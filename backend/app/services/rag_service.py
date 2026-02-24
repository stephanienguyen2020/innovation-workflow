from typing import List, Dict, Any
from dotenv import load_dotenv
import uuid
from datetime import datetime
import os
import pdfplumber
import PyPDF2

from llama_index.core import Document, SummaryIndex
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.llms.gemini import Gemini
from app.constant.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
)
from app.database.database import session_manager
from google.cloud.firestore_v1.base_query import FieldFilter

# Load environment variables
load_dotenv()

class RAGService:
    """
    Retrieval-Augmented Generation service using LlamaIndex and Firestore.
    Documents are stored in Firestore and queried via LlamaIndex SummaryIndex.
    """
    def __init__(self):
        """Initialize basic configuration for the RAG service."""
        self.collection_name = "rag_documents"

    def _create_llm(self):
        """Create a Gemini LLM instance."""
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required for Gemini models")

        return Gemini(
            model=GEMINI_MODEL,
            api_key=GEMINI_API_KEY,
            temperature=0.1,
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ],
        )

    async def _load_documents_from_firestore(self, document_id: str = None) -> List[Document]:
        """Load documents from Firestore, optionally filtered by parent document ID."""
        collection = session_manager.client.collection(self.collection_name)

        if document_id:
            docs_snapshot = await collection.where(filter=FieldFilter("parent_doc_id", "==", document_id)).get()
        else:
            docs_snapshot = await collection.get()

        docs = []
        for doc in docs_snapshot:
            data = doc.to_dict()
            text = data.get("text", "")
            if text.strip():
                docs.append(
                    Document(
                        text=text,
                        metadata=data.get("metadata", {})
                    )
                )

        return docs

    async def get_document_text(self, document_id: str) -> str:
        """
        Get raw document text from Firestore without any LLM processing.
        Much faster than using the query engine for simple text retrieval.
        """
        docs = await self._load_documents_from_firestore(document_id)
        if not docs:
            return ""
        return "\n\n".join(doc.text for doc in docs)

    async def query(
        self,
        query_text: str,
        top_k: int = 3,
        similarity_threshold: float = 0.7
    ) -> Dict[str, Any]:
        """
        Query documents using SummaryIndex.
        """
        print(f"🔎 Querying documents for: '{query_text}'")

        docs = await self._load_documents_from_firestore()
        if not docs:
            return {"query": query_text, "response": "No documents found.", "source_nodes": []}

        llm = self._create_llm()
        index = SummaryIndex.from_documents(docs)
        query_engine = index.as_query_engine(llm=llm, response_mode="compact")

        response = query_engine.query(query_text)
        print(f"🤖 Query response length: {len(str(response))}")

        result = {
            "query": query_text,
            "response": str(response),
            "source_nodes": []
        }

        if hasattr(response, 'source_nodes'):
            for node in response.source_nodes:
                result["source_nodes"].append({
                    "text": node.text,
                    "score": node.score if hasattr(node, 'score') else None,
                    "metadata": node.metadata
                })

        return result

    async def create_document_query_engine(
        self,
        document_id: str = None,
        similarity_top_k: int = 3,
        stage_number: int = None,
    ):
        """
        Create a query engine for document analysis.
        Loads document chunks from Firestore and builds a SummaryIndex.
        """
        print(f"🛠️ Creating document query engine (doc_id={document_id}, stage={stage_number})")

        llm = self._create_llm()

        docs = await self._load_documents_from_firestore(document_id)

        if docs:
            try:
                summary_index = SummaryIndex.from_documents(docs)
            except Exception:
                sanitized_docs = [Document(text=doc.text, metadata={}) for doc in docs]
                summary_index = SummaryIndex.from_documents(sanitized_docs)

            return summary_index.as_query_engine(
                llm=llm,
                response_mode="compact"
            )

        # No documents found — return a basic query engine with empty index
        empty_index = SummaryIndex.from_documents([Document(text="No documents available.")])
        return empty_index.as_query_engine(llm=llm, response_mode="compact")

    async def ingest_documents_from_directory(
        self,
        directory_path: str,
        filename: str = None
    ) -> str:
        """
        Ingest a PDF file using PyPDF2 for text and pdfplumber for tables.
        Each page and table is stored in Firestore.

        Args:
            directory_path: Path to directory containing the PDF file
            filename: Original filename (required for metadata)

        Returns:
            Parent document ID
        """
        if not filename:
            raise ValueError("Filename is required for document ingestion")

        file_path = os.path.join(directory_path, filename)
        if not os.path.exists(file_path):
            raise ValueError(f"File not found: {file_path}")

        parent_doc_id = str(uuid.uuid4())
        pdf_reader = PyPDF2.PdfReader(file_path)

        # Process PDF page by page
        for page_num, page in enumerate(pdf_reader.pages, 1):
            text = page.extract_text()

            if text.strip():
                metadata = {
                    "parent_doc_id": parent_doc_id,
                    "original_filename": filename,
                    "page_number": page_num,
                    "content_type": "text",
                    "ingestion_timestamp": datetime.utcnow().isoformat(),
                    "is_chunk": True,
                    "source": file_path
                }
                doc_id = str(uuid.uuid4())

                await session_manager.client.collection(self.collection_name).document(doc_id).set({
                    "text": text,
                    "metadata": metadata,
                    "parent_doc_id": parent_doc_id,
                    "ingested_at": datetime.utcnow(),
                    "content_type": "text"
                })

        # Extract tables with pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                tables = page.extract_tables()

                for table_num, table in enumerate(tables, 1):
                    if table:
                        table_text = "\n".join([
                            " | ".join([str(cell) if cell else "" for cell in row])
                            for row in table
                        ])

                        if table_text.strip():
                            metadata = {
                                "parent_doc_id": parent_doc_id,
                                "original_filename": filename,
                                "page_number": page_num,
                                "table_number": table_num,
                                "content_type": "table",
                                "ingestion_timestamp": datetime.utcnow().isoformat(),
                                "is_chunk": True,
                                "source": file_path
                            }
                            doc_id = str(uuid.uuid4())

                            await session_manager.client.collection(self.collection_name).document(doc_id).set({
                                "text": table_text,
                                "metadata": metadata,
                                "parent_doc_id": parent_doc_id,
                                "ingested_at": datetime.utcnow(),
                                "content_type": "table"
                            })

        return parent_doc_id

    async def ingest_text(self, text: str, metadata: Dict[str, Any] = None) -> str:
        """
        Ingest a single text document into Firestore.

        Args:
            text: Text content to ingest
            metadata: Optional metadata for the document

        Returns:
            Parent document ID (used to look up the document later)
        """
        parent_doc_id = str(uuid.uuid4())
        doc_id = str(uuid.uuid4())

        await session_manager.client.collection(self.collection_name).document(doc_id).set({
            "text": text,
            "metadata": metadata or {},
            "parent_doc_id": parent_doc_id,
            "ingested_at": datetime.utcnow(),
            "content_type": "text"
        })

        return parent_doc_id

    async def delete_document(self, doc_id: str) -> bool:
        """
        Delete a document from Firestore.

        Args:
            doc_id: Document ID to delete

        Returns:
            True if document was deleted
        """
        await session_manager.client.collection(self.collection_name).document(doc_id).delete()
        return True

    async def list_documents(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        List documents in the RAG system.

        Args:
            limit: Maximum number of documents to return
            offset: Number of documents to skip

        Returns:
            List of documents
        """
        collection = session_manager.client.collection(self.collection_name)
        query = collection.order_by("ingested_at").offset(offset).limit(limit)
        docs = await query.get()
        documents = []
        for doc in docs:
            data = doc.to_dict()
            documents.append({
                "id": doc.id,
                "text": data.get("text", ""),
                "metadata": data.get("metadata", {})
            })
        return documents

# Create a singleton instance
rag_service = RAGService()
