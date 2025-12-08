import re
import logging
import numpy as np
import natsort as ns
import urllib.parse
import scipy.cluster.hierarchy as sch
from flask import (
    Blueprint,
    current_app,
    render_template,
    abort,
    request,
    jsonify,
)

from depmap import data_access
from depmap.extensions import csrf_protect
from depmap.access_control import is_current_user_an_admin
from depmap.data_explorer_2.links import get_plot_link, get_tutorial_link


# TODO: delete things only imported here

log = logging.getLogger(__name__)

blueprint = Blueprint(
    "data_explorer_2",
    __name__,
    url_prefix="/data_explorer_2",
    static_folder="../static",
)


@blueprint.route("/")
def view_data_explorer_2():
    return render_template(
        "data_explorer_2/index.html", tutorial_link=get_tutorial_link()
    )
