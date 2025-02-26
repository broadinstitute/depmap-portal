# -*- coding: utf-8 -*-
"""The app module, containing the app factory function."""
from dataclasses import dataclass
import logging
import logging.config
import json
import os

import flask
import pandas as pd
from flask import (
    Flask,
    current_app,
    redirect,
    render_template,
    request,
)
from flask.json import JSONEncoder
from werkzeug.routing import RequestRedirect

from depmap.access_control import initialize_request_user, load_auth_config_for_app
from depmap.access_control.api import Private as AccessControlRESTResource
from depmap.access_control.api import namespace as access_control_namespace
from depmap.access_control.views import blueprint as access_control_blueprint
from depmap.access_control.utils.get_authorizations import is_current_user_an_admin
from depmap.api.views import blueprint as api_blueprint
from depmap.assets import assets, css_cdns, js_cdns, pre_js_cdns
from depmap.authentication.utils import verify_oauth_request_signature
from depmap.cansar.views import blueprint as cansar_blueprint
from depmap.cas.views import blueprint as cas_blueprint
from depmap.cell_line.views import blueprint as cell_line_blueprint
from depmap.celligner.views import blueprint as celligner_blueprint
from depmap.compound.views.index import blueprint as compound_blueprint
from depmap.compute.views import blueprint as compute_blueprint
from depmap.constellation.views import blueprint as constellation_blueprint
from depmap.context.views import blueprint as context_blueprint

from depmap.dataset.models import (
    ColMatrixIndex,
    Dataset,
    Matrix,
    RowMatrixIndex,
)
from depmap.dev.views import blueprint as dev_blueprint
from depmap.download.views import blueprint as download_blueprint
from depmap.experimental.views import blueprint as experimental_blueprint
from depmap.extensions import (
    bcrypt,
    cache,
    in_memory_cache,
    cansar,
    csrf_protect,
    db,
    debug_toolbar,
    exception_reporter,
    humanize,
    login_manager,
    markdown,
    methylation_db,
    breadbox,
)
from depmap.gene.views.index import blueprint as gene_blueprint
from depmap.global_search.views import blueprint as global_search_blueprint

# the list of tables which have row level access controls applied to them
from depmap.interactive.nonstandard.models import (
    ColNonstandardMatrix,
    NonstandardMatrix,
    PrivateDatasetMetadata,
    RowNonstandardMatrix,
)
from depmap.interactive.views import blueprint as interactive_blueprint
from depmap.methylation.views import blueprint as methylation_blueprint
from depmap.partials.views import blueprint as partials_blueprint
from depmap.private_dataset.api import Private as PrivateDatasetRESTResource
from depmap.private_dataset.api import namespace as private_dataset_namespace
from depmap.private_dataset.views import blueprint as private_dataset_blueprint
from depmap.public.minisites import register_minisites
from depmap.public.views import blueprint as public_blueprint
from depmap.private.views import blueprint as private_blueprint
from depmap.theme.views import blueprint as theme_blueprint
from depmap.tda.views import blueprint as tda_blueprint
from depmap.tile.views import blueprint as tile_blueprint
from depmap.compound_dashboard.views import blueprint as compound_dashboard_blueprint
from depmap.utilities import color_palette
from depmap.utilities.mobile_utils import is_mobile
from depmap.vector_catalog.views import blueprint as vector_catalog_blueprint
from depmap.external_tools.views import blueprint as external_tools_blueprint
from depmap.data_explorer_2.views import blueprint as data_explorer_2_blueprint
from depmap.groups_manager.views import blueprint as groups_manager_blueprint
from depmap.dataset_manager.views import blueprint as dataset_manager_blueprint
from depmap.theme import include_theme_snippet
from depmap.context_explorer.views import blueprint as context_explorer_blueprint
from depmap.data_page.views import blueprint as data_page_blueprint
from flask_hunter_profile.flask_blueprint import (
    flask_hunter_profile as flask_hunter_profile_blueprint,
)

log = logging.getLogger(__name__)

ACCESS_CONTROLLED_TABLES = [
    Dataset.__tablename__,
    Matrix.__tablename__,
    RowMatrixIndex.__tablename__,
    ColMatrixIndex.__tablename__,
    NonstandardMatrix.__tablename__,
    ColNonstandardMatrix.__tablename__,
    RowNonstandardMatrix.__tablename__,
    PrivateDatasetMetadata.__tablename__,
]

pd.set_option("mode.use_inf_as_na", False)


