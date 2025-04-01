import logging

from flask import Blueprint, render_template, request, current_app
from flask_restplus import Api, Resource
import pandas as pd

from depmap import data_access
from depmap.interactive import interactive_utils
from depmap.breadbox_shim import breadbox_shim
from depmap.celery_task.utils import (
    format_task_status,
    format_taskless_error_message,
    task_response_model,
)
from depmap.extensions import csrf_protect, restplus_handle_exception
from depmap.compute import analysis_tasks
from depmap_compute.models import AnalysisType
from depmap_compute.slice import slice_id_to_slice_query
from depmap.user_uploads.utils.task_utils import get_current_result_dir

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
        if dataset_id.startswith("breadbox/"):
            # If the query slice is from a legacy dataset, load it now and pass the values to breadbox
            # The query_cell_lines parameter needs to be the same order/length as the query_values when passed to breadbox.
            if slice_query and not slice_query_is_from_breadbox:
                # In this one specific case, we avoid the data_access method because 
                # breadbox-legacy-dataset-aliases don't work for lookups by entity_id 
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

        # Two-class comparison case
        if analysis_type == AnalysisType.two_class:
            cl_query_vector = query_cell_lines
            assert all(
                x in {"in", "out"} for x in query_values
            ), "Expecting values in {} to be either 'in' or 'out'".format(query_values)
            value_query_vector = [0 if x == "out" else 1 for x in query_values]

        # Pearson and association case
        elif (
            analysis_type == AnalysisType.pearson
            or analysis_type == AnalysisType.association
        ):
            # association and pearson have the same parameters
            # 1. main query vector
            # 2. which is dependent/independent, the matrix or the vector
            # 3. optionally, a list of cell line depmap ids
            assert slice_query is not None
            if slice_query_is_from_breadbox:
                query_series = data_access.get_slice_data(slice_query)
            else: 
                # In this one specific case, we avoid the data_access method because 
                # breadbox-legacy-dataset-aliases don't work for lookups by entity_id 
                # (which is still the slice format used by celfie/genomic associations)
                query_series = interactive_utils.get_row_of_values_from_slice_id(
                    query_id
                )
            query_series = query_series[~query_series.isna()] # In theory, this line is now redundant

            # cl_query_vector is the intersection of cell lines in both data tracts plus the cell line subset
            (
                cl_query_vector,
                value_query_vector,
            ) = subset_values_by_intersecting_cell_lines(query_series, query_cell_lines)
        else:
            raise ValueError("Unexpected analysis type {}".format(analysis_type))

        # further intersect cell lines with the dataset being used. Get the list of cell lines actually used in computation
        depmap_ids_filtered = []
        values_filtered = []
        dataset_depmap_ids = set(data_access.get_dataset_sample_ids(dataset_id))
        for depmap_id, value in zip(cl_query_vector, value_query_vector):
            if depmap_id in dataset_depmap_ids:
                depmap_ids_filtered.append(depmap_id)
                values_filtered.append(value)

        if len(depmap_ids_filtered) == 0:
            return format_taskless_error_message(
                "No cell lines in common between query and dataset searched"
            )

        result_dir = get_current_result_dir()

        # celery requires serialization, and will silently serialize the enum if we don't
        # everything that gets passed to celery needs to be the string (params, and direct args to the function)
        analysis_type_name = analysis_type.name
        parameters = dict(
            datasetId=dataset_id,
            query=dict(
                analysisType=analysis_type_name,  # type is enum
                queryId=query_id,
                queryValues=values_filtered,
                vectorIsDependent=vector_is_dependent,
                queryCellLines=depmap_ids_filtered,
            ),
        )

        from depmap.access_control import get_current_user_for_access_control

        result = analysis_tasks.run_custom_analysis.delay(
            analysis_type_name,
            depmap_ids_filtered,
            values_filtered,
            vector_is_dependent,
            parameters,
            result_dir,
            get_current_user_for_access_control(),
            dataset_id,
        )
        return format_task_status(result)


def subset_values_by_intersecting_cell_lines(query_series, index_subset=None):
    """
    Given a query and a list of indices to subset by,
        return (index list, list of values from query), aligned along the index,
        representing the intersection of all data tracts
    :return: (index list, list of query), intersected and aligned
    """
    if index_subset is not None:
        query_series = query_series.loc[
            set.intersection(set(query_series.index), set(index_subset))
        ]

    return query_series.index.tolist(), query_series.values.tolist()
