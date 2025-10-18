from functools import lru_cache
import os
from typing import List, Optional, Union

from pydantic import RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    breadbox_secret: str
    sqlalchemy_database_url: str
    filestore_location: str
    compute_results_location: str
    admin_users: List[str]
    use_depmap_proxy: bool
    default_user: Optional[str]
    host_scheme_override: Optional[str] = None
    breadbox_env: str = "dev"
    # prefix all routes with api_prefix if it's not an empty string
    api_prefix: str = ""
    # used for configuring CORS allowed origins
    origins: List[str] = [
        "http://127.0.0.1:5000",
    ]
    # CELERY_BROKER_URL: Union[RedisDsn, str] = os.environ.get(
    #     "CELERY_BROKER_URL", "redis://127.0.0.1:6379/0"
    # )
    # CELERY_RESULT_BACKEND: Union[RedisDsn, str] = os.environ.get(
    #     "CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/0"
    # )

    # if set, causes celery to executes tasks in a synchronous mode. Not exactly the same
    # as normal execution, but everything runs within one process and no need for a broker
    # or result backend. Should only be used for testing.
    brokerless_celery_for_testing: bool = False

    LEGACY_CAS_BUCKET: Optional[str] = os.environ.get("LEGACY_CAS_BUCKET")

    model_config = SettingsConfigDict(
        env_file=os.environ.get("BREADBOX_SETTINGS_PATH", ".env"),
    )

    @field_validator("host_scheme_override")
    def env_contains_colon(cls, v):
        """"""
        if v is not None and ":" not in v:
            raise ValueError(
                "Must contain colon and take the format of [Internet protocol]:[host name]!"
            )
        return v


@lru_cache()
def _get_settings():
    # construct with no parameters so that they're all taken from environment variables or .env
    return Settings()  # pyright: ignore [reportCallIssue]


def get_settings():
    # This is just delgating (to _get_settings) so that we have a hook we can monkey patch
    # in tests to override the value of get_settings. Otherwise we'd have to monkey patch _every_
    # module get_settings is imported in which is a lot of places.
    return _get_settings()
