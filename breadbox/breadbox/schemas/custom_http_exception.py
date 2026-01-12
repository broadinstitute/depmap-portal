from typing import Optional
from typing_extensions import Annotated, Doc
from fastapi import HTTPException, status
from pydantic import BaseModel
from pydantic_settings import SettingsConfigDict
import enum


class HTTPError(BaseModel):
    detail: str

    model_config = SettingsConfigDict(
        json_schema_extra={"example": {"detail": "HTTPException raised."}},
    )


ERROR_CODES = [
    status.HTTP_400_BAD_REQUEST,
    status.HTTP_403_FORBIDDEN,
    status.HTTP_404_NOT_FOUND,
    status.HTTP_409_CONFLICT,
    status.HTTP_401_UNAUTHORIZED
]
ERROR_RESPONSES = dict.fromkeys(ERROR_CODES, {"model": HTTPError})


class UserError(HTTPException):
    def __init__(self, msg, error_code=400):
        super().__init__(error_code, msg)


class GroupPermissionError(UserError):
    def __init__(self, msg):
        super().__init__(msg, error_code=403)


# API response should not give info about whether dataset exists to user without access to it
class DatasetAccessError(UserError):
    def __init__(self, msg):
        super().__init__(msg, error_code=404)


class GroupHasDatasetsError(UserError):
    def __init__(self, msg):
        super().__init__(msg, error_code=409)


class ExistingResourceNameError(UserError):
    def __init__(self, msg):
        super().__init__(msg, error_code=409)


class ResourceNotFoundError(UserError):
    def __init__(self, msg):
        super().__init__(msg, error_code=404)


class FileValidationError(UserError):
    def __init__(self, msg):
        super().__init__(msg)


class AnnotationValidationError(UserError):
    def __init__(self, msg):
        super().__init__(msg)


class ComputeLinearFitError(UserError):
    def __init__(self, msg):
        super().__init__(msg)


class CeleryConnectionError(HTTPException):
    def __init__(self, msg, error_code=503):
        super().__init__(error_code, msg)


# TODO: Ideally we would create ErrorTypes for the other custom exceptions defined above but for now reduce scope

# NOTE: Error type enums shared with frontend
class ErrorType(enum.Enum):
    DATASET_NOT_FOUND = "DATASET_NOT_FOUND"
    FEATURE_NOT_FOUND = "FEATURE_NOT_FOUND"
    SAMPLE_NOT_FOUND = "SAMPLE_NOT_FOUND"
    DIMENSION_TYPE_NOT_FOUND = "DIMENSION_TYPE_NOT_FOUND"
    LARGE_DATASET_READ = "LARGE_DATASET_READ"


class ErrorTypeDetail(BaseModel):
    message: str
    error_type: ErrorType


class BaseErrorTypeException(HTTPException):
    def __init__(self, status_code: int, message: str, error_type: ErrorType):
        detail = ErrorTypeDetail(message=message, error_type=error_type).model_dump(
            mode="json"
        )
        super().__init__(status_code=status_code, detail=detail)


class DatasetNotFoundError(BaseErrorTypeException):
    def __init__(self, msg):
        super().__init__(404, msg, ErrorType.DATASET_NOT_FOUND)


class DimensionTypeNotFoundError(BaseErrorTypeException):
    def __init__(self, msg):
        super().__init__(404, msg, ErrorType.DIMENSION_TYPE_NOT_FOUND)


class FeatureNotFoundError(BaseErrorTypeException):
    def __init__(self, msg):
        super().__init__(404, msg, ErrorType.FEATURE_NOT_FOUND)


class SampleNotFoundError(BaseErrorTypeException):
    def __init__(self, msg):
        super().__init__(404, msg, ErrorType.SAMPLE_NOT_FOUND)


class LargeDatasetReadError(BaseErrorTypeException):
    def __init__(self, features_length, samples_length):
        msg = f"This requires fetching data for {samples_length} samples and {features_length} features which is too large to be processed at once. This is not supported at this time."

        super().__init__(
            status_code=507, message=msg, error_type=ErrorType.LARGE_DATASET_READ
        )
