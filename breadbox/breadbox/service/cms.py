from dataclasses import dataclass, replace
from typing import Any, Dict, Protocol, List
import httpx
from fastapi import HTTPException


class ContentClient(Protocol):
    async def fetch(
        self, collection_type: str, filters: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        ...


class PayloadClient:
    url: str
    api_key: str

    def __init__(self, url: str, api_key: str):
        self.url = url
        self.api_key = api_key

    async def fetch(
        self, collection_type: str, filters: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """
        Fetch documents from Payload CMS with optional filtering.

        Args:
            collection_type: The Payload collection name
            filters: Dictionary of property filters

        Returns:
            Response from Payload CMS API
        """
        url = f"{self.url}/api/{collection_type}"

        # Build query parameters for Payload's where clause
        where_conditions = {}
        for prop, value in filters.items():
            where_conditions[prop] = {"equals": value}

        params = {}
        if where_conditions:
            # Payload uses a 'where' parameter with JSON
            import json

            params["where"] = json.dumps(where_conditions)

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    url, params=params, headers=headers, timeout=30.0
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=500, detail=f"Error fetching from Payload CMS: {str(e)}"
                )


class CacheClient:
    cache_dir: str

    def __init__(self, cache_dir: str):
        self.cache_dir = cache_dir

    async def fetch(
        self, collection_type: str, filters: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError()

    def update(
        self,
        collection_type: str,
        documents: List[Dict[str, Any]],
        replace_all: bool = False,
    ):
        # used for populating the cache
        raise NotImplementedError()


# Turns out none of this is needed. Will delete...
# class WrongNumberOfMatches(Exception):
#     pass
#
# class TooManyMatches(WrongNumberOfMatches):
#     pass
#
# class NoMatches(WrongNumberOfMatches):
#     pass
#
# @dataclass(frozen=True)
# class Query:
#     client : ContentClient
#     content_type: str
#     filters : Dict[str, str]
#
#     def filter_by(self, **filters):
#         new_filters = dict(self.filters, **filters)
#         return replace(self, filters=new_filters)
#
#     async def one(self):
#         result = await self.client.fetch(self.content_type, self.filters)
#         if len(result) == 1:
#             return result[0]
#         elif len(result) == 0:
#             raise NoMatches()
#         else:
#             raise TooManyMatches()
#
#     async def all(self):
#         return await self.client.fetch(self.content_type, self.filters)
#
#     async def one_or_none(self):
#         result = await self.client.fetch(self.content_type, self.filters)
#         if len(result) == 1:
#             return result[0]
#         elif len(result) == 0:
#             return None
#         else:
#             raise TooManyMatches()
#
# class CMS:
#     """
#     A slim wrapper around a client which provides some sqlalchemy api-like query behavior where we can
#     """
#
#     client : ContentClient
#     def __init__(self,client : ContentClient):
#         self.client = client
#
#     def query(self, content_type: str):
#         return
