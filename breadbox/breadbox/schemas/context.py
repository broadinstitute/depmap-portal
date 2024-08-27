from pydantic import Field, BaseModel
from typing import Annotated, Union


class ContextSummary(BaseModel):
    num_candidates: int
    num_matches: int


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
    context_type: str  # Dimension type, Ex. "depmap_model"
