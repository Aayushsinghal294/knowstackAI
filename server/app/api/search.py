from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.retrieval import search_documents

router = APIRouter(prefix="/api/v1/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)


@router.post("")
def search(request: SearchRequest, db: Session = Depends(get_db)):
    if not request.query.strip():
        raise HTTPException(
            status_code=400,
            detail="Query cannot be empty.", 
        )

    try:
        results  = search_documents(
            db=db,
            query=request.query,
            top_k=request.top_k,
        )

        return {
            "query": request.query,
            "results_count": len(results),
            "results": results, 
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc