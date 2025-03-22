from typing import List
from depmap.cell_line.models_new import DepmapModel
import pandas as pd
from flask import current_app

from depmap.cell_line.models import CellLine, Lineage
from depmap.gene.models import Gene
from depmap.dataset.models import (
    Mutation,
    Translocation,
    Fusion,
    Dataset,
)
from depmap.partials.data_table.models import (
    DataTable,
    DataTableData,
    TableDisplay,
    TableDisplayLink,
    TableDisplayEntityLink,
    TableDisplayRender,
)
from depmap.utilities.registration import _make_factory, _get_factory_output
from depmap.utilities.url_utils import js_url_for
from sqlalchemy import types


def get_data_table_for_view(type, **kwargs):
    return get_data_table(type, **kwargs).data_for_ajax_partial()


def get_data_table(type, **kwargs):
    return _get_factory_output(("data_table", type), **kwargs)


def _data_table_factory(type):
    return _make_factory(("data_table", type))


class MutationTableSpec:
    # shared columns between per cell line and per gene tables
    common_columns = [
        "chrom",
        "pos",
        "variant_type",
        "variant_info",
        "ref",
        "alt",
        "af",
        "ref_count",
        "alt_count",
        "gt",
        "ps",
        "dna_change",
        "protein_change",
        "hgnc_name",
        "hgnc_family",
        "uniprot_id",
        "gc_content",
        "civic_id",
        "civic_description",
        "civic_score",
        "likely_lof",
        "hess_driver",
        "hess_signature",
        "revel_score",
        "dida_id",
        "dida_name",
        "gwas_disease",
        "gwas_pmid",
        "oncogenic",
        "mutation_effect",
        ## New columns 2023 Q4
        "tumor_suppressor_high_impact",
        "vep_biotype",
        "lof_gene_name",
        "gnomade_af",
        "lof_gene_id",
        "vep_swissprot",
        "dbsnp_rs_id",
        "polyphen",
        "vep_pli_gene_value",
        "vep_lof_tool",
        "gnomadg_af",
        "rescue",
        "vep_clin_sig",
        "dp",
        "ensembl_feature_id",
        "lof_percent_of_transcripts_affected",
        "transcript_likely_lof",
        "gtex_gene",
        "brca1_func_score",
        "pharmgkb_id",
        "molecular_consequence",
        "vep_hgnc_id",
        "vep_existing_variation",
        "vep_mane_select",
        "sift",
        "vep_ensp",
        "ensembl_gene_id",
        "provean_prediction",
        "nmd",
        "vep_somatic",
        "lof_number_of_transcripts_in_gene",
        "vep_impact",
        "oncogene_high_impact",
        ## New columns 24Q2
        "am_class",
        "am_pathogenicity",
        "hotspot",
    ]

    common_renames = {
        "chrom": "Chromosome",
        "pos": "Position",
        "variant_type": "Variant Type",
        "variant_info": "Variant Info",
        "ref": "Ref Allele",
        "alt": "Alt Allele",
        "af": "Allele Fraction",
        "ref_count": "Ref Count",
        "alt_count": "Alt Count",
        "gt": "GT",
        "ps": "Phasing Set",
        "dna_change": "DNA Change",
        "protein_change": "Protein Change",
        "hgnc_name": "HGNC Name",
        "hgnc_family": "HGNC Family",
        "transcript": "Transcript",
        "transcript_exon": "Transcript Exon",
        "transcript_strand": "Transcript Strand",
        "uniprot_id": "Uniprot ID",
        "dbsnp_id": "dbSNP ID",
        "dbsnp_filter": "dbSNP Filter",
        "issues": "Issues",
        "gc_content": "GC Content",
        "lineage_association": "Lineage Association",
        "cancer_molecular_genetics": "Cancer Molecular Genetics",
        "ccle_deleterious": "CCLE Deleterious",
        "structural_relation": "Structural Relation",
        "cosmic_hotspot": "COSMIC Hotspot",
        "cosmic_overlapping_mutations": "COSMIC Overlapping Mutations",
        "associated_with": "Associated With",
        "lof": "LOF",
        "driver": "Driver",
        "likely_driver": "Likely Driver",
        "transcript_likely_lof": "Transcript Likely LOF",
        "civic_id": "CIViC ID",
        "civic_description": "CIViC Description",
        "civic_score": "CIViC Score",
        "popaf": "Population Allele Frequency",
        "likely_gof": "Likely GOF",
        "likely_lof": "Likely LOF",
        "hess_driver": "Hess Driver",
        "hess_signature": "Hess Signature",
        "cscape_score": "Cscape Score",
        "dann_score": "DANN Score",
        "revel_score": "Revel Score",
        "funseq2_score": "Funseq2 Score",
        "pharmgkb_id": "PharmGKB ID",
        "dida_id": "DIDA ID",
        "dida_name": "DIDA Name",
        "gwas_disease": "GWAS Disease",
        "gwas_pmid": "GWAS PMID",
        "gtex_gene": "GTEX Gene",
        "cell_line_display_name": "Cell Line",
        "oncogenic": "Oncogenic",
        "mutation_effect": "Mutation Effect",
        "tumor_suppressor_high_impact": "Tumor Suppressor High Impact",
        "vep_biotype": "Vep Biotype",
        "lof_gene_name": "LoF Gene Name",
        "gnomade_af": "Gnomade AF",
        "lof_gene_id": "LoF Gene ID",
        "vep_swissprot": "VEP Swissprot",
        "dbsnp_rs_id": "Dbsnp Rs ID",
        "polyphen": "Polyphen",
        "vep_pli_gene_value": "Vep Pli Gene Value",
        "vep_lof_tool": "Vep LoF Tool",
        "gnomadg_af": "Gnomadg AF",
        "rescue": "Rescue",
        "vep_clin_sig": "Vep Clin Sig",
        "dp": "DP",
        "ensembl_feature_id": "Ensembl Feature ID",
        "lof_percent_of_transcripts_affected": "LoF Percent of Transcripts Affected",
        "transcript_likely_lof": "Transcript Likely LoF",
        "gtex_gene": "Gtex Gene",
        "brca1_func_score": "Brca1 Func Score",
        "pharmgkb_id": "Pharmgkb ID",
        "molecular_consequence": "Molecular Consequence",
        "vep_hgnc_id": "Vep Hgnc ID",
        "vep_existing_variation": "Vep Existing Variation",
        "vep_mane_select": "Vep Mane Select",
        "sift": "Sift",
        "vep_ensp": "Vep ENSP",
        "ensembl_gene_id": "Ensembl Gene ID",
        "provean_prediction": "Provean Prediction",
        "nmd": "NMD",
        "vep_somatic": "Vep Somatic",
        "lof_number_of_transcripts_in_gene": "LoF Number of Transcripts in Gene",
        "vep_impact": "Vep Impact",
        "oncogene_high_impact": "Oncogene High Impact",
        "am_class": "AM class",
        "am_pathogenicity": "AM Pathogenicity",
        "hotspot": "Hotspot",
    }

    common_default_columns = [
        "Protein Change",
        "Variant Annotation",
        "Variant Classification",
        "Variant Type",
        "Annotation Transcript",
        "TCGA Hotspot count",
        "Oncogenic",
        "Mutation Effect",
    ]

    default_sort = ("protein_change", "desc")

    def get_subsetted_mutations_df_by_ids(gene_ids, depmap_ids):
        query = Mutation.find_by_genes_and_cell_lines_query(
            gene_ids=gene_ids, depmap_ids=depmap_ids
        )
        df = pd.read_sql(query.statement, query.session.connection())
        return df

    @staticmethod
    def get_all_mutation_gene_ids() -> List[str]:
        query = Mutation.get_all_gene_ids()
        df = pd.read_sql(query.statement, query.session.connection())

        return df["gene_id"].values.tolist()

    def format_mutations_table(query):
        def get_data():
            df = pd.read_sql(query.statement, query.session.connection())
            return df

        def get_column_types():
            cols = {col.name: col.type for col in query.statement.columns}
            return cols

        return DataTableData(get_column_types, get_data)


