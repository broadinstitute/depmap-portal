import numpy as np
import pandas as pd
import pytest

from breadbox.db.session import SessionWithUser
from breadbox.service.slice import (
    get_slice_data,
    _flatten_reindex_chain,
    _resolve_reindex_chain,
    _chain_step,
)
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.dataset import ColumnMetadata
from breadbox.schemas.custom_http_exception import UserError

from breadbox.depmap_compute_embed.slice import SliceQuery

from typing import cast
from tests import factories


def test_get_slice_data_with_matrix_dataset(minimal_db: SessionWithUser, settings):
    """
    Test that the get_slice_data function works with all matrix identifier types.
    Also test that it filters NA values correctly.
    """
    filestore_location = settings.filestore_location
    # Define label metadata for our features
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="feature-with-metadata",
        display_name="Feature With Metadata",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        axis="feature",
        metadata_df=pd.DataFrame(
            {
                "ID": ["featureID1", "featureID2", "featureID3"],
                "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
            }
        ),
    )

    # Define label metadata for our samples
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="sample-with-metadata",
        display_name="Sample With Metadata",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["sampleID1", "sampleID2", "sampleID3"],
                "label": ["sampleLabel1", "sampleLabel2", "sampleLabel3"],
            }
        ),
    )

    # Define a matrix dataset
    example_matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["featureID1", "featureID2", "featureID3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[np.NAN, 2, 3], [4, np.NAN, 6], [7, 8, np.NAN]]),
    )
    dataset_given_id = "dataset_123"
    dataset_with_metadata = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type="feature-with-metadata",
        sample_type="sample-with-metadata",
        data_file=example_matrix_values,
        given_id=dataset_given_id,
    )

    # Test queries by feature_id
    feature_id_query = SliceQuery(
        dataset_id=dataset_given_id,
        identifier="featureID2",
        identifier_type="feature_id",
    )
    result_series = get_slice_data(minimal_db, filestore_location, feature_id_query)
    assert result_series.index.tolist() == ["sampleID1", "sampleID3"]
    assert result_series.values.tolist() == [2, 8]

    # Test queries by feature_label
    feature_label_query = SliceQuery(
        dataset_id=dataset_given_id,
        identifier="featureLabel1",
        identifier_type="feature_label",
    )
    result_series = get_slice_data(minimal_db, filestore_location, feature_label_query)
    assert result_series.index.tolist() == ["sampleID2", "sampleID3"]
    assert result_series.values.tolist() == [4, 7]

    # Test queries by sample_id
    sample_id_query = SliceQuery(
        dataset_id=dataset_given_id, identifier="sampleID3", identifier_type="sample_id"
    )
    result_series = get_slice_data(minimal_db, filestore_location, sample_id_query)
    assert result_series.index.tolist() == ["featureID1", "featureID2"]
    assert result_series.values.tolist() == [7, 8]

    # Test queries by sample_label
    sample_label_query = SliceQuery(
        dataset_id=dataset_given_id,
        identifier="sampleLabel2",
        identifier_type="sample_label",
    )
    result_series = get_slice_data(minimal_db, filestore_location, sample_label_query)
    assert result_series.index.tolist() == ["featureID1", "featureID3"]
    assert result_series.values.tolist() == [4, 6]


