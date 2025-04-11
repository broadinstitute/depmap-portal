# Just a reference for what genes and cell lines are used to create sample data subsets

# we also load additional genes in small-hgnc-2a89.2_without_MED1.csv, but they are not what we normally expect for subsets
genes = [
    "SWI5 (375757)",
    "TRIL (9865)",
    "TENC1 (23371)",
    "UNC93B1 (81622)",
    "PSG7 (5676)",
    "KDM7A (80853)",
    "F8A1 (8263)",
    "MIR3613 (100500908)",
    "ANOS1 (3730)",
    "HNF1B (6928)",
    "SOX10 (6663)",  # representative full-feature example. this should have all data types
    "AMY1A (276)",
    "NRAS (4893)",
    "MAP4K4 (9448)",
    "MED1 (5469)",
    "C1orf74 (148304)",
]

genes_hgnc_symbols = [
    "SWI5",
    "TRIL",
    "TENC1",
    "UNC93B1",
    "PSG7",
    "KDM7A",
    "F8A1",
    "MIR3613",
    "ANOS1",
    "HNF1B",
    "SOX10",
    "AMY1A",
    "NRAS",
    "MAP4K4",
    "MED1",
    "C1orf74",
]

genes_entrez_ids = [
    "375757",
    "9865",
    "23371",
    "81622",
    "5676",
    "80853",
    "8263",
    "100500908",
    "3730",
    "6928",
    "6663",
    "276",
    "4893",
    "9448",
    "5469",
    "148304",
]

# "TNS2 (ENSG00000111077)" is the same as "TENC1 (23371)"
genes_ensembl = [
    "SWI5 (ENSG00000175854)",
    "TRIL (ENSG00000255690)",
    "TNS2 (ENSG00000111077)",
    "UNC93B1 (ENSG00000110057)",
    "PSG7 (ENSG00000221878)",
    "KDM7A (ENSG00000006459)",
    "F8A1 (ENSG00000277203)",
    "MIR3613 (ENSG00000264864)",
    "ANOS1 (ENSG00000011201)",
    "HNF1B (ENSG00000275410)",
    "SOX10 (ENSG00000100146)",
    "AMY1A (ENSG00000237763)",
    "NRAS (ENSG00000213281)",
    "MAP4K4 (ENSG00000071054)",
    "MED1 (ENSG00000125686)",
    "C1orf74 (ENSG00000162757)",
]

cell_lines = [
    "HS294T_SKIN",
    "A673_BONE",
    "EWS502_BONE",
    "HT29_LARGE_INTESTINE",
    "A2058_SKIN",
    "C32_SKIN",
    "143B_BONE",
    "CADOES1_BONE",
    "CJM_SKIN",
    "COLO679_SKIN",
    "EKVX_LUNG",
    "EPLC272H_LUNG",
    "UACC62_SKIN",  # representative full-feature example. this should have all data types
    "SKMEL30_SKIN",
    "WM88_SKIN",
    "PETA_SKIN",
    "TC32_BONE",
    "WM115_SKIN",
    "SH4_SKIN",
]

cell_lines_arxspan = [
    "ACH-000014",
    "ACH-000052",
    "ACH-000279",
    "ACH-000552",
    "ACH-000788",
    "ACH-000580",
    "ACH-001001",
    "ACH-000210",
    "ACH-000458",
    "ACH-000805",
    "ACH-000706",
    "ACH-000585",
    "ACH-000425",  # UACC62_SKIN
    "ACH-000810",
    "ACH-000899",
    "ACH-001170",
    "ACH-001205",
    "ACH-000304",
    "ACH-000441",
]

contexts = [
    "Ewings_sarcoma",
    "bone",
    "osteosarcoma",
    "lung",
    "lung_adenocarcinoma",
    "lung_NSC",
    "lung_squamous",
    "melanoma",
    "skin",
    "colorectal",
    "Merkel",
    "urinary_tract",
    "leukemia",
    "AML",
]
lines_in_all_bone = ["EWS502_BONE"]

# hdf5 files additionally have gemcitabine, which is deliberately NOT included in compound metadata
# this is to simulate the loader encountering a compound that we have not registered, and that things should proceed smoothly
compound_names = [
    "afatinib",  # representative full-feature example. this should have all data types. afatinib has multiple broad experiments and dose data.
    "erlotinib",
    "erlotinib:PLX-4032 (2:1 mol/mol)",  # bunch of symbols in the name
    "indoximod",  # only primary
    "JQ12",  # only gdsc, no metadata
    "methacycline",  # only broad
    "bleomycin",  # no primary, has gdsc, ctd2 and repurposing metadata
    "alvocidib",  # only ctd2, has metadata, also duplicate metadata row
    "talopram",  # only repurposing metadata
    "methotrexate",  # everything
    "sulfopin",  # prism oncRef
]

