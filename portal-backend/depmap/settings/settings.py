# -*- coding: utf-8 -*-
"""Application configuration."""
from typing import Optional
import os

from depmap.enums import DataTypeEnum

TEST_ENV_TYPE = "test-env-type"


class FeatureFlags:
    def to_dict(self):
        flags = {}

        for item in dir(self):
            if not item.startswith("__"):
                attr = getattr(self, item)
                if not callable(attr):
                    flags[item] = attr

        return flags

    def is_public(self):
        from flask import current_app

        return current_app.config["ENV_TYPE"] == "public"

    def is_qa(self):
        from flask import current_app

        env = current_app.config["ENV"]  # pyright: ignore
        assert isinstance(env, str)
        return env.endswith("qa")

    def is_skyros(self):
        from flask import current_app

        return current_app.config["ENV_TYPE"] in ["skyros", TEST_ENV_TYPE]

    def is_dmc_like(self):
        """Prefer this helper. DMC and PedDep features should stay in sync."""
        from flask import current_app

        return (
            current_app.config["ENV_TYPE"] == "dmc"
            or current_app.config["ENV_TYPE"] == "peddep"
        )

    def is_only_dmc_and_i_have_a_good_reason(self):
        """This should only be used for unusual cases such as the home page."""
        from flask import current_app

        return current_app.config["ENV_TYPE"] == "dmc"

    def is_only_peddep_and_i_have_a_good_reason(self):
        """This should only be used for unusual cases such as the home page."""
        from flask import current_app

        return current_app.config["ENV_TYPE"] == "peddep"

    def is_prerelease_env(self):
        "returns true if this is an environment which should see pre-release functionality"
        from flask import current_app

        return current_app.config["ENV_TYPE"] in (
            "skyros",
            "dmc",
            "peddep",
            TEST_ENV_TYPE,
        )

    def is_early_access(self):
        from flask import session

        return session.get("EARLY_ACCESS", False)

    @property
    def require_download_citations(self):
        return self.is_public()

    @property
    def full_data_page_citation_section(self):
        return self.is_public()

    @property
    def gene_confidence(self):
        return False  # Disabled everywhere as of 22Q4

    @property
    def compound_dashboard_app(self):
        return self.is_prerelease_env()

    @property
    def show_embargo_info(self):
        return self.is_prerelease_env()

    @property
    def use_taiga_urls(self):
        return self.is_skyros()

    @property
    def use_taiga_urls_downloads_page(self):
        return self.is_skyros()

    @property
    def flagship_projects(self):
        return self.is_skyros()

    @property
    def new_compound_page_tabs(self):
        return self.is_prerelease_env()

    @property
    def show_all_new_dose_curve_and_heatmap_tab_datasets(self):
        return True

    @property
    def data_page(self):
        return True

    # The pipeline overview is always hidden because it is an unfinished feature
    @property
    def pipeline_overview(self):
        return False

    @property
    def context_explorer(self):
        return True

    @property
    def context_explorer_prerelease_datasets(self):
        return self.is_prerelease_env()

    @property
    def data_usage(self):
        return self.is_skyros()

    @property
    def cell_line_mapping(self):
        return self.is_skyros()

    @property
    def linear_association(self):
        return self.is_skyros()

    @property
    def extra_dmc_pages(self):
        return self.is_only_dmc_and_i_have_a_good_reason()

    @property
    def bulk_files_csv_url(self):
        return self.is_dmc_like()

    @property
    def access_control_and_private_resources(self):
        return self.is_skyros() or self.is_dmc_like()

    @property
    def resources_page(self):
        return not self.is_only_peddep_and_i_have_a_good_reason()

    @property
    def two_class_comparison(self):
        return self.is_prerelease_env()

    @property
    def morpheus(self):
        return self.is_prerelease_env()

    @property
    def celfie(self):
        return self.is_prerelease_env()

    @property
    def celligner_app_v3(self):
        return True

    # used in depmap/settings/shared.py to set special value for DepDatasetMeta cell_lines
    @property
    def repurposing_secondary_AUC_cell_line_range(self):
        return self.is_prerelease_env()

    # Constellation isn't in the portal anymore, but we still use its view and data for other parts of the portal
    @property
    def constellation_app(self):
        return self.is_prerelease_env()

    @property
    def private_datasets(self):
        return False

    @property
    def dataset_manager(self):
        return self.is_prerelease_env()

    @property
    def target_discovery_app(self):
        return True

    @property
    def gene_tea(self):
        return self.is_prerelease_env()

    # NOTE: This feature flag is separated out from the above
    # "gene_tea" feature flag. "gene_tea" refers to the data
    # explorer integration of gene_tea; whereas, gene_tea_portal_page
    # refers to the portal gene tea tool page.
    @property
    def gene_tea_portal_page(self):
        return self.is_skyros()

    @property
    def anchor_screen_dashboard(self):
        return self.is_dmc_like()

    @property
    def show_peddep_landing_page(self):
        return self.is_public()

    @property
    def show_compound_correlations(self):
        return self.is_qa()


