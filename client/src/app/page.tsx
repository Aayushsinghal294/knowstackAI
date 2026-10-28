
"use client";

import { useState } from "react";
import { useEffect } from "react";

type Citation = {
  source_id: string;
  document_id: number;
  chunk_id: number;
  filename: string;
  page_number: number | null;
  chunk_index: number;
  similarity: number;
};

type DocumentItem = {
  id: number;
  filename: string;
  file_type: string;
  status: string;
  created_at: string;
  chunks_created: number;
};

type Conversation = {
  id: number;
  title: string;
  created_at: string;
};

type ConversationMessage = {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  created_at: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentMessage, setDocumentMessage] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<number | null>(null);

  useEffect(() => {
    void loadDocuments();
    void loadConversations();
  }, []);

  async function loadDocuments() {
  setDocumentError("");

  try {
    const response = await fetch(`${API_URL}/api/v1/documents`);

    if (!response.ok) {
      throw new Error("Could not load documents.");
    }

    const data: DocumentItem[] = await response.json();
    setDocuments(data);
  } catch (err) {
    setDocumentError(
      err instanceof Error ? err.message : "Failed to load documents."
    );
  }
}

async function loadConversations() {
  try {
    const response = await fetch(`${API_URL}/api/v1/conversations`);
    if (!response.ok) {
      throw new Error("Could not load conversations.");
    }
    const data: Conversation[] = await response.json();
    setConversations(data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to load conversations.");
  }
}

async function createConversation() {
  setConversationLoading(true);
  setError("");

  try {
    const response = await fetch(`${API_URL}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New conversation" }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.detail || "Could not create conversation.");
    }

    const conversation: Conversation = data;
    setConversations((previous) => [
      conversation,
      ...previous.filter((item) => item.id !== conversation.id),
    ]);
    setActiveConversationId(conversation.id);
    setMessages([]);
    setQuestion("");
    setError("");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Could not create conversation.");
  } finally {
    setConversationLoading(false);
  }
}

async function loadConversation(conversationId: number) {
  setConversationLoading(true);
  setError("");

  try {
    const response = await fetch(
      `${API_URL}/api/v1/conversations/${conversationId}`
    );
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.detail || "Could not load conversation.");
    }

    const savedMessages: ConversationMessage[] = data.messages || [];
    setActiveConversationId(data.id);
    setMessages(
    savedMessages.map((message) => ({
    role: message.role,
    content: message.content,
    citations: message.citations || [],
  }))
);
    setQuestion("");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Could not load conversation.");
  } finally {
    setConversationLoading(false);
  }
}

async function deleteConversation(conversationId: number) {
  const confirmed = window.confirm(
    "Delete this conversation and all its messages? This action cannot be undone."
  );

  if (!confirmed) return;

  setDeletingConversationId(conversationId);
  setError("");

  try {
    const response = await fetch(
      `${API_URL}/api/v1/conversations/${conversationId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.detail || "Could not delete conversation.");
    }

    const remaining = conversations.filter(
      (conversation) => conversation.id !== conversationId
    );
    setConversations(remaining);

    if (activeConversationId === conversationId) {
      if (remaining.length > 0) {
        await loadConversation(remaining[0].id);
      } else {
        setActiveConversationId(null);
        setMessages([]);
        setQuestion("");
      }
    }
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Could not delete conversation."
    );
  } finally {
    setDeletingConversationId(null);
  }
}

async function uploadDocument(file: File) {
  setUploading(true);
  setDocumentError("");
  setDocumentMessage("");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${API_URL}/api/v1/documents/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.detail || "Document upload failed.");
    }

    setDocumentMessage(`${file.name} uploaded successfully.`);
    await loadDocuments();
  } catch (err) {
    setDocumentError(
      err instanceof Error ? err.message : "Document upload failed."
    );
  } finally {
    setUploading(false);
  }
}

