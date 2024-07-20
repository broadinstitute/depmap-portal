from fastapi import APIRouter, Depends
from .dependencies import get_user as get_user_dep

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/", operation_id="get_user")
def get_user(user: str = Depends(get_user_dep)):
    return user
