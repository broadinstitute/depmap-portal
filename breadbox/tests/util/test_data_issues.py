from types import SimpleNamespace

from breadbox.utils.data_issues import (
    check_for_dataset_ids_without_metadata,
    check_for_metadata_not_in_dataset,
    known_deprecated_ids,
)


def make_dataset(given_id="dataset-1", id="dataset-id-1", name="My Dataset", dataset_metadata=None):
    return SimpleNamespace(
        given_id=given_id, id=id, name=name, dataset_metadata=dataset_metadata
    )


class TestCheckForDatasetIdsWithoutMetadata:
    def test_no_issue_when_all_dataset_ids_have_metadata(self):
        dataset = make_dataset()
        issue = check_for_dataset_ids_without_metadata(
            dataset,
            "sample",
            dataset_given_ids=["a", "b", "c"],
            metadata_given_ids=["a", "b", "c", "d"],
        )
        assert issue is None

    def test_reports_issue_when_ids_missing_metadata(self):
        dataset = make_dataset()
        issue = check_for_dataset_ids_without_metadata(
            dataset,
            "sample",
            dataset_given_ids=["a", "b", "c"],
            metadata_given_ids=["a", "b"],
        )
        assert issue is not None
        assert issue.issue_type == "Dataset given IDs without metadata"
        assert issue.dimension_type_name == "sample"
        assert issue.dataset_id == dataset.given_id
        assert issue.dataset_name == dataset.name
        assert issue.count_affected == 1
        assert issue.percent_affected == 1 / 3
        assert issue.examples == ["c"]

    def test_ignores_known_deprecated_ids(self):
        deprecated_id = next(iter(known_deprecated_ids))
        dataset = make_dataset()
        issue = check_for_dataset_ids_without_metadata(
            dataset,
            "sample",
            dataset_given_ids=["a", "b", deprecated_id],
            metadata_given_ids=["a", "b"],
        )
        assert issue is None

    def test_ignores_gene_ids_matching_expected_formats_below_threshold(self):
        dataset = make_dataset()
        # 1 of 100 ids missing metadata (below the 5% threshold), and it matches the Entrez ID pattern
        dataset_given_ids = [str(i) for i in range(1, 100)] + ["123456"]
        metadata_given_ids = [str(i) for i in range(1, 100)]
        issue = check_for_dataset_ids_without_metadata(
            dataset,
            "gene",
            dataset_given_ids=dataset_given_ids,
            metadata_given_ids=metadata_given_ids,
        )
        assert issue is None

    def test_reports_issue_for_gene_ids_not_matching_expected_formats(self):
        dataset = make_dataset()
        dataset_given_ids = [str(i) for i in range(1, 100)] + ["NOT-A-GENE-ID"]
        metadata_given_ids = [str(i) for i in range(1, 100)]
        issue = check_for_dataset_ids_without_metadata(
            dataset,
            "gene",
            dataset_given_ids=dataset_given_ids,
            metadata_given_ids=metadata_given_ids,
        )
        assert issue is not None
        assert issue.examples == ["NOT-A-GENE-ID"]

    def test_reports_issue_for_gene_ids_when_missing_percent_meets_threshold(self):
        dataset = make_dataset()
        # 5 of 100 ids missing metadata (meets/exceeds the 5% threshold), even though they match the Entrez ID pattern
        dataset_given_ids = [str(i) for i in range(1, 96)] + ["96", "97", "98", "99", "100"]
        metadata_given_ids = [str(i) for i in range(1, 96)]
        issue = check_for_dataset_ids_without_metadata(
            dataset,
            "gene",
            dataset_given_ids=dataset_given_ids,
            metadata_given_ids=metadata_given_ids,
        )
        assert issue is not None
        assert issue.count_affected == 5

    def test_ignores_ensembl_ids_below_threshold(self):
        dataset = make_dataset()
        dataset_given_ids = [str(i) for i in range(1, 100)] + ["ENSG00000139618"]
        metadata_given_ids = [str(i) for i in range(1, 100)]
        issue = check_for_dataset_ids_without_metadata(
            dataset,
            "gene",
            dataset_given_ids=dataset_given_ids,
            metadata_given_ids=metadata_given_ids,
        )
        assert issue is None

    def test_ignores_multi_gene_ids_below_threshold(self):
        dataset = make_dataset()
        dataset_given_ids = [str(i) for i in range(1, 100)] + ["BRCA1&BRCA2 (672&675)"]
        metadata_given_ids = [str(i) for i in range(1, 100)]
        issue = check_for_dataset_ids_without_metadata(
            dataset,
            "gene",
            dataset_given_ids=dataset_given_ids,
            metadata_given_ids=metadata_given_ids,
        )
        assert issue is None


class TestCheckForMetadataNotInDataset:
    def test_no_issue_when_dataset_uses_all_metadata(self):
        dataset = make_dataset()
        issue = check_for_metadata_not_in_dataset(
            dataset,
            "sample",
            axis="feature",
            dataset_given_ids=["a", "b", "c"],
            metadata_given_ids=["a", "b", "c"],
        )
        assert issue is None

    def test_reports_issue_when_dataset_uses_too_little_metadata(self):
        dataset = make_dataset()
        metadata_given_ids = [str(i) for i in range(100)]
        dataset_given_ids = [str(i) for i in range(10)]  # Only uses 10% of metadata
        issue = check_for_metadata_not_in_dataset(
            dataset,
            "sample",
            axis="feature",
            dataset_given_ids=dataset_given_ids,
            metadata_given_ids=metadata_given_ids,
        )
        assert issue is not None
        assert issue.issue_type == "Metadata records not used in dataset"
        assert issue.dimension_type_name == "sample"
        assert issue.dataset_id == dataset.given_id
        assert issue.dataset_name == dataset.name
        assert issue.count_affected == 90
        assert issue.percent_affected == 0.9
        assert issue.examples is None

    def test_ignores_axis_other_than_feature(self):
        dataset = make_dataset()
        metadata_given_ids = [str(i) for i in range(100)]
        dataset_given_ids = [str(i) for i in range(10)]
        issue = check_for_metadata_not_in_dataset(
            dataset,
            "sample",
            axis="sample",
            dataset_given_ids=dataset_given_ids,
            metadata_given_ids=metadata_given_ids,
        )
        assert issue is None

    def test_ignores_dimension_types_with_expansive_metadata(self):
        dataset = make_dataset()
        metadata_given_ids = [str(i) for i in range(100)]
        dataset_given_ids = [str(i) for i in range(10)]
        for dimension_type_name in ["gene", "compound"]:
            issue = check_for_metadata_not_in_dataset(
                dataset,
                dimension_type_name,
                axis="feature",
                dataset_given_ids=dataset_given_ids,
                metadata_given_ids=metadata_given_ids,
            )
            assert issue is None

    def test_respects_custom_min_percent_feature_metadata_used(self):
        # With a lower cutoff configured on the dataset, using only 10% of metadata should be fine
        dataset = make_dataset(
            dataset_metadata={"min_percent_feature_metadata_used": 5}
        )
        metadata_given_ids = [str(i) for i in range(100)]
        dataset_given_ids = [str(i) for i in range(10)]
        issue = check_for_metadata_not_in_dataset(
            dataset,
            "sample",
            axis="feature",
            dataset_given_ids=dataset_given_ids,
            metadata_given_ids=metadata_given_ids,
        )
        assert issue is None
