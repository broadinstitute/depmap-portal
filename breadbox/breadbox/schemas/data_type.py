from pydantic import BaseModel, ConfigDict


class DataType(BaseModel):
    model_config: ConfigDict = ConfigDict(from_attributes=True, populate_by_name=True)

    name: str
