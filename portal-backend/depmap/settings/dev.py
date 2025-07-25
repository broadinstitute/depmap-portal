from depmap.enums import DependencyEnum, BiomarkerEnum


additional_dev_metadata = {
    DependencyEnum.Chronos_Combined: {
        "matrix_file_name_root": "dataset/chronos_combined",
        "taiga_id": "small-chronos-combined-e82b.2/chronos_combined_score",
    },
    DependencyEnum.Chronos_Achilles: {
        "matrix_file_name_root": "dataset/chronos_achilles",
        "taiga_id": "placeholder-taiga-id.1",
    },
    DependencyEnum.CERES_Combined: {
        "matrix_file_name_root": "dataset/ceres_combined",
        "taiga_id": "small-ceres-combined-3dc6.1/ceres_combined_score",
    },
    DependencyEnum.Avana: {
        "matrix_file_name_root": "dataset/avana",
        "taiga_id": "small-avana-virtual-dataset-86d8.1/avana_score",  # is virtual to small-avana-f2b9.2/avana_score, includes dataset name for testing. in prod the avana loader input will be canonical, but this simulates other datasets that may not go through pipeline re-writing. avana has loader input virtual, versions and downloads canonical
    },
    DependencyEnum.RNAi_Ach: {
        "matrix_file_name_root": "dataset/rnai_ach",
        "taiga_id": "small-rnai-d0ad.1",
    },
    DependencyEnum.RNAi_Nov_DEM: {
        "matrix_file_name_root": "dataset/rnai_nov_dem",
        "taiga_id": "small-rnai-d0ad.1",
    },
    DependencyEnum.RNAi_merged: {
        "matrix_file_name_root": "dataset/rnai-merged",
        "taiga_id": "placeholder-taiga-id.1",
    },
    DependencyEnum.GDSC1_AUC: {
        "matrix_file_name_root": "dataset/gdsc1-auc",
        "taiga_id": "placeholder-gdsc-id.1",
    },
    DependencyEnum.GDSC2_AUC: {
        "matrix_file_name_root": "dataset/gdsc2-auc",
        "taiga_id": "placeholder-gdsc-id.1",
    },
    DependencyEnum.GDSC1_dose_replicate: {
        "perturbation_csv_file": "compound/gdsc1_dose_replicate_perturbations.csv",
        "cell_line_index_csv_file": "compound/gdsc1_dose_replicate_cell_lines.csv",
        "hdf5_file": "compound/gdsc1_dose_replicate.hdf5",
        "taiga_id": "placeholder-gdsc-id.1",
    },
    DependencyEnum.GDSC2_dose_replicate: {
        "perturbation_csv_file": "compound/gdsc2_dose_replicate_perturbations.csv",
        "cell_line_index_csv_file": "compound/gdsc2_dose_replicate_cell_lines.csv",
        "hdf5_file": "compound/gdsc2_dose_replicate.hdf5",
        "taiga_id": "placeholder-gdsc-id.1",
    },
    DependencyEnum.CTRP_AUC: {
        "matrix_file_name_root": "dataset/ctrp-auc",
        "taiga_id": "placeholder-ctrp-id.1",
    },
    DependencyEnum.CTRP_dose_replicate: {
        "perturbation_csv_file": "compound/ctd2_dose_replicate_perturbations.csv",
        "cell_line_index_csv_file": "compound/ctd2_dose_replicate_cell_lines.csv",
        "hdf5_file": "compound/ctd2_dose_replicate.hdf5",
        "taiga_id": "placeholder-ctrp-id.1",
    },
    DependencyEnum.Repurposing_secondary_AUC: {
        "matrix_file_name_root": "dataset/repurposing-secondary-auc",
        "taiga_id": "placeholder-taiga-id.1",
    },
    DependencyEnum.Repurposing_secondary_dose: {
        "matrix_file_name_root": "dataset/repurposing-secondary-dose",
        "taiga_id": "placeholder-taiga-id.1",
    },
    DependencyEnum.Repurposing_secondary_dose_replicate: {
        "perturbation_csv_file": "compound/repurposing_secondary_dose_replicate_perturbations.csv",
        "cell_line_index_csv_file": "compound/repurposing_secondary_dose_replicate_cell_lines.csv",
        "hdf5_file": "compound/repurposing_secondary_dose_replicate.hdf5",
        "taiga_id": "placeholder-taiga-id.1",
    },
    DependencyEnum.Rep1M: {
        "matrix_file_name_root": "dataset/rep1m",
        "taiga_id": "placeholder-taiga-id.1",
    },
    DependencyEnum.Rep_all_single_pt: {
        "matrix_file_name_root": "dataset/rep-all-single-pt",  # should match part of the name of sample_data/dataset file w/o '_score'
        "taiga_id": "placeholder-taiga-id.1",
    },
    DependencyEnum.Prism_oncology_AUC: {
        "matrix_file_name_root": "dataset/prism-oncology-auc",
        "taiga_id": "placeholder-onc-id.1",
    },
    DependencyEnum.Prism_oncology_dose_replicate: {
        "perturbation_csv_file": "compound/prism_oncology_dose_replicate_perturbations.csv",
        "cell_line_index_csv_file": "compound/prism_oncology_dose_replicate_cell_lines.csv",
        "hdf5_file": "compound/prism_oncology_dose_replicate.hdf5",
        "taiga_id": "placeholder-onc-id.1",
    },
    # DependencyEnum.OrganoidGeneEffect: {
    #     "matrix_file_name_root": "dataset/OrganoidGeneEffect",  # should match part of the name of sample_data/dataset file w/o '_score'
    #     "taiga_id": "placeholder-taiga-id.1",
    # },
    BiomarkerEnum.expression: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.copy_number_absolute: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.copy_number_relative: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.mutation_pearson: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.context: {"taiga_id": "placeholder-taiga-id.1", "transpose": True},
    BiomarkerEnum.rppa: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.rrbs: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.proteomics: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.sanger_proteomics: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.mutations_hotspot: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.mutations_damaging: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.mutations_driver: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.fusions: {"taiga_id": "placeholder-taiga-id.1", "transpose": True},
    BiomarkerEnum.ssgsea: {"taiga_id": "placeholder-taiga-id.1", "transpose": True},
    BiomarkerEnum.metabolomics: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.rep1m_confounders: {"taiga_id": "placeholder-taiga-id.1",},
    BiomarkerEnum.crispr_confounders: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.rnai_confounders: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.oncref_confounders: {"taiga_id": "placeholder-taiga-id.1"},
    BiomarkerEnum.rep_all_single_pt_confounders: {"taiga_id": "placeholder-taiga-id.1"}
    # BiomarkerEnum.CRISPRGeneDependency: {"taiga_id": "placeholder-taiga-id.1"},
    # BiomarkerEnum.OmicsAbsoluteCNGene: {"taiga_id": "placeholder-taiga-id.1"},
    # BiomarkerEnum.OmicsLoH: {"taiga_id": "placeholder-taiga-id.1"},
    # BiomarkerEnum.OmicsSignatures: {"taiga_id": "placeholder-taiga-id.1"},
}
