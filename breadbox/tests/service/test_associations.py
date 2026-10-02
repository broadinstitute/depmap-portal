import numpy as np
import pandas as pd
import pytest

from breadbox.db.session import SessionWithUser
from breadbox.service.associations import compute_associations
from breadbox.depmap_compute_embed.slice import SliceQuery
from breadbox.models.dataset import AnnotationType

from tests import factories


def test_compute_associations_within_same_dataset(
    minimal_db: SessionWithUser, settings
):
    """
    compute_associations should correlate every feature in `other_dataset`
    against the profile named by `profile_slice_query`, when that profile
    lives in the dataset being scanned.
    """
    values = np.array(
        [
            [1.0, 3.0, 4.0],  # ACH-1: feat_ref=1, feat_a=3, feat_b=4
            [2.0, 4.0, 3.0],  # ACH-2: feat_ref=2, feat_a=4, feat_b=3
        ]
    )
    data_file = factories.matrix_csv_data_file_with_values(
        feature_ids=["feat_ref", "feat_a", "feat_b"],
        sample_ids=["ACH-1", "ACH-2"],
        values=values,
    )
    # feature_type=None means given_id is used directly as the label (no
    # metadata lookup needed).
    dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type=None,
        sample_type="depmap_model",
        data_file=data_file,
    )
    minimal_db.commit()

    result = compute_associations(
        minimal_db,
        settings.filestore_location,
        dataset,
        SliceQuery(
            dataset_id=dataset.id, identifier="feat_ref", identifier_type="feature_id",
        ),
    )

    assert set(result.columns) == {"given_id", "label", "cor"}

    by_id = dict(zip(result["given_id"], result["cor"]))
    assert set(by_id.keys()) == {"feat_ref", "feat_a", "feat_b"}
    assert by_id["feat_ref"] == pytest.approx(1.0)  # correlated with itself
    assert by_id["feat_a"] == pytest.approx(1.0)  # moves in lockstep
    assert by_id["feat_b"] == pytest.approx(-1.0)  # moves in the opposite direction

    # feature_type=None, so label falls back to given_id for every feature.
    label_by_id = dict(zip(result["given_id"], result["label"]))
    assert label_by_id == {
        "feat_ref": "feat_ref",
        "feat_a": "feat_a",
        "feat_b": "feat_b",
    }


def test_compute_associations_against_profile_from_different_dataset(
    minimal_db: SessionWithUser, settings
):
    """
    The reference profile named by `profile_slice_query` doesn't need to live
    in `other_dataset` — e.g. correlating every feature in a DNA features
    dataset against a gene's actual dependency scores, which live in a
    separate actuals dataset.
    """
    actuals_data_file = factories.matrix_csv_data_file_with_values(
        feature_ids=["SOX10"],
        sample_ids=["ACH-1", "ACH-2"],
        values=np.array([[1.0], [2.0]]),
    )
    actuals_dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type=None,
        sample_type="depmap_model",
        data_file=actuals_data_file,
        given_id="actuals-dataset",
    )

    features_data_file = factories.matrix_csv_data_file_with_values(
        feature_ids=["feat_up", "feat_down"],
        sample_ids=["ACH-1", "ACH-2"],
        values=np.array([[10.0, 30.0], [20.0, 10.0],]),  # ACH-1  # ACH-2
    )
    features_dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type=None,
        sample_type="depmap_model",
        data_file=features_data_file,
        given_id="features-dataset",
    )
    minimal_db.commit()

    result = compute_associations(
        minimal_db,
        settings.filestore_location,
        features_dataset,
        SliceQuery(
            dataset_id=actuals_dataset.id,
            identifier="SOX10",
            identifier_type="feature_id",
        ),
    )

    by_id = dict(zip(result["given_id"], result["cor"]))
    assert set(by_id.keys()) == {"feat_up", "feat_down"}
    assert by_id["feat_up"] == pytest.approx(1.0)  # increases alongside SOX10
    assert by_id["feat_down"] == pytest.approx(-1.0)  # decreases as SOX10 increases


def test_compute_associations_resolves_labels_via_feature_type_metadata(
    minimal_db: SessionWithUser, settings
):
    """
    When `other_dataset` has a feature_type, labels in the result should come
    from that feature type's metadata rather than falling back to given_id.
    This is also verifying a current bug: A feature with no metadata row (featureID4) results in a null label.
    """
    user = settings.admin_users[0]
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="feature-with-metadata",
        display_name="Feature With Metadata",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        axis="feature",
        # Only three of the four features below have a metadata row.
        metadata_df=pd.DataFrame(
            {
                "ID": ["featureID1", "featureID2", "featureID3"],
                "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
            }
        ),
    )

    data_file = factories.matrix_csv_data_file_with_values(
        feature_ids=["featureID1", "featureID2", "featureID3", "featureID4"],
        sample_ids=["ACH-1", "ACH-2"],
        values=np.array([[1.0, 2.0, 1.0, 2.0], [2.0, 1.0, 2.0, 1.0]]),
    )
    dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="feature-with-metadata",
        sample_type="depmap_model",
        data_file=data_file,
    )
    minimal_db.commit()

    result = compute_associations(
        minimal_db,
        settings.filestore_location,
        dataset,
        SliceQuery(
            dataset_id=dataset.id,
            identifier="featureID1",
            identifier_type="feature_id",
        ),
    )

    label_by_id = dict(zip(result["given_id"], result["label"]))
    assert label_by_id["featureID1"] == "featureLabel1"
    assert label_by_id["featureID2"] == "featureLabel2"
    assert label_by_id["featureID3"] == "featureLabel3"
    # featureID4 has no metadata row, so its label should be null.
    assert "featureID4" not in label_by_id
