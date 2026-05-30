"""
RAG Document Q&A System - FastAPI Backend
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn

from app.rag_engine import RAGEngine
from app.config import settings

app = FastAPI(
    title="RAG Document Q&A API",
    description="A Retrieval-Augmented Generation system for intelligent document Q&A",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_engine = RAGEngine()


class QueryRequest(BaseModel):
    question: str
    collection_name: Optional[str] = "default"
    top_k: Optional[int] = 4


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]
    collection_name: str


@app.get("/")
async def root():
    return {"message": "RAG Document Q&A API is running 🚀", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/upload", summary="Upload and index a document")
async def upload_document(
    file: UploadFile = File(...),
    collection_name: Optional[str] = "default",
):
    """
    Upload a PDF or TXT file and index it into the vector store.
    """
    allowed_types = ["application/pdf", "text/plain"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not supported. Use PDF or TXT.",
        )

    contents = await file.read()

    try:
        result = await rag_engine.ingest_document(
            file_bytes=contents,
            filename=file.filename,
            content_type=file.content_type,
            collection_name=collection_name,
        )
        return JSONResponse(
            content={
                "message": "Document indexed successfully",
                "filename": file.filename,
                "chunks_indexed": result["chunks"],
                "collection_name": collection_name,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", response_model=QueryResponse, summary="Ask a question about your documents")
async def query_documents(request: QueryRequest):
    """
    Ask a natural language question and get an answer grounded in uploaded documents.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = await rag_engine.query(
            question=request.question,
            collection_name=request.collection_name,
            top_k=request.top_k,
        )
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"],
            collection_name=request.collection_name,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/collections", summary="List all document collections")
async def list_collections():
    """List all indexed document collections."""
    collections = rag_engine.list_collections()
    return {"collections": collections}


@app.delete("/collections/{collection_name}", summary="Delete a collection")
async def delete_collection(collection_name: str):
    """Delete a document collection and all its embeddings."""
    try:
        rag_engine.delete_collection(collection_name)
        return {"message": f"Collection '{collection_name}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
