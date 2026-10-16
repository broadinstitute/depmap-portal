from functools import lru_cache
import os
from typing import List, Optional, Union

from pydantic import RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import datetime


class Settings(BaseSettings):
    breadbox_secret: str
    sqlalchemy_database_url: str
    filestore_location: str
    compute_results_location: str
    admin_users: List[str]
    use_depmap_proxy: bool
    default_user: Optional[str]
    host_scheme_override: Optional[str] = None
    sql_endpoints_enabled: bool = False
    breadbox_env: str = "dev"

    # prefix all routes with api_prefix if it's not an empty string
    api_prefix: str = ""

    # used for configuring CORS allowed origins
    origins: List[str] = [
        "http://127.0.0.1:5000",
    ]

    # if set, causes celery to executes tasks in a synchronous mode. Not exactly the same
    # as normal execution, but everything runs within one process and no need for a broker
    # or result backend. Should only be used for testing.
    brokerless_celery_for_testing: bool = False

    LEGACY_CAS_BUCKET: Optional[str] = os.environ.get("LEGACY_CAS_BUCKET")

    # the host:port to use for connecting to redis (used by caching)
    redis_host: Optional[str] = os.getenv("REDIS_HOST")

    # --- POST /plot-data (see breadbox/service/plot_data.py) ---
    # Root URL the plot-data Node script uses to read back from this same Breadbox.
    # Must be the *unprefixed* loopback address: it must not contain the /breadbox
    # prefix (requests that arrive with it are a 404 on loopback).
    plot_data_base_url: str = "http://127.0.0.1:8000"
    plot_data_max_request_bytes: int = 256 * 1024
    plot_data_timeout_seconds: float = 30.0
    plot_data_max_output_bytes: int = 8 * 1024 * 1024
    plot_data_max_concurrency: int = 2
    plot_data_max_queue: int = 8
    plot_data_queue_timeout_seconds: float = 5.0
    plot_data_node_max_old_space_mb: int = 512
    # Whole-response cache. A size of 0 (or a ttl of 0) disables it.
    plot_data_cache_max_bytes: int = 128 * 1024 * 1024
    plot_data_cache_ttl_seconds: float = 300.0
    # Replaces the whole child command (`node --max-old-space-size=.. plot-data.js`).
    # Only meant for tests, which substitute a fake child.
    plot_data_command_override: Optional[List[str]] = None
    # The child runs with PATH only, so Breadbox's secrets stay out of it. Names listed here
    # are copied from Breadbox's own environment as well (e.g. ["NODE_OPTIONS"]).
    plot_data_child_env_passthrough: List[str] = []

    model_config = SettingsConfigDict(
        env_file=os.environ.get("BREADBOX_SETTINGS_PATH", ".env"),
    )

    # used for writing temp files as part of exports
    gcs_credentials_path: Optional[str] = os.environ.get("GCS_CREDENTIALS_PATH")
    gcs_temp_path: Optional[str] = os.environ.get("GCS_TEMP_PATH")

    def get_todays_result_dir(self):
        """
        Fetch the result directory (used for temp files) to use for any tasks. (Result directory includes the date so
        that we can easily clean up old results)
        """

        return os.path.join(
            self.compute_results_location,
            str(datetime.datetime.now().strftime("%Y%m%d")),
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
