from fastapi import HTTPException, status
from pydantic import BaseModel
from pydantic_settings import SettingsConfigDict


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
