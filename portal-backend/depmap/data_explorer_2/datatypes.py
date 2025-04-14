# None of these can be used as a slice_type/index_type.
blocked_dimension_types = set(
    [
        "antibody",
        "compound_dose",
        "compound_dose_replicate",
        "generic_entity",
        "protein",
        "transcription_start_site",
    ]
)

entity_aliases = {
    "depmap_model": [
        {
            "label": "Cell Line Name",
            "slice_id": "slice/cell_line_display_name/all/label",
        }
    ],
}

_hardcoded_metadata_slices = {
    "depmap_model": {
        "slice/cell_line_display_name/all/label": {
            "name": "Cell Line Name",
            "valueType": "categorical",
            "isHighCardinality": True,
            "isLabelColumn": True,
        },
        "slice/age_category/all/label": {
            "name": "Age Category",
            "valueType": "categorical",
        },
        "slice/lineage/1/label": {"name": "Lineage", "valueType": "categorical"},
        "slice/lineage/2/label": {
            "name": "Lineage Subtype",
            "valueType": "categorical",
        },
        "slice/lineage/3/label": {
            "name": "Lineage Sub-subtype",
            "valueType": "categorical",
        },
        "slice/primary_disease/all/label": {
            "name": "Primary Disease",
            "valueType": "categorical",
        },
        "slice/disease_subtype/all/label": {
            "name": "Disease Subtype",
            "valueType": "categorical",
        },
        "slice/tumor_type/all/label": {
            "name": "Tumor Type",
            "valueType": "categorical",
        },
        "slice/gender/all/label": {"name": "Gender", "valueType": "categorical"},
        "slice/growth_pattern/all/label": {
            "name": "Growth Pattern",
            "valueType": "categorical",
        },
        "slice/prism-pools-4441.2%2Fcoded_prism_pools/": {
            "name": "Current PRISM Pools",
            "valueType": "categorical",
            "isPartialSliceId": True,
            "sliceTypeLabel": "cell line group",
        },
        "slice/mutations_prioritized/": {
            "name": "Mutation",
            "valueType": "categorical",
            "isPartialSliceId": True,
            "sliceTypeLabel": "gene",
        },
        "slice/mutation_protein_change_by_gene/": {
            "name": "Mutation protein changes",
            "valueType": "list_strings",
            "isPartialSliceId": True,
            "isHighCardinality": True,
            "sliceTypeLabel": "gene",
        },
        "slice/msi-0584.6%2Fmsi/": {
            "name": "Micro Satellite Instability",
            "valueType": "categorical",
            "isPartialSliceId": True,
            "sliceTypeLabel": "MSI annotation source",
        },
        ###################################################
        #                Breadbox Metadata                #
        ###################################################
        "slice/depmap_model_metadata/depmap_id/label": {
            "name": "ModelID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
            "isIdColumn": True,
        },
        "slice/depmap_model_metadata/label/label": {
            "name": "CellLineName",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
            "isLabelColumn": True,
        },
        "slice/depmap_model_metadata/Age/label": {
            "name": "Age",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/AgeCategory/label": {
            "name": "AgeCategory",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/CCLEName/label": {
            "name": "CCLEName",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/COSMICID/label": {
            "name": "COSMICID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/CatalogNumber/label": {
            "name": "CatalogNumber",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/CulturedResistanceDrug/label": {
            "name": "CulturedResistanceDrug",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/DepmapModelType/label": {
            "name": "DepmapModelType",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/EngineeredModel/label": {
            "name": "EngineeredModel",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/EngineeredModelDetails/label": {
            "name": "EngineeredModelDetails",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/FormulationID/label": {
            "name": "FormulationID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/GrowthPattern/label": {
            "name": "GrowthPattern",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/HCMIID/label": {
            "name": "HCMIID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/ModelAvailableInDbgap/label": {
            "name": "ModelAvailableInDbgap",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/ModelDerivationMaterial/label": {
            "name": "ModelDerivationMaterial",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/ModelSubtypeFeatures/label": {
            "name": "ModelSubtypeFeatures",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/ModelTreatment/label": {
            "name": "ModelTreatment",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/ModelType/label": {
            "name": "ModelType",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/OnboardedMedia/label": {
            "name": "OnboardedMedia",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/OncotreeCode/label": {
            "name": "OncotreeCode",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/OncotreeLineage/label": {
            "name": "OncotreeLineage",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/OncotreePrimaryDisease/label": {
            "name": "OncotreePrimaryDisease",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/OncotreeSubtype/label": {
            "name": "OncotreeSubtype",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/PatientID/label": {
            "name": "PatientID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/PatientRace/label": {
            "name": "PatientRace",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/PatientSubtypeFeatures/label": {
            "name": "PatientSubtypeFeatures",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/PatientTreatmentDetails/label": {
            "name": "PatientTreatmentDetails",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/PatientTreatmentResponse/label": {
            "name": "PatientTreatmentResponse",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/PatientTreatmentStatus/label": {
            "name": "PatientTreatmentStatus",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/PatientTreatmentType/label": {
            "name": "PatientTreatmentType",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/PatientTumorGrade/label": {
            "name": "PatientTumorGrade",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/PlateCoating/label": {
            "name": "PlateCoating",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/PrimaryOrMetastasis/label": {
            "name": "PrimaryOrMetastasis",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/PublicComments/label": {
            "name": "PublicComments",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/RRID/label": {
            "name": "RRID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/SampleCollectionSite/label": {
            "name": "SampleCollectionSite",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/SangerModelID/label": {
            "name": "SangerModelID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/SerumFreeMedia/label": {
            "name": "SerumFreeMedia",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/Sex/label": {
            "name": "Sex",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/SourceDetail/label": {
            "name": "SourceDetail",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/SourceType/label": {
            "name": "SourceType",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/Stage/label": {
            "name": "Stage",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/StagingSystem/label": {
            "name": "StagingSystem",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/StrippedCellLineName/label": {
            "name": "StrippedCellLineName",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/depmap_model_metadata/TissueOrigin/label": {
            "name": "TissueOrigin",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/depmap_model_metadata/WTSIMasterCellID/label": {
            "name": "WTSIMasterCellID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        ###################################################
    },
    "gene": {
        "slice/gene_essentiality/all/label": {
            "name": "Essentiality",
            "valueType": "categorical",
        },
        "slice/gene_selectivity/all/label": {
            "name": "Selectivity",
            "valueType": "categorical",
        },
    },
    "compound_experiment": {
        "slice/compound_experiment/compound_name/label": {
            "name": "Compound",
            "valueType": "categorical",
            "isHighCardinality": True,
        },
        "slice/compound_experiment/compound_instance/label": {
            "name": "Experiment",
            "valueType": "categorical",
            "isHighCardinality": True,
        },
    },
    # This type should just be called "screen" but it isn't. The fact that it's
    # called "Screen metadata" means that the its metadata is called "Screen
    # metadata metadata" 😵‍💫
    "Screen metadata": {
        "slice/screen_metadata/ScreenID/label": {
            "name": "ScreenID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
            "isIdColumn": True,
        },
        "slice/screen_metadata/CasActivity/label": {
            "name": "CasActivity",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/HasCopyNumber/label": {
            "name": "HasCopyNumber",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/Library/label": {
            "name": "Library",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/ModelConditionID/label": {
            "name": "ModelConditionID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/screen_metadata/ModelID/label": {
            "name": "ModelID",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/screen_metadata/nIncludedSequences/label": {
            "name": "nIncludedSequences",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/nPassingSequences/label": {
            "name": "nPassingSequences",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/ScreenDoublingTime/label": {
            "name": "ScreenDoublingTime",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/ScreenFPR/label": {
            "name": "ScreenFPR",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/ScreenMADEssentials/label": {
            "name": "ScreenMADEssentials",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/screen_metadata/ScreenMADNonessentials/label": {
            "name": "ScreenMADNonessentials",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/screen_metadata/ScreenMedianEssentialDepletion/label": {
            "name": "ScreenMedianEssentialDepletion",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/screen_metadata/ScreenMedianNonessentialDepletion/label": {
            "name": "ScreenMedianNonessentialDepletion",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/screen_metadata/ScreenNNMD/label": {
            "name": "ScreenNNMD",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/screen_metadata/ScreenROCAUC/label": {
            "name": "ScreenROCAUC",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
            "isHighCardinality": True,
        },
        "slice/screen_metadata/ScreenType/label": {
            "name": "ScreenType",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/CanInclude/label": {
            "name": "CanInclude",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/PassesQC/label": {
            "name": "PassesQC",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/QCStatus/label": {
            "name": "QCStatus",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/ScreenNotBlacklisted/label": {
            "name": "ScreenNotBlacklisted",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
        "slice/screen_metadata/ScreenPermissionToRelease/label": {
            "name": "ScreenPermissionToRelease",
            "valueType": "categorical",
            "isBreadboxMetadata": True,
        },
    },
}


def get_hardcoded_metadata_slices():
    # FIXME: Instead of hardcoding this, find datasets with data_type
    # "metadata" and value_type "binary". Those two conditions represent
    # an annotation that's stored as a one-hot encoded matrix.
    molecular_subtypes_slice_id = "slice/OmicsInferredMolecularSubtypes/"
    model_slices = _hardcoded_metadata_slices["depmap_model"]

    model_slices[molecular_subtypes_slice_id] = {
        "name": "Inferred Molecular Subtype",
        "valueType": "binary",
        "isPartialSliceId": True,
        "sliceTypeLabel": "Molecular subtype",
        "isBreadboxMetadata": True,
    }

    return _hardcoded_metadata_slices


def is_hardcoded_binarylike_slice(slice_id: str) -> bool:
    for slices in get_hardcoded_metadata_slices().values():
        for m_slice_id, info in slices.items():
            if m_slice_id in slice_id:
                if info.get("valueType") == "binary":
                    return True
    return False
