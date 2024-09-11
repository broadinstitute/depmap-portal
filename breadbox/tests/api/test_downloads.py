import json
import numpy as np
import pandas as pd
from ..utils import assert_status_ok, assert_status_not_ok

from fastapi.testclient import TestClient

from breadbox.compute.analysis_tasks import get_features_info_and_dataset
from breadbox.compute.download_tasks import (
    get_merged_processed_df,
    get_processed_df,
)
from breadbox.compute.download_tasks import (
    get_feature_and_sample_indices_per_merged_dataset,
)
from breadbox.models.dataset import AnnotationType, ValueType
from breadbox.compute.download_tasks import _get_all_sample_indices
from breadbox.schemas.custom_http_exception import UserError
from tests import factories


def _create_dataset(db, settings, features, samples, data):
    dataset = factories.matrix_dataset(
        db,
        settings,
        data_file=factories.matrix_csv_data_file_with_values(
            feature_ids=features, sample_ids=samples, values=data,
        ),
        feature_type="gene",
        value_type=ValueType.continuous,
    )

    return dataset


def test_get_processed_df(minimal_db, settings):
    features = ["feature_" + str(i) for i in range(9)]
    samples = ["cell_line_" + str(i) for i in range(9)]

    num_cols = len(samples)
    num_rows = len(features)

    df = pd.DataFrame()
    for i in range(num_cols):
        df[i] = [j + i / 10 for j in range(num_rows)]

    # Insert data as the admin
    admin_user = settings.admin_users[0]
    factories.feature_type(minimal_db, admin_user, "gene")
    created_dataset = _create_dataset(
        db=minimal_db,
        settings=settings,
        features=features,
        samples=samples,
        data=df.values,
    )

    # Query as the default user
    user = settings.default_user
    minimal_db.reset_user(user)
    feature_labels, feature_indices, dataset = get_features_info_and_dataset(
        db=minimal_db,
        user=user,
        dataset_id=created_dataset.id,
        feature_filter_labels=features,
    )

    sample_indices = _get_all_sample_indices(
        db=minimal_db, user=user, dataset=dataset, given_ids=samples
    )

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    processed_df = get_processed_df(
        db=minimal_db,
        dataset=dataset,
        filestore_location=settings.filestore_location,
        feature_indices=feature_indices,
        sample_indices=sample_indices,
        progress_callback=progress_callback,
        user=user,
        chunk_size=2,
    )

    expected_df = df
    expected_df.columns = [feature for feature in features]
    expected_df.index = [sample for sample in samples]

    assert processed_df.equals(expected_df)
    assert recorded_progress == [18, 36, 54, 72, 90]


def _get_expected_merged_process_df_variables(minimal_db, settings):
    features = ["feature_" + str(i) for i in range(9)]
    samples = ["cell_line_" + str(i) for i in range(9)]
    num_cols = len(samples)
    num_rows = len(features)
    df_single = pd.DataFrame()

    for i in range(num_cols):
        df_single[i] = [j + i / 10 for j in range(num_rows)]

    df = pd.concat([df_single.transpose(), df_single.transpose()])

    # Insert data as the admin
    admin_user = settings.admin_users[0]
    factories.feature_type(minimal_db, admin_user, "gene")
    dataset_avana = _create_dataset(
        db=minimal_db,
        settings=settings,
        features=features,
        samples=samples,
        data=df_single.values,
    )

    dataset_achilles = _create_dataset(
        db=minimal_db,
        settings=settings,
        features=features,
        samples=samples,
        data=df_single.values,
    )

    dataset_ids = [dataset_avana.id, dataset_achilles.id]

    # Query with the non-admin user
    default_user = settings.default_user
    minimal_db.reset_user(default_user)
    (
        feature_indices_per_dataset,
        sample_indices_per_dataset,
        datasets,
    ) = get_feature_and_sample_indices_per_merged_dataset(
        db=minimal_db,
        user=default_user,
        dataset_ids=dataset_ids,
        given_ids=samples,
        feature_labels=features,
    )

    expected_variables = {
        "filestore_location": settings.filestore_location,
        "feature_indices": feature_indices_per_dataset,
        "sample_indices": sample_indices_per_dataset,
        "datasets": datasets,
        "user": default_user,
        "features": features,
        "samples": samples,
        "df": df,
    }

    return expected_variables


