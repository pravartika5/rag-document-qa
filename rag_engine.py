"""
RAG Engine - Core Retrieval-Augmented Generation Logic
Handles document ingestion, embedding, storage, and retrieval.
"""

import io
import uuid
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import Document

from app.config import settings


SYSTEM_PROMPT = """You are a precise, helpful assistant that answers questions strictly based on the provided document context.

Rules:
1. Only use information from the provided context to answer.
2. If the answer is not in the context, say: "I couldn't find relevant information in the uploaded documents."
3. Be concise, accurate, and cite which part of the document supports your answer.
4. Never hallucinate or add information outside the provided context.

Context:
{context}
"""


class RAGEngine:
    def __init__(self):
        # Initialize ChromaDB (persistent local vector store)
        self.chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

        # Embeddings model
        self.embeddings = OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            openai_api_key=settings.OPENAI_API_KEY,
        )

        # LLM for generating answers
        self.llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            temperature=0.1,
            openai_api_key=settings.OPENAI_API_KEY,
        )

        # Text splitter for chunking documents
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

        # Prompt template
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("human", "{question}"),
        ])

    async def ingest_document(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        collection_name: str = "default",
    ) -> dict:
        """
        Parse, chunk, embed, and store a document.
        Returns chunk count.
        """
        # Parse document into text
        documents = self._parse_document(file_bytes, filename, content_type)

        # Split into chunks
        chunks = self.text_splitter.split_documents(documents)

        if not chunks:
            raise ValueError("No text could be extracted from the document.")

        # Get or create ChromaDB collection
        collection = self.chroma_client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

        # Embed and store chunks
        texts = [chunk.page_content for chunk in chunks]
        metadatas = [
            {
                "source": filename,
                "chunk_index": i,
                "page": chunk.metadata.get("page", 0),
            }
            for i, chunk in enumerate(chunks)
        ]
        ids = [str(uuid.uuid4()) for _ in chunks]

        # Get embeddings
        embeddings = self.embeddings.embed_documents(texts)

        collection.add(
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
            ids=ids,
        )

        return {"chunks": len(chunks), "filename": filename}

    async def query(
        self,
        question: str,
        collection_name: str = "default",
        top_k: int = 4,
    ) -> dict:
        """
        Retrieve relevant chunks and generate a grounded answer.
        """
        try:
            collection = self.chroma_client.get_collection(name=collection_name)
        except Exception:
            raise ValueError(
                f"Collection '{collection_name}' not found. Please upload documents first."
            )

        # Embed the question
        query_embedding = self.embeddings.embed_query(question)

        # Retrieve top-k relevant chunks
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        if not results["documents"][0]:
            return {
                "answer": "No relevant documents found. Please upload documents first.",
                "sources": [],
            }

        # Build context from retrieved chunks
        retrieved_docs = results["documents"][0]
        retrieved_metas = results["metadatas"][0]
        retrieved_distances = results["distances"][0]

        context = "\n\n---\n\n".join(
            [f"[Source: {m['source']}, Chunk {m['chunk_index']}]\n{doc}"
             for doc, m in zip(retrieved_docs, retrieved_metas)]
        )

        # Generate answer using LLM
        chain = self.prompt | self.llm
        response = chain.invoke({"context": context, "question": question})

        # Build source metadata for response
        sources = [
            {
                "filename": meta["source"],
                "chunk_index": meta["chunk_index"],
                "page": meta.get("page", 0),
                "relevance_score": round(1 - dist, 4),
                "excerpt": doc[:300] + ("..." if len(doc) > 300 else ""),
            }
            for doc, meta, dist in zip(retrieved_docs, retrieved_metas, retrieved_distances)
        ]

        return {
            "answer": response.content,
            "sources": sources,
        }

    def _parse_document(
        self, file_bytes: bytes, filename: str, content_type: str
    ) -> list[Document]:
        """Parse PDF or plain text into LangChain Document objects."""
        if content_type == "application/pdf":
            # Write to temp file for PyPDF loader
            import tempfile, os
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
            try:
                loader = PyPDFLoader(tmp_path)
                docs = loader.load()
            finally:
                os.unlink(tmp_path)
        else:
            # Plain text
            text = file_bytes.decode("utf-8", errors="replace")
            docs = [Document(page_content=text, metadata={"source": filename})]

        return docs

    def list_collections(self) -> list[dict]:
        """List all ChromaDB collections."""
        collections = self.chroma_client.list_collections()
        return [
            {"name": col.name, "count": col.count()}
            for col in collections
        ]

    def delete_collection(self, collection_name: str):
        """Delete a ChromaDB collection."""
        self.chroma_client.delete_collection(name=collection_name)