def test_get_slice_data_with_tabular_dataset(minimal_db: SessionWithUser, settings):
    """
    Test that the get_slice_data function works with tabular identifier types.
    """
    filestore_location = settings.filestore_location
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="some-sample-type",
        axis="sample",
        id_column="ID",
    )

    dataset_given_id = "my-tabular-dataset"
    factories.tabular_dataset(
        minimal_db,
        settings,
        name="some-tabular-dataset",
        columns_metadata={
            "ID": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "count": ColumnMetadata(
                units="somethings", col_type=AnnotationType.continuous
            ),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["sampleID1", "sampleID2", "sampleID3"],
                "label": ["sampleLabel1", "sampleLabel2", "sampleLabel3"],
                "count": [1, 2, 3],
            }
        ),
        index_type_name="some-sample-type",
        given_id=dataset_given_id,
    )

    # Test queries by column
    label_column_query = SliceQuery(
        dataset_id=dataset_given_id, identifier="label", identifier_type="column",
    )
    result_series = get_slice_data(minimal_db, filestore_location, label_column_query)
    assert result_series.index.tolist() == ["sampleID1", "sampleID2", "sampleID3"]
    assert result_series.values.tolist() == [
        "sampleLabel1",
        "sampleLabel2",
        "sampleLabel3",
    ]

    count_column_query = SliceQuery(
        dataset_id=dataset_given_id, identifier="count", identifier_type="column",
    )
    result_series = get_slice_data(minimal_db, filestore_location, count_column_query)
    assert result_series.index.tolist() == ["sampleID1", "sampleID2", "sampleID3"]
    assert result_series.values.tolist() == [1, 2, 3]


# ============================================================
# Tests for _flatten_reindex_chain
# ============================================================


def test_flatten_single_step():
    """A query with no reindex_through returns a single-element chain."""
    leaf = SliceQuery(dataset_id="ds1", identifier="col1", identifier_type="column")
    chain = _flatten_reindex_chain(leaf)
    assert len(chain) == 1
    assert chain[0].dataset_id == "ds1"


def test_flatten_two_hops():
    """A two-step chain flattens to [root, leaf] order."""
    root = SliceQuery(
        dataset_id="root_ds", identifier="fk_col", identifier_type="column"
    )
    leaf = SliceQuery(
        dataset_id="leaf_ds",
        identifier="data_col",
        identifier_type="column",
        reindex_through=root,
    )
    chain = _flatten_reindex_chain(leaf)
    assert len(chain) == 2
    assert chain[0].dataset_id == "root_ds"
    assert chain[1].dataset_id == "leaf_ds"


def test_flatten_three_hops():
    """screen_pair → screen → model, reading a column from model metadata."""
    innermost = SliceQuery(
        dataset_id="screen_pair_meta", identifier="ScreenID", identifier_type="column",
    )
    middle = SliceQuery(
        dataset_id="screen_meta",
        identifier="ModelID",
        identifier_type="column",
        reindex_through=innermost,
    )
    leaf = SliceQuery(
        dataset_id="model_meta",
        identifier="Lineage",
        identifier_type="column",
        reindex_through=middle,
    )
    chain = _flatten_reindex_chain(leaf)
    assert len(chain) == 3
    assert [s.dataset_id for s in chain] == [
        "screen_pair_meta",
        "screen_meta",
        "model_meta",
    ]


def test_flatten_detects_circular_reference():
    """A chain that revisits the same (dataset_id, identifier) should raise."""
    root = SliceQuery(dataset_id="ds_a", identifier="col_a", identifier_type="column")
    mid = SliceQuery(
        dataset_id="ds_b",
        identifier="col_b",
        identifier_type="column",
        reindex_through=root,
    )
    leaf = SliceQuery(
        dataset_id="ds_a",
        identifier="col_a",
        identifier_type="column",
        reindex_through=mid,
    )
    with pytest.raises(UserError, match="Circular reference"):
        _flatten_reindex_chain(leaf)


def test_flatten_rejects_excessive_depth():
    """A chain deeper than _MAX_REINDEX_DEPTH should raise."""
    current = SliceQuery(
        dataset_id="ds_0", identifier="col_0", identifier_type="column"
    )
    for i in range(1, 15):
        current = SliceQuery(
            dataset_id=f"ds_{i}",
            identifier=f"col_{i}",
            identifier_type="column",
            reindex_through=current,
        )
    with pytest.raises(UserError, match="maximum depth"):
        _flatten_reindex_chain(current)


# ============================================================
# Tests for _resolve_reindex_chain validation
# ============================================================


