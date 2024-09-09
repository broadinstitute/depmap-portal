from dataclasses import dataclass
from typing import Optional, List, Dict

from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import ValueType, AnnotationType
import enum
from breadbox.crud.data_type import add_data_type, get_data_type
import pandas as pd
from breadbox.crud.types import add_dimension_type

from breadbox.crud.data_type import get_data_types
from breadbox.api.types import add_feature_type, add_sample_type, Settings
from breadbox.schemas.types import IdMapping, AnnotationTypeMap
import os
from typing import Protocol, Any
import typing


class CeleryTask(Protocol):
    def apply(self, args) -> Any:
        ...


class MetadataType(enum.Enum):
    feature_type = "feature_type"
    sample_type = "sample_type"


@dataclass
class DatasetMetadata:
    metadata_type: MetadataType
    metadata_type_name: str
    id_column: str
    annotation_type_mapping: Optional[Dict[str, AnnotationType]] = None
    #    id_mapping: Optional[IdMapping] = None
    filename: Optional[str] = None
    taiga_id: Optional[str] = None


@dataclass
class MetadataDatasetUpload:
    metadata_type: MetadataType
    metadata_type_name: str
    id_column: str
    annotation_type_mapping: Optional[Dict[str, AnnotationType]] = None
    # id_mapping: Optional[str] = None
    filename: Optional[str] = None
    taiga_id: Optional[str] = None


@dataclass
class DatasetUpload:
    dataset_name: str
    feature_type: str
    sample_type: str
    units: str
    value_type: ValueType
    filename: str
    data_type: str = "User upload"
    # TODO: Temporary default value to avoid needing to change entire depmap upload script for now
    priority: Optional[int] = None
    taiga_id: Optional[str] = None
    allowed_values: Optional[List[str]] = None
    dataset_metadata: Optional[DatasetMetadata] = None
    data_file_format = "csv"


class DataTypeEnum(enum.Enum):
    cn = "CN"
    mutations = "Mutations"
    model_metadata = "Model Metadata"
    protein_expression = "Protein Expression"
    methylation = "Methylation"
    structural_variants = "Structural variants"
    expression = "Expression"
    metabolomics = "Metabolomics"
    confounders = "Confounders"
    crispr = "CRISPR"
    rnai = "RNAi"
    global_genomics = "Global genomics"
    global_epigenomic_feature = "Global epigenomic feature"
    drug_screen = "Drug screen"
    msi = "MSI"
    metmap = "MetMap"
    functional_category = "Functional category"
    gene_accessibility = "Gene accessibility"  # temporarily defined this until I confirm what the type should be
    deprecated = (
        "deprecated"  # NOTE: datasets with this data type are going to be deprecated
    )
    user_upload = "User upload"


@dataclass
class DataTypeUpload:
    name: str


def upload_example_datasets(db, settings):
    example_datasets = [
        DatasetUpload(
            "Drug sensitivity (PRISM Repurposing Primary Screen)",
            "compound",
            "depmap_model",
            "log2 fold change",
            ValueType.continuous,
            "tests/sample_data/repurposing-primary_score.csv",
        ),
        DatasetUpload(
            "Drug sensitivity AUC (PRISM Repurposing Secondary Screen)",
            "compound",
            "depmap_model",
            "AUC",
            ValueType.continuous,
            "tests/sample_data/repurposing-secondary-auc_score.csv",
        ),
        DatasetUpload(
            "Drug sensitivity dose-level (PRISM Repurposing Secondary Screen)",
            "compound",
            "depmap_model",
            "log2 fold change (μM)",
            ValueType.continuous,
            "tests/sample_data/repurposing-secondary-dose_score.csv",
        ),
        DatasetUpload(
            "CRISPR (DepMap 22Q1 Internal+Score, Chronos)",
            "gene",
            "depmap_model",
            "Gene Effect (Chronos)",
            ValueType.continuous,
            "tests/sample_data/chronos_combined_score.csv",
        ),
        DatasetUpload(
            "Expression",
            "gene",
            "depmap_model",
            "log2(TPM+1)",
            ValueType.continuous,
            "tests/sample_data/expression.csv",
        ),
        DatasetUpload(
            "Protein Array",
            "rppa_antibody",
            "depmap_model",
            "RPPA signal (log2)",
            ValueType.continuous,
            "tests/sample_data/rppa.csv",
        ),
        DatasetUpload(
            "Methylation (1kb upstream TSS)",
            "rbbs_tss",
            "depmap_model",
            "Methylation Fraction",
            ValueType.continuous,
            "tests/sample_data/rbbs.csv",
        ),
        DatasetUpload(
            "Proteomics",
            "protein",
            "depmap_model",
            "Relative Protein Expression",
            ValueType.continuous,
            "tests/sample_data/proteomics.csv",
        ),
    ]

    example_metadata_datasets = [
        MetadataDatasetUpload(
            metadata_type=MetadataType.feature_type,
            metadata_type_name="gene",
            id_column="entrez_id",
            annotation_type_mapping={
                "entrez_id": AnnotationType.text,
                "label": AnnotationType.text,
                "name": AnnotationType.text,
                "ensembl_id": AnnotationType.text,
                "hgnc_id": AnnotationType.text,
                "locus_type": AnnotationType.text,
                "uniprot_ids": AnnotationType.text,
            },
            filename="tests/sample_data/gene_reference.csv",
        ),
        MetadataDatasetUpload(
            MetadataType.sample_type,
            "depmap_model",
            "depmap_id",
            {
                "depmap_id": AnnotationType.text,
                "cell_line_name": AnnotationType.text,
                "cell_line_display_name": AnnotationType.text,
                "label": AnnotationType.text,
                "aliases": AnnotationType.text,
                "alt_names": AnnotationType.text,
                "wtsi_master_cell_id": AnnotationType.text,
                "cosmic_id": AnnotationType.text,
                "cell_line_passport_id": AnnotationType.text,
                "primary_disease": AnnotationType.categorical,
                "subtype_name": AnnotationType.categorical,
                "tumor_type_name": AnnotationType.text,
                "gender": AnnotationType.categorical,
                "lineage_1": AnnotationType.categorical,
                "lineage_2": AnnotationType.categorical,
                "lineage_3": AnnotationType.categorical,
                "lineage_4": AnnotationType.categorical,
                "source": AnnotationType.text,
                "rrid": AnnotationType.text,
                "image_filename": AnnotationType.text,
                "comments": AnnotationType.text,
            },
            filename="tests/sample_data/depmap_model_reference.csv",
        ),
        MetadataDatasetUpload(
            MetadataType.feature_type, "rppa_antibody", "antibody_id"
        ),
        MetadataDatasetUpload(MetadataType.feature_type, "rbbs_tss", "rbbs_tss_id"),
        MetadataDatasetUpload(MetadataType.feature_type, "protein", "uniprot_id"),
        MetadataDatasetUpload(MetadataType.feature_type, "compound", "label"),
        MetadataDatasetUpload(MetadataType.feature_type, "condition", "condition_id"),
        MetadataDatasetUpload(
            MetadataType.feature_type, "compound_sample", "compound_id"
        ),
        MetadataDatasetUpload(
            MetadataType.feature_type, "crispr_screen", "depmap_screen_id"
        ),
    ]

    existing_data_type_names = {t.data_type for t in get_data_types(db)}
    preset_data_types = set(
        [dt.value for dt in DataTypeEnum if dt.value not in existing_data_type_names]
    )

    for preset_dt_name in preset_data_types:
        if get_data_type(db, preset_dt_name) is None:
            add_data_type(db, preset_dt_name)
            db.flush()

    for m in example_metadata_datasets:
        validate_metadata_upload_and_add_to_db(db, settings, m)
        db.flush()

    for d in example_datasets:
        validate_dataset_upload_and_add_to_db(db, settings, d)
        db.flush()


