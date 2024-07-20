import os
from glob import glob
import sys
import argparse
import subprocess

table_groups_s = """
*db_versioning
alembic_version                     
checkpoint
data_issue                         

*entities
entity
antibody                            
entity_alias
gene
transcription_start_site
gene_executive_info
gene_compound_target_association
gene_antibody_association

*cell_lines
cell_line                           
cell_line_alias                    
cell_line_context_association      
lineage
tumor_type
source
primary_site
primary_disease
primary_histology
disease_subtype
context
culture_medium                     
conditions

*contexts
context
context_enrichment
context_entity

*correlations
correlated_dataset                
correlation                        
entity
dataset

*compounds
compound
compound_dose
compound_experiment
dose_response_curve
row_matrix_index
col_matrix_index
matrix

*datasets
dataset
row_matrix_index
col_matrix_index
row_nonstandard_matrix_index
col_nonstandard_matrix_index 
matrix
dependency_dataset
biomarker_dataset                   
nonstandard_matrix
nonstandard_matrix_loader_metadata
custom_dataset_config              

*search                        
global_search_index                             
       
*predictive_models                 
predictive_background
predictive_feature
predictive_model

*other_characterizations
cell_line
entity
gene
mutation
translocation
fusion
"""


def main():
    parser = argparse.ArgumentParser(
        description="Generates a set of ERD diagrams based on the contents of the database"
    )
    parser.add_argument(
        "schemacrawler_dir",
        help="Path to a release of schemacrawler (ie: ./schemacrawler-15.03.04-distribution)",
    )
    parser.add_argument("db_path", help="path to depmap sqlite file")
    args = parser.parse_args()

    classpath = glob(os.path.join(args.schemacrawler_dir, "_schemacrawler/lib/*.jar"))
    classpath.append(os.path.join(args.schemacrawler_dir, "_schemacrawler/config"))

    table_groups = []
    cur_name = None
    tables = []

    def flush_group():
        if cur_name is None:
            return
        table_groups.append((cur_name, list(tables)))
        while len(tables) > 0:
            del tables[-1]

    for line in table_groups_s.split("\n"):
        line = line.strip()
        if line == "":
            continue
        if line.startswith("*"):
            flush_group()
            cur_name = line[1:]
        else:
            tables.append(line)
    flush_group()

    for name, tables in table_groups:
        print("Generating {}.png".format(name))
        subprocess.run(
            [
                "java",
                "-cp",
                ":".join(classpath),
                "schemacrawler.Main",
                "-server",
                "sqlite",
                "-database",
                args.db_path,
                "-command",
                "schema",
                "-infolevel",
                "standard",
                "-user",
                "-password",
                "-outputformat",
                "png",
                "-outputfile",
                "{}.png".format(name),
                "-tables={}".format("|".join(tables)),
            ],
            check=True,
        )


if __name__ == "__main__":
    main()
