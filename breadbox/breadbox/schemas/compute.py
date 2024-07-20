from pydantic import BaseModel, Field
from typing import Optional, Any, List


class ComputeParams(BaseModel):
    analysisType: str
    datasetId: str
    # Either queryId (node id) or queryFeatureId and queryDatasetId are required
    # queryId is a deprecated query type which is only used by Elara
    queryId: Optional[str] = None
    queryFeatureId: Optional[str] = None
    queryDatasetId: Optional[str] = None
    vectorVariableType: Optional[str] = None
    queryCellLines: Optional[List[str]] = None
    queryValues: Optional[List[Any]] = (
        None  # The query may be specified with either the QueryId or QueryValues
    )


class ComputeResponse(BaseModel):
    state: str
    id: str
    message: Optional[str] = Field()
    result: Optional[Any] = Field()
    percentComplete: Optional[int] = Field()
