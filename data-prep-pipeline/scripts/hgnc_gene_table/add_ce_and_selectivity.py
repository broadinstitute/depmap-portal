import argparse
import pandas as pd

from taigapy import create_taiga_client_v3


def parse_gene_format(gene_string):
    """
    Parse 'GENE_SYMBOL (entrez_id)' format.
    Example: 'A1BG (125)' -> 'A1BG', 125
    """
    pattern = r'^(?P<gene_symbol>[^\(]+?)\s*\(\s*(?P<entrez_id>\d+)\s*\)$'
    return gene_string.str.extract(pattern)

def assign_essentiality(entrez_id):
    """
    - If entrez_id exists in full_gene_list_with_common_essentials and is_common_essential==True → "common essential"
    - If entrez_id exists in full_gene_list_with_common_essentials and is_common_essential==False → "not common essential"  
    - If entrez_id exists in full_gene_list_with_common_essentials but not in gene_table → null
    - If entrez_id exists in gene_table but not in full_gene_list_with_common_essentials → null
    """
    if pd.isna(entrez_id):
        return None
    
    entrez_id = int(entrez_id)
    
    if entrez_id in essentiality_mapping:
        if essentiality_mapping[entrez_id]:
            return "common essential"
        else:
            return "not common essential"
    else:
        # entrez_id exists in gene_table but not in full_gene_list_with_common_essentials
        return None

def assign_selectivity(entrez_id):
    """
    - If entrez_id exists in is_strongly_selective and is_strongly_selective==True → "strongly selective"
    - If entrez_id exists in is_strongly_selective and is_strongly_selective==False → "not strongly selective"
    - If entrez_id exists in gene_table but not in is_strongly_selective → null
    """
    if pd.isna(entrez_id):
        return None
    
    entrez_id = int(entrez_id)
    
    if entrez_id in selectivity_mapping:
        if selectivity_mapping[entrez_id]:
            return "strongly selective"
        else:
            return "not strongly selective"
    else:
        # entrez_id exists in gene_table but not in is_strongly_selective
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Add common essential and selectivity to HGNC gene table."
    )
    parser.add_argument("hgnc_gene_table_taiga_id", help="Taiga ID of HGNC gene table")
    parser.add_argument("crispr_inferred_common_essentials_taiga_id", help="Taiga ID of CRISPR inferred common essentials")
    parser.add_argument("crispr_gene_effect_taiga_id", help="Taiga ID of CRISPR gene effect")
    parser.add_argument("crispr_gene_dependency_taiga_id", help="Taiga ID of CRISPR gene dependency")
    parser.add_argument("output", help="Path to write the output")
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    hgnc_gene_table = tc.get(args.hgnc_gene_table_taiga_id)
    crispr_inferred_common_essentials = tc.get(args.crispr_inferred_common_essentials_taiga_id)
    crispr_gene_effect = tc.get(args.crispr_gene_effect_taiga_id)
    crispr_gene_dependency = tc.get(args.crispr_gene_dependency_taiga_id)
    
    ### Add common essentials to HGNC gene table
    print("Number of rows in crispr_inferred_common_essentials: ", len(crispr_inferred_common_essentials))

    parsed_ce = parse_gene_format(crispr_inferred_common_essentials['Essentials'])
    parsed_ce['entrez_id'] = pd.to_numeric(parsed_ce['entrez_id'], errors='coerce')
    assert parsed_ce.notnull().all().all()

    parsed_gene_effect = parse_gene_format(pd.Series(crispr_gene_effect.columns))
    parsed_gene_effect['entrez_id'] = pd.to_numeric(parsed_gene_effect['entrez_id'], errors='coerce')
    assert parsed_gene_effect.notnull().all().all()

    # Check that all common essentials are in the gene effect matrix
    assert parsed_ce['entrez_id'].isin(parsed_gene_effect['entrez_id']).all()

    full_gene_list_with_common_essentials = parsed_gene_effect.copy()
    full_gene_list_with_common_essentials['is_common_essential'] = (
        full_gene_list_with_common_essentials['entrez_id']
        .isin(parsed_ce['entrez_id'])
    )

    print(f"Total genes in gene_effect: {len(parsed_gene_effect)}")
    print(f"Common essentials found in gene_effect: {full_gene_list_with_common_essentials['is_common_essential'].sum()}")

    assert len(parsed_ce.dropna()) == full_gene_list_with_common_essentials['is_common_essential'].sum()

    hgnc_gene_table['entrez_id'] = pd.to_numeric(hgnc_gene_table['entrez_id'], errors='coerce')

    essentiality_mapping = full_gene_list_with_common_essentials.set_index('entrez_id')['is_common_essential'].to_dict()
    hgnc_gene_table['Essentiality'] = hgnc_gene_table['entrez_id'].apply(assign_essentiality)

    print("Essentiality column value counts:")
    print(hgnc_gene_table['Essentiality'].value_counts(dropna=False))

    ### Add selectivity to HGNC gene table
    assert len(crispr_gene_dependency.columns) == len(crispr_gene_effect.columns)

    dep_lines = (crispr_gene_dependency > 0.5).sum(axis=0)
    
    # Calculate statistical moments
    skewness = crispr_gene_effect.skew(axis=0)
    kurtosis = crispr_gene_effect.kurtosis(axis=0)

    # Calculate is_strongly_selective
    is_strongly_selective = (skewness * kurtosis < -0.86) & (dep_lines > 0)


    parsed_strongly_selective = parse_gene_format(pd.Series(is_strongly_selective.index))
    parsed_strongly_selective['selectivity'] = is_strongly_selective.values
    parsed_strongly_selective['entrez_id'] = pd.to_numeric(parsed_strongly_selective['entrez_id'], errors='coerce')

    selectivity_mapping = parsed_strongly_selective.set_index('entrez_id')['selectivity'].to_dict()
    hgnc_gene_table['Selectivity'] = hgnc_gene_table['entrez_id'].apply(assign_selectivity)
    
    print("Selectivity column value counts:")
    print(hgnc_gene_table['Selectivity'].value_counts(dropna=False))

    if hgnc_gene_table is not None:
        hgnc_gene_table.to_csv(args.output, index=False)
