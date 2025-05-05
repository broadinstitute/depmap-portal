import csv
import os
import tempfile
from flask import current_app
from depmap.enums import BiomarkerEnum, DataTypeEnum, TabularEnum
from depmap.cell_line.models import CellLine
from depmap.database import db
from depmap.dataset.models import (
    Dataset,
    BiomarkerDataset,
    DependencyDataset,
    TabularDataset,
    Mutation,
    Fusion,
    Translocation,
)
from depmap.entity.models import GenericEntity
from depmap.gene.models import Gene
from depmap.context.models import Context, ContextEntity, ContextEnrichment
from depmap.compound.models import CompoundExperiment
from depmap.transcription_start_site.models import TranscriptionStartSite
from depmap.proteomics.models import Protein
from loader.matrix_loader import create_matrix_object, create_transposed_hdf5
from loader.proteomics_loader import load_proteins
from loader.dataset_loader.utils import add_biomarker_dataset, add_tabular_dataset
from depmap.utilities.iter import estimate_line_count
from depmap.utilities.caching import LazyCache
from depmap.utilities.bulk_load import batch_load_from_generator
from depmap.utilities.models import log_data_issue
from depmap.utilities import hdf5_utils, settings_utils
from depmap.settings.shared import DATASET_METADATA, DatasetLabel
from depmap.utilities.hdf5_utils import df_to_hdf5, read_hdf5
from depmap.access_control import PUBLIC_ACCESS_GROUP
from depmap.oncokb_version.models import OncokbDatasetVersionDate

import pandas as pd
from collections import OrderedDict
from dataclasses import asdict

GENERIC_ENTITY_BIOMARKER_ENUMS = [
    BiomarkerDataset.BiomarkerEnum.fusions,
    BiomarkerDataset.BiomarkerEnum.ssgsea,
    BiomarkerDataset.BiomarkerEnum.metabolomics,
    BiomarkerDataset.BiomarkerEnum.crispr_confounders,
    BiomarkerDataset.BiomarkerEnum.rnai_confounders,
    BiomarkerDataset.BiomarkerEnum.rep1m_confounders,
    BiomarkerDataset.BiomarkerEnum.oncref_confounders,
    BiomarkerDataset.BiomarkerEnum.rep_all_single_pt_confounders,
    BiomarkerDataset.BiomarkerEnum.OmicsSignatures,
]


def load_biomarker_dataset(
    biomarker_enum,
    biomarker_metadata,
    file_path,
    owner_id=None,
    allow_missing_entities=False,
):
    """
    Loads one biomarker dataset
    :return:
    """
    assert owner_id is not None
    matrix_name = biomarker_enum.name

    if biomarker_metadata.get(
        "transpose", False
    ):  # TODO: Shouldn't be needed since no transpose property
        file_path = create_transposed_hdf5(file_path)

    if biomarker_enum == BiomarkerDataset.BiomarkerEnum.context:
        entity_lookup = lambda x: ContextEntity.get_by_label(x, must=False)
        matrix = create_matrix_object(
            matrix_name,
            file_path,
            biomarker_metadata["units"],
            owner_id,
            non_gene_lookup=entity_lookup,
        )
        entity_type = "context"
    elif biomarker_enum == BiomarkerDataset.BiomarkerEnum.rrbs:
        entity_lookup = lambda x: TranscriptionStartSite.get_by_label(x, must=False)
        matrix = create_matrix_object(
            matrix_name,
            file_path,
            biomarker_metadata["units"],
            owner_id,
            non_gene_lookup=entity_lookup,
        )
        entity_type = "transcription_start_site"
    elif biomarker_enum == BiomarkerDataset.BiomarkerEnum.rppa:
        entity_lookup = lambda x: Protein.get_by_uniprot_id(x, must=False)
        matrix = create_matrix_object(
            matrix_name,
            file_path,
            biomarker_metadata["units"],
            owner_id,
            non_gene_lookup=entity_lookup,
        )
        entity_type = "protein"
    elif (biomarker_enum == BiomarkerDataset.BiomarkerEnum.proteomics) or (
        biomarker_enum == BiomarkerDataset.BiomarkerEnum.sanger_proteomics
    ):
        load_proteins(file_path, allow_missing_entities=allow_missing_entities)
        entity_lookup = lambda x: Protein.get_by_label(x, must=False)
        matrix = create_matrix_object(
            matrix_name,
            file_path,
            biomarker_metadata["units"],
            owner_id,
            non_gene_lookup=entity_lookup,
        )
        entity_type = "protein"
    elif biomarker_enum in GENERIC_ENTITY_BIOMARKER_ENUMS:
        load_generic_entities(file_path)

        def entity_lookup(x):
            return GenericEntity.get_by_label(x, must=False)

        matrix = create_matrix_object(
            matrix_name,
            file_path,
            biomarker_metadata["units"],
            owner_id,
            non_gene_lookup=entity_lookup,
        )
        entity_type = "generic_entity"
    else:
        matrix = create_matrix_object(
            matrix_name,
            file_path,
            biomarker_metadata["units"],
            owner_id,
            allow_missing_entities=allow_missing_entities,
        )
        entity_type = "gene"

    add_biomarker_dataset(
        name_enum=biomarker_enum,
        display_name=biomarker_metadata["display_name"],
        units=biomarker_metadata["units"],
        data_type=biomarker_metadata["data_type"],
        priority=biomarker_metadata["priority"],
        global_priority=biomarker_metadata["global_priority"],
        matrix=matrix,
        taiga_id=biomarker_metadata["taiga_id"],
        entity_type=entity_type,
        owner_id=owner_id,
    )


