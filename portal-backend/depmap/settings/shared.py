from collections import namedtuple
from dataclasses import dataclass
from typing import Dict, List, Tuple, Union

from flask import current_app

from depmap.enums import BiomarkerEnum, DataTypeEnum, DependencyEnum, TabularEnum


class DataLoadConfig:
    def __init__(
        self, hgnc_dataset: str, dose_replicate_level_datasets: List[DependencyEnum],
    ):
        self.hgnc_dataset = hgnc_dataset
        self.dose_replicate_level_datasets = dose_replicate_level_datasets


@dataclass
class DepDatasetMeta:
    display_name: str
    units: str
    data_type: DataTypeEnum
    global_priority: int = None
    priority: int = None
    nominal_range: tuple = (0, 0)


@dataclass
class DatasetLabel:
    display_name: str
    units: str
    data_type: DataTypeEnum
    s3_json_name: str
    global_priority: int = None
    priority: int = None
    nominal_range: tuple = (0, 0)


TabularDatasetMeta = namedtuple(
    "TabularDatasetMeta", ["display_name", "data_type", "units"]
)

# preferred range for plotting scores which are normalized to pos and neg ctrl
NORMALIZED_RANGE = (-2, 2)

DATASET_METADATA: Dict[
    Union[BiomarkerEnum, DependencyEnum, TabularEnum],
    Union[DatasetLabel, DepDatasetMeta, TabularDatasetMeta],
] = {  # used in data load
    BiomarkerEnum.expression: DatasetLabel(
        display_name="Expression",
        units="log2(TPM+1)",
        s3_json_name="expression",
        data_type=DataTypeEnum.expression,
        priority=1,
        global_priority=3,
    ),
    BiomarkerEnum.copy_number_absolute: DatasetLabel(
        display_name="Copy Number (Absolute)",
        units="Copy Number",
        s3_json_name="copy-number-absolute",
        data_type=DataTypeEnum.cn,
        priority=2,
    ),
    BiomarkerEnum.copy_number_relative: DatasetLabel(
        display_name="Copy Number",
        units="Copy Number log2(relative to ploidy + 1)",
        s3_json_name="copy-number-relative",
        data_type=DataTypeEnum.cn,
        priority=1,
        global_priority=4,
    ),
    BiomarkerEnum.mutation_pearson: DatasetLabel(
        display_name="Mutation",
        units="Mutation (one hot encoding)",
        s3_json_name="mutation-pearson",
        data_type=DataTypeEnum.mutations,
        global_priority=5,
    ),
    BiomarkerEnum.context: DatasetLabel(
        display_name="Context",
        units="Context",
        s3_json_name="context",
        data_type=DataTypeEnum.model_metadata,
    ),
    BiomarkerEnum.rppa: DatasetLabel(
        display_name="Protein Array",
        units="RPPA signal (log2)",
        s3_json_name="rppa",
        data_type=DataTypeEnum.protein_expression,
        global_priority=9,
    ),
    BiomarkerEnum.rrbs: DatasetLabel(
        display_name="Methylation (1kb upstream TSS)",
        units="Methylation Fraction",
        s3_json_name="rrbs",
        data_type=DataTypeEnum.methylation,
    ),
    BiomarkerEnum.proteomics: DatasetLabel(
        display_name="Proteomics",
        units="Relative Protein Expression",
        s3_json_name="proteomics",
        data_type=DataTypeEnum.protein_expression,
        priority=1,
        global_priority=10,
    ),
    BiomarkerEnum.sanger_proteomics: DatasetLabel(
        display_name="Sanger Proteomics",
        units="Relative Protein Expression",
        s3_json_name="sanger-proteomics",  # biomarker-category == s3_json_name
        data_type=DataTypeEnum.protein_expression,
        global_priority=11,
    ),
    BiomarkerEnum.mutations_hotspot: DatasetLabel(
        display_name="Hotspot Mutations",
        units="Has Hotspot Mutation",
        s3_json_name="mutations-hotspot",
        data_type=DataTypeEnum.mutations,
        priority=1,
        global_priority=6,
    ),
    BiomarkerEnum.mutations_damaging: DatasetLabel(
        display_name="Damaging Mutations",
        units="Has Damaging Mutation",
        s3_json_name="mutations-damaging",
        data_type=DataTypeEnum.mutations,
        global_priority=7,
    ),
    BiomarkerEnum.mutations_driver: DatasetLabel(
        display_name="Driver Mutations",
        units="Has Driver Mutation",
        s3_json_name="mutations-driver",
        data_type=DataTypeEnum.mutations,
        global_priority=8,
    ),
    BiomarkerEnum.mutations_prioritized: DatasetLabel(
        display_name="Prioritized Mutations",
        units="Has Prioritized Mutation",
        s3_json_name="",  # Not uploaded to s3
        data_type=DataTypeEnum.mutations,
    ),
    BiomarkerEnum.fusions: DatasetLabel(
        display_name="Fusions (one-hot encoded)",
        units="Has genes fused",
        s3_json_name="fusions",
        data_type=DataTypeEnum.structural_variants,
    ),
    BiomarkerEnum.ssgsea: DatasetLabel(
        display_name="ssGSEA",
        units="Enrichment",
        s3_json_name="ssgsea",
        data_type=DataTypeEnum.expression,
    ),
    BiomarkerEnum.metabolomics: DatasetLabel(
        display_name="Metabolomics",
        units="metabolite abundance (log10 scale)",
        s3_json_name="metabolomics",
        data_type=DataTypeEnum.metabolomics,
        priority=1,
    ),
    BiomarkerEnum.crispr_confounders: DatasetLabel(
        display_name="CRISPR confounders",
        units="",
        s3_json_name="crispr-confounders",
        data_type=DataTypeEnum.confounders,
        priority=1,
    ),
    BiomarkerEnum.rnai_confounders: DatasetLabel(
        display_name="RNAi confounders",
        units="",
        s3_json_name="rnai-confounders",
        data_type=DataTypeEnum.confounders,
        priority=2,
    ),
    BiomarkerEnum.rep1m_confounders: DatasetLabel(
        display_name="Rep1M confounders",
        units="",
        s3_json_name="rep1m-confounders",
        data_type=DataTypeEnum.confounders,
        priority=5,
    ),
    BiomarkerEnum.oncref_confounders: DatasetLabel(
        display_name="PRISM OncRef confounders",
        units="",
        s3_json_name="oncref-confounders",
        data_type=DataTypeEnum.confounders,
        priority=3,
    ),
    BiomarkerEnum.rep_all_single_pt_confounders: DatasetLabel(
        display_name="Repurposing Primary Extended confounders",
        units="",
        s3_json_name="repallsinglept-confounders",  # matches biomarker-matrix artfact's category
        data_type=DataTypeEnum.confounders,
        priority=4,
    ),
    BiomarkerEnum.CRISPRGeneDependency: DatasetLabel(
        display_name="CRISPR Gene Dependency",
        units="Probability of dependency",
        s3_json_name="CRISPRGeneDependency",
        data_type=DataTypeEnum.crispr,
        priority=9,
    ),
    BiomarkerEnum.OmicsAbsoluteCNGene: DatasetLabel(
        display_name="Omics Absolute CN Gene",
        units="Gene-Level Absolute Copy Number",
        s3_json_name="OmicsAbsoluteCNGene",
        data_type=DataTypeEnum.cn,
    ),
    BiomarkerEnum.OmicsLoH: DatasetLabel(
        display_name="Omics LoH",
        units="Binary (0=no LoH, 1=LoH)",
        s3_json_name="OmicsLoH",
        data_type=DataTypeEnum.cn,
    ),
    BiomarkerEnum.OmicsSignatures: DatasetLabel(
        display_name="Omics Signatures",
        units="",
        s3_json_name="OmicsSignatures",
        data_type=DataTypeEnum.global_genomics,
    ),
    DependencyEnum.OrganoidGeneEffect: DepDatasetMeta(
        display_name="Organoid Gene Effect",
        units="Gene Effect (Chronos)",
        nominal_range=NORMALIZED_RANGE,
        data_type=DataTypeEnum.crispr,
        priority=7,
    ),
    DependencyEnum.RNAi_Ach: DepDatasetMeta(
        display_name="RNAi (Achilles, DEMETER2)",
        units="Gene Effect (DEMETER2)",
        nominal_range=NORMALIZED_RANGE,
        data_type=DataTypeEnum.rnai,
        priority=2,
    ),
    DependencyEnum.RNAi_Nov_DEM: DepDatasetMeta(
        display_name="RNAi (DRIVE, DEMETER2)",
        units="Gene Effect (DEMETER2)",
        nominal_range=NORMALIZED_RANGE,
        data_type=DataTypeEnum.rnai,
        priority=3,
    ),
    DependencyEnum.RNAi_merged: DepDatasetMeta(
        display_name="RNAi (Achilles+DRIVE+Marcotte, DEMETER2)",
        units="Gene Effect (DEMETER2)",
        nominal_range=NORMALIZED_RANGE,
        data_type=DataTypeEnum.rnai,
        priority=1,
        global_priority=2,
    ),
    DependencyEnum.Chronos_Combined: DepDatasetMeta(
        display_name="CRISPR (DepMap+Score, Chronos)",
        units="Gene Effect (Chronos)",
        nominal_range=NORMALIZED_RANGE,
        data_type=DataTypeEnum.crispr,
        priority=1,  # Determined from labeling as default_crispr_enum
        global_priority=1,
    ),
    DependencyEnum.Chronos_Achilles: DepDatasetMeta(
        display_name="CRISPR (DepMap, Chronos)",
        units="Gene Effect (Chronos)",
        nominal_range=NORMALIZED_RANGE,
        data_type=DataTypeEnum.crispr,
        priority=2,
    ),
    DependencyEnum.CERES_Combined: DepDatasetMeta(
        display_name="CRISPR (DepMap+Score, CERES)",
        units="Gene Effect (CERES)",
        nominal_range=NORMALIZED_RANGE,
        data_type=DataTypeEnum.crispr,
        priority=4,
    ),
    DependencyEnum.Avana: DepDatasetMeta(
        display_name="CRISPR (DepMap, CERES)",
        units="Gene Effect (CERES)",
        nominal_range=NORMALIZED_RANGE,
        data_type=DataTypeEnum.crispr,
        priority=5,
    ),
    DependencyEnum.GDSC1_AUC: DepDatasetMeta(
        display_name="Drug sensitivity AUC (Sanger GDSC1)",
        units="AUC",
        data_type=DataTypeEnum.drug_screen,
        nominal_range=(0, 1.1),
    ),
    DependencyEnum.GDSC1_IC50: DepDatasetMeta(
        display_name="Drug sensitivity IC50 (Sanger GDSC1)",
        units="ln(IC50) (μM)",
        data_type=DataTypeEnum.drug_screen,
    ),
    DependencyEnum.GDSC2_AUC: DepDatasetMeta(
        display_name="Drug sensitivity AUC (Sanger GDSC2)",
        units="AUC",
        data_type=DataTypeEnum.drug_screen,
        nominal_range=(0, 1.1),
    ),
    DependencyEnum.GDSC2_IC50: DepDatasetMeta(
        display_name="Drug sensitivity IC50 (Sanger GDSC2)",
        units="ln(IC50) (μM)",
        data_type=DataTypeEnum.drug_screen,
    ),
    DependencyEnum.GDSC1_dose_replicate: DepDatasetMeta(
        display_name="Drug sensitivity replicate-level dose (Sanger GDSC1)",
        units="Viability",
        data_type=DataTypeEnum.drug_screen,
    ),
    DependencyEnum.GDSC2_dose_replicate: DepDatasetMeta(
        display_name="Drug sensitivity replicate-level dose (Sanger GDSC2)",
        units="Viability",
        data_type=DataTypeEnum.drug_screen,
    ),
    DependencyEnum.CTRP_AUC: DepDatasetMeta(
        display_name="Drug sensitivity AUC (CTD^2)",
        units="AUC",
        data_type=DataTypeEnum.drug_screen,
        nominal_range=(0, 1.1),
    ),
    DependencyEnum.CTRP_dose_replicate: DepDatasetMeta(
        display_name="Drug sensitivity replicate-level dose (CTD^2)",
        units="Viability",
        data_type=DataTypeEnum.drug_screen,
    ),
    DependencyEnum.Repurposing_secondary_AUC: DepDatasetMeta(
        display_name="Drug sensitivity AUC (PRISM Repurposing Secondary Screen)",
        units="AUC",
        data_type=DataTypeEnum.drug_screen,
        nominal_range=(0, 1.1),
        global_priority=13,
    ),
    DependencyEnum.Repurposing_secondary_dose: DepDatasetMeta(
        display_name="Drug sensitivity dose-level (PRISM Repurposing Secondary Screen)",
        units="log2 fold change (μM)",
        data_type=DataTypeEnum.drug_screen,
        global_priority=14,
    ),
    DependencyEnum.Repurposing_secondary_dose_replicate: DepDatasetMeta(
        display_name="Drug sensitivity replicate-level dose (PRISM Repurposing Secondary Screen)",
        units="Viability",  # does not contain (μM), because this goes into the y axis of the dose response curve. the dose-axis label in dose curves is set in react code
        data_type=DataTypeEnum.drug_screen,
        global_priority=15,
    ),
    DependencyEnum.Rep1M: DepDatasetMeta(
        display_name="Repurposing 1M",
        units="log2 fold change",
        nominal_range=(0, 1.1),
        data_type=DataTypeEnum.drug_screen,
        global_priority=16,
    ),
    DependencyEnum.Rep_all_single_pt: DepDatasetMeta(
        display_name="Repurposing Primary Extended",
        units="log2 fold change",
        data_type=DataTypeEnum.drug_screen,
        nominal_range=(0, 1.1),
        priority=2,
        global_priority=17,
    ),
    DependencyEnum.Prism_oncology_AUC: DepDatasetMeta(
        display_name="PRISM OncRef AUC",  # display name overridden by dataset display name artifact
        units="AUC",
        data_type=DataTypeEnum.drug_screen,
        nominal_range=(0, 1.1),
        priority=1,
    ),
    DependencyEnum.Prism_oncology_IC50: DepDatasetMeta(
        display_name="PRISM OncRef IC50",  # display name overridden by dataset display name artifact
        units="log2(IC50) (μM)",
        data_type=DataTypeEnum.drug_screen,
    ),
    DependencyEnum.Prism_oncology_dose_replicate: DepDatasetMeta(
        display_name="PRISM OncRef Dose Replicate",
        units="Viability",
        data_type=DataTypeEnum.drug_screen,
    ),
    TabularEnum.mutation: TabularDatasetMeta(
        display_name="Mutation", data_type=DataTypeEnum.mutations, units=""
    ),
    TabularEnum.fusion: TabularDatasetMeta(
        display_name="Fusion", data_type=DataTypeEnum.structural_variants, units=""
    ),
    TabularEnum.translocation: TabularDatasetMeta(
        display_name="Translocation",
        data_type=DataTypeEnum.structural_variants,
        units="",
    ),
}
