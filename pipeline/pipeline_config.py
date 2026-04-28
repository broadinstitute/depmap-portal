from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class CommonConfig(BaseModel):
    """Common configuration shared across all pipeline runs."""

    env_name: str
    commit_sha: str
    state_path: str
    s3_staging_url: str
    working_dir: str
    publish_dest: Optional[str] = None
    start_with: Optional[str] = None
    manually_run_conseq: bool = False
    conseq_args: List[str] = Field(default_factory=list)
    conseq_file: Optional[str] = None
    export_path: Optional[str] = None