def get_upload_file(obj):
    """
    Constructs an instance of File used by the client to upload. Override this class if there
    are any additional transformations that should be done to the file before uploading.
    """
    if obj.filename is None:
        return None

    upload = FileHack(
        file=open(obj.filename, "rb"),
        filename=os.path.basename(obj.filename),
        mimetype="text/csv",
    )
    return upload


def validate_metadata_upload_and_add_to_db(
    db: SessionWithUser, settings: Settings, m: MetadataDatasetUpload
):
    feature_types = get_data_types(db)
    assert isinstance(feature_types, List)
    if m.metadata_type_name in {f.data_type for f in feature_types}:
        return

    # pick an arbitrary admin to do these operations. Only do this because this
    # is only going to run in dev. This is not something we should do outside of testing
    user = settings.admin_users[0]

    upload_file = get_upload_file(m)

    id_mapping = None
    # if m.id_mapping:
    #     id_mapping = IdMapping(reference_column_mappings=m.id_mapping)

    annotation_type_mapping = None
    if m.annotation_type_mapping:
        annotation_type_mapping = AnnotationTypeMap(
            annotation_type_mapping=m.annotation_type_mapping
        )

    if m.metadata_type == MetadataType.feature_type:
        axis = "feature"
    else:
        assert m.metadata_type == MetadataType.sample_type
        axis = "sample"

    metadata_df = None
    if upload_file is not None:
        metadata_df = pd.read_csv(upload_file.file)  # pyright: ignore

    add_dimension_type(
        db,
        settings,
        user,
        m.metadata_type_name,
        m.metadata_type_name,
        m.id_column,
        axis,
        metadata_df,
        m.annotation_type_mapping,
        reference_column_mappings={},
        # reference_column_mappings: Optional[Dict[str, str]] = None,
        properties_to_index=None,
        taiga_id=m.taiga_id,
        units_per_column={},
    )


@dataclass
class FileHack:
    file: object
    filename: str
    mimetype: Optional[str] = None


def validate_dataset_upload_and_add_to_db(
    db: SessionWithUser, settings: Settings, d: DatasetUpload
):
    from breadbox.api.datasets import get_file_dict, run_upload_dataset, get_datasets
    from breadbox.crud.access_control import PUBLIC_GROUP_ID

    # pick an arbitrary admin to do these operations. Only do this because this
    # is only going to run in dev. This is not something we should do outside of testing
    user = settings.admin_users[0]
    datasets = get_datasets(db=db, user=user)
    assert datasets is not None
    if d.dataset_name in {x.name for x in datasets}:  # type: ignore
        print(f"Skipping load of {d.dataset_name}")
        return

    data_file_dict = get_file_dict(
        FileHack(file=open(d.filename, "rb"), filename=d.filename)
    )

    run_upload_dataset_: CeleryTask = typing.cast(CeleryTask, run_upload_dataset)
    r = run_upload_dataset_.apply(
        args=[
            d.dataset_name,
            d.units,
            d.feature_type,
            d.sample_type,
            d.data_type,
            data_file_dict,
            d.value_type,
            d.priority,
            d.taiga_id,
            d.allowed_values,
            False,
            user,
            PUBLIC_GROUP_ID,
            {},
            d.data_file_format,
        ]
    )
