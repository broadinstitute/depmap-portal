from pydantic import Field, BaseModel
from typing import Annotated, Optional, Union


class ContextSummary(BaseModel):
    num_candidates: int
    num_matches: int


class ContextMatchResponse(BaseModel):
    ids: list[str]
    labels: list[str]


ContextExpression = Annotated[
    Union[bool, dict[str, list]], Field(union_mode="left_to_right")
]


class Context(BaseModel):
    # Context expression examples:
    # - { "!": [ { "var": "slice/lineage/1/label" }, "Breast" ] }
    # - { "==": [ { "var": "entity_label"}, "ACH-000001" ] }
    # - { "==": [ {"var": "slice/growth_pattern/all/label"}, "Adherent" ] }
    # - True
    expr: ContextExpression
    name: str

    # The "dimension_type" field is used by contexts in the new format (with slice queries)
    # The "context_type" field is used by the old format (with slice IDs)
    # The two fields contain the same information (the dimension type name)
    dimension_type: Optional[str] = None
    context_type: Optional[str] = None
    vars: dict[str, dict[str, str]] = {}
