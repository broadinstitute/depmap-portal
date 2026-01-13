import os

from fastapi.testclient import TestClient

from tests import factories
from ..utils import assert_status_ok
import json
import pytest


def _print_mem_delta(msg):
    print(msg)


@pytest.mark.skip("Only useful for testing memory usage")
def test_reindexing_memory_usage(
    minimal_db, client: TestClient, settings, public_group
):
    # this test stress tests generation of a large number of index records
    # simulate the following two linked types. Largely created to measure memory impact
    # of populating the index

    gene_count = 20000
    compound_count = 200000

    _print_mem_delta("before load gene")
    admin_user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": admin_user}
    gene_feature_type_response = client.post(
        "/types/feature",
        data={
            "name": "gene",
            "id_column": "entrez_id",
            "properties_to_index": ["label", "entrez_id"],
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "entrez_id": "text",
                        "aliases": "list_strings",
                        "P2": "text",
                        "P3": "text",
                        "P4": "text",
                        "P5": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "gene_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "entrez_id", "aliases", "P2", "P3", "P4", "P5"],
                    row_values=[
                        [
                            f"label_{i}",
                            f"g_id_{i}",
                            json.dumps([f"a_{i}", f"b_{i}"]),
                            f"p2_{i}",
                            f"p3_{i}",
                            f"p4_{i}",
                            f"p5_{i}",
                        ]
                        for i in range(gene_count)
                    ],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_ok(gene_feature_type_response)
    _print_mem_delta("before load compound")

    compound_feature_type_response = client.post(
        "/types/feature",
        data={
            "name": "compound",
            "id_column": "compound_id",
            "properties_to_index": ["compound_id", "label", "aliases", "target",],
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "compound_id": "text",
                        "target": "text",
                    }
                }
            ),
            "id_mapping": json.dumps(
                {"id_mapping": {"reference_column_mappings": {"target": "gene"}}}
            ),
        },
        files={
            "metadata_file": (
                "compound_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "compound_id", "target"],
                    row_values=[
                        [f"c_label_{i}", f"c_id_{i}", f"g_id_{ i % gene_count }"]
                        for i in range(compound_count)
                    ],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )

    assert_status_ok(compound_feature_type_response)
    _print_mem_delta("after load compound")

    import resource

    max_rss_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    print(f"max rss {max_rss_kb}")

    # for dimension_type_name in ["gene", "compound"]:
    #     dimension_type = get_dimension_type(minimal_db, dimension_type_name)
    #     assert dimension_type is not None
    #     populate_search_index_after_update(minimal_db, dimension_type)
    #
