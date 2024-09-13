from depmap.settings.shared import DataLoadConfig
from depmap.interactive.config import categories
from depmap.gene.models import Gene
from depmap.enums import DataTypeEnum, DependencyEnum, BiomarkerEnum
from depmap.settings.taiga_ids import HUGO_NCGC_TAIGA_ID
from depmap.settings.settings import RemoteConfig, Config
import os
from depmap.read_config import read_config

dev_datasets = DataLoadConfig(
    hgnc_dataset=HUGO_NCGC_TAIGA_ID,
    dose_replicate_level_datasets=[  # this split is only used by db loading, to loop over a different list and use a different loader
        DependencyEnum.GDSC1_dose_replicate,
        DependencyEnum.GDSC2_dose_replicate,
        DependencyEnum.CTRP_dose_replicate,
        DependencyEnum.Repurposing_secondary_dose_replicate,
        DependencyEnum.Prism_oncology_dose_replicate,
    ],
)


# dev downloads are _dev_only, plus specified in settings.py


def get_dev_nonstandard_datasets():
    return {
        "small-msi-dataset-aa84.5": {  # this mimics/is the dev version of the msi dataset config in .nonstandard_datasets._msi
            "label": "Microsatellite Instability",
            "units": "MSI status",
            "data_type": DataTypeEnum.msi,
            "priority": None,
            "feature_name": "MSI annotation source",
            "transpose": True,
            "prepopulate": True,
            "use_arxspan_id": True,
            "is_categorical": True,
            "categories": categories.MsiConfig(),  # this is important to have in dev because this is currently the only nonstandard dataset with a value map configured. it's also the only categorical nonstandard
        },
        "small-mapped-avana-551a.1": {  # virtual to small-mapped-avana-551a.1. used to test nonstandard dataset taiga aliasing
            "label": "Small Avana entity mapped",
            "units": "CERES Score",
            "data_type": DataTypeEnum.deprecated,
            "priority": None,
            "feature_name": "gene",
            "transpose": False,
            "entity": Gene,  # for nonstandard_utils,
            "is_continuous": True,
        },
        # "small-chronos-combined-e82b.2/chronos_combined_score_duplicate": {  # for deving vector catalog sorting; specifically this mimics the nonstandard PR for a given quarter
        #     "label": "CRISPR Chronos (Combined) Internal 21Q2 Duplicate",
        #     "units": "CERES Score",
        #     "feature_name": "gene",
        #     "transpose": False,
        #     "entity": Gene,
        #     "is_continuous": True,
        # },
        "small-avana-2987.2": {  # does not have stable IDs, specifically made for dplot testing
            "label": "Small Avana no entity",
            "units": "CERES Score",
            "data_type": DataTypeEnum.deprecated,
            "priority": None,
            "feature_name": "gene",
            "transpose": False,
            "is_continuous": True,
        },
    }


_config_cache = {}


def get_setting_from_config(setting_name, env_type):
    if env_type not in _config_cache:
        if env_type == "skyros":
            config = read_config(
                env_name="istaging", config_path="../config/skyros/settings.py"
            )
        elif env_type == "dmc":
            config = read_config(
                env_name="dstaging", config_path="../config/dmc/settings.py"
            )
        elif env_type == "public":
            config = read_config(
                env_name="xstaging", config_path="../config/public/settings.py"
            )
        elif env_type == "peddep":
            config = read_config(
                env_name="pstaging", config_path="../config/peddep/settings.py"
            )
        else:
            raise Exception(
                f"Environment type {env_type} not recognized. Unable to read environment configs."
            )
        _config_cache[env_type] = config
    return getattr(_config_cache[env_type], setting_name)