def test_resolve_rejects_non_column_intermediate():
    """Intermediate steps must use identifier_type='column'."""
    root = SliceQuery(
        dataset_id="ds_root",
        identifier="some_feature",
        identifier_type="feature_id",  # Invalid for an intermediate step
    )
    leaf = SliceQuery(
        dataset_id="ds_leaf",
        identifier="data_col",
        identifier_type="column",
        reindex_through=root,
    )
    with pytest.raises(UserError, match="identifier_type 'column'"):
        # db and filestore_location won't be reached because validation fails first
        _resolve_reindex_chain(
            cast(SessionWithUser, None), cast(str, None), leaf,
        )


def test_resolve_allows_non_column_leaf():
    """The leaf step CAN use non-column identifier types (feature_id, sample_label, etc.).
    This test just validates the chain structure — it will fail on DB access,
    but should NOT fail on the intermediate identifier_type check."""
    root = SliceQuery(
        dataset_id="ds_root", identifier="fk_col", identifier_type="column",
    )
    leaf = SliceQuery(
        dataset_id="ds_leaf",
        identifier="some_feature",
        identifier_type="feature_id",
        reindex_through=root,
    )
    # Should fail on DB access (None db), not on validation
    with pytest.raises(Exception) as exc_info:
        _resolve_reindex_chain(
            cast(SessionWithUser, None), cast(str, None), leaf,
        )
    assert "identifier_type 'column'" not in str(exc_info.value)


# ============================================================
# Unit tests for _chain_step
# ============================================================


def test_chain_step_scalar_chain():
    """Fully scalar chain: output stays scalar (parity with the old .map() behavior)."""
    current = pd.Series({"a": "x", "b": "y", "c": "z"})
    nxt = pd.Series({"x": 1, "y": 2, "z": 3})

    result = _chain_step(current, nxt)

    assert result["a"] == 1
    assert result["b"] == 2
    assert result["c"] == 3
    assert all(not isinstance(v, list) for v in result.dropna())


def test_chain_step_list_valued_fk_dedupes_and_preserves_order():
    """List-valued FK cells fan out, results dedup in first-occurrence order."""
    current = pd.Series(
        {
            "Akt": [
                "207",
                "208",
                "10000",
            ],  # multi-element, two distinct arms after dedup
            "ACC": ["31", "32"],  # multi-element, both map to the same arm
            "single": ["7529"],  # single-element list — stays a list
        }
    )
    nxt = pd.Series(
        {
            "207": "14q",
            "208": "14q",  # same as 207, expect dedup
            "10000": "10q",
            "31": "1p",
            "32": "1p",  # same as 31, expect dedup
            "7529": "20p",
        }
    )

    result = _chain_step(current, nxt)

    # Order tracks input list order; duplicates collapse.
    assert result["Akt"] == ["14q", "10q"]
    assert result["ACC"] == ["1p"]
    # Single-element lists stay lists (type stability across the column).
    assert result["single"] == ["20p"]


def test_chain_step_drops_empty_and_all_miss_lists():
    """Empty list and all-elements-miss cells become None so dropna() removes them."""
    current = pd.Series(
        {
            "empty": [],
            "all_miss": ["nope1", "nope2"],
            "partial": ["207", "nope"],  # one matching element, one missing
        }
    )
    nxt = pd.Series({"207": "14q"})

    result = _chain_step(current, nxt).dropna()

    assert "empty" not in result.index
    assert "all_miss" not in result.index
    # Missing elements within an otherwise-matching list are silently skipped.
    assert result["partial"] == ["14q"]


def test_chain_step_list_valued_leaf_upgrades_scalar_input():
    """Scalar input + list-valued lookup → list-valued output cell."""
    current = pd.Series({"sp1": "g1", "sp2": "g2"})
    nxt = pd.Series({"g1": ["AKT1", "PKB"], "g2": ["TP53"]})

    result = _chain_step(current, nxt)

    # Lookup-yielded list propagates; the output column is uniformly list-shaped.
    assert result["sp1"] == ["AKT1", "PKB"]
    assert result["sp2"] == ["TP53"]


