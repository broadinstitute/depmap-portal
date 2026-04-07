from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DefaultsConfig(BaseModel):
    taiga_dir: str
    creds_dir: str


class CredentialsConfig(BaseModel):
    required_files: List[str]


class DockerVolumes(BaseModel):
    work_dir: str
    aws_keys: str
    sparkles_cache: str
    google_creds: str
    taiga: str


class DockerPipelineOptions(BaseModel):
    security_opt: Optional[str] = None


class DockerEnvVars(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    google_application_credentials: str = Field(alias="GOOGLE_APPLICATION_CREDENTIALS")


class DockerConfig(BaseModel):
    volumes: DockerVolumes
    options: Dict[str, DockerPipelineOptions]
    env_vars: DockerEnvVars


class ConseqConfig(BaseModel):
    sparkles_path: str
    max_fail: int
    common_args: List[str]
    gc_enabled: bool


class DataPrepTemplateConfig(BaseModel):
    input: str
    output: str


class DataPrepTemplates(BaseModel):
    external: DataPrepTemplateConfig
    internal: DataPrepTemplateConfig


class PipelineConfig(BaseModel):
    defaults: DefaultsConfig
    credentials: CredentialsConfig
    docker: DockerConfig
    conseq: ConseqConfig


class CommonConfig(BaseModel):
    """Common configuration shared across all pipeline runs."""

    env_name: str
    job_name: str
    taiga_dir: str
    creds_dir: str
    image: Optional[str] = None
    docker_image: str
    commit_sha: str
    state_path: str
    working_dir: str
    publish_dest: Optional[str] = None
    start_with: Optional[str] = None
    manually_run_conseq: bool = False
    conseq_args: List[str] = Field(default_factory=list)
    # Set after initial build
    conseq_file: Optional[str] = None
    # Pipeline-specific optional fields
    export_path: Optional[str] = None
    s3_staging_url: Optional[str] = None
