from pydantic import BaseModel, Field
from typing import Optional, Annotated, Any, List, Literal, Union


class ComputeParams(BaseModel):
    analysisType: Annotated[
        Optional[Literal["pearson", "association", "two_class"]],
        Field(description="The type of analysis to run")
    ] = None
    datasetId: Annotated[
        str, Field(description="The given ID or UUID of the dataset to search for association")
    ]

    # Either queryId (node id) or queryFeatureId and queryDatasetId are required
    # queryId is a deprecated query type which is only used by Elara
    # TODO: remove this
    queryId: Optional[str] = None # REMOVE

    # TODO: check if this is used? It's different from the portal backend
    queryFeatureId: Annotated[
        Optional[str], Field(description="")
    ] = None
    queryDatasetId: Optional[str] = None

    queryCellLines: Optional[List[str]] = None # Alternatively, could take slice Query
    queryValues: Optional[List[Any]] = (
        None  # The query may be specified with either the QueryId or QueryValues
    )
    # TODO: rename this to "association_var_independence", add better typing
    vectorVariableType: Optional[str] = None # Either "dependent" or "independent". Only relevant for Association and two-class


class ComputeResponse(BaseModel):
    state: str
    id: str
    message: Optional[str] = Field()
    result: Optional[Any] = Field()
    percentComplete: Optional[int] = Field()
