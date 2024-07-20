from fastapi.testclient import TestClient
from tests import factories
import numpy as np
import json

from breadbox.db.session import SessionWithUser


class TestGet:
    def test_get_cell_line_selector_lines(
        self, client: TestClient, minimal_db: SessionWithUser, settings
    ):
        headers = {"X-Forwarded-User": "someone@private-group.com"}
        sample_metadata = factories.tabular_csv_data_file(
            cols=[
                "cell_line_name",
                "primary_disease",
                "lineage_1",
                "lineage_2",
                "lineage_3",
                "depmap_id",
                "cell_line_display_name",
                "other_col_name",
                "label",
            ],
            row_values=[
                [
                    "HS294T_SKIN",
                    np.nan,
                    "skin",
                    "melanoma",
                    np.nan,
                    "ACH-000014",
                    "HS294T",
                    "other_val",
                    "HS294T",
                ],
                [
                    "UACC62_SKIN",
                    "Melanoma/Skin Cancer",
                    "skin",
                    "melanoma",
                    "b_cell_HERpos_dev_lineage",
                    "ACH-000425",
                    "UACC62",
                    "random",
                    "UACC62",
                ],
            ],
        )
        res_update_sample_type = client.patch(
            "/types/sample/depmap_model/metadata",
            data={
                "name": "depmap_model",
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "cell_line_name": "text",
                            "primary_disease": "categorical",
                            "lineage_1": "categorical",
                            "lineage_2": "categorical",
                            "lineage_3": "categorical",
                            "cell_line_display_name": "text",
                            "other_col_name": "text",
                            "depmap_id": "text",
                            "label": "text",
                        }
                    }
                ),
            },
            files={
                "metadata_file": ("sample_metadata.csv", sample_metadata, "text/csv",)
            },
            headers={"X-Forwarded-Email": settings.admin_users[0]},
        )
        from ..utils import assert_status_ok

        assert_status_ok(res_update_sample_type)
        assert res_update_sample_type.status_code == 200
        expected_res1 = {
            "cols": [
                "cell_line_name",
                "primary_disease",
                "lineage_1",
                "lineage_2",
                "lineage_3",
                "depmap_id",
                "cell_line_display_name",
            ],
            "data": [
                ["HS294T_SKIN", None, "skin", "melanoma", None, "ACH-000014", "HS294T"],
                [
                    "UACC62_SKIN",
                    "Melanoma/Skin Cancer",
                    "skin",
                    "melanoma",
                    "b_cell_HERpos_dev_lineage",
                    "ACH-000425",
                    "UACC62",
                ],
            ],
        }

        res1 = client.get(
            "/partials/data_table/cell_line_selector_lines", headers=headers,
        )
        assert_status_ok(res1)
        assert res1.json() == expected_res1