class TranslocationTableSpec:
    common_columns = [
        "map_id",
        "break_point_1",
        "break_point_2",
        "trans_class",
        "gene_1_label",
        "site_1",
        "gene_2_label",
        "site_2",
        "fusion",
        "multi_sv_fusion",
        "cosmic_fus",
    ]
    common_renames = {"gene_1_label": "Gene 1", "gene_2_label": "Gene 2"}
    default_columns = ["Trans Class", "Gene 1", "Gene 2", "Fusion"]

    @staticmethod
    def get_common_renders():
        return [
            TableDisplayLink(
                js_url_for("gene.view_gene", gene_symbol="{data}"), "gene_1_label"
            ),
            TableDisplayLink(
                js_url_for("gene.view_gene", gene_symbol="{data}"), "gene_2_label"
            ),
        ]


class FusionTableSpec:
    common_columns = [
        "fusion_name",
        "left_gene_label",
        "left_breakpoint",
        "right_gene_label",
        "right_breakpoint",
        "junction_read_count",
        "spanning_frag_count",
        "splice_type",
        "large_anchor_support",
        "left_break_dinuc",
        "left_break_entropy",
        "right_break_dinc",
        "right_break_entropy",
        "ffpm",
        "annots",
    ]
    common_renames = {
        "left_gene_label": "Left Gene",
        "right_gene_label": "Right Gene",
        "spanning_frag_count": "Spanning Frag Count",
    }
    default_columns = [
        "Cell Line",
        "Fusion Name",
        "Left Gene",
        "Right Gene",
        "Splice Type",
        "Annots",
    ]

    @staticmethod
    def get_common_renders():
        return [
            TableDisplayLink(
                js_url_for("gene.view_gene", gene_symbol="{data}"), "left_gene_label"
            ),
            TableDisplayLink(
                js_url_for("gene.view_gene", gene_symbol="{data}"), "right_gene_label"
            ),
            # Making this a render, so that the data stays as a string list for downloads. I don't want to assume the validiy of ';' as a delimiter (that it's not present in all data)
            # Could put each annot on a line, but that makes the table large
            TableDisplayRender(
                lambda col_indices: 'JSON.parse(data).join("; ")', ["annots"]
            ),
        ]