def test_get_merged_processed_df(minimal_db, settings):
    expected = _get_expected_merged_process_df_variables(minimal_db, settings)
    datasets = expected["datasets"]
    filestore_location = expected["filestore_location"]
    feature_indices = expected["feature_indices"]
    sample_indices = expected["sample_indices"]
    features = expected["features"]
    samples = expected["samples"]
    user = expected["user"]
    df = expected["df"]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    processed_df = get_merged_processed_df(
        db=minimal_db,
        datasets=datasets,
        filestore_location=filestore_location,
        feature_indices=feature_indices,
        sample_indices=sample_indices,
        progress_callback=progress_callback,
        user=user,
        chunk_size=2,
    )

    expected_df = df.transpose()

    expected_column_list = [f"{datasets[0].name} {feature}" for feature in features] + [
        f"{datasets[1].name} {feature}" for feature in features
    ]
    expected_df.columns = expected_column_list
    expected_df.index = samples
    assert processed_df.equals(expected_df)
    assert recorded_progress == [18, 27, 36, 45, 54, 62, 72, 81, 90, 90]


def test_get_merged_processed_df_custom_feature_list(minimal_db, settings):
    expected = _get_expected_merged_process_df_variables(minimal_db, settings)
    datasets = expected["datasets"]
    filestore_location = expected["filestore_location"]
    feature_indices = expected["feature_indices"]
    sample_indices = expected["sample_indices"]
    features = expected["features"]
    samples = expected["samples"]
    user = expected["user"]
    df = expected["df"]
    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    # Test custom feature list
    processed_df = get_merged_processed_df(
        db=minimal_db,
        datasets=datasets,
        filestore_location=filestore_location,
        feature_indices=[[feature_indices[0][0]], [feature_indices[1][0]]],
        sample_indices=sample_indices,
        progress_callback=progress_callback,
        user=user,
        chunk_size=2,
    )

    expected_df = df.transpose()

    expected_column_list = [f"{datasets[0].name} {feature}" for feature in features] + [
        f"{datasets[1].name} {feature}" for feature in features
    ]
    expected_df.columns = expected_column_list
    expected_df.index = samples

    # Only look at the expected dataframe with the 2 feature columns of interest
    dataset_achilles_col_name = f"{datasets[1].name} {features[0]}"
    dataset_avana_col_name = f"{datasets[0].name} {features[0]}"
    expected_df = expected_df[[dataset_avana_col_name, dataset_achilles_col_name]]

    expected_df.index = samples

    assert processed_df.equals(expected_df)


def test_get_merged_processed_df_custom_sample_list(minimal_db, settings):
    expected = _get_expected_merged_process_df_variables(minimal_db, settings)
    datasets = expected["datasets"]
    filestore_location = expected["filestore_location"]
    feature_indices = expected["feature_indices"]
    sample_indices = expected["sample_indices"]
    features = expected["features"]
    samples = expected["samples"]
    user = expected["user"]
    df = expected["df"]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    processed_df = get_merged_processed_df(
        db=minimal_db,
        datasets=datasets,
        filestore_location=filestore_location,
        feature_indices=feature_indices,
        sample_indices=[sample_indices[0]],  # get 1 sample per dataset
        progress_callback=progress_callback,
        user=user,
        chunk_size=2,
    )

    expected_df = df.transpose()
    expected_df = expected_df[:1]

    expected_column_list = [f"{datasets[0].name} {feature}" for feature in features] + [
        f"{datasets[1].name} {feature}" for feature in features
    ]
    expected_df.columns = expected_column_list
    expected_df.index = [samples[0]]
    assert processed_df.equals(expected_df)
    assert recorded_progress == [18, 27, 36, 45, 54, 62, 72, 81, 90, 90]