def make_log_config(log_dir):
    return {
        "version": 1,
        "formatters": {
            "default": {
                "format": "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
            },
            "brief": {"format": "%(message)s"},
        },
        "handlers": {
            "wsgi": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stderr",
                "formatter": "default",
            },
            "access-log": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "brief",
                "filename": os.path.join(log_dir, "access.log"),
                "maxBytes": 1024 * 1024 * 50,
                "backupCount": 5,
            },
        },
        "root": {"level": "INFO", "handlers": ["wsgi"]},
        "loggers": {
            "depmap.data_access": {"handlers": ["access-log"]},
            "werkzeug": {"level": "INFO"},
            "alembic": {"level": "INFO"},
            "depmap": {"level": "INFO"},
            "gunicorn": {"level": "INFO"},
            "loader": {"level": "INFO"},
        },
        #        'disable_existing_loggers': False
    }


class Config(object):
    """Base configuration."""

    ENV_TYPE = "public"
    USE_FRONTEND_DEV_SERVER = False
    DB_NAME = "data.db"
    SECRET_KEY = os.getenv("DEPMAP_SECRET")

    APP_DIR = os.path.abspath(
        os.path.dirname(os.path.dirname(__file__))
    )  # Parent directory
    PROJECT_ROOT = os.path.abspath(os.path.join(APP_DIR, os.pardir))
    ADDITIONAL_MOUNTS_DIR = "/install/additional_mounts"
    DOWNLOADS_KEY = os.path.join(ADDITIONAL_MOUNTS_DIR, "downloads-key.json")
    OAUTH_SIGNATURE_KEY = os.path.join(
        ADDITIONAL_MOUNTS_DIR, "signature_key"
    )  # this is only used if there is oauth on the server
    REQUIRE_REQUEST_SIGNATURE_VERIFICATION = False  # we have code for signature verification, but are not currently using it in any environment
    HAS_USER_ACCOUNTS = False  # THIS IS A SECURITY FLAG. Setting this to true in the absence of oauth will allow user impersonation by spoofing headers
    BCRYPT_LOG_ROUNDS = 13
    ASSETS_DEBUG = False
    DEBUG_TB_ENABLED = False  # Disable Debug toolbar
    DEBUG_TB_INTERCEPT_REDIRECTS = False
    CACHE_TYPE = "null"
    # Cache results for 1 day. Thinking of making this infinite because we have a read-only DB.
    # As long as we're using in-memory cache, will be cleared on server restart.
    CACHE_DEFAULT_TIMEOUT = 24 * 60 * 60
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    APPLICATION_ROOT = "/"  # used as a variable to wire into DispatcherMiddleware in autoapp.py, and also as a setting to generate url_for outside a request context on a celery worker (https://flask.palletsprojects.com/en/1.1.x/config/#APPLICATION_ROOT)
    REPORT_EXCEPTIONS = False
    STATIC_MINI_SITES = ["achilles", "ccle"]
    TAIGA_CACHE_DIR = "~/.taiga"
    PROFILE_DIR: Optional[str] = None
    PROFILE_COOKIE_NAME = "profiler-settings"
    S3_DIR = "depmap-pipeline/dev"  # folder from broad-datasci S3 bucket that contains the metadata folder
    GOOGLE_ANALYTICS_UA: Optional[str] = None
    METHYLATION_DATABASE = (
        "/methylation/methylation.sqlite3"  # hardcoded mount point in ansible
    )
    SHOW_TAIGA_IN_DOWNLOADS = False
    SHOW_TAIGA_IN_BULK_DOWNLOADS = False
    ALLOW_CUSTOM_DOWNLOAD_WITH_TAIGA_URL = False
    CANSAR_CREDENTIALS = os.getenv("CANSAR_CREDENTIALS")
    CONTACT_EMAIL = "depmap@broadinstitute.org"
    DEFAULT_USER_ID = "anonymous"
    LOG_CONFIG = make_log_config(".")

    # Should match match-related-matrix xref
    MATCH_RELATED_TAIGA_ID = "related-features-dcbd.5/related_features"
    PREFERRED_URL_SCHEME = "http"
    # only needed for DB build time
    SAMPLE_DATA_DIR = "./sample_data"
    ENABLED_FEATURES = FeatureFlags()
    CLOUD_CORRELATION_ENABLED = False
    CLOUD_TRACE_ENABLED = False
    PROJECT_ID = "broad-achilles"
    METMAP_500_TAIGA_ID = "metmap-data-f459.4/metmap500_flattened_table"
    ANNOUNCEMENTS_PATH = os.path.join(ADDITIONAL_MOUNTS_DIR, "announcements.md")
    ANNOUNCEMENTS_FILE_PATH = os.path.join(ADDITIONAL_MOUNTS_DIR, "announcements.yaml")
    UPDATES_AND_ANNOUNCEMENTS_FILE_PATH = os.path.join(
        ADDITIONAL_MOUNTS_DIR, "theme/updates_and_announcements.md"
    )
    DOCUMENTATION_PATH = os.path.join(ADDITIONAL_MOUNTS_DIR, "documentation.yaml")
    DMC_SYMPOSIA_PATH = os.path.join(ADDITIONAL_MOUNTS_DIR, "dmc_symposia.yaml")
    DOWNLOADS_PATHS = [
        os.path.join(ADDITIONAL_MOUNTS_DIR, "downloads"),
        os.path.join(ADDITIONAL_MOUNTS_DIR, "shared/public_downloads"),
    ]
    BREADBOX_PROXY_TARGET = os.environ.get(
        "BREADBOX_PROXY_TARGET", "http://127.0.0.1:8000"
    )
    BREADBOX_PROXY_DEFAULT_USER = None
    # Since this is using CAS storage, there should be no security issue with different environments sharing
    # storage. However, breaking the prod environments into different buckets to ensure permissions are
    # working properly and allow us to clean up the different environments independently.
    CAS_BUCKET = "depmap-dev-portal-cas"
    URL_UPLOAD_WHITELIST = [
        "https://taiga2.s3.amazonaws.com",
        "https://s3.amazonaws.com/analysis.clue.io/",
        "https://s3.amazonaws.com/assets.clue.io/",
        "https://assets.clue.io/",
        "http://assets.clue.io/",
    ]
    # the cap on how large an upload we'll accept before aborting reading, arbitrarily set huge
    # with the expectation that in some environments we'll want to lower this
    MAX_UPLOAD_SIZE = 10 ** 10
    FORUM_API_KEY = os.getenv("FORUM_API_KEY")


