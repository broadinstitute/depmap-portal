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
from depmap.data_explorer_2.plot import (
    compute_dimension,
    compute_filter,
    compute_metadata,
    compute_waterfall,
)
from depmap.data_explorer_2.performance import generate_performance_report
from depmap.data_explorer_2.datasets import get_datasets_matching_context_with_details
from depmap.data_explorer_2.utils import (
    get_all_dimension_labels_by_id,
    get_all_supported_continuous_datasets,
    get_dimension_labels_across_datasets,
    get_dimension_labels_to_datasets_mapping,
    get_file_and_release_from_dataset,
    get_ids_and_labels_matching_context,
    get_index_display_labels,
    get_reoriented_df,
    get_series_from_de2_slice_id,
    get_union_of_index_labels,
    get_vector_labels,
    make_gzipped_json_response,
    pluralize,
    slice_to_dict,
    to_display_name,
    to_serializable_numpy_number,
)
from depmap.data_explorer_2.datatypes import (
    get_hardcoded_metadata_slices,
    is_hardcoded_binarylike_slice,
)

from depmap.download.models import ReleaseTerms
from depmap.download.views import get_file_record, get_release_record

from depmap_compute.context import LegacyContextEvaluator
from depmap_compute.slice import decode_slice_id

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
