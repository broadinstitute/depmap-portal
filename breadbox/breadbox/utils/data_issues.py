import json
import os
from typing import Optional

from dataclasses import dataclass, asdict

from breadbox.models.dataset import MatrixDataset

ISSUES_FILE = "known-data-issues.json"


@dataclass
class DataIssue:
    dataset_id: Optional[str] # None if the issue is not dataset-specific
    dataset_name: Optional[str] # None if the issue is not dataset-specific
    issue_type: str
    count_affected: int # number of affected IDs/records
    percent_affected: float # percentage of affected IDs/records
    examples: Optional[list[str]] = None # Optional list of example affected IDs/records

    # Add a method to format the issue as a string for printing
    def __str__(self) -> str:
        dataset_part = f"'{self.dataset_name}':" if self.dataset_name else ""
        examples_part = f" Examples: {', '.join(self.examples)}." if self.examples else ""
        return f"{dataset_part} {self.issue_type}. Impacted records: {self.count_affected} ({self.percent_affected:.2%}).{examples_part}"
    
    def get_key(self) -> str:
        return f"{self.issue_type}:{self.dataset_id}"
    

def check_for_dataset_ids_without_metadata(dataset: MatrixDataset, dataset_given_ids: set[str], metadata_given_ids: set[str]) -> Optional[DataIssue]:
    """
    Return a warning string if there are a substantial number of features in dataset_given_ids that are not in metadata_given_ids.
    """
    dataset_ids_not_in_metadata = set(dataset_given_ids).difference(set(metadata_given_ids))
    percent_ids_not_in_metadata = len(dataset_ids_not_in_metadata) / len(dataset_given_ids)

    # Append a warning when a given matrix dataset has a large number of features or samples with no metadata.
    if percent_ids_not_in_metadata > 0:
        return DataIssue(
            dataset_id=dataset.given_id if dataset.given_id else dataset.id,
            dataset_name=dataset.name,
            issue_type="Dataset give IDs without metadata",
            count_affected=len(dataset_ids_not_in_metadata),
            percent_affected=percent_ids_not_in_metadata,
            examples=list(dataset_ids_not_in_metadata)[:5],
        )
    return None

def check_for_metadata_not_in_dataset(dataset: MatrixDataset, axis: str, dataset_given_ids: set[str], metadata_given_ids: set[str]) -> Optional[DataIssue]:
    # Get the cutoffs configured for this particular dataset
    dataset_configs = dataset.dataset_metadata
    min_percent_feature_metadata_used = dataset_configs.get("min_percent_feature_metadata_used", 95)

    metadata_ids_not_in_dataset = set(metadata_given_ids).difference(set(dataset_given_ids))
    percent_metadata_ids_not_in_dataset = len(metadata_ids_not_in_dataset) / len(metadata_given_ids)
    if percent_metadata_ids_not_in_dataset > (1 - min_percent_feature_metadata_used / 100) and axis == "feature":
        return DataIssue(
            dataset_id=dataset.given_id if dataset.given_id else dataset.id,
            dataset_name=dataset.name,
            issue_type="Metadata records not used in dataset",
            count_affected=len(metadata_ids_not_in_dataset),
            percent_affected=percent_metadata_ids_not_in_dataset,
            examples=None,
        )
    return None

# The breadbox log_data_issues ratchets similarly to pyright-ratchet. 
# Existing issues are logged, and errors are only raised for new issues.
# Many of the functions below were copied from https://github.com/pgm/pyright-ratchet
# and modified to fit this use case.


def load_known_issues() -> dict[str, list[DataIssue]]:
    if not os.path.exists(ISSUES_FILE):
        return {}
        
    with open(ISSUES_FILE, "rt") as fd:
        data = json.load(fd)
        issues = {}
        for dimension_type, issues_list in data.items():
            issues[dimension_type] = [DataIssue(**issue_dict) for issue_dict in issues_list]
    return issues


def save_issues(issues: dict[str, list[DataIssue]]) -> int:
    # Convert DataIssue objects to dictionaries for JSON serialization
    serializable_issues = {}
    for dimension_type, issues_list in issues.items():
        serializable_issues[dimension_type] = [asdict(issue) for issue in issues_list]
    
    with open(ISSUES_FILE, "wt") as fd:
        json.dump(serializable_issues, fd, indent=2)
    
    return len(issues)
