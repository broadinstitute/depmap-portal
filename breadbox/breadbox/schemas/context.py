from pydantic import Field, BaseModel
from typing import Annotated, Optional, Union


class ContextMatchResponse(BaseModel):
    ids: list[str]
    labels: list[str]
    num_candidates: int


ContextExpression = Annotated[
    Union[bool, dict[str, list]], Field(union_mode="left_to_right")
]


class Context(BaseModel):
    # Context expression examples:
    # - { "!": [ { "var": "model1_lineage" }, "Breast" ] }
    # - { "==": [ { "var": "entity_id"}, "ACH-000001" ] }
    # - { ">": [ {"var": "model2_expression"}, 0.5 ] }
    # - True
    expr: ContextExpression
    name: Optional[str] = None
    dimension_type: str
    # This vars field is a dictionary of variable names to slice queries
    vars: dict[str, dict[str, str]] = {}
