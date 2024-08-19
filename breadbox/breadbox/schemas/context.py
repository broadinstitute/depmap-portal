from pydantic import Field, BaseModel


class ContextSummary(BaseModel):
    num_candidates: int
    num_matches: int


class Context(BaseModel):
    # Context expression examples:
    # - { "!": [ { "var": "slice/lineage/1/label" }, "Breast" ] }
    # - { "==": [ { "var": "entity_label"}, "ACH-000001" ] }
    # - { "==": [ {"var": "slice/growth_pattern/all/label"}, "Adherent" ] }
    expr: dict[str, list]
    context_type: str  # Dimension type, Ex. "depmap_model"