class DevConfig(Config):
    """Development configuration."""

    ENV = "dev"  # ENV is used for uniqueness, do not make checks against ENV. Use ENV_TYPE for skyros/public/dmc split. The only exception is for setting the depmapIsDevEnv in layout.html to determine error handling behavior
    ENV_TYPE = os.environ.get("DEPMAP_THEME", "public")  # 'skyros' or 'public' or 'dmc'
    USE_FRONTEND_DEV_SERVER = True
    SERVER_NAME = "127.0.0.1:5000"  # set to use url_for in celery (request context absent) and flask shell
    DEBUG = True  # this doesn't seem to do anything
    DB_NAME = "dev.db"
    # Put the db file in project root
    LOADER_DATA_DIR = os.path.join(Config.PROJECT_ROOT, "sample_data")
    WEBAPP_DATA_DIR = os.path.join(Config.PROJECT_ROOT, "webapp_data")
    DB_PATH = os.path.join(WEBAPP_DATA_DIR, DB_NAME)
    SQLALCHEMY_DATABASE_URI = "sqlite:///{0}".format(DB_PATH)
    NONSTANDARD_DATA_DIR = os.path.join(WEBAPP_DATA_DIR, "nonstandard")
    PRIVATE_FILE_BUCKETS = ["dev-resources-files"]
    RESOURCES_DATA_PATH = os.path.join(WEBAPP_DATA_DIR, "resources", "results.db")
    COMPUTE_RESULTS_ROOT = os.path.join(WEBAPP_DATA_DIR, "results")
    PROFILE_DIR = os.path.join(Config.PROJECT_ROOT, "profiling")
    ANNOUNCEMENTS_PATH = os.path.join(
        Config.PROJECT_ROOT,
        f"../../depmap-deploy/portal-config/env/{ENV_TYPE}/announcements.md",
    )
    ANNOUNCEMENTS_FILE_PATH = os.path.join(
        Config.PROJECT_ROOT,
        f"../../depmap-deploy/portal-config/env/{ENV_TYPE}/announcements.yaml",
    )
    THEME_PATH = os.path.join(Config.PROJECT_ROOT, f"../config/{ENV_TYPE}/theme")
    DOCUMENTATION_PATH = os.path.join(
        Config.PROJECT_ROOT,
        f"../../depmap-deploy/portal-config/env/{ENV_TYPE}/documentation.yaml",
    )
    DMC_SYMPOSIA_PATH = os.path.join(
        Config.PROJECT_ROOT,
        f"../../depmap-deploy/portal-config/env/{ENV_TYPE}/dmc_symposia.yaml",
    )
    DOWNLOADS_PATH = os.path.join(
        Config.PROJECT_ROOT,
        f"../../depmap-deploy/portal-config/env/{ENV_TYPE}/downloads",
    )
    SHARED_DOWNLOADS_PATH = os.path.join(
        Config.PROJECT_ROOT,
        "../../depmap-deploy/portal-config/env/shared/shared_downloads",
    )
    DEV_DOWNLOADS_PATH = os.path.join(Config.PROJECT_ROOT, f"../config/dev/downloads")
    DOWNLOADS_KEY = os.path.join(
        Config.PROJECT_ROOT, "./secrets/dev-downloads-key.json",
    )
    FORUM_API_KEY = os.path.join(
        Config.PROJECT_ROOT, "./secrets/iqa-forum-api-key.txt",
    )
    if ENV_TYPE != "public":
        AUTH_CONFIG_FILE = os.path.join(
            LOADER_DATA_DIR, "settings/access_control_config.py"
        )
    DEBUG_TB_ENABLED = True
    DATA_LOAD_CONFIG = dev_datasets
    SHOW_TAIGA_IN_DOWNLOADS = True if ENV_TYPE == "skyros" else False
    ALLOW_CUSTOM_DOWNLOAD_WITH_TAIGA_URL = True
    SHOW_TAIGA_IN_BULK_DOWNLOADS = True
    GET_NONSTANDARD_DATASETS = get_dev_nonstandard_datasets
    FEEDBACK_FORM_URL = get_setting_from_config("FEEDBACK_FORM_URL", ENV_TYPE)
    CONTACT_EMAIL = get_setting_from_config("CONTACT_EMAIL", ENV_TYPE)
    ASSETS_DEBUG = True  # Don't bundle/minify static assets
    METHYLATION_DATABASE = "sample_data/cpg-meth.sqlite3"
    CACHE_NO_NULL_WARNING = True  # suppress warning for lack of caching
    DEFAULT_USER_ID = "dev@sample.com"
    EXTERNAL_TOOLS = (
        get_setting_from_config("EXTERNAL_TOOLS", ENV_TYPE)
        if ENV_TYPE != "public"
        else None
    )
    RELEASE_NOTES_URL = get_setting_from_config("RELEASE_NOTES_URL", ENV_TYPE)
    FORUM_URL = get_setting_from_config("FORUM_URL", ENV_TYPE)
    FORUM_RESOURCES_CATEGORY = "resources-prototype"
    FORUM_RESOURCES_DEFAULT_TOPIC_ID = get_setting_from_config(
        "FORUM_RESOURCES_DEFAULT_TOPIC_ID", ENV_TYPE
    )

    # to test oauth signing using ssh tunnel
    # SERVER_NAME = "dev.cds.team"
    # APPLICATION_ROOT = "/oauth_test"
    # REQUIRE_REQUEST_SIGNATURE_VERIFICATION = True
    # HAS_USER_ACCOUNTS = True
    # OAUTH_SIGNATURE_KEY = "../dev_cds_team_oauth_signature_key"

    # Uncomment this to turn on caching for dev:
    # CACHE_TYPE = "redis"
    # CACHE_REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    # CACHE_KEY_PREFIX = "_flask_redis_cache"
