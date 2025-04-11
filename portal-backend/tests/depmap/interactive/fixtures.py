import os
from depmap.settings.settings import Config
from tests.depmap.user_uploads.user_upload_fixtures import UserUploadFixture

standard_aliased_dataset_id = "Avana"
standard_aliased_dataset_feature = "ANOS1"
standard_aliased_dataset_with_associations = "SOX10"

standard_nonaliased_dataset_id = "rppa"
standard_nonaliased_dataset_feature = "AMPK_alpha"

context_dataset_id = "context"
context_dataset_feature = "BONE"

nonstandard_aliased_dataset_id = (
    "small-mapped-avana-551a.1"  # has stable IDs, mapped to Gene
)
nonstandard_nonaliased_dataset_id = (
    "small-avana-2987.2"  # no stable IDs, use strings as row names
)
nonstandard_nonaliased_feature = "ABCD1"

prepopulated_dataset = "small-msi-dataset-aa84.4"  # has arxspan ids for cell line names
prepopulated_dataset_file_path_suffix = "interactive/small-msi-dataset-aa84.4.hdf5"
prepopulated_dataset_feature_example = "isMSI"
prepopulated_dataset_row_names = [
    "isMSI",
    "msiDEL",
    "msiINS",
    "totalDEL",
    "totalINS",
]  # sorted alphabetically

lineage_dataset_id = "lineage"
lineage_dataset_feature = "all"
lineage_name = "bone"
lineage_id = 2
lineage_cell_line = "A673_BONE"

mutations_dataset_feature = "MAP4K4"

# Provides extra test case for test_get_rna_mutations_colors() after 22q4
mutations_dataset_extra_feature = "NRAS"

not_in_anything_feature = "F8A1"

# upload csv one row during custom analysis
custom_csv_one_row_upload_file_path = os.path.join(
    Config.PROJECT_ROOT, "tests/depmap/interactive/nonstandard/data/test_one_row.csv"
)

# plot custom csv dataset
custom_csv_upload_file_path = os.path.join(
    Config.PROJECT_ROOT, "tests/depmap/interactive/nonstandard/data/test_matrix.csv"
)
custom_csv_local_file_name = (
    "313f11d7d462a9edc122db58c8167c97114c9f466c09040d0c4a42f1629bf556.hdf5"
)
custom_csv_feature = "ME1 (4199)"
custom_csv_plot_points_length = 2

custom_csv_invalid_upload_file_path = os.path.join(
    Config.PROJECT_ROOT,
    "tests/depmap/interactive/nonstandard/data/test_invalid_matrix.csv",
)

# plot custom taiga dataset
# dataset is small-avana-f2b9.2/avana_score and contains "MED1 (5469)"
user_upload_fixture = UserUploadFixture()
mock_taiga_client_feature = user_upload_fixture.row_name
mock_taiga_client_length = len(user_upload_fixture.expected_row_of_values)

# for custom cell line groups, written to by the compute module
custom_cell_line_group_dataset_id = "custom_cell_lines"
custom_cell_line_group_feature = "test_custom_cell_line_group_uuid"
custom_cell_line_group_depmap_ids = ["ACH-000014", "ACH-000052", "ACH-000279"]