def test_chain_step_chained_list_propagation():
    """Two consecutive _chain_step calls: list shape propagates through both hops."""
    # Hop 1: list FK → scalar lookup yields a list of clusters.
    antibody_fk = pd.Series(
        {"Akt": ["207", "208", "10000"]}  # three targets across two clusters
    )
    gene_to_cluster = pd.Series({"207": "C1", "208": "C1", "10000": "C2"})
    mid = _chain_step(antibody_fk, gene_to_cluster)
    assert mid["Akt"] == ["C1", "C2"]  # dedup at hop 1

    # Hop 2: list (from hop 1) → scalar lookup yields a list of cluster labels.
    cluster_to_label = pd.Series({"C1": "PI3K_pathway", "C2": "AKT3_specific"})
    final = _chain_step(mid, cluster_to_label)
    assert final["Akt"] == ["PI3K_pathway", "AKT3_specific"]


# ============================================================
# Integration tests for get_slice_data with reindex_through
# ============================================================


def _setup_chained_dimension_types(minimal_db, settings):
    """
    Set up three dimension types with FK relationships:
        screen_pair → screen (via ScreenID column)
        screen → model (via ModelID column)

    And populate metadata for each with test data.
    Returns the given_ids of the three metadata datasets.
    """
    user = settings.admin_users[0]

    # 1. Create the "model" dimension type with metadata
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="test-model",
        display_name="Test Model",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "Lineage": AnnotationType.text,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["MODEL_A", "MODEL_B", "MODEL_C"],
                "label": ["Model A", "Model B", "Model C"],
                "Lineage": ["Breast", "Lung", "Skin"],
            }
        ),
    )

    # 2. Create the "screen" dimension type with metadata
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="test-screen",
        display_name="Test Screen",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "ModelID": AnnotationType.text,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["SCREEN_1", "SCREEN_2", "SCREEN_3"],
                "label": ["Screen 1", "Screen 2", "Screen 3"],
                "ModelID": ["MODEL_A", "MODEL_B", "MODEL_C"],
            }
        ),
    )

    # 3. Create the "screen_pair" dimension type with metadata
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="test-screen-pair",
        display_name="Test Screen Pair",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "ScreenID": AnnotationType.text,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["PAIR_X", "PAIR_Y", "PAIR_Z"],
                "label": ["Pair X", "Pair Y", "Pair Z"],
                "ScreenID": ["SCREEN_1", "SCREEN_2", "SCREEN_3"],
            }
        ),
    )

    # Now create tabular datasets for each dimension type so get_slice_data can load them
    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="test-model-metadata",
        index_type_name="test-model",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "Lineage": ColumnMetadata(col_type=AnnotationType.text),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["MODEL_A", "MODEL_B", "MODEL_C"],
                "label": ["Model A", "Model B", "Model C"],
                "Lineage": ["Breast", "Lung", "Skin"],
            }
        ),
    )

    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="test-screen-metadata",
        index_type_name="test-screen",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "ModelID": ColumnMetadata(
                col_type=AnnotationType.text, references="test-model"
            ),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["SCREEN_1", "SCREEN_2", "SCREEN_3"],
                "label": ["Screen 1", "Screen 2", "Screen 3"],
                "ModelID": ["MODEL_A", "MODEL_B", "MODEL_C"],
            }
        ),
    )

    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="test-screen-pair-metadata",
        index_type_name="test-screen-pair",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "ScreenID": ColumnMetadata(
                col_type=AnnotationType.text, references="test-screen"
            ),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["PAIR_X", "PAIR_Y", "PAIR_Z"],
                "label": ["Pair X", "Pair Y", "Pair Z"],
                "ScreenID": ["SCREEN_1", "SCREEN_2", "SCREEN_3"],
            }
        ),
    )

    return {
        "model": "test-model-metadata",
        "screen": "test-screen-metadata",
        "screen_pair": "test-screen-pair-metadata",
    }


