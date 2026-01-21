import json
import os
from typing import Optional
from datetime import datetime
from dataclasses import dataclass, asdict

from breadbox.models.dataset import MatrixDataset

ISSUES_FILE_NAME = "known-data-issues.json"


@dataclass
class DataIssue:
    dimension_type_name: str 
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
        return f"{self.dimension_type_name}:{self.dataset_id}:{self.issue_type}"
    

def check_for_dataset_ids_without_metadata(dataset: MatrixDataset, dimension_type_name: str, dataset_given_ids: set[str], metadata_given_ids: set[str]) -> Optional[DataIssue]:
    """
    Return a warning string if there are a substantial number of features in dataset_given_ids that are not in metadata_given_ids.
    """
    dataset_ids_not_in_metadata = set(dataset_given_ids).difference(set(metadata_given_ids))
    percent_ids_not_in_metadata = len(dataset_ids_not_in_metadata) / len(dataset_given_ids)

    # Append a warning when a given matrix dataset has a large number of features or samples with no metadata.
    if percent_ids_not_in_metadata > 0:
        return DataIssue(
            dimension_type_name=dimension_type_name,
            dataset_id=dataset.given_id if dataset.given_id else dataset.id,
            dataset_name=dataset.name,
            issue_type="Dataset given IDs without metadata",
            count_affected=len(dataset_ids_not_in_metadata),
            percent_affected=percent_ids_not_in_metadata,
            examples=list(dataset_ids_not_in_metadata)[:5],
        )
    return None

def check_for_metadata_not_in_dataset(dataset: MatrixDataset, dimension_type_name: str, axis: str, dataset_given_ids: set[str], metadata_given_ids: set[str]) -> Optional[DataIssue]:
    # Get the cutoffs configured for this particular dataset
    dataset_configs = dataset.dataset_metadata
    min_percent_feature_metadata_used = dataset_configs.get("min_percent_feature_metadata_used", 95)

    metadata_ids_not_in_dataset = set(metadata_given_ids).difference(set(dataset_given_ids))
    percent_metadata_ids_not_in_dataset = len(metadata_ids_not_in_dataset) / len(metadata_given_ids)
    if percent_metadata_ids_not_in_dataset > (1 - min_percent_feature_metadata_used / 100) and axis == "feature":
        return DataIssue(
            dimension_type_name=dimension_type_name,
            dataset_id=dataset.given_id if dataset.given_id else dataset.id,
            dataset_name=dataset.name,
            issue_type="Metadata records not used in dataset",
            count_affected=len(metadata_ids_not_in_dataset),
            percent_affected=percent_metadata_ids_not_in_dataset,
            examples=None,
        )
    return None


def load_known_issues(issues_dir: str) -> dict[str, DataIssue]:
    """Load all known data issues from file"""
    issues_filepath = os.path.join(issues_dir, ISSUES_FILE_NAME)

    if not os.path.exists(issues_filepath):
        return {}
        
    with open(issues_filepath, "rt") as fd:
        data = json.load(fd)
        issues = {}
        for issue_key, issue in data.items():
            issues[issue_key] = DataIssue(**issue)
    return issues


def save_issues(issues: dict[str, DataIssue], issues_dir: str) -> int:
    """
    Save all known data issues to file. If a file already exists at the specified path, 
    store it as a backup by renaming it with a date suffix.
    """
    # Ensure the issues directory exists
    os.makedirs(issues_dir, exist_ok=True)

    issues_filepath = os.path.join(issues_dir, ISSUES_FILE_NAME)
    if os.path.exists(issues_filepath):
        # Get the current date as a string in YYYYMMDD format
        date = datetime.now().strftime("%Y%m%d")
        
        backup_filepath = os.path.join(issues_dir, date + "-" + ISSUES_FILE_NAME + ".bak")
        os.rename(issues_filepath, backup_filepath)
        print(f"Existing issues file renamed to backup: {backup_filepath}")


    # Convert DataIssue objects to dictionaries for JSON serialization
    serializable_issues = {issue_key: asdict(issue) for issue_key, issue in issues.items()}
    
    with open(issues_filepath, "wt") as fd:
        json.dump(serializable_issues, fd, indent=2)
    
    return len(issues)
