from __future__ import annotations
from typing import Callable, Iterator, Any, Union, List, Optional, Tuple, Dict


from dataclasses import dataclass

from breadbox.db.session import SessionWithUser
from ...schemas.dataset import AnnotationType
from ...crud import dataset as crud_dataset
from ...crud import dimension_types as crud_dimension_types
from ...models.dataset import MatrixDataset, TabularDataset, Dataset, DimensionType


@dataclass(frozen=True)
class MatrixTableMapping:
    dataset_id: str
    name: str


@dataclass(frozen=True)
class TabularTableMapping:
    dataset_id: str
    name: str
    columns: List


import re


def _sanitize(name, max_len=30):
    # turn any non-alphanumeric characters into _
    name = re.sub("[^a-z0-9_]", "_", name.lower())

    # make sure name doesn't start with a number
    if re.match("[0-9]+.*", name):
        name = "_" + name

    # turn multiple "_" into a single "_"
    name = re.sub("_+", "_", name)

    # make sure the name isn't too long
    name = name[:max_len]

    # make sure the final result satisfies the constraints
    assert re.match("[a-z_]+[a-z0-9_]*", name)
    return name


def add_suffix_if_needed(name: str, used_names: set, max_tries=100):
    if name not in used_names:
        return name
    for i in range(max_tries):
        with_prefix = f"{name}_{i+1}"
        if with_prefix not in used_names:
            return with_prefix
    raise Exception(f"too many attempts to get a unique name for {name}")


def sanitize_names(names: List[str]) -> Dict[str, str]:
    """Given a list of names, return a map of those names to unique sanitized names.
    For example: ["a", "A", "a!"] -> {"a": "a", "a": "a_1", "a!": "a_"}
    """
    used_names = set()
    name_to_sanitized = {}

    for name in names:
        sanitized = add_suffix_if_needed(_sanitize(name), used_names)
        used_names.add(sanitized)
        name_to_sanitized[name] = sanitized

    return name_to_sanitized


def _fk_constraint_name(table_name, sample_id_column):
    return f"fk_{table_name}_{sample_id_column}"


class SchemaNames:
    def __init__(
        self,
        table_name_by_dataset_id,
        table_pk_by_dataset_id,
        metadata_dataset_id_by_type,
    ):
        self.table_name_by_dataset_id = table_name_by_dataset_id
        self.table_pk_by_dataset_id = table_pk_by_dataset_id
        self.metadata_dataset_id_by_type = metadata_dataset_id_by_type
        self.type_name_by_dataset_id = {
            type_name: dataset_id
            for dataset_id, type_name in table_pk_by_dataset_id.items()
        }

    def get_dataset_table_name(self, dataset_id: str):
        return self.table_name_by_dataset_id[dataset_id]

    def get_tabular_dataset_pk(self, dataset_id: str):
        return self.table_pk_by_dataset_id[dataset_id]

    def get_metadata_dataset_id_for_type(self, type_name: str):
        return self.metadata_dataset_id_by_type[type_name]

    def get_type_name_using_dataset_id(self, dataset_id: str):
        return self.type_name_by_dataset_id.get(dataset_id)


def _get_create_table_for_matrix(dataset: MatrixDataset, schema: SchemaNames) -> str:
    clauses = []

    table_name = schema.get_dataset_table_name(dataset.id)

    # hardcoding these names -- but maybe the name should be based on the metadata table they're joining to?
    sample_id_column = "sample_id"
    feature_id_column = "feature_id"

    # add columns
    clauses.append(f'"{sample_id_column}" VARCHAR NOT NULL')
    clauses.append(f'"{feature_id_column}" VARCHAR NOT NULL')
    clauses.append(f'"value" FLOAT')

    # add PK
    clauses.append(
        f"CONSTRAINT pk_{table_name} PRIMARY KEY ({feature_id_column}, {sample_id_column})"
    )

    # add KFs
    sample_type_metadata_id = dataset.sample_type.dataset.id
    sample_metadata_table = schema.get_dataset_table_name(sample_type_metadata_id)
    sample_metadata_pk = schema.get_tabular_dataset_pk(sample_type_metadata_id)
    clauses.append(
        f'CONSTRAINT {_fk_constraint_name(table_name, sample_id_column)} FOREIGN KEY ({sample_id_column}) REFERENCES "{sample_metadata_table}" ("{sample_metadata_pk}")'
    )
    if (
        dataset.feature_type_name is not None
        and dataset.feature_type.dataset is not None
    ):
        feature_type_metadata_id = dataset.feature_type.dataset.id
        feature_metadata_table = schema.get_dataset_table_name(feature_type_metadata_id)
        feature_metadata_pk = schema.get_tabular_dataset_pk(feature_type_metadata_id)
        clauses.append(
            f'CONSTRAINT {_fk_constraint_name(table_name, feature_id_column)} FOREIGN KEY ({feature_id_column}) REFERENCES "{feature_metadata_table}" ("{feature_metadata_pk}")'
        )
    # trying to make it clear that there's a link between the sample/feature tables, but I'm not sure that this is useful. Perhaps it should be removed?
    clauses.append(
        f'CONSTRAINT {_fk_constraint_name(table_name, feature_id_column)}_2 FOREIGN KEY ({feature_id_column}) REFERENCES "{table_name}_feature" ("{feature_id_column}")'
    )
    clauses.append(
        f'CONSTRAINT {_fk_constraint_name(table_name, sample_id_column)}_2 FOREIGN KEY ({sample_id_column}) REFERENCES "{table_name}_sample" ("{sample_id_column}")'
    )

    # add some leading space to make it more readable
    clauses = [f"    {x}" for x in clauses]
    clauses_str = ",\n".join(clauses)

    return f"""
CREATE TABLE \"{table_name}_sample\" (
    /*
    List of sample_ids in {table_name}.
    */
    \"{sample_id_column}\" VARCHAR NOT NULL,
);

CREATE TABLE \"{table_name}_feature\" (
    /*
    List of feature_ids in {table_name}. 
    */
    \"{feature_id_column}\" VARCHAR NOT NULL,
);

CREATE TABLE \"{table_name}\" (
    /* 
    Table definition for matrix dataset \"{dataset.name}\" (id={dataset.id}, given_id={dataset.given_id})
    */    
{clauses_str}
);
"""


