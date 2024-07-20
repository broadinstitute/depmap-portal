import sqlite3
import os

dest_filenames = """sample_data/association/Avana_copy_number_absolute_cor.db
sample_data/association/Avana_dep_cor.db
sample_data/association/Avana_expression_cor.db
sample_data/association/Avana_mutation_pearson_cor.db
sample_data/association/Chronos_Combined_copy_number_absolute_cor.db
sample_data/association/Chronos_Combined_dep_cor.db
sample_data/association/Chronos_Combined_expression_cor.db
sample_data/association/Chronos_Combined_mutation_pearson_cor.db
sample_data/association/Chronos_Combined_copy_number_relative_cor.db
sample_data/association/Chronos_Combined_mutations_damaging_cor.db
sample_data/association/Chronos_Combined_mutations_driver_cor.db
sample_data/association/Chronos_Combined_mutations_hotspot_cor.db
sample_data/association/GeCKO_copy_number_absolute_cor.db
sample_data/association/GeCKO_dep_cor.db
sample_data/association/GeCKO_expression_cor.db
sample_data/association/GeCKO_mutation_pearson_cor.db
sample_data/association/GeCKO_copy_number_relative_cor.db
sample_data/association/GeCKO_mutations_damaging_cor.db
sample_data/association/GeCKO_mutations_driver_cor.db
sample_data/association/GeCKO_mutations_hotspot_cor.db
sample_data/association/RNAi_Ach_copy_number_absolute_cor.db
sample_data/association/RNAi_Ach_dep_cor.db
sample_data/association/RNAi_Ach_expression_cor.db
sample_data/association/RNAi_Ach_mutation_pearson_cor.db
sample_data/association/RNAi_Ach_copy_number_relative_cor.db
sample_data/association/RNAi_Ach_mutations_damaging_cor.db
sample_data/association/RNAi_Ach_mutations_driver_cor.db
sample_data/association/RNAi_Ach_mutations_hotspot_cor.db
sample_data/association/RNAi_Nov_DEM_copy_number_absolute_cor.db
sample_data/association/RNAi_Nov_DEM_dep_cor.db
sample_data/association/RNAi_Nov_DEM_expression_cor.db
sample_data/association/RNAi_Nov_DEM_mutation_pearson_cor.db
sample_data/association/RNAi_Nov_DEM_copy_number_relative_cor.db
sample_data/association/RNAi_Nov_DEM_mutations_damaging_cor.db
sample_data/association/RNAi_Nov_DEM_mutations_driver_cor.db
sample_data/association/RNAi_Nov_DEM_mutations_hotspot_cor.db
sample_data/association/RNAi_merged_copy_number_absolute_cor.db
sample_data/association/RNAi_merged_dep_cor.db
sample_data/association/RNAi_merged_expression_cor.db
sample_data/association/RNAi_merged_mutation_pearson_cor.db
sample_data/association/RNAi_merged_copy_number_relative_cor.db
sample_data/association/RNAi_merged_mutations_damaging_cor.db
sample_data/association/RNAi_merged_mutations_driver_cor.db
sample_data/association/RNAi_merged_mutations_hotspot_cor.db
sample_data/association/Repurposing_secondary_AUC_copy_number_absolute_cor.db
sample_data/association/Repurposing_secondary_AUC_dep_cor.db
sample_data/association/Repurposing_secondary_AUC_expression_cor.db
sample_data/association/Repurposing_secondary_AUC_mutation_pearson_cor.db
sample_data/association/Repurposing_secondary_AUC_copy_number_relative_cor.db
sample_data/association/Repurposing_secondary_AUC_mutations_damaging_cor.db
sample_data/association/Repurposing_secondary_AUC_mutations_driver_cor.db
sample_data/association/Repurposing_secondary_AUC_mutations_hotspot_cor.db""".split(
    "\n"
)

conn = sqlite3.connect("webapp_data/dev.db")
c = conn.cursor()
c.execute(
    "select b.name, m.file_path from dataset_write_only d join biomarker_dataset b on d.dataset_id = b.biomarker_dataset_id join matrix_write_only m on m.matrix_id = d.matrix_id"
)
biom = []
for name, file_path in c:
    biom.append((name, file_path))

deps = []
c.execute(
    "select b.name, m.file_path from dataset_write_only d join dependency_dataset b on d.dataset_id = b.dependency_dataset_id join matrix_write_only m on m.matrix_id = d.matrix_id"
)
for name, file_path in c:
    if "dose" not in name:
        deps.append((name, file_path))


def run_cor(file0, label0, file1, label1, fn):
    if os.path.exists(fn):
        os.unlink(fn)
    cmd = f"python pipeline/scripts/correlation.py webapp_data/{file0} webapp_data/{file1} {fn} --label0 {label0} --label1 {label1}"
    print("exec", cmd)
    ret = os.system(cmd)
    assert ret == 0


for dep_name, dep_file in deps:
    fn = f"sample_data/association/{dep_name}_dep_cor.db"
    run_cor(dep_file, dep_name, dep_file, dep_name, fn)
    for biom_name, biom_file in biom:
        fn = f"sample_data/association/{dep_name}_{biom_name}_cor.db"
        print(fn)
        if fn not in dest_filenames:
            print("Skipping", fn)
            continue
        run_cor(dep_file, dep_name, biom_file, biom_name, fn)