@_data_table_factory("mutation_by_gene")
def get_mutation_by_gene_table(gene_id):
    cols = [
        "cell_line_display_name",
        "depmap_id",
        "primary_disease",
        "disease_subtype",
        "lineage",
        "lineage_subtype",
    ] + MutationTableSpec.common_columns
    factory_params = {"type": "mutation_by_gene", "gene_id": gene_id}
    renames = MutationTableSpec.common_renames
    default_cols_to_show = [
        "Cell Line",
        "Lineage",
    ] + MutationTableSpec.common_default_columns
    renders = [
        TableDisplayLink(
            js_url_for("cell_line.view_cell_line", cell_line_name="{row['Depmap Id']}"),
            "cell_line_display_name",
        )
    ]

    display = TableDisplay(
        cols=cols,
        factory_params=factory_params,
        renames=renames,
        renders=renders,
        sort_col=MutationTableSpec.default_sort,
        default_cols_to_show=default_cols_to_show,
    )

    query = Mutation.find_by_gene_query(gene_id)
    table = MutationTableSpec.format_mutations_table(query)

    def filename_lambda(gene_id):
        return "{} mutations".format(Gene.query.get(gene_id).label)

    return DataTable(
        table,
        display,
        "mutation",
        {"function": filename_lambda, "params": {"gene_id": gene_id}},
    )


@_data_table_factory("mutation_by_cell_line")
def get_mutation_by_cell_line_table(model_id):
    cols = ["gene"] + MutationTableSpec.common_columns
    factory_params = {"type": "mutation_by_cell_line", "model_id": model_id}
    renames = MutationTableSpec.common_renames
    default_cols_to_show = ["Gene"] + MutationTableSpec.common_default_columns

    renders = [
        TableDisplayLink(js_url_for("gene.view_gene", gene_symbol="{data}"), "gene")
    ]
    display = TableDisplay(
        cols=cols,
        factory_params=factory_params,
        renames=renames,
        renders=renders,
        sort_col=MutationTableSpec.default_sort,
        default_cols_to_show=default_cols_to_show,
    )

    query = Mutation.find_by_cell_line_query(model_id)
    table = MutationTableSpec.format_mutations_table(query)
    filename = "{} mutations".format(
        DepmapModel.query.filter_by(model_id=model_id).one().stripped_cell_line_name
    )
    return DataTable(table, display, "mutation", filename)


@_data_table_factory("translocation_by_gene")
def _get_translocation_by_gene_table(gene_id):
    default_cols_to_show = TranslocationTableSpec.default_columns
    display = TableDisplay(
        ["cell_line_display_name", "depmap_id"] + TranslocationTableSpec.common_columns,
        {"type": "translocation_by_gene", "gene_id": gene_id},
        renames={
            **TranslocationTableSpec.common_renames,
            "cell_line_display_name": "Cell Line",
        },
        renders=TranslocationTableSpec.get_common_renders()
        + [
            TableDisplayLink(
                js_url_for(
                    "cell_line.view_cell_line", cell_line_name="{row['Depmap Id']}"
                ),
                "cell_line_display_name",
            )
        ],
        default_cols_to_show=["Cell Line"] + default_cols_to_show,
    )
    query = Translocation.find_by_gene_query(gene_id)

    def filename_lambda(gene_id):
        return "{} translocations".format(Gene.query.get(gene_id).label)

    return DataTable(
        query,
        display,
        "translocation",
        {"function": filename_lambda, "params": {"gene_id": gene_id}},
    )


