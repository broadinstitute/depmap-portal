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


class BasePipelineSpecificConfig(BaseModel):
    state_path: str
    log_destination: str
    working_dir: str
    env_mapping: Dict[str, str]


class PreprocessingPipelineSpecificConfig(BasePipelineSpecificConfig):
    pass


class DataPrepTemplateConfig(BaseModel):
    input: str
    output: str


class DataPrepTemplates(BaseModel):
    external: DataPrepTemplateConfig
    internal: DataPrepTemplateConfig


class DataPrepPipelineSpecificConfig(BasePipelineSpecificConfig):
    templates: DataPrepTemplates


class PipelinesConfig(BaseModel):
    preprocessing: PreprocessingPipelineSpecificConfig
    data_prep: DataPrepPipelineSpecificConfig


class PipelineConfig(BaseModel):
    defaults: DefaultsConfig
    credentials: CredentialsConfig
    docker: DockerConfig
    conseq: ConseqConfig
    pipelines: PipelinesConfig
