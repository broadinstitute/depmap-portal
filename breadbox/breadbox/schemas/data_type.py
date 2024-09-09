from pydantic import BaseModel
from pydantic_settings import SettingsConfigDict


class DataType(BaseModel):
    model_config = SettingsConfigDict(from_attributes=True, populate_by_name=True)

    name: str
