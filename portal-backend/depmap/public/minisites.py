import functools
import logging
import os

import flask
from jinja2 import Environment, FileSystemLoader

# The purpose of the minisites is to serve a set of static content which resides in a directory. Because the content
# is largely static, we don't need to bother with defining a view function for each template. Instead, it will look
# at the url, and if there is a template with that name (after adding .html), it will render it. If the url
# refers to a directory, it looks for "index.html" in that directory.
#
#  Normal jinja templating rules apply.
#

log = logging.getLogger(__name__)


def serve_mini_site(config, root, path):
    full_path = flask.safe_join(root, path)
    assert os.path.isabs(full_path)

    # if the urls references a filename and serve static assets like .png or .css files
    if (
        os.path.exists(full_path)
        and not os.path.isdir(full_path)
        and not full_path.endswith(".html")
    ):
        return flask.send_from_directory(root, path)

    # Check for html file which we can render as a template
    if os.path.exists(full_path):
        if os.path.isdir(full_path):
            html_file = os.path.join(full_path, "index.html")
    else:
        html_file = full_path + ".html"

    if os.path.exists(html_file):
        with open(html_file, "rt") as fd:
            content = fd.read()
        return flask.render_template_string(content)

    return flask.abort(404)


def partial(*args):
    fn = functools.partial(*args)
    # adding these fields because the debug toolbar tries to extract these and
    # throws an exception if not present
    fn.__module__ = __name__
    fn.__name__ = args[0].__name__ + "_partial"
    return fn


def register_minisites(app):
    site_root = os.path.join(os.path.dirname(__file__), "../sites")
    for path in app.config["STATIC_MINI_SITES"]:
        rule = "/" + path + "/"
        site_dir = os.path.join(site_root, path)
        app.add_url_rule(
            rule,
            path + "_index",
            partial(serve_mini_site, app.config, site_dir, "index"),
        )
        app.add_url_rule(
            rule + "<path>", path, partial(serve_mini_site, app.config, site_dir)
        )