def load_generic_entities(filename):
    """
    :param path to hdf5 file:
    :return: list of GenericEntity objects
    """
    loaded_entity_labels = set(e.label for e in GenericEntity.get_all())
    entity_labels = hdf5_utils.get_row_index("", filename)
    entities = [
        GenericEntity(label=entity_label)
        for entity_label in entity_labels
        if entity_label not in loaded_entity_labels
    ]
    db.session.add_all(entities)
    return entities


def check_dataset_versions_up_to_date():
    """
    This checks that any datasets specified in versions exist in the db
    It would raise a flag if a dataset that had a version specified is no longer in the database,
    which would occur if the db taiga id was updated but we forgot to update the version

    This also checks that any datasets that expect to have a templated version have a version specified
    """
    # check that any datasets with a templated display name have a version specified
    for dataset_enum, metadata in DATASET_METADATA.items():
        # this loops through for tablular datasets, which retrieve display names dynamically
        if (
            isinstance(dataset_enum, TabularEnum)
            and "{version}" in metadata.display_name
        ):
            assert TabularDataset.get_by_name(dataset_enum).taiga_id in dataset_versions
    for dataset in Dataset.get_all():
        # this loops for Dataset objects, which have their full display name including the version stored into database
        assert (
            "{version}" not in dataset.display_name
        ), f"version didn't get expanded in {dataset.display_name} (probably config['DATASET_VERSIONS'] missing {dataset.taiga_id})"


variant_annotation_map = {"": "NA"}


