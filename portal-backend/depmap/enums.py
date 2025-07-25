import enum


class DatasetEnum(enum.Enum):
    @staticmethod
    def get_enum_from_enum_name(enum_name: str) -> enum.Enum:
        assert isinstance(enum_name, str)  # should be string, not enum object
        if enum_name in DependencyEnum.values():
            return DependencyEnum(enum_name)
        elif enum_name in BiomarkerEnum.values():
            return BiomarkerEnum(enum_name)
        else:
            raise ValueError("Unexpected enum name ", enum_name)


class DependencyEnum(DatasetEnum):
    # define in desired iteration order

    # Chronos_Achilles and Chronos_Score combined
    Chronos_Combined = "Chronos_Combined"
    # analogous to Avana, but run with Chronos instead of CERES
    Chronos_Achilles = "Chronos_Achilles"

    CERES_Combined = "CERES_Combined"  # Avana and Sanger_CRISPR combined
    Avana = "Avana"

    OrganoidGeneEffect = "OrganoidGeneEffect"

    # RNAi
    RNAi_merged = "RNAi_merged"
    RNAi_Ach = "RNAi_Ach"
    RNAi_Nov_DEM = "RNAi_Nov_DEM"

    # Drug datasets
    GDSC1_AUC = "GDSC1_AUC"
    GDSC2_AUC = "GDSC2_AUC"
    CTRP_AUC = "CTRP_AUC"
    Repurposing_secondary_AUC = "Repurposing_secondary_AUC"

    CTRP_dose_replicate = "CTRP_dose_replicate"
    GDSC1_dose_replicate = "GDSC1_dose_replicate"
    GDSC2_dose_replicate = "GDSC2_dose_replicate"
    Repurposing_secondary_dose = "Repurposing_secondary_dose"
    Repurposing_secondary_dose_replicate = "Repurposing_secondary_dose_replicate"
    Rep1M = "Rep1M"
    Rep_all_single_pt = "Rep_all_single_pt"
    Prism_oncology_AUC = "Prism_oncology_AUC"
    Prism_oncology_dose_replicate = "Prism_oncology_dose_replicate"

    @staticmethod
    def values():
        return {x.value for x in DependencyEnum}

    @staticmethod
    def is_compound_experiment_enum(dataset_enum):
        """
        This used to be a static method in DependencyDataset but was moved here since it was only used in loader script to check if dependency dataset enum.
        """
        # TODO: Unhardcode
        return dataset_enum in {
            DependencyEnum.GDSC1_AUC,
            DependencyEnum.GDSC2_AUC,
            DependencyEnum.CTRP_AUC,
            DependencyEnum.Repurposing_secondary_AUC,
            DependencyEnum.Rep1M,
            DependencyEnum.Rep_all_single_pt,
            DependencyEnum.Prism_oncology_AUC,
        }


class BiomarkerEnum(DatasetEnum):
    expression = "expression"
    copy_number_absolute = "copy_number_absolute"
    copy_number_relative = "copy_number_relative"
    mutation_pearson = "mutation_pearson"
    mutations_damaging = "mutations_damaging"
    mutations_hotspot = "mutations_hotspot"
    mutations_driver = "mutations_driver"
    mutations_prioritized = "mutations_prioritized"
    context = "context"
    rppa = "rppa"
    rrbs = "rrbs"
    proteomics = "proteomics"
    sanger_proteomics = "sanger_proteomics"
    fusions = "fusions"
    ssgsea = "ssgsea"
    metabolomics = "metabolomics"
    crispr_confounders = "crispr_confounders"
    rnai_confounders = "rnai_confounders"
    oncref_confounders = "oncref_confounders"
    rep_all_single_pt_confounders = "rep_all_single_pt_confounders"
    rep1m_confounders = "rep1m_confounders"
    CRISPRGeneDependency = "CRISPRGeneDependency"
    OmicsAbsoluteCNGene = "OmicsAbsoluteCNGene"
    OmicsSignatures = "OmicsSignatures"
    OmicsLoH = "OmicsLoH"

    @staticmethod
    def values():
        return {x.value for x in BiomarkerEnum}


class TabularEnum(enum.Enum):
    depmap_model = "depmap_model"
    gene = "gene"
    mutation = "mutation"
    fusion = "fusion"
    translocation = "translocation"
    metmap = "metmap"
    protein = "protein"


class CellLineTileEnum(enum.Enum):
    description = "description"
    metmap = "metmap"
    pref_dep = "pref_dep"


class GeneTileEnum(enum.Enum):
    essentiality = "essentiality"
    selectivity = "selectivity"
    omics = "omics"
    predictability = "predictability"
    tda_predictability = "tda_predictability"
    target_tractability = "target_tractability"
    codependencies = "codependencies"
    mutations = "mutations"
    gene_score_confidence = "gene_score_confidence"
    description = "description"
    celfie = "celfie"
    targeting_compounds = "targeting_compounds"


class CompoundTileEnum(enum.Enum):
    selectivity = "selectivity"
    predictability = "predictability"
    description = "description"
    sensitivity = "sensitivity"
    correlations = "correlations"
    availability = "availability"
    celfie = "celfie"
    heatmap = "heatmap"


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