def _fix_disabled_loggers(logger_names):
    # if logging gets configures (as it does inside of alembic commands) then any existing loggers get disabled.
    # this walk through the loggers mentioned to make sure they're all enabled.
    to_enable = []

    existing_names = list(logging.root.manager.loggerDict.keys())
    existing_names.sort()

    previous_match = None
    for name in existing_names:
        if previous_match is not None:
            if name.startswith(previous_match):
                to_enable.append(name)
            else:
                previous_match = None

        if previous_match == None:
            if name in logger_names:
                previous_match = name
                to_enable.append(name)

    for name in to_enable:
        logger = logging.getLogger(name)
        logger.disabled = False


def setup_logging(log_config):
    # set up logging, do this before importing create_app because any call to flask.logging will
    # install a default log config. Note, this disables any existing loggers which have been created.
    # If you want to keep those loggers, just be sure to include the in LOG_CONFIG, otherwise
    # all output from those will be suppressed.
    logging.config.dictConfig(log_config)
    _fix_disabled_loggers(set(log_config["loggers"].keys()))


def create_app(config_object):
    """An application factory, as explained here: http://flask.pocoo.org/docs/patterns/appfactories/.

    :param config_object: The configuration object to use.
    """
    setup_logging(config_object.LOG_CONFIG)

    app = Flask(__name__.split(".")[0])
    app.config.from_object(config_object)

    @app.context_processor
    def inject_jinja_globals():
        def raise_exception(x):  # this cannot be a lambda function
            raise Exception(x)

        def get_alert_banner_message():
            message = None
            alert_path = os.path.join(
                current_app.config["WEBAPP_DATA_DIR"], "alert.html"
            )
            if os.path.exists(alert_path):
                with open(alert_path) as f:
                    message = f.read()

            # check user browser and version
            browser = flask.request.user_agent.browser
            version = flask.request.user_agent.version

            browsers_and_min_versions = {
                "edge": 80,
            }
            if browser and version:
                # this can have trouble parsing the version because the `int()` call
                # can throw an exception which prevents the whole page from loading
                if browser in browsers_and_min_versions.keys():
                    try:
                        major_version = int(version.split(".")[0])
                    except ValueError:
                        major_version = 0

                    if major_version < browsers_and_min_versions[browser]:
                        browser_message = (
                            browser.capitalize()
                            + " "
                            + str(major_version)
                            + " is not compatible with the DepMap Portal.  Please upgrade your browser or switch to a different browser."
                        )
                        message = message + "<br/>" if message else ""
                        message += browser_message

            return message

        def process_color_palette():
            color_palette_dict = {}
            for attr in dir(color_palette):
                if attr.endswith("_color"):
                    color_palette_dict[attr] = getattr(color_palette, attr)
            return color_palette_dict

        return {
            "raise": raise_exception,
            "css_cdns": css_cdns,
            "js_cdns": js_cdns,
            "pre_js_cdns": pre_js_cdns,
            "webpack_url": webpack_url,
            "alert_banner_message": get_alert_banner_message,
            "color_palette": process_color_palette(),
            "is_mobile": is_mobile(request),
            "is_admin_user": is_current_user_an_admin(),
            "include_theme_snippet": include_theme_snippet,
        }

    @app.template_filter("restrict_str_length")
    def restrict_str_length(value, max_length):
        value = str(value)
        if len(value) > max_length:
            len_to_keep = int((max_length - 3) / 2)
            return value[:len_to_keep] + "..." + value[-len_to_keep:]
        return value

    register_extensions(app)
    register_blueprints(app)
    register_minisites(app)
    register_errorhandlers(app)
    register_shellcontext(app)
    register_commands(app)
    register_json_encoder(app)

    register_access_control(app)
    # setup database before first request
    app.before_first_request(enable_access_controls)

    return app


def get_table_mapping_for_access_controls():
    table_mapping = {}
    for table_name in ACCESS_CONTROLLED_TABLES:
        table_mapping[table_name] = "{}_write_only".format(table_name)
    return table_mapping


def enable_access_controls():
    from depmap.access_control.sql_rewrite import (
        enable_access_controls as _enable_access_controls,
    )

    _enable_access_controls(db.engine, get_table_mapping_for_access_controls())


def create_filtered_views():
    from depmap.access_control.sql_rewrite import (
        create_filtered_views as _create_filtered_views,
    )

    _create_filtered_views(db.engine, get_table_mapping_for_access_controls())


