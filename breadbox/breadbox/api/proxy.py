# mypy: ignore-errors
from fastapi import APIRouter, Request, Response
import httpx

router = APIRouter(prefix="/depmap", tags=["depmap"])


@router.get("{path:path}")
async def depmap_get(path: str, request: Request, response: Response):
    async with httpx.AsyncClient() as client:
        params = request.query_params
        proxy = await client.get(f"http://127.0.0.1:5000{path}?{params}")
    response.body = proxy.content
    response.status_code = proxy.status_code
    return response


@router.post("{path:path}")
async def depmap_post(path: str, request: Request, response: Response):
    data = await request.body()
    headers = [(key, value) for key, value in request.headers.raw if key != b"host"]

    async with httpx.AsyncClient() as client:
        proxy = await client.post(
            f"http://127.0.0.1:5000{path}", content=data, headers=headers
        )
    response.body = proxy.content
    response.status_code = proxy.status_code
    return response
