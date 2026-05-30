import { useState, useRef, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Icons (inline SVG) ──────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);

const BotIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ animation: "spin 1s linear infinite" }}>
    <path d="M21 12a9 9 0 11-6.22-8.56"/>
  </svg>
);

// ── Components ──────────────────────────────────────────────────────────────
function SourceCard({ source }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="source-card" onClick={() => setOpen(!open)}>
      <div className="source-header">
        <FileIcon />
        <span className="source-name">{source.filename}</span>
        <span className="source-score">{(source.relevance_score * 100).toFixed(0)}% match</span>
        <span className="source-toggle">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="source-excerpt">
          <span className="excerpt-label">Page {source.page + 1} · Chunk {source.chunk_index}</span>
          <p>"{source.excerpt}"</p>
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isBot = msg.role === "assistant";
  return (
    <div className={`message ${isBot ? "message-bot" : "message-user"}`}>
      <div className="message-avatar">
        {isBot ? <BotIcon /> : <UserIcon />}
      </div>
      <div className="message-body">
        <div className="message-text">{msg.content}</div>
        {isBot && msg.sources && msg.sources.length > 0 && (
          <div className="sources-section">
            <p className="sources-label">📎 Sources ({msg.sources.length})</p>
            {msg.sources.map((s, i) => <SourceCard key={i} source={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [collection, setCollection] = useState("default");
  const [collections, setCollections] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! Upload a PDF or text document, then ask me anything about it. I'll answer using only information found in your documents.",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchCollections();
  }, []);

  async function fetchCollections() {
    try {
      const res = await fetch(`${API_BASE}/collections`);
      const data = await res.json();
      setCollections(data.collections || []);
    } catch {}
  }

  async function handleUpload(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("collection_name", collection);

      try {
        const res = await fetch(`${API_BASE}/upload?collection_name=${collection}`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Upload failed");

        setUploadedFiles((prev) => [
          ...prev,
          { name: file.name, chunks: data.chunks_indexed },
        ]);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✅ **${file.name}** indexed successfully — ${data.chunks_indexed} chunks stored. You can now ask questions about this document.`,
          },
        ]);
        fetchCollections();
      } catch (e) {
        setError(e.message);
      }
    }
    setUploading(false);
  }

  async function handleQuery() {
    if (!question.trim() || querying) return;
    const q = question.trim();
    setQuestion("");
    setQuerying(true);
    setError(null);

    setMessages((prev) => [...prev, { role: "user", content: q }]);

    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, collection_name: collection, top_k: 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Query failed");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (e) {
      setError(e.message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Error: ${e.message}` },
      ]);
    }
    setQuerying(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  }

  async function deleteCollection(name) {
    await fetch(`${API_BASE}/collections/${name}`, { method: "DELETE" });
    fetchCollections();
    if (name === collection) setCollection("default");
  }

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">⬡</div>
          <div>
            <h1>DocuMind</h1>
            <p>RAG-Powered Document Intelligence</p>
          </div>
        </div>
        <div className="header-collection">
          <label>Collection</label>
          <div className="collection-input-row">
            <input
              value={collection}
              onChange={(e) => setCollection(e.target.value.replace(/\s/g, "_"))}
              placeholder="collection-name"
            />
          </div>
        </div>
      </header>

      <div className="layout">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <section className="sidebar-section">
            <h3>Upload Documents</h3>
            <div
              className={`drop-zone ${dragOver ? "drag-over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleUpload(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt"
                style={{ display: "none" }}
                onChange={(e) => handleUpload(e.target.files)}
              />
              <div className="drop-icon">
                {uploading ? <SpinnerIcon /> : <UploadIcon />}
              </div>
              <p>{uploading ? "Indexing..." : "Drop PDF / TXT here"}</p>
              <span>or click to browse</span>
            </div>
          </section>

          {uploadedFiles.length > 0 && (
            <section className="sidebar-section">
              <h3>Indexed Files</h3>
              <ul className="file-list">
                {uploadedFiles.map((f, i) => (
                  <li key={i}>
                    <FileIcon />
                    <span className="file-name">{f.name}</span>
                    <span className="file-chunks">{f.chunks} chunks</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {collections.length > 0 && (
            <section className="sidebar-section">
              <h3>Collections</h3>
              <ul className="collection-list">
                {collections.map((c) => (
                  <li
                    key={c.name}
                    className={c.name === collection ? "active" : ""}
                    onClick={() => setCollection(c.name)}
                  >
                    <span className="col-dot" />
                    <span className="col-name">{c.name}</span>
                    <span className="col-count">{c.count}</span>
                    <button
                      className="col-delete"
                      onClick={(e) => { e.stopPropagation(); deleteCollection(c.name); }}
                    ><TrashIcon /></button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="sidebar-section tips">
            <h3>How it works</h3>
            <ol>
              <li>Upload your PDF or text</li>
              <li>Document is chunked &amp; embedded</li>
              <li>Your question retrieves top chunks</li>
              <li>LLM answers from those chunks only</li>
            </ol>
          </section>
        </aside>

        {/* ── Chat ── */}
        <main className="chat-panel">
          {error && (
            <div className="error-banner">⚠️ {error}</div>
          )}

          <div className="messages">
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {querying && (
              <div className="message message-bot">
                <div className="message-avatar"><BotIcon /></div>
                <div className="message-body">
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="input-row">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your documents..."
              rows={1}
            />
            <button
              className="send-btn"
              onClick={handleQuery}
              disabled={!question.trim() || querying}
            >
              {querying ? <SpinnerIcon /> : <SendIcon />}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,wght@0,300;0,600;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0d0f14;
    --surface: #13161e;
    --surface2: #1a1e28;
    --border: #252936;
    --accent: #e8c96d;
    --accent2: #7c9cf8;
    --text: #d4d8e8;
    --text-muted: #626880;
    --text-dim: #3d4158;
    --green: #56d4a0;
    --red: #f08080;
    --radius: 12px;
    --font-body: 'DM Mono', monospace;
    --font-display: 'Fraunces', serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 13.5px; }

  .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

  /* Header */
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 24px; border-bottom: 1px solid var(--border);
    background: var(--surface); flex-shrink: 0;
  }
  .header-brand { display: flex; align-items: center; gap: 12px; }
  .brand-icon { font-size: 28px; color: var(--accent); line-height: 1; }
  .header-brand h1 { font-family: var(--font-display); font-size: 22px; font-weight: 600; color: #fff; letter-spacing: -0.5px; }
  .header-brand p { color: var(--text-muted); font-size: 11px; margin-top: 1px; }
  .header-collection { display: flex; align-items: center; gap: 10px; }
  .header-collection label { color: var(--text-muted); font-size: 11px; }
  .header-collection input {
    background: var(--surface2); border: 1px solid var(--border); color: var(--accent);
    padding: 6px 10px; border-radius: 6px; font-family: var(--font-body); font-size: 12px; outline: none;
  }
  .header-collection input:focus { border-color: var(--accent); }

  /* Layout */
  .layout { display: flex; flex: 1; overflow: hidden; }

  /* Sidebar */
  .sidebar {
    width: 260px; flex-shrink: 0; background: var(--surface);
    border-right: 1px solid var(--border); overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 20px;
  }
  .sidebar-section h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 10px; }

  /* Drop Zone */
  .drop-zone {
    border: 1.5px dashed var(--border); border-radius: var(--radius);
    padding: 20px; text-align: center; cursor: pointer; transition: all 0.2s;
    background: var(--surface2);
  }
  .drop-zone:hover, .drop-zone.drag-over { border-color: var(--accent); background: rgba(232,201,109,0.05); }
  .drop-icon { color: var(--accent); margin-bottom: 8px; display: flex; justify-content: center; }
  .drop-zone p { color: var(--text); font-size: 12px; margin-bottom: 4px; }
  .drop-zone span { color: var(--text-muted); font-size: 11px; }

  /* File list */
  .file-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .file-list li { display: flex; align-items: center; gap: 6px; background: var(--surface2); padding: 7px 9px; border-radius: 7px; }
  .file-list svg { color: var(--accent2); flex-shrink: 0; }
  .file-name { flex: 1; color: var(--text); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-chunks { color: var(--text-muted); font-size: 10px; white-space: nowrap; }

  /* Collections */
  .collection-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .collection-list li {
    display: flex; align-items: center; gap: 7px; padding: 7px 9px; border-radius: 7px;
    cursor: pointer; border: 1px solid transparent; transition: all 0.15s;
  }
  .collection-list li:hover { background: var(--surface2); }
  .collection-list li.active { background: rgba(232,201,109,0.08); border-color: rgba(232,201,109,0.2); }
  .col-dot { width: 6px; height: 6px; background: var(--green); border-radius: 50%; flex-shrink: 0; }
  .col-name { flex: 1; color: var(--text); font-size: 11.5px; }
  .col-count { color: var(--text-muted); font-size: 10px; }
  .col-delete { background: none; border: none; cursor: pointer; color: var(--text-dim); padding: 2px; border-radius: 4px; display: flex; }
  .col-delete:hover { color: var(--red); }

  /* Tips */
  .tips ol { padding-left: 16px; color: var(--text-muted); font-size: 11.5px; line-height: 1.8; }

  /* Chat Panel */
  .chat-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .messages { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
  .messages::-webkit-scrollbar { width: 4px; }
  .messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* Messages */
  .message { display: flex; gap: 12px; }
  .message-bot { align-items: flex-start; }
  .message-user { flex-direction: row-reverse; }

  .message-avatar {
    width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .message-bot .message-avatar { background: rgba(232,201,109,0.1); border: 1px solid rgba(232,201,109,0.2); color: var(--accent); }
  .message-user .message-avatar { background: rgba(124,156,248,0.1); border: 1px solid rgba(124,156,248,0.2); color: var(--accent2); }

  .message-body { max-width: 80%; display: flex; flex-direction: column; gap: 10px; }
  .message-user .message-body { align-items: flex-end; }

  .message-text {
    padding: 12px 16px; border-radius: 12px; line-height: 1.7; font-size: 13.5px;
    white-space: pre-wrap; word-break: break-word;
  }
  .message-bot .message-text { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 2px 12px 12px 12px; }
  .message-user .message-text { background: rgba(124,156,248,0.12); border: 1px solid rgba(124,156,248,0.2); color: var(--text); border-radius: 12px 2px 12px 12px; }

  /* Sources */
  .sources-section { display: flex; flex-direction: column; gap: 6px; }
  .sources-label { font-size: 10.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
  .source-card {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 12px; cursor: pointer; transition: border-color 0.15s; font-size: 12px;
  }
  .source-card:hover { border-color: var(--accent2); }
  .source-header { display: flex; align-items: center; gap: 7px; }
  .source-header svg { color: var(--accent2); flex-shrink: 0; }
  .source-name { flex: 1; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .source-score { color: var(--green); font-size: 10.5px; }
  .source-toggle { color: var(--text-muted); font-size: 10px; }
  .source-excerpt { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
  .excerpt-label { font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 4px; }
  .source-excerpt p { color: var(--text-muted); font-size: 11.5px; line-height: 1.6; font-style: italic; }

  /* Typing indicator */
  .typing-indicator {
    display: flex; align-items: center; gap: 4px; padding: 14px 16px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px; width: fit-content;
  }
  .typing-indicator span {
    width: 6px; height: 6px; background: var(--accent); border-radius: 50%;
    animation: bounce 1.2s infinite;
  }
  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

  /* Input */
  .input-row {
    display: flex; align-items: flex-end; gap: 10px; padding: 16px 24px;
    border-top: 1px solid var(--border); background: var(--surface);
  }
  .input-row textarea {
    flex: 1; background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 12px 14px; font-family: var(--font-body); font-size: 13.5px;
    resize: none; outline: none; line-height: 1.5; max-height: 120px;
  }
  .input-row textarea:focus { border-color: var(--accent2); }
  .input-row textarea::placeholder { color: var(--text-dim); }

  .send-btn {
    width: 42px; height: 42px; border-radius: 10px; border: none; cursor: pointer;
    background: var(--accent); color: #0d0f14; display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; flex-shrink: 0;
  }
  .send-btn:hover:not(:disabled) { background: #f5d98a; }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .error-banner { background: rgba(240,128,128,0.1); border: 1px solid rgba(240,128,128,0.3); color: var(--red); padding: 10px 16px; font-size: 12.5px; }

  @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