def _read_mutations(dr, pbar, gene_cache, cell_line_cache):
    def _to_boolean(string_value):
        if string_value.lower() == "true":
            return True
        elif string_value.lower() == "false":
            return False
        elif string_value is None or string_value == "" or string_value == "NA":
            return None
        else:
            raise Exception(
                "Looking for true or false but got {}".format(repr(string_value))
            )

    def _to_none(num_value):
        if num_value == "" or num_value == "NA":
            return None
        else:
            return num_value

    inserted = 0
    skipped = 0
    missing_cell_line = 0
    missing_gene = 0
    for r in dr:
        gene = gene_cache.get(r["EntrezGeneID"])

        assert "cell_line" not in r
        cell_line_id = r["ModelID"]
        cell_line = cell_line_cache.get(cell_line_id)

        if cell_line is None:
            missing_cell_line += 1
            log_data_issue(
                "Mutation",
                "Missing cell line",
                id_type="depmap_id",
                identifier=cell_line_id,
            )
        if gene is None:
            missing_gene += 1
            log_data_issue(
                "Mutation",
                "Missing gene",
                id_type="entrez_gene_id",
                identifier=r["EntrezGeneID"],
            )

        if gene is None or cell_line is None:
            skipped += 1
        else:
            record = dict(
                gene_id=gene.entity_id,
                depmap_id=cell_line.depmap_id,
                chrom=r["Chrom"],
                pos=_to_none(r["Pos"]),
                variant_type=r["VariantType"],
                variant_info=r["VariantInfo"],
                ref=r["Ref"],
                alt=r["Alt"],
                af=_to_none(r["AF"]),
                ref_count=_to_none(r["RefCount"]),
                alt_count=_to_none(r["AltCount"]),
                gt=r["GT"],
                ps=_to_none(r["PS"]),
                dna_change=r["DNAChange"],
                protein_change=r["ProteinChange"],
                # hugo_symbol=r["hugo_symbol"],
                hgnc_name=r["HgncName"],
                hgnc_family=r["HgncFamily"],
                uniprot_id=r["UniprotID"],
                gc_content=_to_none(r["GcContent"]),
                civic_id=_to_none(r["CivicID"]),
                civic_description=r["CivicDescription"],
                civic_score=_to_none(r["CivicScore"]),
                likely_lof=r["LikelyLoF"],
                hess_driver=r["HessDriver"],
                hess_signature=r["HessSignature"],
                revel_score=_to_none(r["RevelScore"]),
                dida_id=r["DidaID"],
                dida_name=r["DidaName"],
                gwas_disease=r["GwasDisease"],
                gwas_pmid=_to_none(r["GwasPmID"]),
                oncogenic=r["Oncogenic"],
                mutation_effect=r["MutationEffect"],
                ## New columns 2023 Q4
                tumor_suppressor_high_impact=_to_sql_bool(
                    r["TumorSuppressorHighImpact"]
                ),
                vep_biotype=r["VepBiotype"],
                lof_gene_name=r["LofGeneName"],
                gnomade_af=_to_none(r["GnomadeAF"]),
                lof_gene_id=r["LofGeneId"],
                vep_swissprot=r["VepSwissprot"],
                dbsnp_rs_id=r["DbsnpRsID"],
                polyphen=r["Polyphen"],
                vep_pli_gene_value=_to_none(r["VepPliGeneValue"]),
                vep_lof_tool=_to_none(r["VepLofTool"]),
                gnomadg_af=_to_none(r["GnomadgAF"]),
                rescue=_to_sql_bool(r["Rescue"]),
                vep_clin_sig=r["VepClinSig"],
                dp=_to_none(r["DP"]),
                ensembl_feature_id=r["EnsemblFeatureID"],
                lof_percent_of_transcripts_affected=_to_none(
                    r["LofPercentOfTranscriptsAffected"]
                ),
                transcript_likely_lof=r["TranscriptLikelyLof"],
                gtex_gene=r["GtexGene"],
                brca1_func_score=_to_none(r["Brca1FuncScore"]),
                pharmgkb_id=r["PharmgkbId"],
                molecular_consequence=r["MolecularConsequence"],
                vep_hgnc_id=r["VepHgncID"],
                vep_existing_variation=r["VepExistingVariation"],
                vep_mane_select=r["VepManeSelect"],
                sift=r["Sift"],
                vep_ensp=r["VepENSP"],
                ensembl_gene_id=r["EnsemblGeneID"],
                provean_prediction=r["ProveanPrediction"],
                nmd=r["NMD"],
                vep_somatic=r["VepSomatic"],
                lof_number_of_transcripts_in_gene=_to_none(
                    r["LofNumberOfTranscriptsInGene"]
                ),
                vep_impact=r["VepImpact"],
                oncogene_high_impact=_to_sql_bool(r["OncogeneHighImpact"]),
                # New columns 24Q2
                am_class=r["AMClass"],  # string
                am_pathogenicity=_to_none(r["AMPathogenicity"]),  # float
                hotspot=_to_sql_bool(r["Hotspot"]),  # bool
                # New columns 25Q2
                intron=r["Intron"],  # string
                exon=r["Exon"],  # string
                rescue_reason=r["RescueReason"],  # string
            )

            yield record
            inserted += 1
        pbar.update(1)
    print(
        "Loaded {} mutations (Skipped {}, {} had missing gene, {} had missing line)".format(
            inserted, skipped, missing_gene, missing_cell_line
        )
    )
    assert skipped < inserted  # coarse check to make sure something got loaded


def _to_sql_bool(x):
    if pd.isna(x) or x == "" or x == "NA":
        return None
    elif x == "True" or x == True:
        return 1
    else:
        assert x == "False" or x == False, f"Expect True or False but was {x}"
        return 0


