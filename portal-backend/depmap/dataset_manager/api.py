from flask import abort, current_app, request
from flask_restplus import Namespace, Resource

from breadbox_facade.exceptions import BreadboxException

from depmap import data_access
from depmap.data_access.response_parsing import (
    is_breadbox_id,
    format_breadbox_task_status,
)
from depmap import extensions

namespace = Namespace("dataset_manager", description="Manage Breadbox datasets")


@namespace.route("/copy_to_breadbox")
class CopyToBreadbox(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.doc(
        description="Copy a continuous matrix dataset from the legacy database into breadbox. Once copied, the portal will use the breadbox version by default.",
        params={
            "dataset_id": {
                "description": "The ID of the legacy dataset which should be copied",
                "type": "string",
                "required": True,
            },
            "group_id": {
                "description": "The UUID of the breadbox group that the dataset should be copied to. If none is provided, the dataset will be copied to the public group.",
                "type": "string",
                "default": None,
            },
            "feature_type": {
                "description": "The the breadbox feature type that should be used for this dataset.",
                "type": "string",
                "default": None,
            },
        },
    )
    def post(self):
        """
        Copy a continuous matrix dataset from the portal into breadbox.
        Any tabular/metadata datasets will need to be done on a more case-by-case basis.
        """
        dataset_id = request.args.get("dataset_id")
        group_id = request.args.get(
            "group_id", extensions.breadbox.client.PUBLIC_GROUP_ID
        )
        feature_type = request.args.get("feature_type")

        if is_breadbox_id(dataset_id):
            abort(400, f"The given dataset id '{dataset_id}' is a breadbox dataset.")

        if not data_access.is_continuous(dataset_id):
            abort(
                404, f"No existing continuous dataset found with the id '{dataset_id}'"
            )

        # Create the datatype if it doesn't already exist
        breadbox_data_types = [
            dt.name for dt in extensions.breadbox.client.get_data_types()
        ]
        dataset_data_type = data_access.get_dataset_data_type(dataset_id)
        if dataset_data_type and dataset_data_type not in breadbox_data_types:
            extensions.breadbox.client.add_data_type(dataset_data_type)

        # Check if this dataset already exists in breadbox
        existing_breadbox_datasets = extensions.breadbox.client.get_datasets()
        for bb_dataset in existing_breadbox_datasets:
            metadata = bb_dataset.dataset_metadata
            if metadata and metadata.to_dict().get("legacy_dataset_id") == dataset_id:
                abort(
                    400,
                    f"Dataset {dataset_id} has already been copied to breadbox dataset '{bb_dataset.id}'",
                )

        legacy_data_df = data_access.get_subsetted_df_by_labels(
            dataset_id, feature_row_labels=None, sample_col_ids=None
        )
        # Convert column names from label -> id
        feature_ids_by_label = data_access.get_dataset_feature_ids_by_label(dataset_id)
        breadbox_upload_df = legacy_data_df.transpose().rename(
            columns=feature_ids_by_label
        )
        # Make sure the sample_ids are included in the upload (the index is dropped)
        breadbox_upload_df = breadbox_upload_df.rename_axis("depmap_id").reset_index()
        # Certain values are optional in the legacy backend but required in breadbox
        units = data_access.get_dataset_units(dataset_id)
        data_type = data_access.get_dataset_data_type(dataset_id)
        assert units is not None
        assert data_type is not None

        try:
            dataset_response = extensions.breadbox.client.add_matrix_dataset(
                name=data_access.get_dataset_label(dataset_id),
                units=units,
                data_type=data_type,
                data_df=breadbox_upload_df,
                priority=data_access.get_dataset_priority(dataset_id),
                taiga_id=data_access.get_dataset_taiga_id(dataset_id),
                feature_type=feature_type,
                sample_type="depmap_model",
                group_id=group_id,
                # Hard-coding a few values we assume to be true for datasets being copied over
                is_transient=False,
                value_type="continuous",
                dataset_metadata={"legacy_dataset_id": dataset_id,},
            )
            return dataset_response
        except BreadboxException as e:
            abort(400, str(e))