# If a custom feature list is used for dataset merging, the entities in the list might not exist in every selected dataset.
# If at least 1 dataset has feature information, proceed as usual, leaving any dataset without ANY matching feature id's
# off of the resulting merged file.
def test_get_merged_processed_df_datasets_without_entities(minimal_db, settings):
    features = ["feature_" + str(i) for i in range(9)]
    samples = ["cell_line_" + str(i) for i in range(9)]
    num_cols = len(samples)
    num_rows = len(features)
    df_single = pd.DataFrame()

    for i in range(num_cols):
        df_single[i] = [j + i / 10 for j in range(num_rows)]

    compound_features = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]

    df = pd.concat([df_single.transpose(), df_single.transpose(), pd.DataFrame()])

    # Insert data as the admin
    admin_user = settings.admin_users[0]
    factories.feature_type(minimal_db, admin_user, "gene")
    dataset_avana = _create_dataset(
        db=minimal_db,
        settings=settings,
        features=features,
        samples=samples,
        data=df_single.values,
    )

    dataset_achilles = _create_dataset(
        db=minimal_db,
        settings=settings,
        features=features,
        samples=samples,
        data=df_single.values,
    )

    factories.feature_type(minimal_db, admin_user, "compound")
    dataset_compound = factories.matrix_dataset(
        minimal_db,
        settings,
        data_file=factories.matrix_csv_data_file_with_values(
            feature_ids=compound_features, sample_ids=samples, values=df_single.values,
        ),
        feature_type="compound",
        value_type=ValueType.continuous,
    )

    # Query as the default user
    user = settings.default_user
    minimal_db.reset_user(user)
    dataset_ids = [
        dataset_avana.id,
        dataset_achilles.id,
        dataset_compound.id,
    ]

    (
        feature_indices_per_dataset,
        sample_indices_per_dataset,
        datasets,
    ) = get_feature_and_sample_indices_per_merged_dataset(
        db=minimal_db,
        user=user,
        dataset_ids=dataset_ids,
        given_ids=samples,
        feature_labels=features,
    )

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    processed_df = get_merged_processed_df(
        db=minimal_db,
        datasets=datasets,
        filestore_location=settings.filestore_location,
        feature_indices=feature_indices_per_dataset,
        sample_indices=sample_indices_per_dataset,
        progress_callback=progress_callback,
        user=user,
        chunk_size=2,
    )

    expected_df = df.transpose()

    expected_column_list = [
        f"{dataset_avana.name} {feature}" for feature in features
    ] + [f"{dataset_achilles.name} {feature}" for feature in features]
    expected_df.columns = expected_column_list
    expected_df.index = samples
    assert processed_df.equals(expected_df)
    assert recorded_progress == [18, 27, 36, 45, 54, 62, 72, 81, 90, 90]


# If no features are present, let error bubble to top so React can display a generic message to the user
def test_get_merged_processed_df_no_info(minimal_db, settings):
    expected = _get_expected_merged_process_df_variables(minimal_db, settings)
    datasets = expected["datasets"]
    user = expected["user"]
    filestore_location = expected["filestore_location"]
    feature_indices = [[], []]
    sample_indices = []

    # interactive_test_utils.reload_interactive_config()

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    error_message = ""
    try:
        processed_df = get_merged_processed_df(
            db=minimal_db,
            datasets=datasets,
            filestore_location=filestore_location,
            feature_indices=feature_indices,
            sample_indices=sample_indices,
            progress_callback=progress_callback,
            user=user,
            chunk_size=2,
        )
    except UserError:
        error_message = "The chosen genes, compounds, or cell lines do not exist in the selected datasets. Nothing to export."

    assert (
        error_message
        == "The chosen genes, compounds, or cell lines do not exist in the selected datasets. Nothing to export."
    )


def test_validate_data_slicer_features(minimal_db, settings, client: TestClient):
    # TODO: it would be nice if this just worked without resetting the user
    any_user = "anyone"
    # Base case: empty list of labels
    response = client.post(
        "/downloads/data_slicer/validate_data_slicer_features",
        headers={"X-Forwarded-User": any_user},
        json={"featureLabels": []},
    )
    assert_status_ok(response)
    assert response.json() == {"valid": [], "invalid": []}

    # Set up a more complicated test case (A matrix dataset with metadata)
    minimal_db.reset_user(settings.admin_users[0])
    feature_type = factories.add_dimension_type(
        minimal_db,
        settings,
        settings.admin_users[0],
        name="feature_type_foobar",
        display_name="Feature Type Foobar",
        id_column="ID",
        axis="feature",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        metadata_df=pd.DataFrame(
            {
                "ID": ["featureID1", "featureID2", "featureID3"],
                "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
            }
        ),
    )
    matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["featureID1", "featureID2", "featureID3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    matrix_dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="feature_type_foobar",
        data_file=matrix_values,
    )

    # More complicated test: both valid and invalid labels and given ids
    response = client.post(
        "/downloads/data_slicer/validate_data_slicer_features",
        headers={"X-Forwarded-User": any_user},
        json=(
            {
                "featureLabels": [
                    # Valid:
                    "featureID1",
                    "FEATUREID2",
                    "FEATURELABEL1",
                    "featureLabel2",
                    # Invalid:
                    "FakeLabel",
                    "SampleID1",
                ]
            }
        ),
    )
    assert_status_ok(response)
    response_content = response.json()
    assert set(response_content.get("valid")) == {"featureLabel1", "featureLabel2"}
    assert set(response_content.get("invalid")) == {
        "FakeLabel",
        "SampleID1",
        "featureID1",
        "FEATUREID2",
    }
