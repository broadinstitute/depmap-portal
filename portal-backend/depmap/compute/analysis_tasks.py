import os
import time
from typing import Dict, List, Optional

from depmap.access_control.utils.initialize_current_auth import assume_user
from depmap_compute import analysis_tasks_interface
from depmap_compute.models import AnalysisType
from depmap.compute.celery import app


import logging

from depmap import data_access
from depmap.compute.models import CustomCellLineGroup
from depmap.vector_catalog.models import (
    SliceRowType,
    SliceSerializer,
)


log = logging.getLogger(__name__)


def make_result_task_directory(result_dir: str, task_id: str):
    result_task_dir = os.path.join(result_dir, task_id)
    os.makedirs(result_task_dir)
    return result_task_dir


def get_features(
    dataset_id: str, feature_labels: list[str]
) -> List[analysis_tasks_interface.Feature]:
    features = []
    for feature_label in feature_labels:
        slice_id = SliceSerializer.encode_slice_id(
            dataset=dataset_id,
            feature=feature_label,
            slice_row_type=SliceRowType.label
        )
        features.append(analysis_tasks_interface.Feature(feature_label, slice_id))

    return features


@app.task(bind=True)
def run_custom_analysis(
    self,
    analysis_type: str,  # things that go through redis need to be serialized
    cell_line_query_vector: List[str],
    value_query_vector: List[float],
    vector_is_dependent: Optional[bool],
    parameters: Dict,
    result_dir: str,
    user_id: str,
    dataset_id: str,
):
    """
    :param self:
    :param analysis_type: The type of analysis
    :param dep_mat_col_indices: The indices of the columns to search (may be a subset of the matrix)
    :param dataset_id: The id of the dataset to search.
    :param value_query_vector: The query profile to search for
    :param vector_is_dependent:
    :param parameters: Additional parameters to return in the response when we're done
    :param result_dir: The directory to write results to
    :param user_id: The user id that should be used to verify they have access to see the matrix
    :return:
    """
    with assume_user(user_id):
        feature_labels = data_access.get_dataset_feature_labels(dataset_id)
        features = get_features(dataset_id, feature_labels)
        dataset_df = data_access.get_subsetted_df_by_labels(
            dataset_id, feature_labels, cell_line_query_vector
        )

        depmap_model_ids = parameters["query"]["queryCellLines"]

        start_time = time.time()
        analysis_type_enum = AnalysisType(analysis_type)

        last_state_update = {
            "start_time": start_time,
            "message": "Beginning calculations...",
        }
        if not self.request.called_directly:
            self.update_state(
                state="PROGRESS", meta=last_state_update,
            )

        if self.request.called_directly:
            task_id = "called_directly"
        else:
            task_id = self.request.id

        def update_message(
            message=None, start_time=None, max_time: int = 45, percent_complete=None
        ):
            """
            :start_time: the presence of this is used to determine whether we show a progress presented
            :max_time: used to calculate to the end of a fake gloating bar
            """
            # remember the value used for the last update_message so that we don't have to pass all the parameters every time.
            nonlocal last_state_update

            if (
                analysis_type_enum == AnalysisType.association
                or analysis_type_enum == AnalysisType.two_class
            ) and not vector_is_dependent:
                # running mustafa's code with an independent vector causes a much longer running time
                # this is a temporary hack to manages user expectations
                max_time = 280

            last_state_update["message"] = message
            last_state_update["start_time"] = start_time
            last_state_update["percent_complete"] = percent_complete
            last_state_update["max_time"] = max_time

            if not self.request.called_directly:
                self.update_state(
                    state="PROGRESS", meta=last_state_update,
                )

        entity_type = data_access.get_dataset_feature_type(dataset_id)
        result = analysis_tasks_interface.run_custom_analysis(
            task_id,
            update_message,
            analysis_type,
            depmap_model_ids,
            value_query_vector,
            features,
            entity_type,
            dataset_df.values,
            vector_is_dependent,
            parameters,
            result_dir,
            create_cell_line_group,
            use_feature_ids=False,
        )

    return result


def create_cell_line_group(cell_lines: List[str], _: bool) -> str:
    """
    This function contains logic specific to the legacy portal and is 
    passed as an argument to run_custom_analysis (which is in the shared folder).
    Since this function needs to match the signature used by the breadbox implementation, 
    it takes a boolean parameter which is unused. 
    """
    cell_lines_used_group_uuid = CustomCellLineGroup.add(cell_lines)
    filter_slice_id = SliceSerializer.encode_slice_id(
        data_access.get_custom_cell_lines_dataset(),
        cell_lines_used_group_uuid,
        SliceRowType.label,
    )
    return filter_slice_id