def test_single_hop_reindex(minimal_db: SessionWithUser, settings):
    """
    screen → model: load Lineage from model metadata, indexed by screen IDs.
    """
    ds_ids = _setup_chained_dimension_types(minimal_db, settings)

    query = SliceQuery(
        dataset_id=ds_ids["model"],
        identifier="Lineage",
        identifier_type="column",
        reindex_through=SliceQuery(
            dataset_id=ds_ids["screen"], identifier="ModelID", identifier_type="column",
        ),
    )
    result = get_slice_data(minimal_db, settings.filestore_location, query)

    # Result should be indexed by screen IDs, with model Lineage values
    assert set(result.index.tolist()) == {"SCREEN_1", "SCREEN_2", "SCREEN_3"}
    assert result["SCREEN_1"] == "Breast"
    assert result["SCREEN_2"] == "Lung"
    assert result["SCREEN_3"] == "Skin"


def test_two_hop_reindex(minimal_db: SessionWithUser, settings):
    """
    screen_pair → screen → model: load Lineage from model metadata,
    indexed by screen_pair IDs.
    """
    ds_ids = _setup_chained_dimension_types(minimal_db, settings)

    query = SliceQuery(
        dataset_id=ds_ids["model"],
        identifier="Lineage",
        identifier_type="column",
        reindex_through=SliceQuery(
            dataset_id=ds_ids["screen"],
            identifier="ModelID",
            identifier_type="column",
            reindex_through=SliceQuery(
                dataset_id=ds_ids["screen_pair"],
                identifier="ScreenID",
                identifier_type="column",
            ),
        ),
    )
    result = get_slice_data(minimal_db, settings.filestore_location, query)

    # Result should be indexed by screen_pair IDs
    assert set(result.index.tolist()) == {"PAIR_X", "PAIR_Y", "PAIR_Z"}
    assert result["PAIR_X"] == "Breast"  # PAIR_X → SCREEN_1 → MODEL_A → Breast
    assert result["PAIR_Y"] == "Lung"  # PAIR_Y → SCREEN_2 → MODEL_B → Lung
    assert result["PAIR_Z"] == "Skin"  # PAIR_Z → SCREEN_3 → MODEL_C → Skin


def test_reindex_with_missing_fk_values(minimal_db: SessionWithUser, settings):
    """
    When an FK column has a value that doesn't match any entity in the target,
    that entry should be dropped (NaN propagation via map + dropna).
    """
    user = settings.admin_users[0]

    factories.add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="target-type",
        display_name="Target",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "Value": AnnotationType.text,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["T1", "T2"],
                "label": ["Target 1", "Target 2"],
                "Value": ["val1", "val2"],
            }
        ),
    )

    factories.add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="source-type",
        display_name="Source",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "TargetID": AnnotationType.text,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["S1", "S2", "S3"],
                "label": ["Source 1", "Source 2", "Source 3"],
                "TargetID": ["T1", "NONEXISTENT", "T2"],
            }
        ),
    )

    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="target-metadata",
        index_type_name="target-type",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "Value": ColumnMetadata(col_type=AnnotationType.text),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["T1", "T2"],
                "label": ["Target 1", "Target 2"],
                "Value": ["val1", "val2"],
            }
        ),
    )

    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="source-metadata",
        index_type_name="source-type",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "TargetID": ColumnMetadata(
                col_type=AnnotationType.text, references="target-type"
            ),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["S1", "S2", "S3"],
                "label": ["Source 1", "Source 2", "Source 3"],
                "TargetID": ["T1", "NONEXISTENT", "T2"],
            }
        ),
    )

    query = SliceQuery(
        dataset_id="target-metadata",
        identifier="Value",
        identifier_type="column",
        reindex_through=SliceQuery(
            dataset_id="source-metadata",
            identifier="TargetID",
            identifier_type="column",
        ),
    )
    result = get_slice_data(minimal_db, settings.filestore_location, query)

    # S2 pointed to NONEXISTENT which isn't in target, so it's dropped
    assert set(result.index.tolist()) == {"S1", "S3"}
    assert result["S1"] == "val1"
    assert result["S3"] == "val2"