compound_broad_ids = [  # this may be incorrect?
    "BRD:BRD-K66175015-001-13-2",  # afatinib
    "BRD:BRD-K66175015-001-09-0",
    "BRD:BRD-K66175015-332-01-6",
    "BRD:BRD-K70401845-001-15-7",  # erlotinib
    "BRD:BRD-K70401845-003-09-6",
    "BRD:BRD-K93255255-001-02-1",  # indoximod
    "BRD:BRD-A49035384-003-27-1",  # methacycline
    "BRD:BRD-A49035384-003-28-9",
    "BRD:BRD-A49035384-003-29-7",
    "BRD:BRD-A49035384-003-30-5",
    "BRD:BRD-A12918100-065-01-8",  # bleomycin
    "BRD:BRD-A42083487-001-01-3",
    "BRD:BRD-A42083487-065-05-9",
    "BRD:BRD-A42083487-065-06-7",
    "BRD:BRD-K87909389-003-03-4",  # alvocidib
    "BRD:BRD-K87909389-003-04-2",
    "BRD:BRD-A02532772-003-01-7",  # talopram
    "BRD:BRD-A55424491-001-19-9",  # methotrexate
    "BRD:BRD-K59456551-001-19-2",
    "BRD:BRD-K59456551-001-20-0",
    "BRD:BRD-K59456551-001-22-6",
    "BRD:BRD-A10188456-001-04-9",  # contained in hdf5, but missing from our metadata
    "BRD:BRD-U00115292-001-01-9",  # sulfopin
]
compound_ctrp_ids = [
    "CTRP:606135",  # afatinib
    "CTRP:52928",  # erlotinib
    "CTRP:660768",  # erlotinib:PLX-4032 (2:1 mol/mol)
    "CTRP:639531",  # bleomycin
    "CTRP:687720",  # alvocidib
    "CTRP:30371",  # methotrexate
    "CTRP:411739",  # contained in hdf5, but missing from our metadata
]

compound_gdsc_ids = [
    "GDSC1:1032",  # afatinib
    "GDSC1:1377",
    "GDSC1:1",  # erlotinib
    "GDSC1:164",  # JQ12
    "GDSC1:1378",  # bleomycin
    "GDSC1:190",
    "GDSC1:1008",  # methotrexate
    "GDSC1:1009",  # contained in hdf5, but missing from our metadata
]

# For figuring out compound membership
# select * from entity where entity_id in (select entity_id from compound where entity_id in (select compound_id from compound_experiment where entity_id in (select entity_id from row_matrix_index_write_only where matrix_id=5)) and entity_id not in (select compound_id from compound_experiment where entity_id in (select entity_id from row_matrix_index_write_only where matrix_id=9 or matrix_id=6)) limit 6);


# the sample data for rnai_nov_dem is a copy of that for rnai_ach
genes_expanded = [
    "SWI5 (375757)",  # avana
    "TRIL (9865)",  #  in rnai but not avana
    "TENC1 (23371)",  # rnai_ach, rnai_nov_dem. not in any dataset but has dropped from chronos
    "UNC93B1 (81622)",  #  rnai_ach, rnai_nov_dem. in rnai but not avana, but has gene executive info for chronos indicating dropped by chronos
    "PSG7 (5676)",  # avana, rnai_ach, rnai_nov_dem
    "KDM7A (80853)",  # avana,  not in combined chronos
    "F8A1 (8263)",  # rnai, fusion
    "MIR3613 (100500908)",  # cn, also not in any dependency dataset
    "ANOS1 (3730)",  # exp
    "HNF1B (6928)",  # mut, cn
    "SOX10 (6663)",  # exp, cn
    "AMY1A (276)",  # exp, not in combined chronos or chronos achilles
    "NRAS (4893)",  # normal genes, in everything
    "MAP4K4 (9448)",
    "MED1 (5469)",
    "C1orf74 (148304)",  # contains lower case letters
]

cell_lines_expanded = [
    "HS294T_SKIN",  # avana,  rnai_ach, rnai_nov_dem
    "A673_BONE",  #  rnai_ach, rnai_nov_dem
    "EWS502_BONE",  #  rnai_ach, rnai_nov_dem
    "HT29_LARGE_INTESTINE",  #  rnai_ach, rnai_nov_dem
    "A2058_SKIN",  # avana, rnai_ach, rnai_nov_dem
    "C32_SKIN",  # avana, rnai_ach, rnai_nov_dem
    "143B_BONE",  # avana, rnai_ach, rnai_nov_dem
    "CADOES1_BONE",  #  rnai_ach, rnai_nov_dem
    "CJM_SKIN",  # avana, rnai_ach, rnai_nov_dem
    "COLO679_SKIN",  # avana, rnai_ach, rnai_nov_dem
    "EKVX_LUNG",  # avana, rnai_ach, rnai_nov_dem
    "EPLC272H_LUNG",  # avana, rnai_ach, rnai_nov_dem. has no lineage in cell line metadata (set to unknown by loader)
    "UACC62_SKIN",  # avana
    "SKMEL30_SKIN",  # avana
    "WM88_SKIN",  # rnai_ach, rnai_nov_dem
    "PETA_SKIN",  # rnai_ach, rnai_nov_dem. missing rrid
    "WM115_SKIN",  # avana, rnai_ach, rnai_nov_dem
    "SH4_SKIN",  # rnai_ach, rnai_nov_dem
]

