from sqlalchemy import text

from app.db.session import Base, engine
from app.models import Document, DocumentChunk  # noqa: F401
from app.models.conversation import Conversation, ChatMessage
from app.models.user import User


def initialize_database():
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    Base.metadata.create_all(bind=engine)
    print("KnowStack AI database initialized successfully.")


if __name__ == "__main__":
    initialize_database()