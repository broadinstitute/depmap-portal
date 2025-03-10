from pydantic import BaseModel


class CASKey(BaseModel):
    key: str


class CASValue(BaseModel):
    value: str