contexts_expanded = [
    "osteosarcoma",  # 143B_BONE
    "ewing_sarcoma",  # bone lines except 143B_BONE
    "melanoma",  # skin lines except PETA_SKIN
    "lung_NSC",  # lung lines
    "urinary_tract",  # no cell lines
    # colorectal is omitted so that HT29_LARGE_INTESTINE is not a member of any context (PETA_SKIN also isn't)
    "bone",  # lines containing the string "BONE", so that bone lines are members of multiple contexts
]

# genes by dataset (sorted([x.entity.label for x in Matrix.query.get(3).row_index.all()]))
chronos_combined = [
    "ANOS1",
    "C1orf74",
    "F8A1",
    "HNF1B",
    "MAP4K4",
    "MED1",
    "NRAS",
    "PSG7",
    "SOX10",
    "SWI5",
]
chronos_achilles = [
    "ANOS1",
    "C1orf74",
    "F8A1",
    "HNF1B",
    "KDM7A",
    "MAP4K4",
    "MED1",
    "NRAS",
    "PSG7",
    "SOX10",
    "SWI5",
]
avana_score = [
    "AMY1A",
    "ANOS1",
    "C1orf74",
    "F8A1",
    "HNF1B",
    "KDM7A",
    "MAP4K4",
    "MED1",
    "NRAS",
    "PSG7",
    "SOX10",
    "SWI5",
]
rnai_ach = [
    "AMY1A",
    "F8A1",
    "HNF1B",
    "MAP4K4",
    "MED1",
    "NRAS",
    "PSG7",
    "SOX10",
    "TNS2",
    "UNC93B1",
]
rnai_nov_dem = [
    "AMY1A",
    "F8A1",
    "HNF1B",
    "MAP4K4",
    "MED1",
    "NRAS",
    "PSG7",
    "SOX10",
    "TNS2",
    "UNC93B1",
]
expression = [
    "AMY1A",
    "ANOS1",
    "KDM7A",
    "MAP4K4",
    "MED1",
    "NRAS",
    "PSG7",
    "SOX10",
    "SWI5",
    "TNS2",
    "TRIL",
    "UNC93B1",
]
copy_number_absolute = [
    "HNF1B",
    "KDM7A",
    "MAP4K4",
    "MED1",
    "MIR3613",
    "NRAS",
    "PSG7",
    "SOX10",
    "SWI5",
    "TNS2",
    "TRIL",
    "UNC93B1",
]
mutation = [
    "AMY1A",
    "F8A1",
    "HNF1B",
    "KDM7A",
    "MAP4K4",
    "MED1",
    "NRAS",
    "PSG7",
    "SWI5",
    "TNS2",
    "UNC93B1",
]
mutation_table = [
    "F8A1",
    "MAP4K4",
    "MAP4K4",
    "NRAS",
    "NRAS",
    "NRAS",
]  # two MAP4k4 mutations, 3 NRAS
proteomics = [
    "SOX10",
    "MED1",
    "HNF1B",
    "KDM7A",
    "F8A1",
    "TRIL",
    "NRAS",
    "SWI5",
    "UNC93B1",
    "ANOS1",
    "MAP4K4",
]

# tumors IDs in celligner
tumor_ids = [
    "THR08_0178_S01",
    "Rh-10",
    "TCGA-AN-A0FL-01",
    "TH27_1454_S01",
    "TCGA-CR-6491-01",
    "THR24_1948_S01",
    "TCGA-WB-A81D-01",
    "TCGA-DJ-A1QL-01",
    "TARGET-20-PARAJX-09",
    "MO_1437-poly-SI_9666-C5N0MANXX",
    "TCGA-VM-A8CH-01",
    "TCGA-A2-A0YL-01",
    "TP_2018-capt-SI_5936-H09HYADXX",
    "TCGA-22-4613-01",
    "TCGA-3A-A9I9-01",
    "TARGET-30-PARBAJ-01",
    "TCGA-V1-A8MM-01",
    "TCGA-61-1741-01",
    "TCGA-60-2697-01",
    "THR30_0830_S01",
    "TARGET-30-PALNVP-01",
    "1678HXXTM",
    "TCGA-E2-A15E-01",
    "TCGA-53-7813-01",
    "TCGA-13-1409-01",
    "TCGA-OR-A5J1-01",
    "TCGA-61-1907-01",
    "TCGA-BF-A5ES-01",
    "THR24_1816_S01",
    "TCGA-2L-AAQA-01",
    "TCGA-EK-A3GJ-01",
    "TCGA-04-1332-01",
    "TARGET-10-PAPEAB-04",
    "TCGA-HC-7752-01",
    "TCGA-98-A53H-01",
    "TARGET-10-PAPBES-03",
    "TCGA-P5-A5EY-01",
    "TCGA-S9-A6TW-01",
    "TCGA-RW-A68D-01",
    "THR24_2144_S01",
]
