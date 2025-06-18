import os
from depmap.settings.settings import Config, make_log_config


def get_dev_config():
    py_path = "../config/dev/settings.py"
    with open(py_path, "rt") as fd:
        contents = fd.read()
    code = compile(contents, py_path, "exec")
    scope = {"__name__": f"depmap_parsed_config"}
    exec(code, scope, scope)
    return scope["DevConfig"]


DevConfig = get_dev_config()

from depmap.read_config import read_config

# copied from autoapp.py. Figure out the config that we're trying to override
# find all the configs and index them by "ENV" name
def get_base_settings():
    env_name = os.getenv("DEPMAP_ENV")
    config_path = os.getenv("CONFIG_PATH")
    return read_config(env_name, config_path)


base_settings = get_base_settings()

LOG_CONFIG = make_log_config(".")

SERVER_NAME = "127.0.0.1:5000"
PROJECT_ROOT = DevConfig.PROJECT_ROOT
LOADER_DATA_DIR = DevConfig.LOADER_DATA_DIR
WEBAPP_DATA_DIR = DevConfig.WEBAPP_DATA_DIR
DOWNLOADS_PATHS = [
    os.path.join(Config.PROJECT_ROOT, f"../config/{base_settings.ENV_TYPE}/downloads",),
    "/Users/amourey/dev/depmap-portal3/depmap-deploy/portal-config/env/shared/public_downloads",
]
THEME_PATH = os.path.join(
    Config.PROJECT_ROOT, f"../config/{base_settings.ENV_TYPE}/theme/"
)
DB_NAME = Config.DB_NAME
DB_PATH = os.path.join(WEBAPP_DATA_DIR, DB_NAME)
NONSTANDARD_DATA_DIR = DevConfig.NONSTANDARD_DATA_DIR
SQLALCHEMY_DATABASE_URI = "sqlite:///{0}".format(DB_PATH)
ADDITIONAL_MOUNTS_DIR = f"../config/{base_settings.ENV_TYPE}/"
THEME_PATH = os.path.join(ADDITIONAL_MOUNTS_DIR, "theme")
PROFILE_DIR = os.path.join(DevConfig.WEBAPP_DATA_DIR, "profiles")
TAIGA_CACHE_DIR = DevConfig.TAIGA_CACHE_DIR
DOWNLOADS_KEY = DevConfig.DOWNLOADS_KEY
CACHE_TYPE = "null"

key_override = "secrets/dev-downloads-key.json"
print("looking for key at ", key_override, ": ", os.path.exists(key_override))
if os.path.exists(key_override):
    DOWNLOADS_KEY = key_override

COMPUTE_RESULTS_ROOT = os.path.join(PROJECT_ROOT, "results")
PREFERRED_URL_SCHEME = "http"
USE_FRONTEND_DEV_SERVER = True

BREADBOX_PROXY_TARGET = os.environ.get("BREADBOX_PROXY_TARGET", "http://127.0.0.1:8000")

AUTH_CONFIG_FILE = None
HAS_USER_ACCOUNTS = False
# uncomment if you want to do something which requires access controls
# if os.environ["DEPMAP_ENV"] == "dstaging":
#     IS_LOCAL_OVERRIDE = True
#     DEFAULT_USER_ID = "____@broadinstitute.org"  # replace with your own user id, do not commit
#     AUTH_CONFIG_FILE = os.path.join(
#         PROJECT_ROOT,
#         "../ansible-configs/roles/depmap/files/dmc_access_control_config.py",
#         # point this to the file for the environment that you are using
#     )

# disable analytics and stackdriver reporting
GOOGLE_ANALYTICS_UA = None
REPORT_EXCEPTIONS = False
CLOUD_TRACE_ENABLED = False
