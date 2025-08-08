from pydantic import BaseModel, Field
from typing import Optional, Annotated, Any, List, Literal, Union


class ComputeParams(BaseModel):
    analysisType: Annotated[
        Literal["pearson", "association", "two_class"],
        Field(description="The type of analysis to run")
    ]
    datasetId: Annotated[
        str, Field(description="The given ID or UUID of the dataset to search for association")
    ]

    # Option 1 for specifying a "query vector": Provide the dataset ID and feature given ID.
    queryFeatureId: Annotated[
        Optional[str], 
        Field(description="The given ID of the feature/slice which is being queried (ex. for genes, this would be an entrez ID). If specified, the caller must also provide the `queryDatasetId`.")
    ] = None
    queryDatasetId: Annotated[
        Optional[str], 
        Field(description="The UUID or dataset given ID of the dataset in which the query feature/slice is defined. If specified, the caller must also provide the `queryFeatureId`.")
    ] = None

    # Option 2 for specifying a "query vector": Provide the values and IDs of the slice. 
    # This option is used when calling custom analysis from the breadbox_shim in the portal-backend.
    queryCellLines: Annotated[
        Optional[list[str]],
        Field(description="A list of identifiers for the query vector. At the moment, this is always cell lines. If provided, the caller must also provide the `queryValues`.")
    ] = None
    queryValues: Annotated[
        Optional[list[Any]],
        Field(description="A list of values for the query vector. If provided, the caller must also provide the `queryCellLines`.")
    ] = None

    vectorVariableType: Annotated[
        Optional[Literal["dependent", "independent"]],
        Field(description="Describes whether the dataset is expected to be independent or dependent from the query vector. Only relevant for `association` and `two_class` analyses")
    ] = None


class ComputeResponse(BaseModel):
    state: str
    id: str
    message: Optional[str] = Field()
    result: Optional[Any] = Field()
    percentComplete: Optional[int] = Field()