def register_extensions(app: Flask):
    """Register Flask extensions."""
    assets.init_app(app)
    bcrypt.init_app(app)
    cache.init_app(app)
    in_memory_cache.init_app(app, config={"CACHE_TYPE": "simple"})
    db.init_app(app)
    csrf_protect.init_app(app)
    login_manager.init_app(app)
    debug_toolbar.init_app(app)
    methylation_db.init_app(app)
    cansar.init_app(app)
    breadbox.init_app(app)

    exception_reporter.init_app(app, service_name="depmap-" + app.config["ENV"])
    markdown(app)
    humanize(app)

    return None


# This must match the oauth2_proxy config parameter "skip_auth_regex"
# If a path bypasses oauth2_proxy than we'll be missing the X-Forwarded-User
# header and auth assert will fail. Currently this is only needed for downloading
# of recorded performance profiles.
OAUTH2_PROXY_BYPATHED_PATHS = ["/dev/download-profile/", "/api/health_check/"]


def register_access_control(app: Flask):
    # load the authorization config, just once
    load_auth_config_for_app(app)

    def authenticate_user():
        """
        Run before every request, only runs when a request this made
        """

        if current_app.config["REQUIRE_REQUEST_SIGNATURE_VERIFICATION"]:
            # will abort 401 if signature verification fails
            verify_oauth_request_signature()

        if current_app.config["HAS_USER_ACCOUNTS"]:
            # we only have special user identities for specific servers
            # this SHOULD ONLY BE TURNED ON when we know that the headers are coming from oauth, to prevent impersonation by spoofing headers
            assert current_app.config["SERVER_NAME"] in {
                "dev.cds.team",
                "cds.team",
                "dmc.depmap.org",
                "peddep.depmap.org",
            }, "User accounts should only be available on servers that have oauth to authenticate users"

            # try to get from the oauth email address
            user_id = request.headers.get("X-Forwarded-Email")

            # if we don't have that try oauth user name
            if user_id is None:
                user_id = request.headers.get("X-Forwarded-User")

            if user_id is None:
                # handled whitelisted URLs. See comment on OAUTH2_PROXY_BYPATHED_PATHS
                for bypass_path in OAUTH2_PROXY_BYPATHED_PATHS:
                    if request.path.startswith(bypass_path):
                        user_id = "oauth2_proxy_bypassed_path"
                        break

            assert user_id, "Could not determine user_id for this request"

            # set the user identity
            initialize_request_user(user_id)
        else:
            # if there are no user accounts, user id will later be set to the default user
            # additionally, if there are no user accounts, we expect no oauth headers
            # xqa and xstaging on dev.cds.team will be configured to remove oauth headers
            assert (
                "X-Forwarded-Email" not in request.headers
                and "X-Forwarded-User" not in request.headers
            )

        return None  # everything is ok, carry on with the request

    app.before_request(authenticate_user)


def register_blueprints(app: Flask):
    """Register Flask blueprints."""
    app.register_blueprint(public_blueprint)
    app.register_blueprint(private_blueprint)
    app.register_blueprint(theme_blueprint)
    app.register_blueprint(gene_blueprint)
    app.register_blueprint(cell_line_blueprint)
    app.register_blueprint(celligner_blueprint)
    app.register_blueprint(dev_blueprint)
    app.register_blueprint(context_blueprint)
    app.register_blueprint(interactive_blueprint)
    app.register_blueprint(global_search_blueprint)
    app.register_blueprint(partials_blueprint)
    app.register_blueprint(download_blueprint)
    app.register_blueprint(compound_blueprint)
    app.register_blueprint(methylation_blueprint)
    app.register_blueprint(experimental_blueprint)
    app.register_blueprint(compute_blueprint)
    app.register_blueprint(cansar_blueprint)
    app.register_blueprint(cas_blueprint)
    app.register_blueprint(access_control_blueprint)
    app.register_blueprint(tda_blueprint)
    app.register_blueprint(vector_catalog_blueprint)
    app.register_blueprint(private_dataset_blueprint)
    app.register_blueprint(constellation_blueprint)
    app.register_blueprint(tile_blueprint)
    app.register_blueprint(compound_dashboard_blueprint)
    app.register_blueprint(external_tools_blueprint)
    app.register_blueprint(data_explorer_2_blueprint)
    app.register_blueprint(groups_manager_blueprint)
    app.register_blueprint(dataset_manager_blueprint)
    app.register_blueprint(context_explorer_blueprint)
    app.register_blueprint(data_page_blueprint)
    app.register_blueprint(flask_hunter_profile_blueprint)

    saved_handlers = app.handle_exception, app.handle_user_exception
    app.register_blueprint(api_blueprint)

    with app.app_context():
        if not app.config["ENABLED_FEATURES"].access_control_and_private_resources:
            access_control_namespace.hide(AccessControlRESTResource)
            private_dataset_namespace.hide(PrivateDatasetRESTResource)

    if app.config["DEBUG"]:
        # RESTplus installs an error handler which will return a simple json error message on any exceptions.
        # if we're debugging we'd rather get the interactive flask debugger. Get that back by restoring the
        # original exception handlers
        app.handle_exception, app.handle_user_exception = saved_handlers  # type: ignore
    return None


