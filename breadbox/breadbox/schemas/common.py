from uuid import UUID

from pydantic import BaseModel

from typing import Callable, Any


class ResponseMixin:
    """
    Ideally pydantic's built in methods would automagically
    map the database models onto our response models. However, there are
    often discrepencies between names and types used in responses
    (like DatasetResponse) and ORM models (like Dataset), which aren't handled
    well by pydantic. This mixin allows us to explicitely override the mapping
    for a subset of fields.
    """

    __mapping_overrides__: dict[str, Callable[[Any], Any]]

    @classmethod
    def from_model(cls, model):
        response_fields = cls.__fields__
        mapping = {}
        for field_name in response_fields:
            if field_name in cls.__mapping_overrides__:
                mapping[field_name] = cls.__mapping_overrides__[field_name](model)
            else:
                val = getattr(model, field_name)
                mapping[field_name] = val
        return cls(**mapping)


class DBBase(BaseModel, ResponseMixin):
    id: UUID

    class Config:
        from_attributes = True