@_data_table_factory("translocation_by_cell_line")
def get_translocation_by_cell_line_table(model_id):
    cols = TranslocationTableSpec.common_columns
    factory_params = {"type": "translocation_by_cell_line", "model_id": model_id}
    renames = TranslocationTableSpec.common_renames
    renders = TranslocationTableSpec.get_common_renders()
    default_cols_to_show = TranslocationTableSpec.default_columns
    display = TableDisplay(
        cols=cols,
        factory_params=factory_params,
        renames=renames,
        renders=renders,
        default_cols_to_show=default_cols_to_show,
    )
    query = Translocation.find_by_models_query(model_id)
    filename = "{} translocations".format(
        DepmapModel.query.filter_by(model_id=model_id).one().stripped_cell_line_name
    )
    return DataTable(query, display, "translocation", filename)


@_data_table_factory("fusion_by_gene")
def get_fusion_by_gene_table(gene_id):
    cols = [
        "depmap_id",
        "cell_line_display_name",
        "primary_disease",
        "disease_subtype",
        "lineage",
        "lineage_subtype",
    ] + FusionTableSpec.common_columns
    invisible_cols = ["depmap_id"]
    factory_params = {"type": "fusion_by_gene", "gene_id": gene_id}
    renames = FusionTableSpec.common_renames
    renames["cell_line_display_name"] = "Cell Line"
    renders = FusionTableSpec.get_common_renders() + [
        TableDisplayLink(
            js_url_for("cell_line.view_cell_line", cell_line_name="{row['Depmap Id']}"),
            "cell_line_display_name",
        )
    ]
    default_cols_to_show = ["Lineage"] + FusionTableSpec.default_columns
    display = TableDisplay(
        cols=cols,
        invisible_cols=invisible_cols,
        factory_params=factory_params,
        renames=renames,
        renders=renders,
        default_cols_to_show=default_cols_to_show,
    )
    query = Fusion.find_by_gene_query(gene_id)

    def filename_lambda(gene_id):
        return "{} fusions".format(Gene.query.get(gene_id).label)

    return DataTable(
        query,
        display,
        "fusion",
        {"function": filename_lambda, "params": {"gene_id": gene_id}},
    )


@_data_table_factory("fusion_by_cell_line")
def get_fusion_by_cell_line_table(model_id):
    cols = FusionTableSpec.common_columns
    factory_params = {"type": "fusion_by_cell_line", "model_id": model_id}
    renames = FusionTableSpec.common_renames
    renders = FusionTableSpec.get_common_renders()
    default_cols_to_show = FusionTableSpec.default_columns
    display = TableDisplay(
        cols=cols,
        factory_params=factory_params,
        renames=renames,
        renders=renders,
        default_cols_to_show=default_cols_to_show,
    )
    query = Fusion.find_by_cell_line_query(model_id)
    filename = "{} fusions".format(
        DepmapModel.query.filter_by(model_id=model_id).one().stripped_cell_line_name
    )
    return DataTable(query, display, "fusion", filename)


@_data_table_factory("cell_line_selector_lines")
def _get_cell_line_selector_lines():
    # Note: The display is defined in frontend/packages/@depmap/cell-line-selector/src/components/CellLineSelector.tsx
    display = TableDisplay(
        cols=[
            "cell_line_name",
            "primary_disease",
            "lineage_1",
            "lineage_2",
            "lineage_3",
            #            "lineage_4",
            "depmap_id",
            "cell_line_display_name",
        ],
        factory_params={"type": "cell_line_selector_lines"},
    )

    name = "cell_line_selector_lines"
    data_table = DataTable(
        get_cell_line_selector_lines_table(), display, name, "all cell lines"
    )
    return data_table


def get_cell_line_selector_lines_table():
    query = CellLine.all_table_query()

    def get_data():
        df = pd.read_sql(query.statement, query.session.connection())
        # if we have lineage pages we want to link to, make the display name a separate column and keep the original lineage column for links
        df["lineage"] = df["lineage"].apply(Lineage.get_display_name)
        df["lineage_level"] = "lineage_" + df["lineage_level"].astype(str)
        inds = df.columns.difference(["lineage_level", "lineage"]).tolist()
        dummy_value = "dummy value to replace NaNs to get pivot table working without deleting rows that contain NaNs so please replace this with None after everything is said and done.  Thanks. :)"
        df = df.fillna(dummy_value)
        df = df.pivot_table(
            index=inds, columns="lineage_level", values="lineage", aggfunc="first"
        )
        df = df.replace(dummy_value, None)
        df = df.reset_index()
        # ensure that all 4 lineage columns are returned
        for i in range(4):
            column_name = "lineage_{}".format(i + 1)
            if column_name not in df.columns:
                df[column_name] = [None] * len(df.index)
        return df.sort_values(by="cell_line_display_name")

    def get_column_types():
        cols = {col.name: col.type for col in query.statement.columns}
        cols["lineage_1"] = types.String
        cols["lineage_2"] = types.String
        cols["lineage_3"] = types.String
        #        cols["lineage_4"] = types.String
        return cols

    return DataTableData(get_column_types, get_data)
