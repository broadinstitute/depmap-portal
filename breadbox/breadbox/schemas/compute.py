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

    # Specify these two if using a feature defined in breadbox
    queryFeatureId: Annotated[
        Optional[str], Field(description="")
    ] = None
    queryDatasetId: Optional[str] = None

    # Specify this if using a feature not defined in breadbox
    queryCellLines: Optional[List[str]] = None # Alternatively, could take slice Query
    queryValues: Optional[List[Any]] = None
    # TODO: rename this to "association_var_independence", add better typing
    vectorVariableType: Optional[str] = None # Either "dependent" or "independent". Only relevant for Association and two-class


class ComputeResponse(BaseModel):
    state: str
    id: str
    message: Optional[str] = Field()
    result: Optional[Any] = Field()
    percentComplete: Optional[int] = Field()
