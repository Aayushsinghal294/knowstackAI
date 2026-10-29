
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk
from app.services.ingestion import embedding_model


MIN_SIMILARITY = 0.25
MAX_TOP_K = 10


def search_documents(
    db: Session,
    query: str,
    user_id: int,
    top_k: int = 5,
) -> list[dict]:
    query = query.strip()

    if not query:
        raise ValueError("Query cannot be empty.")

    top_k = max(1, min(top_k, MAX_TOP_K))

    query_vector = embedding_model.encode(
        query,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).tolist()

    distance = DocumentChunk.embedding.cosine_distance(query_vector)
    max_distance = 1.0 - MIN_SIMILARITY

    statement = (
        select(
            DocumentChunk,
            Document.filename,
            distance.label("distance"),
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id,
        )
        .where(
            Document.user_id == user_id,
            distance <= max_distance,
        )
        .order_by(distance)
        .limit(top_k)
    )

    results = db.execute(statement).all()

    response = []

    for chunk, filename, cosine_distance in results:
        raw_similarity = 1.0 - float(cosine_distance)
        similarity = max(0.0, min(1.0, raw_similarity))

        response.append(
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "filename": filename,
                "chunk_index": chunk.chunk_index,
                "page_number": chunk.page_number,
                "content": chunk.content,
                "similarity": round(similarity, 4),
            }
        )

    return response
