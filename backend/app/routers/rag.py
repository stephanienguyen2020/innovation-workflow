from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import tempfile
import os
import shutil

from app.schema.rag import DoclingIngestRequest, DocumentListResponse, IngestResponse, QueryRequest, QueryResponse, TextIngestRequest
from app.services.rag_service import rag_service

router = APIRouter(tags=["rag"], prefix="/rag")

@router.post("/ingest/text", response_model=IngestResponse)
async def ingest_text(request: TextIngestRequest):
    """
    Ingest a single text document into the RAG system.
    """
    try:
        doc_id = await rag_service.ingest_text(request.text, request.metadata)
        return {
            "success": True,
            "message": "Document ingested successfully",
            "document_id": doc_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest document: {str(e)}")

@router.post("/ingest/files", response_model=IngestResponse)
async def ingest_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    """
    Ingest multiple files into the RAG system.
    """
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Save uploaded files to temp directory
        for file in files:
            file_path = os.path.join(temp_dir, file.filename)
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
        
        # Ingest documents
        doc_count = await rag_service.ingest_documents_from_directory(temp_dir)
        
        # Schedule cleanup of temp directory
        background_tasks.add_task(shutil.rmtree, temp_dir)
        
        return {
            "success": True,
            "message": f"Ingested {doc_count} documents",
            "document_count": doc_count
        }
        
    except Exception as e:
        # Clean up temp directory in case of error
        shutil.rmtree(temp_dir)
        raise HTTPException(status_code=500, detail=f"Failed to ingest files: {str(e)}")

@router.post("/ingest/docling", response_model=IngestResponse)
async def ingest_docling(request: DoclingIngestRequest):
    """
    Ingest documents from Docling.
    """
    try:
        doc_count = await rag_service.ingest_documents_from_docling(
            request.project_id,
            request.api_key
        )
        return {
            "success": True,
            "message": f"Ingested {doc_count} documents from Docling",
            "document_count": doc_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest from Docling: {str(e)}")

@router.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """
    Query the RAG system for information.
    """
    try:
        result = await rag_service.query(
            request.query,
            request.top_k,
            request.similarity_threshold
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(limit: int = 100, offset: int = 0):
    """
    List documents in the RAG system.
    """
    try:
        documents = await rag_service.list_documents(limit, offset)
        return {
            "documents": documents,
            "total": len(documents)  # This is approximate since we're limited by the query
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """
    Delete a document from the RAG system.
    """
    try:
        success = await rag_service.delete_document(doc_id)
        if success:
            return {"success": True, "message": f"Document {doc_id} deleted"}
        else:
            return {"success": False, "message": f"Document {doc_id} not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}") 