# ⬡ DocuMind — RAG Document Q&A System

[![CI](https://github.com/YOUR_USERNAME/rag-document-qa/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/rag-document-qa/actions)
[![Python](https://img.shields.io/badge/Python-3.11-3776ab?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)](https://react.dev)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-1c3c3c?logo=langchain&logoColor=white)](https://langchain.com)

> Upload any PDF or text document and ask questions about it in natural language. Answers are grounded **exclusively** in your documents — no hallucination.

---

## ✨ What is RAG?

**Retrieval-Augmented Generation (RAG)** is a technique that combines:

1. **Retrieval** — finding the most relevant passages from your documents using vector similarity search
2. **Generation** — using an LLM to synthesize a grounded, accurate answer from those passages

This prevents hallucination: the LLM can only use information it actually retrieved from your files.

```
User Question
     │
     ▼
[Embed Question] ──► [Vector Search in ChromaDB] ──► [Top-K Relevant Chunks]
                                                              │
                                                             ▼
                                              [LLM: "Answer using ONLY this context"]
                                                              │
                                                             ▼
                                                     Grounded Answer + Sources
```

---

## 🏗️ Architecture

```
rag-document-qa/
├── backend/                  # Python FastAPI service
│   ├── app/
│   │   ├── main.py           # REST API endpoints
│   │   ├── rag_engine.py     # Core RAG logic
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   └── __init__.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                 # React + Vite UI
│   ├── src/
│   │   ├── App.jsx           # Main app component
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI
├── docker-compose.yml
└── .gitignore
```

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **API** | FastAPI | REST endpoints, file upload, async |
| **RAG Framework** | LangChain | Document loading, chunking, chains |
| **Embeddings** | OpenAI `text-embedding-3-small` | Semantic vector representation |
| **Vector Store** | ChromaDB | Local persistent vector database |
| **LLM** | OpenAI `gpt-4o-mini` | Grounded answer generation |
| **PDF Parsing** | PyPDF | Extracts text from uploaded PDFs |
| **Frontend** | React 18 + Vite | Chat UI with source citations |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- OpenAI API key → [platform.openai.com](https://platform.openai.com)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/rag-document-qa.git
cd rag-document-qa
```

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

### 3. Frontend setup

```bash
cd frontend

npm install

# Optional: configure API URL
cp .env.example .env.local

npm run dev
```

App available at: **http://localhost:3000**

---

## 🐳 Docker (One Command)

```bash
# Set your API key
echo "OPENAI_API_KEY=sk-your-key-here" > backend/.env

# Start everything
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8000
- Swagger docs → http://localhost:8000/docs

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/upload` | Upload & index a PDF or TXT file |
| `POST` | `/query` | Ask a question, get grounded answer |
| `GET` | `/collections` | List all document collections |
| `DELETE` | `/collections/{name}` | Delete a collection |

### Upload a document

```bash
curl -X POST http://localhost:8000/upload \
  -F "file=@report.pdf" \
  -F "collection_name=my-docs"
```

### Ask a question

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the key findings?",
    "collection_name": "my-docs",
    "top_k": 4
  }'
```

**Response:**
```json
{
  "answer": "The key findings are...",
  "sources": [
    {
      "filename": "report.pdf",
      "chunk_index": 3,
      "page": 2,
      "relevance_score": 0.91,
      "excerpt": "..."
    }
  ],
  "collection_name": "my-docs"
}
```

---

## ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *(required)* | Your OpenAI API key |
| `LLM_MODEL` | `gpt-4o-mini` | LLM for answer generation |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `CHUNK_SIZE` | `800` | Characters per document chunk |
| `CHUNK_OVERLAP` | `150` | Overlap between consecutive chunks |
| `CHROMA_PERSIST_DIR` | `./chroma_db` | Where ChromaDB stores vectors |

---

## 🗺️ Roadmap

- [ ] Multi-document cross-referencing
- [ ] Authentication & per-user collections
- [ ] Streaming responses (SSE)
- [ ] Support DOCX, HTML, Markdown files
- [ ] Deploy to Railway / Render one-click button
- [ ] Swap OpenAI for local Ollama models

---

## 🤝 Contributing

PRs are welcome! Please open an issue first to discuss what you'd like to change.

---

