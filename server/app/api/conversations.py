
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.services.rag import answer_question

from app.db.session import get_db
from app.models.conversation import Conversation, ChatMessage

router = APIRouter(
    prefix="/api/v1/conversations",
    tags=["Conversations"],
)


class ConversationCreate(BaseModel):
    title: str = "New conversation"


class MessageCreate(BaseModel):
    role: str
    content: str

class ConversationAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)

def conversation_to_dict(conversation: Conversation):
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at,
    }


def message_to_dict(message: ChatMessage):
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "role": message.role,
        "content": message.content,
        "citations": message.citations or [],
        "created_at": message.created_at,
    }


@router.post("", status_code=201)
def create_conversation(
    request: ConversationCreate,
    db: Session = Depends(get_db),
):
    title = request.title.strip() or "New conversation"

    if len(title) > 200:
        raise HTTPException(
            status_code=400,
            detail="Title cannot exceed 200 characters.",
        )

    conversation = Conversation(title=title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation_to_dict(conversation)


@router.get("")
def list_conversations(db: Session = Depends(get_db)):
    conversations = (
        db.query(Conversation)
        .order_by(Conversation.created_at.desc(), Conversation.id.desc())
        .all()
    )

    return [conversation_to_dict(c) for c in conversations]


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
):
    conversation = db.get(Conversation, conversation_id)

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .all()
    )

    return {
        **conversation_to_dict(conversation),
        "messages": [message_to_dict(m) for m in messages],
    }


@router.post("/{conversation_id}/messages", status_code=201)
def add_message(
    conversation_id: int,
    request: MessageCreate,
    db: Session = Depends(get_db),
):
    conversation = db.get(Conversation, conversation_id)

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    role = request.role.strip().lower()
    content = request.content.strip()

    if role not in {"user", "assistant"}:
        raise HTTPException(
            status_code=400,
            detail="Role must be 'user' or 'assistant'.",
        )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Message content cannot be empty.",
        )

    message = ChatMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    return message_to_dict(message)


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
):
    conversation = db.get(Conversation, conversation_id)

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    db.delete(conversation)
    db.commit()

    return None



@router.post("/{conversation_id}/ask")
def ask_in_conversation(
    conversation_id: int,
    request: ConversationAskRequest,
    db: Session = Depends(get_db),
):
    conversation = db.get(Conversation, conversation_id)

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    # Load recent messages, newest first, then restore chronological order.
    recent_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(6)
        .all()
    )

    history = [
        {"role": message.role, "content": message.content}
        for message in reversed(recent_messages)
    ]

    try:
        result = answer_question(
            db=db,
            question=question,
            top_k=request.top_k,
            history=history,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Persist both messages only after answer generation succeeds.
    user_message = ChatMessage(
        conversation_id=conversation_id,
        role="user",
        content=question,
    )

    assistant_message = ChatMessage(
    conversation_id=conversation_id,
    role="assistant",
    content=result["answer"],
    citations=result.get("citations", []),
)

    try:
        db.add_all([user_message, assistant_message])

        if conversation.title == "New conversation":
            conversation.title = question[:60]

        db.commit()
        db.refresh(user_message)
        db.refresh(assistant_message)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save conversation messages.",
        )

    return {
        "conversation_id": conversation_id,
        "answer": result["answer"],
        "citations": result["citations"],
        "model": result["model"],
        "user_message": message_to_dict(user_message),
        "assistant_message": message_to_dict(assistant_message),
    }