annotation_type_to_sql_type = {
    AnnotationType.continuous: "FLOAT",
    AnnotationType.categorical: "VARCHAR",
    AnnotationType.list_strings: "VARCHAR",
    AnnotationType.text: "VARCHAR",
}


def _get_create_table_for_tabular(dataset: TabularDataset, schema: SchemaNames) -> str:
    clauses = []

    table_name = schema.get_dataset_table_name(dataset.id)
    pk_column = schema.get_tabular_dataset_pk(dataset.id)

    has_label = False

    # add columns
    for column_name, column_metadata in sorted(dataset.columns_metadata.items()):
        sql_type = annotation_type_to_sql_type[column_metadata.col_type]
        if column_name == pk_column or column_name == "label":
            clauses.append(f'"{column_name}" {sql_type} NOT NULL')
            if column_name == "label":
                has_label = True
        else:
            clauses.append(f'"{column_name}" {sql_type}')

    # add PK
    clauses.append(f"CONSTRAINT pk_{table_name} PRIMARY KEY ({pk_column})")
    if has_label:
        clauses.append(f"CONSTRAINT uk_{table_name}_label UNIQUE (label)")

    # add KFs
    for column_name, column_metadata in dataset.columns_metadata.items():
        if column_metadata.references:
            ref_metadata_dataset_id = schema.get_metadata_dataset_id_for_type(
                column_metadata.references
            )
            ref_table_name = schema.get_dataset_table_name(ref_metadata_dataset_id)
            ref_pk_column = schema.get_tabular_dataset_pk(ref_metadata_dataset_id)
            clauses.append(
                f'CONSTRAINT {_fk_constraint_name(table_name, column_name)} ({column_name}) REFERENCES "{ref_table_name}" ("{ref_pk_column}")'
            )

    # add some leading space to make it more readable
    clauses = [f"    {x}" for x in clauses]
    clauses_str = ",\n".join(clauses)

    type_name = schema.get_type_name_using_dataset_id(dataset.id)
    if type_name is None:
        used_by_comment = ""
    else:
        used_by_comment = f'(contains the primary annotations for "{type_name}")'

    return f"""CREATE TABLE \"{table_name}\" (
    /*
    Table definition for tabular dataset \"{dataset.name}\" (id={dataset.id}, given_id={dataset.given_id})" {used_by_comment}
    */
{clauses_str}
);
"""


def assign_names(datasets: List[Dataset], dim_types: List[DimensionType]):
    dataset_names = [x.name for x in datasets]
    sanitized_names = sanitize_names(dataset_names)
    table_name_by_dataset_id = {x.id: sanitized_names[x.name] for x in datasets}

    dim_type_by_name = {x.name: x for x in dim_types}

    table_pk_by_dataset_id = {
        x.id: dim_type_by_name[x.index_type_name].id_column
        for x in datasets
        if isinstance(x, TabularDataset)
    }

    metadata_dataset_id_by_type = {x.name: x.dataset_id for x in dim_types}

    return SchemaNames(
        table_name_by_dataset_id=table_name_by_dataset_id,
        table_pk_by_dataset_id=table_pk_by_dataset_id,
        metadata_dataset_id_by_type=metadata_dataset_id_by_type,
    )


def generate_simulated_schema(db: SessionWithUser, filter_by_dataset: Optional[Dataset]):
    # Assign names for all datasets and dim types
    all_datasets = crud_dataset.get_datasets(db, db.user)
    all_dim_types = crud_dimension_types.get_dimension_types(db)
    schema = assign_names(all_datasets, all_dim_types)

    filtered_datasets = [filter_by_dataset] if filter_by_dataset else all_datasets
    all_statements = []
    for dataset in filtered_datasets:
        if isinstance(dataset, MatrixDataset):
            statements = _get_create_table_for_matrix(dataset, schema)
        elif isinstance(dataset, TabularDataset):
            statements = _get_create_table_for_tabular(dataset, schema)
        else:
            raise Exception("Unknown dataset type")
        all_statements.append(statements)
    # return repr(all_statements)
    return "\n".join(all_statements)
