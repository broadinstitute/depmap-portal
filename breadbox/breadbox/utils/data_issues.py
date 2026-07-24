import json
import os
import re
from typing import Optional
from datetime import datetime
from dataclasses import dataclass, asdict

from breadbox.models.dataset import MatrixDataset

ISSUES_FILE_NAME = "known-data-issues.json"

# HEURISTICS CONFIGS
# There are a small number of special cases in which issues can be safely ignored (configured below).

# Known deprecated IDs may be referenced in older matrix datasets despite being missing from metadata. 
known_deprecated_ids = {
    # Model IDs
    "ACH-001173", "ACH-001741", "ACH-001790", "ACH-001078", "ACH-000010", "ACH-003008", "ACH-003055", "ACH-003004", "ACH-003010", "ACH-002176", "ACH-002194"
    # Compound IDs
    "DPC-004766", 
}

# Dimension types in which our matrix datasets are expected to use only a subset of the metadata's IDs
dim_types_with_expansive_metadata = ["gene", "compound"]

# Within certain dimension types, it's okay to ignore certain ID formats. 
# For example, for gene-indexed datasets, it's okay if some small percentage of of the features do not have metadata.
# Ex. Does it look like an ensemble ID? is a buch of digits? Does it contain an ampersand?). 
id_formats_which_may_not_have_metadata = {
    "gene": [
        r"^[1-9]\d*$", # Entrez IDs
        r"^ENSG\d{11}$", # Ensemble IDs
        r"^.+&.+ \(.+&.+\)$" # More than one gene
    ]
}


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
    

def check_for_dataset_ids_without_metadata(dataset: MatrixDataset, dimension_type_name: str, dataset_given_ids: list[str], metadata_given_ids: list[str]) -> Optional[DataIssue]:
    """
    Return a data issue if there are a substantial number of features in dataset_given_ids that are not in metadata_given_ids.
    """
    given_ids_not_in_metadata = set(dataset_given_ids).difference(set(metadata_given_ids), known_deprecated_ids)
    percent_ids_not_in_metadata = len(given_ids_not_in_metadata) / len(dataset_given_ids)


    if dimension_type_name in id_formats_which_may_not_have_metadata.keys() and percent_ids_not_in_metadata < 0.05: 
        # For gene-indexed datasets, it's fine for some small percentage of of the features to not have metadata
        # as long as those features match one of our expected formats. 
        formats = id_formats_which_may_not_have_metadata[dimension_type_name]
        compiled_patterns = [re.compile(pattern) for pattern in formats]
        all_ids_match = all(
            any(pattern.search(gene_id) for pattern in compiled_patterns)
            for gene_id in given_ids_not_in_metadata
        )
        if all_ids_match:
            return None


    # Append a warning when a given matrix dataset has a large number of features or samples with no metadata.
    if percent_ids_not_in_metadata > 0:
        return DataIssue(
            dimension_type_name=dimension_type_name,
            dataset_id=dataset.given_id if dataset.given_id else dataset.id,
            dataset_name=dataset.name,
            issue_type="Dataset given IDs without metadata",
            count_affected=len(given_ids_not_in_metadata),
            percent_affected=percent_ids_not_in_metadata,
            examples=list(given_ids_not_in_metadata)[:5],
        )
    return None

def check_for_metadata_not_in_dataset(dataset: MatrixDataset, dimension_type_name: str, axis: str, dataset_given_ids: list[str], metadata_given_ids: list[str]) -> Optional[DataIssue]:
    """
    Return a data issue if the given dataset is not using the vast majority of the IDs in its feature's metadata
    For example, paralog datasets in breadbox are expected to reference most of the gene pairs we have metadata for.
    Note: this validation skips certain dimension types, configured in dim_types_with_expansive_metadata. 
    """
    if dimension_type_name in dim_types_with_expansive_metadata:
        return None

    # Get the cutoffs configured for this particular dataset
    dataset_configs = dataset.dataset_metadata if dataset.dataset_metadata else {}
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
