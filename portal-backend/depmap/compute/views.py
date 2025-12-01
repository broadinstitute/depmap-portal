import logging

from flask import abort, Blueprint, render_template, request
from flask_restplus import Api, Resource
import pandas as pd

from depmap.interactive import interactive_utils
from depmap.breadbox_shim import breadbox_shim
from depmap.celery_task.utils import (
    format_taskless_error_message,
    task_response_model,
)
from depmap.extensions import csrf_protect, restplus_handle_exception
from depmap_compute.models import AnalysisType
from depmap_compute.slice import slice_id_to_slice_query

blueprint = Blueprint(
    "compute", __name__, url_prefix="/compute", static_folder="../static"
)

restplus = Api(
    blueprint,
    validate=True,
    decorators=[
        csrf_protect.exempt
    ],  # required, else 400s saying csrf token is missing
    title="Internal restplus endpoints",
    version="1.0",
    description="These are endpoints that use restplus to better document and define contracts. This is not a user-facing interface.",
)
restplus.errorhandler(Exception)(restplus_handle_exception)

log = logging.getLogger(__name__)


@blueprint.route("/ui")
def ui():
    return render_template("compute/ui.html")


@restplus.route("/compute_univariate_associations")
class ComputeUnivariateAssociations(Resource):
    @restplus.doc(
        description="Runs univariate associations",
        params={
            "analysisType": {
                "description": 'Either "pearson", "association", or "two_class"'
            },
            "datasetId": {"description": "the dataset to search for association"},
            "queryCellLines": {
                "description": "A list of depmap ids, such that the calculation will only use values for these lines. Must be provided for two class, optional for association.",
                "type": "list",
            },
            "queryId": {
                "description": "Associations only, slice id accepted by the interactive module for the profile to search for (must be None if queryValues is provided, aka two class)"
            },
            "vectorVariableType": {
                "description": 'Association and two class only. Either "dependent" or "independent". Indicates whether the vector is the dependent or independent variable'
            },
            "queryValues": {
                "description": "Two class only, list of labels 'in' or 'out', a value for each cell line in the query. (Must be None if queryId is provided)",
                "type": "list",
            },
        },
    )
    @restplus.marshal_with(restplus.model("Task", task_response_model,))
    def post(self):
        dataset_id = request.json.get("datasetId")
        query_id = request.json.get("queryId")
        vector_variable_type = request.json.get("vectorVariableType")
        query_cell_lines = request.json.get("queryCellLines")
        query_values = request.json.get("queryValues")

        analysis_type = {
            "pearson": AnalysisType.pearson,
            "association": AnalysisType.association,
            "two_class": AnalysisType.two_class,
        }[request.json.get("analysisType")]

        # verify fields were populated in their correct combinations for the appropriate analysis
        assert dataset_id is not None

        # check vector_variable_type and assign vector_is_dependent
        if analysis_type == AnalysisType.pearson:
            assert vector_variable_type is None
            vector_is_dependent = None
        else:
            assert (
                vector_variable_type == "dependent"
                or vector_variable_type == "independent"
            ), "Unexpected vector_variable_type, is {}. Must be 'dependent' or 'independent'".format(
                vector_variable_type
            )
            vector_is_dependent = vector_variable_type == "dependent"

        # check other parameters
        if (
            analysis_type == AnalysisType.pearson
            or analysis_type == AnalysisType.association
        ):
            # association and pearson have the same parameters, except for dependent/independent which is handled above

            assert query_id
            # may optionally provide query cell lines
            assert not query_values
        elif analysis_type == AnalysisType.two_class:
            assert not query_id
            assert query_cell_lines
            assert query_values
        else:
            raise ValueError("Unexpected analysis type {}".format(analysis_type))

        # Parse the slice ID if one was provided
        if query_id:
            slice_query = slice_id_to_slice_query(query_id)
            slice_query_is_from_breadbox = slice_query.dataset_id.startswith("breadbox/")
        else:
            slice_query = None
            slice_query_is_from_breadbox = False

        # Forward requests to breadbox a breadbox dataset is requested
        if not dataset_id.startswith("breadbox/"):
            raise ValueError("TODO: return 501 not implemented ")
        else:
            # If the query slice is from a legacy dataset, load it now and pass the values to breadbox
            # The query_cell_lines parameter needs to be the same order/length as the query_values when passed to breadbox.
            if slice_query and not slice_query_is_from_breadbox:
                # In this specific case, it's important to avoid the data_access interface because 
                # breadbox legacy-dataset aliases don't work for lookups by entity_id 
                # (which is still the slice format used by celfie/genomic associations)
                legacy_data_slice: pd.Series = interactive_utils.get_row_of_values_from_slice_id(
                    query_id
                )
                if query_cell_lines is not None:
                    # When the cell lines have been filtered by the user,
                    # the legacy feature series also needs to be filtered before being passed to breadbox.
                    feature_cell_lines = legacy_data_slice.index.tolist()
                    unordered_cell_lines_interesection = list(
                        set(query_cell_lines).intersection(set(feature_cell_lines))
                    )
                    if len(unordered_cell_lines_interesection) == 0:
                        return format_taskless_error_message(
                            "No cell lines in common between query and dataset searched"
                        )
                    legacy_data_slice = legacy_data_slice.loc[
                        unordered_cell_lines_interesection
                    ]
                query_values = legacy_data_slice.tolist()
                query_cell_lines: list[
                    str
                ] = legacy_data_slice.index.tolist()  # pyright: ignore
                slice_query = None
            return breadbox_shim.run_custom_analysis(
                analysis_type=analysis_type,
                dataset_slice_id=dataset_id,
                slice_query=slice_query,
                vector_variable_type=vector_variable_type,
                query_cell_lines=query_cell_lines,
                query_values=query_values,
            )
