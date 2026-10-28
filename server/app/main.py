
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.documents import router as documents_router
from app.api.search import router as search_router
from app.core.config import get_settings
from app.api.ask import router as ask_router
from app.api.conversations import router as conversations_router
from app.api.auth import router as auth_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Enterprise knowledge assistant powered by RAG and LLMs.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.get("/")
def root():
    return {
        "app": settings.app_name,
        "message": "Welcome to KnowStack AI",
    }


@app.get("/api/v1/health")
def health():
    return {
        "status": "ok",
        "service": "knowstack-api",
    }

app.include_router(documents_router)
app.include_router(search_router)
app.include_router(ask_router)
app.include_router(conversations_router)
app.include_router(auth_router)