async function deleteDocument(id: number) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this document?"
  );

  if (!confirmed) return;

  setDocumentError("");
  setDocumentMessage("");

  try {
    const response = await fetch(
      `${API_URL}/api/v1/documents/${id}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.detail || "Could not delete document.");
    }

    setDocumentMessage("Document deleted successfully.");
    await loadDocuments();
  } catch (err) {
    setDocumentError(
      err instanceof Error ? err.message : "Could not delete document."
    );
  }
}

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = question.trim();
    if (!text || loading || conversationLoading || deletingConversationId !== null) return;

    setQuestion("");
    setError("");
    setLoading(true);
    setMessages((previous) => [...previous, { role: "user", content: text }]);

    try {
      let conversationId = activeConversationId;

      // Create a conversation automatically if the user starts chatting
      // before selecting or creating one.
      if (conversationId === null) {
        const createResponse = await fetch(`${API_URL}/api/v1/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text.slice(0, 60) || "New conversation" }),
        });
        const createdData = await createResponse.json().catch(() => null);

        if (!createResponse.ok) {
          throw new Error(
            createdData?.detail || "Could not create conversation."
          );
        }

        const created: Conversation = createdData;
        conversationId = created.id;
        setActiveConversationId(created.id);
        setConversations((previous) => [
          created,
          ...previous.filter((item) => item.id !== created.id),
        ]);
      }

      const response = await fetch(
        `${API_URL}/api/v1/conversations/${conversationId}/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, top_k: 5 }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || `Request failed (${response.status})`
        );
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations || [],
        },
      ]);

      // Refresh titles after the backend automatically names a conversation.
      await loadConversations();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6">
        <header className="flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold">
            K
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">
              KnowStack AI
            </h1>
            <p className="text-sm text-slate-400">
              Your enterprise knowledge assistant
            </p>
          </div>

          <div className="ml-auto hidden items-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            RAG assistant
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 gap-6 py-8 lg:grid-cols-[1fr_320px]">
          <div className="flex min-w-0 flex-col">
          {messages.length === 0 ? (
            <div className="m-auto w-full max-w-2xl py-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl">
                ✦
              </div>

              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Knowledge, at your fingertips.
              </h2>

              <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">
                Ask a question about your uploaded documents.
                KnowStack retrieves relevant passages and uses them
                to generate an evidence-grounded answer.
              </p>

              <button
                onClick={() =>
                  setQuestion("What is RAG and how does it work?")
                }
                className="mt-7 rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 transition hover:border-blue-500 hover:bg-slate-900"
              >
                Try: What is RAG and how does it work?
              </button>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              {messages.map((message, index) => (
                <article
                  key={`${index}-${message.role}`}
                  className={`rounded-2xl p-4 sm:p-5 ${
                    message.role === "user"
                      ? "ml-8 bg-blue-600/15 sm:ml-20"
                      : "mr-4 border border-slate-800 bg-slate-900 sm:mr-12"
                  }`}
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {message.role === "user" ? "You" : "KnowStack AI"}
                  </p>

                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200 sm:text-base">
                    {message.content}
                  </div>

                  {message.role === "assistant" &&
                    message.citations &&
                    message.citations.length > 0 && (
                      <div className="mt-5 border-t border-slate-700 pt-4">
                        <h3 className="mb-3 text-sm font-semibold text-slate-300">
                          Sources
                        </h3>

                        <div className="flex flex-col gap-2">
                          {message.citations.map((citation) => (
                            <div
                              key={citation.source_id}
                              className="rounded-lg border border-slate-700 bg-slate-950/70 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-medium text-blue-300">
                                  [{citation.source_id}] {citation.filename}
                                </span>

                                <span className="text-xs text-slate-500">
                                  {citation.page_number != null
                                    ? `Page ${citation.page_number}`
                                    : `Chunk ${citation.chunk_index}`}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-slate-500">
                                Similarity:{" "}
                                {(citation.similarity * 100).toFixed(1)}%
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </article>
              ))}

              {loading && (
                <div className="mr-12 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <p className="animate-pulse text-sm text-slate-400">
                    Searching documents and generating an answer...
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mx-auto mt-5 w-full max-w-3xl rounded-xl border border-red-900 bg-red-950/50 p-4 text-sm text-red-300"
            >
              {error}
            </div>
          )}
          </div>

          <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900 p-4">
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Conversations</h2>
        <button
          type="button"
          onClick={() => void createConversation()}
          disabled={conversationLoading || loading || deletingConversationId !== null}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          + New chat
        </button>
      </div>

      {conversations.length === 0 ? (
        <p className="py-3 text-sm text-slate-500">
          No saved conversations yet. Start a new chat to save your questions.
        </p>
      ) : (
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => void loadConversation(conversation.id)}
                disabled={conversationLoading || loading || deletingConversationId !== null}
                className={`min-w-0 flex-1 rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                  activeConversationId === conversation.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-800 bg-slate-950 hover:border-slate-600"
                }`}
              >
                <span className="block truncate text-sm font-medium text-slate-200">
                  {conversation.title}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Chat #{conversation.id}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void deleteConversation(conversation.id)}
                disabled={conversationLoading || loading || deletingConversationId !== null}
                aria-label={`Delete conversation ${conversation.title}`}
                title="Delete conversation"
                className="shrink-0 rounded-xl border border-slate-800 px-3 text-xs text-red-400 transition hover:border-red-800 hover:bg-red-950/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletingConversationId === conversation.id ? "..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>

    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-semibold">Document Library</h2>
      <button
        type="button"
        onClick={loadDocuments}
        className="text-xs text-blue-300 hover:text-blue-200"
      >
        Refresh
      </button>
    </div>

    <label className="mb-4 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-slate-700 p-5 text-center transition hover:border-blue-500">
      <span className="text-2xl">↑</span>
      <span className="mt-2 text-sm font-medium">
        {uploading ? "Uploading..." : "Upload a document"}
      </span>
      <span className="mt-1 text-xs text-slate-500">
        PDF, DOCX, TXT, MD · Max 10 MB
      </span>

      <input
        type="file"
        accept=".pdf,.docx,.txt,.md"
        disabled={uploading}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadDocument(file);
          event.currentTarget.value = "";
        }}
      />
    </label>

    {documentMessage && (
      <p className="mb-3 text-xs text-emerald-400">
        {documentMessage}
      </p>
    )}

    {documentError && (
      <p role="alert" className="mb-3 text-xs text-red-400">
        {documentError}
      </p>
    )}

    <p className="mb-3 text-xs text-slate-500">
      {documents.length} indexed document
      {documents.length === 1 ? "" : "s"}
    </p>

    <div className="flex flex-col gap-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="rounded-xl border border-slate-800 bg-slate-950 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-slate-200">
                {doc.filename}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {doc.file_type.toUpperCase()} · {doc.chunks_created} chunks
              </p>
            </div>

            <button
              type="button"
              onClick={() => void deleteDocument(doc.id)}
              className="shrink-0 text-xs text-red-400 hover:text-red-300"
              aria-label={`Delete ${doc.filename}`}
            >
              Delete
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-emerald-400">
              ● {doc.status}
            </span>
            <span className="text-xs text-slate-600">
              ID: {doc.id}
            </span>
          </div>
        </div>
      ))}

      {documents.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">
          No documents yet. Upload one to get started.
        </p>
      )}
    </div>
          </aside>
        </section>

        <form
          onSubmit={sendMessage}
          className="sticky bottom-0 mx-auto w-full max-w-3xl border-t border-slate-800 bg-slate-950 py-4"
        >
          <div className="flex items-end gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-2 focus-within:border-blue-500">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask anything about your documents..."
              rows={2}
              maxLength={2000}
              disabled={loading || conversationLoading || deletingConversationId !== null}
              className="max-h-40 min-h-12 flex-1 resize-y bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={loading || conversationLoading || deletingConversationId !== null || !question.trim()}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "..." : "Ask"}
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-slate-500">
            Answers are grounded in retrieved passages. Verify important information against the original documents.
          </p>
        </form>
      </div>
    </main>
  );
}
