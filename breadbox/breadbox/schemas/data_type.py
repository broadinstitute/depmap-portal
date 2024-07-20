from pydantic import BaseModel


class DataType(BaseModel):
    class Config:
        orm_mode = True
        allow_population_by_field_name = True

    name: str