def _batch_load(
    filename,
    parse_fn,
    table_obj,
    lookup_by_entrez_id=True,
    lookup_gene_by_rowname=False,
):
    line_count = estimate_line_count(filename)
    if lookup_by_entrez_id:
        gene_cache = LazyCache(
            lambda id: Gene.get_gene_by_entrez(int(float(id)), must=False)
            if id != "NA" and id != ""
            else None
        )
    # The id here is being imported as a string of float(e.g.'9448.0') due to Taiga not knowing
    # how to represent a column of ints with missing values. So, if it sees an NA, it considers the column as float.
    # Since the get_gene_by_entrez is expecting an int, the id was converted this way - int(float(id))."""
    # If the column doesn't have any missing value, then the id conversion would be int(id)

    elif lookup_gene_by_rowname:
        gene_cache = LazyCache(
            lambda id: Gene.get_gene_from_rowname(id, must=False)
            if id != "NA"
            else None
        )
    else:
        gene_cache = LazyCache(
            lambda id: Gene.get_by_label(id, must=False) if id != "NA" else None
        )
    cell_line_cache = LazyCache(
        lambda name: CellLine.get_by_name_or_depmap_id_for_loaders(name, must=False)
        if name != "NA"
        else None
    )

    with open(filename, "rt") as fd:
        dr = csv.DictReader(fd)
        connection = db.session.connection()
        batch_load_from_generator(
            connection,
            table_obj.name,
            table_obj.insert(),
            lambda pbar: parse_fn(dr, pbar, gene_cache, cell_line_cache),
            line_count,
        )


def load_mutations(filename, taiga_id):
    _batch_load(filename, _read_mutations, Mutation.__table__)
    add_tabular_dataset(
        name_enum=TabularDataset.TabularEnum.mutation.name, taiga_id=taiga_id
    )


def load_oncokb_dataset_version_date(filename):
    df = pd.read_csv(filename)
    version = df["version"].iloc[-1]
    date = df["date"].iloc[-1]
    dataset_version_date = OncokbDatasetVersionDate(version=version, date=date,)
    db.session.add(dataset_version_date)


def get_matrix_hdf5_path(source_dir, biomarker_name):
    """
    Get the file path that contains the matrix hdf5 file
    """
    if source_dir == current_app.config["LOADER_DATA_DIR"]:
        file_path = os.path.join(source_dir, "dataset", biomarker_name + ".hdf5")
    else:
        dataset = Dataset.get_dataset_by_name(biomarker_name)
        if dataset is None:
            return None
        file_path = dataset.matrix.file_path
    return os.path.join(source_dir, file_path)


from depmap.interactive.config.categories import (
    OTHER_CONSERVING_INDEX,
    OTHER_NON_CONSERVING_INDEX,
    DAMAGING_INDEX,
    HOTSPOT_INDEX,
)


def create_mutation_priority(mutation_categories_with_filepath):
    priority = OrderedDict(
        [
            (BiomarkerEnum.mutations_damaging.name, DAMAGING_INDEX),
            (BiomarkerEnum.mutations_hotspot.name, HOTSPOT_INDEX),
        ]
    )

    features = set()
    cell_lines = set()
    mutations_map = {}

    for mutation_category in mutation_categories_with_filepath:
        hdf5_path = mutation_categories_with_filepath[mutation_category]
        if hdf5_path is None:
            continue

        mutations_df = read_hdf5(hdf5_path)
        # Set of all features and cell lines from all mutation types
        features = set.union(features, mutations_df.index)
        cell_lines = set.union(cell_lines, mutations_df.columns)
        # create a Series object of filtered existing mutation for each mutation type
        mutations_stack = mutations_df.stack()
        mutations_series = mutations_stack[mutations_stack.apply(lambda val: val != 0)]
        mutations_map[mutation_category] = mutations_series

    # Init new mutatations df
    mutations_priority_df = pd.DataFrame(
        0, index=list(features), columns=list(cell_lines)
    )
    # Looping in order of priority sorted lowest to highest so the highest priority is final assignment
    # when there are more than one mutations for each feature/cell line pair
    for category in priority:
        if category not in mutations_map or mutations_map[category] is None:
            print(f"No matrix for {category}. Skipping")
            continue

        for feature, cell_line in mutations_map[category].index:
            mutations_priority_df.loc[feature][cell_line] = priority[category]
    mutations_priority_df = mutations_priority_df.astype(int)
    mutations_priority_df = mutations_priority_df.sort_index(axis=0).sort_index(axis=1)
    return mutations_priority_df