def test_reindex_with_list_valued_fk(minimal_db: SessionWithUser, settings):
    """
    End-to-end: when a reindex_through hop uses a list_strings FK column
    (e.g. antibody_v2_metadata.target_entrez_id storing a list of entrez
    IDs per row), the chain fans out the lookup over each list element,
    deduplicates the collected results, and yields a list_strings-shaped
    output column. The cell values in `data_df` for a list_strings column
    are JSON-encoded strings; they are decoded into Python lists by the
    storage read path (see _convert_subsetted_tabular_df_dtypes).
    """
    user = settings.admin_users[0]

    # Target dimension: gene-like, with a categorical "Arm" column that
    # the chain will ultimately deliver indexed by antibodies.
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="gene-like",
        display_name="Gene Like",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "Arm": AnnotationType.text,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["G1", "G2", "G3", "G4"],
                "label": ["Gene 1", "Gene 2", "Gene 3", "Gene 4"],
                "Arm": ["14q", "14q", "10q", "20p"],
            }
        ),
    )

    # Source dimension: antibody-like, with a list_strings FK column
    # pointing at gene-like. JSON-encoded list cells emulate how
    # list_strings columns are actually stored on disk.
    factories.add_dimension_type(
        minimal_db,
        settings,
        user=user,
        name="antibody-like",
        display_name="Antibody Like",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "TargetIDs": AnnotationType.list_strings,
        },
        axis="sample",
        metadata_df=pd.DataFrame(
            {
                "ID": ["AB1", "AB2", "AB3"],
                "label": ["Antibody 1", "Antibody 2", "Antibody 3"],
                "TargetIDs": [
                    '["G1", "G2", "G3"]',  # 3 targets → 2 distinct arms (14q, 10q)
                    '["G1"]',  # single-element list — common case
                    '["G3", "G4"]',  # 2 targets → 2 distinct arms (10q, 20p)
                ],
            }
        ),
    )

    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="gene-like-metadata",
        index_type_name="gene-like",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "Arm": ColumnMetadata(col_type=AnnotationType.text),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["G1", "G2", "G3", "G4"],
                "label": ["Gene 1", "Gene 2", "Gene 3", "Gene 4"],
                "Arm": ["14q", "14q", "10q", "20p"],
            }
        ),
    )

    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="antibody-like-metadata",
        index_type_name="antibody-like",
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "TargetIDs": ColumnMetadata(
                col_type=AnnotationType.list_strings, references="gene-like"
            ),
        },
        data_df=pd.DataFrame(
            {
                "ID": ["AB1", "AB2", "AB3"],
                "label": ["Antibody 1", "Antibody 2", "Antibody 3"],
                "TargetIDs": ['["G1", "G2", "G3"]', '["G1"]', '["G3", "G4"]',],
            }
        ),
    )

    query = SliceQuery(
        dataset_id="gene-like-metadata",
        identifier="Arm",
        identifier_type="column",
        reindex_through=SliceQuery(
            dataset_id="antibody-like-metadata",
            identifier="TargetIDs",
            identifier_type="column",
        ),
    )
    result = get_slice_data(minimal_db, settings.filestore_location, query)

    # Result is indexed by antibody IDs:
    #   AB1: G1=14q, G2=14q, G3=10q → ["14q", "10q"]  (dedup, order-preserving)
    #   AB2: G1=14q                 → ["14q"]         (single-element stays a list)
    #   AB3: G3=10q, G4=20p         → ["10q", "20p"]
    assert set(result.index.tolist()) == {"AB1", "AB2", "AB3"}
    assert result["AB1"] == ["14q", "10q"]
    assert result["AB2"] == ["14q"]
    assert result["AB3"] == ["10q", "20p"]
