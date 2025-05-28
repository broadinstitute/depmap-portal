from depmap.settings.shared import DataLoadConfig
from depmap.enums import DependencyEnum, BiomarkerEnum
from depmap.download.models import DownloadSettings
from depmap.settings.nonstandard_datasets._ccle2 import ccle2_paper_nonstandard_datasets
from depmap.settings.nonstandard_datasets._msi import msi_datasets
from depmap.settings.nonstandard_datasets._metmap import metmap_datasets
from depmap.settings.taiga_ids import HUGO_NCGC_TAIGA_ID
from depmap.settings.settings import RemoteConfig, Config
import os

external_datasets = DataLoadConfig(
    hgnc_dataset=HUGO_NCGC_TAIGA_ID,
    dose_replicate_level_datasets=[  # this split is only used by db loading, to loop over a different list and use a different loader
        DependencyEnum.CTRP_dose_replicate,
        DependencyEnum.GDSC1_dose_replicate,
        DependencyEnum.GDSC2_dose_replicate,
        DependencyEnum.Repurposing_secondary_dose_replicate,
    ],
)


def get_external_nonstandard_datasets():
    return {
        **ccle2_paper_nonstandard_datasets,
        **msi_datasets,
        **metmap_datasets,
    }


class ExternalConfig(RemoteConfig):
    ENV_TYPE = "public"
    LOADER_DATA_DIR = "/"  # paths should be absolute, temporary files
    PROJECT_ROOT = "/depmap"
    WEBAPP_DATA_DIR = os.path.join(
        PROJECT_ROOT, "data"
    )  # hardcoded mount point in ansible
    DB_PATH = os.path.join(WEBAPP_DATA_DIR, Config.DB_NAME)
    SQLALCHEMY_DATABASE_URI = "sqlite:///{0}".format(DB_PATH)
    NONSTANDARD_DATA_DIR = os.path.join(WEBAPP_DATA_DIR, "nonstandard")
    RESOURCES_DATA_PATH = os.path.join(WEBAPP_DATA_DIR, "resources", "results.db")
    GET_NONSTANDARD_DATASETS = get_external_nonstandard_datasets
    COMPUTE_RESULTS_ROOT = os.path.join(WEBAPP_DATA_DIR, "results")
    PROFILE_DIR = os.path.join(
        PROJECT_ROOT, "profiling"
    )  # hardcoded mount point in ansible
    DATA_LOAD_CONFIG = external_datasets
    S3_DIR = "depmap-pipeline/external-25q2"
    FEEDBACK_FORM_URL = "https://forum.depmap.org/"
    THEME_PATH = os.path.join(Config.ADDITIONAL_MOUNTS_DIR, "theme")
    RELEASE_NOTES_URL = "https://forum.depmap.org/c/announcements/15"
    FORUM_URL = "https://forum.depmap.org/"
    FORUM_RESOURCES_CATEGORY = "resources"
    FORUM_RESOURCES_DEFAULT_TOPIC_ID = 3396
    BREADBOX_PROXY_DEFAULT_USER = "anonymous"


class ExternalQAConfig(ExternalConfig):
    ENV = "xqa"
    SERVER_NAME = (
        "dev.cds.team"  # set to use url_for in celery without a request context
    )
    APPLICATION_ROOT = "/depmap-xqa"
    GOOGLE_ANALYTICS_UA = "UA-52456999-8"  # Shown in public-facing file layout.html so no need to move over
    S3_DIR = "depmap-pipeline/xqa"  # folder from broad-datasci S3 bucket that contains the metadata folder


class ExternalStagingConfig(ExternalConfig):
    ENV = "xstaging"  # ENV is used for uniqueness, do not make checks against ENV. Use ENV_TYPE for skyros/public/dmc split.
    SERVER_NAME = (
        "dev.cds.team"  # set to use url_for in celery without a request context
    )
    APPLICATION_ROOT = "/depmap-xstaging"
    GOOGLE_ANALYTICS_UA = "UA-52456999-8"


class ExternalProdConfig(ExternalConfig):
    ENV = "xprod"  # ENV is used for uniqueness, do not make checks against ENV. Use ENV_TYPE for skyros/public/dmc split.
    SERVER_NAME = "depmap.org"  # set to use url_for in celery without a request context
    APPLICATION_ROOT = "/portal"
    PROJECT_ROOT = "/depmap"
    GOOGLE_ANALYTICS_UA = "UA-52456999-4"
    GOOGLE_TAG_MANAGER_ID = "GTM-M5RJ8RC"
    CAS_BUCKET = "depmap-external-portal-cas"
