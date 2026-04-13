from pydantic import Field, BaseModel
from typing import Annotated, Any, Optional, Union
from breadbox.schemas.dataset import SliceQueryIdentifierType


class ContextMatchResponse(BaseModel):
    ids: list[str]
    labels: list[str]
    num_candidates: int


ContextExpression = Annotated[
    Union[bool, dict[str, Any]], Field(union_mode="left_to_right")
]


class SliceQueryRef(BaseModel):
    """A reference to a slice of data in a dataset."""

    dataset_id: str
    identifier: str
    identifier_type: SliceQueryIdentifierType
    reindex_through: Optional["SliceQueryRef"] = None

    class Config:
        extra = "ignore"


class Context(BaseModel):
    # Context expression examples:
    # - { "!": [ { "var": "model1_lineage" }, "Breast" ] }
    # - { "==": [ { "var": "entity_id"}, "ACH-000001" ] }
    # - { ">": [ {"var": "model2_expression"}, 0.5 ] }
    # - { "in": [ { "var": "gene_1" }, { "context": "selective" } ] }
    # - True
    expr: ContextExpression
    name: Optional[str] = None
    dimension_type: str
    # Maps variable names to slice queries, referenced in expr via { "var": "<name>" }
    vars: dict[str, SliceQueryRef] = {}
    # Maps context names to nested context definitions, referenced in expr via
    # { "context": "<name>" }. Inner contexts can themselves define their own
    # vars and contexts, enabling recursive nesting.
    contexts: dict[str, "Context"] = {}