def load_mutations_prioritized_biomarker_dataset(source_dir, derived_taiga_id):
    mutations_bool_file_path = {}
    mutations_biomarkers = [
        BiomarkerEnum.mutations_hotspot,
        BiomarkerEnum.mutations_damaging,
        BiomarkerEnum.mutations_driver,
    ]

    # Get matrix file path for each mutation type and create aggregated matrix with priority
    for mutations_biomarker in mutations_biomarkers:
        mutations_bool_file_path[mutations_biomarker.name] = get_matrix_hdf5_path(
            source_dir, mutations_biomarker.name
        )
    mutations_prioritized_df = create_mutation_priority(mutations_bool_file_path)
    # Write df to temporary file location. Create matrix and load as biomarker dataset
    with tempfile.NamedTemporaryFile(
        prefix=BiomarkerEnum.mutations_prioritized.name, suffix=".hdf5", delete=False,
    ) as temp_hdf5:
        dataset_metadata = DATASET_METADATA.get(BiomarkerEnum.mutations_prioritized)
        assert isinstance(dataset_metadata, DatasetLabel)
        biomarker_obj = dict(**asdict(dataset_metadata), taiga_id=derived_taiga_id,)

        df_to_hdf5(mutations_prioritized_df, temp_hdf5.name)
        load_biomarker_dataset(
            BiomarkerEnum.mutations_prioritized,
            biomarker_obj,
            temp_hdf5.name,
            PUBLIC_ACCESS_GROUP,
            allow_missing_entities=True,
        )


def _read_translocation(dr, pbar, gene_cache, cell_line_cache):
    inserted = 0
    skipped = 0
    missing_cell_line = 0
    missing_gene = 0
    for r in dr:
        # lookups go here

        cell_line = cell_line_cache.get(r["DepMap_ID"])
        gene_1 = gene_cache.get(r["gene1"])
        gene_2 = gene_cache.get(r["gene2"])
        if cell_line is None:
            missing_cell_line += 1
            log_data_issue(
                "Translocation",
                "Missing cell line",
                id_type="depmap_id",
                identifier=r["DepMap_ID"],
            )

        if gene_1 is None:
            missing_gene += 1
            log_data_issue(
                "Translocation", "Missing gene", id_type="gene", identifier=r["gene1"]
            )

        if gene_2 is None:
            missing_gene += 1
            log_data_issue(
                "Translocation", "Missing gene", id_type="gene", identifier=r["gene2"]
            )

        if cell_line is None or gene_1 is None or gene_2 is None:
            skipped += 1
        else:
            record = dict(
                depmap_id=cell_line.depmap_id,
                map_id=str(r["map_id"]),  # new
                break_point_1=str(r["bp1"]),
                break_point_2=str(r["bp2"]),
                trans_class=str(r["class"]),
                gene_1_id=gene_1.entity_id,
                site_1=str(r["site1"]),
                gene_2_id=gene_2.entity_id,
                site_2=str(r["site2"]),
                fusion=str(r["fusion"]),
                multi_sv_fusion=str(r["multi_sv_fusion"]),  # new
                cosmic_fus=str(r["cosmic_fus"]),  # new
            )
        yield record
        inserted += 1
        pbar.update(1)
    print(
        "Loaded {} Translocation (Skipped {}, {} had missing gene, {} had missing line)".format(
            inserted, skipped, missing_gene, missing_cell_line
        )
    )


def load_translocations(filename, taiga_id):
    _batch_load(
        filename,
        _read_translocation,
        Translocation.__table__,
        lookup_by_entrez_id=False,
    )
    add_tabular_dataset(
        name_enum=TabularDataset.TabularEnum.translocation.name, taiga_id=taiga_id
    )