class RemoteConfig(Config):
    CACHE_TYPE = "redis"
    CACHE_REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    CACHE_KEY_PREFIX = "_flask_redis_cache"
    TAIGA_CACHE_DIR = "/data1/taiga"
    REPORT_EXCEPTIONS = True
    DEBUG = False
    DEBUG_TB_ENABLED = False  # Disable Debug toolbar
    PREFERRED_URL_SCHEME = "https"
    BREADBOX_PROXY_TARGET = os.environ.get(
        "BREADBOX_PROXY_TARGET", "http://breadbox:8000"
    )  # Breadbox container URL within network
    LOG_CONFIG = make_log_config("/depmap/log")


# change to force rebuild
# build19


from .shared import DataLoadConfig
from depmap.gene.models import Gene
from datetime import date
from depmap.download.models import (
    DownloadRelease,
    DownloadFile,
    FileSubtype,
    ReleaseType,
    FileSource,
    ReleaseTerms,
    FileType,
    DownloadSettings,
    RetractedUrl,
    SummaryStats,
    ExternalBucketUrl,
)
from depmap.settings.taiga_ids import HUGO_NCGC_TAIGA_ID
from depmap.settings.settings import RemoteConfig, Config
import os

test_datasets = DataLoadConfig(
    hgnc_dataset=HUGO_NCGC_TAIGA_ID, dose_replicate_level_datasets=[],
)


