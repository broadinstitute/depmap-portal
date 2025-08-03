import numpy as np
import pandas as pd
import pytest
from breadbox.db.session import SessionWithUser
from breadbox.service.associations import compute_associations
from depmap_compute.slice import SliceQuery
from tests import factories


def test_compute_dataset_associations(minimal_db: SessionWithUser, settings, tmpdir):
    """Test computing correlations between a profile and all features in another dataset"""

    # Create dimension types for features and samples
    factories.feature_type_with_metadata(
        minimal_db,
        settings,
        name="gene",
        id_column="gene_id",
        metadata_df=pd.DataFrame(
            {"gene_id": ["GENE1", "GENE2", "GENE3"], "label": ["G1", "G2", "G3"],}
        ),
        user=settings.admin_users[0],
    )

    factories.sample_type_with_metadata(
        minimal_db,
        settings,
        name="cell_line",
        id_column="depmap_id",
        metadata_df=pd.DataFrame(
            {
                "depmap_id": ["ACH-001", "ACH-002", "ACH-003"],
                "label": ["Cell1", "Cell2", "Cell3"],
            }
        ),
        user=settings.admin_users[0],
    )

    # Create first dataset with known values for correlation calculation
    reference_values = np.array(
        [
            [1.0, 2.0, 3.0],  # GENE1 across samples
            [2.0, 4.0, 6.0],  # GENE2 across samples
            [1.0, 1.0, 1.0],  # GENE3 across samples
        ]
    )

    reference_dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="gene",
        sample_type="cell_line",
        data_file=factories.matrix_csv_data_file_with_values(
            feature_ids=["GENE1", "GENE2", "GENE3"],
            sample_ids=["ACH-001", "ACH-002", "ACH-003"],
            values=reference_values.transpose(),
        ),
        dataset_name="reference_dataset",
    )

    # Create second dataset to compute correlations against
    other_values = np.array(
        [
            [2.0, 4.0, 6.0],  # OTHERGENE1 - perfectly correlated with GENE2
            [3.0, 2.0, 1.0],  # OTHERGENE2 - negatively correlated with GENE1
        ]
    )

    other_dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="gene",
        sample_type="cell_line",
        data_file=factories.matrix_csv_data_file_with_values(
            feature_ids=["OTHERGENE1", "OTHERGENE2"],
            sample_ids=["ACH-001", "ACH-002", "ACH-003"],
            values=other_values.transpose(),
        ),
        dataset_name="other_dataset",
    )

    minimal_db.commit()

    # Create slice query for GENE2 from reference dataset
    profile_slice_query = SliceQuery(
        dataset_id=reference_dataset.id,
        identifier_type="feature_id",
        identifier="GENE2",
    )

    # Compute associations
    correlations = compute_associations(
        db=minimal_db,
        filestore_location=settings.filestore_location,
        other_dataset=other_dataset,
        profile_slice_query=profile_slice_query,
    )

    # Verify results
    assert (
        len(correlations) == 2
    )  # Should have correlations for both features in other_dataset

    # GENE2 values [2, 4, 6] should be perfectly correlated with OTHERGENE1 [2, 4, 6]
    assert correlations["OTHERGENE1"] == pytest.approx(1.0, abs=1e-10)

    # GENE2 values [2, 4, 6] should be negatively correlated with OTHERGENE2 [3, 2, 1]
    assert correlations["OTHERGENE2"] == pytest.approx(-1.0, abs=1e-10)