def register_errorhandlers(app: Flask):
    """Register error handlers."""

    def render_error(error):
        """Render error template."""
        # submit this exception to stackdriver if properly configured
        error_code = getattr(error, "code", 500)
        user_agent = request.headers.get("User-Agent", "")

        # we're really only interested in exceptions from real people going in stack driver
        if 500 <= error_code < 600:
            if "bot" in user_agent.lower():
                log.warning(
                    "Not logging exception to stackdriver because user_agent contained 'bot'"
                )
            else:
                exception_reporter.report()

        # If a HTTPException, pull the `code` attribute; default to 500
        return render_template("{0}.html".format(error_code)), error_code

    for errcode in [401, 404, 429, 500]:
        app.register_error_handler(errcode, render_error)

    app.register_error_handler(RequestRedirect, lambda r: redirect(r.new_url))

    return None


def register_shellcontext(app: Flask):
    """Register shell context objects."""

    def shell_context():
        """
        A function that flask runs when it creates the shell context
        Normally, this would return a dictionary of key (variables) : values of variables to make available in the flask shell
        In this case, we don't have any of those. However, even though we return an empty dict, flask executes the code here when making the shell context
        We thus use this function to create a request context
        Verified that code here does not run when launching flask run
        """

        def create_request_context():
            """
            Separate function to write this documentation
            this creates a request context, which enables access to tables that have access control on them
            additional permissions may be required to view protected datasets
            from depmap.access_control import all_records_visible
            with all_records_visible():
                code
            """
            ctx = app.test_request_context()
            ctx.push()

        create_request_context()
        return {}

    app.shell_context_processor(shell_context)


def register_commands(app: Flask):
    from depmap.cli_commands import (
        db_load_commands,
        post_deploy_commands,
        spawn_commands,
    )

    """Register Click commands."""
    app.cli.add_command(db_load_commands.recreate_dev_db)
    app.cli.add_command(db_load_commands.fixup_dataset_names)
    app.cli.add_command(db_load_commands.recreate_full_db)
    app.cli.add_command(db_load_commands.export_cell_lines)
    app.cli.add_command(db_load_commands.reload_resources)
    app.cli.add_command(post_deploy_commands.check_data_issues)
    app.cli.add_command(post_deploy_commands.check_download_data)
    app.cli.add_command(post_deploy_commands.check_nonstandard_datasets)
    app.cli.add_command(spawn_commands.run_worker)
    app.cli.add_command(spawn_commands.run_dev_worker)
    app.cli.add_command(spawn_commands.webpack)


def register_json_encoder(app: Flask):
    def encoder_default_disallow_nan(*args, **kwargs):
        kwargs["allow_nan"] = False
        return JSONEncoder(*args, **kwargs)

    app.json_encoder = encoder_default_disallow_nan


@in_memory_cache.cached(timeout=0, key_prefix="webpack_manifest")
def get_webpack_manifest():
    """Wepback outputs a manifest.json file which is a mapping from source
    filenames to output filenames. Each output filename contains a content hash
    which allows for cache busting."""
    try:
        filepath = os.path.join(current_app.root_path, "static/webpack/manifest.json")
        with open(file=filepath, encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        print("Webpack manifest.json not found. Did you forget to run webpack?")
        raise


def webpack_url(name):
    # If enabled, serve assets from webpack-dev-server.
    if current_app.config["USE_FRONTEND_DEV_SERVER"]:
        return "http://localhost:5001/depmap/static/webpack/" + name

    # A few test exercise views to some extent but don't actually simulate a
    # browser. That means nothing on the pytest side will ever try to load this
    # URL. We provide a dummy one rather than hitting the file system to look
    # for Webpack output files (which may not exist if pytest is running
    # locally).
    if current_app.config["ENV"] == "test":
        return "dummy.js"

    # Otherwise, look up the hashed filename and serve from the Webpack output
    # directory.
    root_url = current_app.config["APPLICATION_ROOT"]
    root_url = "" if root_url == "/" else root_url
    manifest = get_webpack_manifest()
    return root_url + "/static/webpack/" + manifest[name]