test_downloads = [
    DownloadRelease(
        name="test name version",
        type=ReleaseType.rnai,
        release_date=date(2018, 5, 8),
        description="test description",
        citation="test citation",
        funding="test funding",
        terms=ReleaseTerms.achilles,
        all_files=[
            DownloadFile(
                name="test file name",
                type=FileType.genetic_dependency,
                sub_type=FileSubtype(
                    code="crispr_screen", label="CRISPR Screen", position=0
                ),
                size="test size",
                url="test url",  # urls are tested in the crawler, so this is fine
                taiga_id="test-taiga-id.1",
                sources=[FileSource.broad, FileSource.marcotte],
                summary_stats=SummaryStats(
                    [
                        {"value": 1, "label": "genes"},
                        {"value": 1, "label": "cell lines"},
                        {"value": 1, "label": "primary diseases"},
                        {"value": 1, "label": "lineages"},
                    ]
                ),
                description="test file description",
            ),
            DownloadFile(
                name="headliner2 file name",
                date_override=date(2000, 1, 1),
                type=FileType.omics,
                sub_type=FileSubtype(code="mutations", label="Mutations", position=1),
                size="headliner2 size",
                url=ExternalBucketUrl("fake/test/headliner2_file_name"),
                taiga_id="test-taiga-id.1",
                satisfies_db_taiga_id="small-avana-f2b9.2/avana_score",
                # required for correct testing of test_get_download_records and test_get_taiga_id_to_download
            ),
            DownloadFile(
                name="test file name 2",
                type=FileType.genetic_dependency,
                sub_type=FileSubtype(
                    code="crispr_screen", label="CRISPR Screen", position=0
                ),
                size="test size",
                url=RetractedUrl(),
                taiga_id="test-taiga-id.1",
                retraction_override="retraction description",
                terms_override=ReleaseTerms.depmap,
            ),
        ],
    )
]


def get_test_nonstandard_datasets():
    return {
        "small-mapped-avana-551a.1": {
            "label": "Small Avana entity mapped",
            "units": "CERES Score",
            "data_type": DataTypeEnum.deprecated,
            "feature_name": "Gene",
            "transpose": False,
            "entity": Gene,  # for nonstandard_utils
            "is_continuous": True,
        },
        "small-avana-2987.2": {  # does not have stable IDs, specifically made for dplot testing
            "label": "Small Avana no entity",
            "units": "CERES Score",
            "data_type": DataTypeEnum.deprecated,
            "feature_name": "Gene",
            "transpose": False,
            "is_continuous": True,
        },
        "small-msi-dataset-aa84.4": {
            "label": "MSI",
            "units": "Count",
            "data_type": DataTypeEnum.msi,
            "feature_name": "Variable",
            "feature_example": "isMSI",
            "prepopulate": True,
            "transpose": True,
            "use_arxspan_id": True,
            "is_continuous": True,
        },
    }


# separate dict so that only conftest uses it, don't interfere with the above dictionary
id_to_sample_dir_path = {
    "small-mapped-avana-551a.1": "interactive/small-mapped-avana-551a.1.hdf5",
    "small-avana-2987.2": "interactive/small_avana_unmapped.hdf5",
    "small-msi-dataset-aa84.4": "interactive/small-msi-dataset-aa84.4.hdf5",
}


class TestConfig(Config):
    """
    Test configuration
    Additional settings for:
        DB_PATH
        WEBAPP_DATA_DIR
        NONSTANDARD_DATA_DIR
        COMPUTE_RESULTS_ROOT
        SQLALCHEMY_DATABASE_URI
    are set in the app fixture in conftest, so that a new one is generated per test
    """

    ENV = "test"
    ENV_TYPE = TEST_ENV_TYPE  # so we text max functionality
    DEBUG = True  # this doesn't seem to do anything
    LOADER_DATA_DIR = os.path.join(Config.PROJECT_ROOT, "sample_data")
    AUTH_CONFIG_FILE = os.path.join(
        LOADER_DATA_DIR, "settings/access_control_config.py"
    )
    GET_NONSTANDARD_DATASETS = get_test_nonstandard_datasets
    # For faster tests; needs at least 4 to avoid "ValueError: Invalid rounds"
    BCRYPT_LOG_ROUNDS = 4
    SHOW_TAIGA_IN_DOWNLOADS = False
    ALLOW_CUSTOM_DOWNLOAD_WITH_TAIGA_URL = True
    SHOW_TAIGA_IN_BULK_DOWNLOADS = True
    WTF_CSRF_ENABLED = False  # Allows form testing
    CACHE_NO_NULL_WARNING = True  # suppress warning for lack of caching
    DATA_LOAD_CONFIG = test_datasets
    DOWNLOAD_LIST_FOR_TESTS = test_downloads  # hardcoded list of downloads, specified here to make it easier for tests to override. This property is only valid when config['ENV'] == 'test'. see depmap.settings.download_settings.get_download_list() for more details.
    DOWNLOADS_KEY = os.path.join(
        "sample_data/key/invalid-account-for-testing.json"
    )  # this is a valid formatted cred file, but this key is not actually valid
    FEEDBACK_FORM_URL = None
    CLOUD_TRACE_ENABLED = False
    DOWNLOADS_PATHS = []
    THEME_PATH = os.path.join(Config.PROJECT_ROOT, f"../config/{ENV_TYPE}/theme")
