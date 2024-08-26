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

hardcoded_metadata_slices = {
    "depmap_model": {
        "slice/cell_line_display_name/all/label": {
            "name": "Cell Line Name",
            "valueType": "categorical",
            "isHighCardinality": True,
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
}