def _read_fusion(dr, pbar, gene_cache, cell_line_cache):
    inserted = 0
    skipped = 0
    missing_cell_line = 0
    missing_gene = 0
    for r in dr:
        # lookups go here

        cell_line_id = r["ModelID"]
        cell_line = cell_line_cache.get(cell_line_id)

        gene_1 = gene_cache.get(r["Gene1"])
        gene_2 = gene_cache.get(r["Gene2"])
        if cell_line is None:
            missing_cell_line += 1
            log_data_issue(
                "Fusion",
                "Missing cell line",
                id_type="depmap_id",
                identifier=r["ModelID"],
            )

        if gene_1 is None:
            missing_gene += 1
            log_data_issue(
                "Fusion", "Missing gene", id_type="gene", identifier=r["Gene1"]
            )

        elif gene_2 is None:
            missing_gene += 1
            log_data_issue(
                "Fusion", "Missing gene", id_type="gene", identifier=r["Gene2"]
            )

        if cell_line is None or gene_1 is None or gene_2 is None:
            skipped += 1
        else:
            record = dict(
                depmap_id=cell_line.depmap_id,
                fusion_name=str(r["CanonicalFusionName"]),
                gene_1_id=gene_1.entity_id,
                gene_2_id=gene_2.entity_id,
                profile_id=str(r["ProfileID"]),
                total_reads_supporting_fusion=int(r["TotalReadsSupportingFusion"]),
                total_fusion_coverage=int(r["TotalFusionCoverage"]),
                ffpm=float(r["FFPM"]),
                split_reads_1=int(r["SplitReads1"]),
                split_reads_2=int(r["SplitReads2"]),
                discordant_mates=int(r["DiscordantMates"]),
                strand1=str(r["Strand1"]),
                strand2=str(r["Strand2"]),
                reading_frame=str(r["ReadingFrame"]),
            )
            yield record
            inserted += 1
        pbar.update(1)
    print(
        "Loaded {} Fusion (Skipped {}, {} had missing gene, {} had missing line)".format(
            inserted, skipped, missing_gene, missing_cell_line
        )
    )


def load_fusions(filename, taiga_id):
    _batch_load(
        filename,
        _read_fusion,
        Fusion.__table__,
        lookup_gene_by_rowname=True,
        lookup_by_entrez_id=False,
    )
    add_tabular_dataset(
        name_enum=TabularDataset.TabularEnum.fusion.name, taiga_id=taiga_id
    )


def _read_enrichment(dr, pbar, gene_cache, cell_line_cache):
    gene_cache = LazyCache(lambda name: Gene.get_gene_from_rowname(name, must=False))
    context_cache = LazyCache(lambda name: Context.get_by_name(name, must=False))
    compound_cache = LazyCache(
        lambda xref: CompoundExperiment.get_by_xref_full(xref, must=False)
    )

    skipped_gene = 0
    skipped_compound = 0
    skipped_context = 0
    loaded = 0

    from loader.association_loader import pipeline_label_to_dataset

    for row in dr:
        dependency_dataset_name = pipeline_label_to_dataset[row["dataset"]]

        dependency_dataset = DependencyDataset.get_dataset_by_name(
            dependency_dataset_name, must=True
        )
        assert dependency_dataset is not None

        if dependency_dataset.data_type == DataTypeEnum.drug_screen:
            compound = compound_cache.get(row["Gene"])
            if compound is None:
                skipped_compound += 1
                log_data_issue(
                    "ContextEnrichment",
                    "Missing compound",
                    identifier=row["Gene"],
                    id_type="compound",
                )
                continue
            entity_id = compound.entity_id
        else:
            gene = gene_cache.get(row["Gene"])
            if gene is None:
                skipped_gene += 1
                log_data_issue(
                    "ContextEnrichment",
                    "Missing gene",
                    identifier=row["Gene"],
                    id_type="gene",
                )
                continue
            entity_id = gene.entity_id

        context = context_cache.get(row["context"])
        if context is None:
            skipped_context += 1
            log_data_issue(
                "ContextEnrichment",
                "Missing context",
                identifier=row["context"],
                id_type="context_name",
            )
            continue

        enrichment = dict(
            context_name=context.name,
            entity_id=entity_id,
            p_value=float(row["p_value"]),
            t_statistic=float(row["t_statistic"]),
            effect_size_means_difference=float(row["effect_size_means_difference"]),
            dependency_dataset_id=dependency_dataset.dependency_dataset_id,
        )

        yield enrichment
        loaded += 1
        pbar.update(1)

    # sanity check

    # Add this back later
    #    assert (
    #        skipped_gene + skipped_compound < 2500
    #    ), "Error too many enrichment rows skipped: skipped {} genes and {} compounds".format(
    #        skipped_gene, skipped_compound
    #    )

    print(
        "Loaded {} context enrichment records ({} missing gene, {} missing compound, {} missing context)".format(
            loaded, skipped_gene, skipped_compound, skipped_context
        )
    )


def load_context_enrichment(db_file):
    _batch_load(db_file, _read_enrichment, ContextEnrichment.__table__)
