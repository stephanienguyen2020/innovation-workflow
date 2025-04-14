from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv
import uuid
from datetime import datetime

from llama_index.vector_stores.mongodb import MongoDBAtlasVectorSearch
from llama_index.core import VectorStoreIndex, StorageContext, Document
from llama_index.core import SimpleDirectoryReader
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.readers.docling import DoclingReader
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.retrievers import VectorIndexRetriever
import pymongo

from app.constant.config import MONGODB_CONNECTION_URL, OPENAI_API_KEY
from app.database.database import session_manager

# Load environment variables
load_dotenv()

class RAGService:
    """
    Retrieval-Augmented Generation service using LlamaIndex and MongoDB Atlas Vector Search.
    """
    def __init__(self):
        """Initialize basic configuration for the RAG service."""
        # Configuration
        self.collection_name = "rag_documents"
        self.index_name = "vector_index"
        self.embedding_dimension = 1536  # OpenAI embedding dimension
        
        # Initialize embedding model
        self.embed_model = OpenAIEmbedding(
            model="text-embedding-3-small",
            api_key = OPENAI_API_KEY,
            dimensions=self.embedding_dimension
        )
        
        self._index = None
        self.vector_store = None
        self.storage_context = None

    async def initialize(self):
        """Async initialization of MongoDB components."""
        if self.vector_store is not None:
            return
            
        mongodb_client = pymongo.MongoClient(MONGODB_CONNECTION_URL)
        # Initialize vector store with minimal configuration
        self.vector_store = MongoDBAtlasVectorSearch(
            mongodb_client=mongodb_client,
            db_name=session_manager.db.name,
            collection_name=self.collection_name,
            vector_index_name=self.index_name,
            index_name=self.index_name
        )
        # Create storage context
        self.storage_context = StorageContext.from_defaults(vector_store=self.vector_store)

    @property
    def index(self):
        """Lazy load the vector index."""
        if self._index is None:
            self._index = VectorStoreIndex.from_vector_store(
                vector_store=self.vector_store,
                embed_model=self.embed_model
            )
        return self._index

    async def query(
        self, 
        query_text: str, 
        top_k: int = 3,
        similarity_threshold: float = 0.7
    ) -> Dict[str, Any]:
        """
        Query the vector store for relevant documents.
        
        Args:
            query_text: Query text
            top_k: Number of documents to retrieve
            similarity_threshold: Minimum similarity score (0-1)
            
        Returns:
            Query results
        """
        # Use regular query engine for simple queries
        retriever = VectorIndexRetriever(
            index=self.index,
            similarity_top_k=top_k,
            similarity_cutoff=similarity_threshold
        )
        
        query_engine = RetrieverQueryEngine.from_args(
            retriever=retriever,
            embed_model=self.embed_model
        )
        
        response = query_engine.query(query_text)
        
        # Format results
        result = {
            "query": query_text,
            "response": str(response),
            "source_nodes": []
        }
        
        # Add source information
        if hasattr(response, 'source_nodes'):
            for node in response.source_nodes:
                result["source_nodes"].append({
                    "text": node.text,
                    "score": node.score if hasattr(node, 'score') else None,
                    "metadata": node.metadata
                })
        
        return result

    async def ingest_documents_from_directory(
        self, 
        directory_path: str,
        filename: str = None
    ) -> Tuple[str, List[str]]:
        """
        Ingest documents from a directory into the vector store.
        
        Args:
            directory_path: Path to directory containing documents
            filename: Original filename (optional)
            
        Returns:
            Tuple of (parent_doc_id, list of chunk doc_ids)
        """
        # Generate a parent document ID
        parent_doc_id = str(uuid.uuid4())
        
        # Load documents from directory
        documents = SimpleDirectoryReader(directory_path).load_data()
        
        for doc in documents:
            # Add metadata to track relationship and source
            doc.metadata.update({
                "parent_doc_id": parent_doc_id,
                "original_filename": filename,
                "ingestion_timestamp": datetime.utcnow().isoformat(),
                "is_chunk": True
            })
        
        # Create index from documents
        index = VectorStoreIndex.from_documents(
            documents,
            storage_context=self.storage_context,
            embed_model=self.embed_model
        )
        
        # Store index for future queries
        self._index = index
        
        return parent_doc_id

    async def ingest_documents_from_docling(self, project_id: str, api_key: str) -> int:
        """
        Ingest documents from Docling into the vector store.
        
        Args:
            project_id: Docling project ID
            api_key: Docling API key
            
        Returns:
            Number of documents ingested
        """
        # Load documents from Docling
        reader = DoclingReader(api_key=api_key)
        documents = reader.load_data(project_id=project_id)
        
        # Create index from documents
        index = VectorStoreIndex.from_documents(
            documents,
            storage_context=self.storage_context,
            embed_model=self.embed_model
        )
        
        # Store index for future queries
        self._index = index
        
        return len(documents)

    async def ingest_text(self, text: str, metadata: Dict[str, Any] = None) -> str:
        """
        Ingest a single text document into the vector store.
        
        Args:
            text: Text content to ingest
            metadata: Optional metadata for the document
            
        Returns:
            Document ID
        """
        print("Ingesting text document...")
        # Ensure vector search index exists
        print("Ensured vector search index")
        # Create document
        document = Document(text=text, metadata=metadata or {})
        
        # Add document to index
        if self._index is None:
            self._index = VectorStoreIndex.from_documents(
                [document],
                storage_context=self.storage_context,
                embed_model=self.embed_model
            )
        else:
            self._index.insert(document)
        
        return document.doc_id

    async def delete_document(self, doc_id: str) -> bool:
        """
        Delete a document from the vector store.
        
        Args:
            doc_id: Document ID to delete
            
        Returns:
            True if document was deleted
        """
        if self._index is None:
            return False
        
        return self._index.delete(doc_id)

    async def list_documents(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        List documents in the vector store.
        
        Args:
            limit: Maximum number of documents to return
            offset: Number of documents to skip
            
        Returns:
            List of documents
        """
        collection = session_manager.db[self.collection_name]
        
        cursor = collection.find({}, {
            "_id": 1,
            "text": 1,
            "metadata": 1
        }).skip(offset).limit(limit)
        
        documents = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            documents.append(doc)
        
        return documents

# Create a singleton instance
rag_service = RAGService() 