from flask import current_app

from depmap.antibody.models import Antibody
from depmap.context.models_new import SubtypeContext, SubtypeNode
from depmap.dataset.models import BiomarkerDataset, TabularDataset
from depmap.transcription_start_site.models import TranscriptionStartSite
from depmap.partials.data_table.factories import get_data_table_for_view
from depmap.partials.entity_summary.models import EntitySummary
from depmap.proteomics.models import Protein
from depmap.enums import BiomarkerEnum


def format_characterizations(gene_id, gene_symbol, biomarker_datasets):
    """
    Returns a list of characterizations, with specifications for radio buttons/tab content
    All characterizations contain:
        id
        display_name
    They main contain:
        data_table
        box_plot
        bubble_map
    """
    biomarker_enums = {dataset.name for dataset in biomarker_datasets}
    multiple_entities_per_gene = {
        BiomarkerEnum.rrbs.name: TranscriptionStartSite,
        BiomarkerEnum.rppa.name: Antibody,
        BiomarkerEnum.proteomics.name: Protein,
        BiomarkerEnum.sanger_proteomics.name: Protein,
    }
    tabular_enum_to_format_function = {
        TabularDataset.TabularEnum.mutation: format_mutations,
        TabularDataset.TabularEnum.fusion: format_fusions,
        TabularDataset.TabularEnum.translocation: format_translocations,
    }

    characterizations = []

    dataset_enums = [
        BiomarkerEnum.expression,
        BiomarkerEnum.copy_number_absolute,
        BiomarkerEnum.copy_number_relative,
        TabularDataset.TabularEnum.mutation,
        TabularDataset.TabularEnum.fusion,
        TabularDataset.TabularEnum.translocation,
        BiomarkerEnum.rrbs,
        "cpg_methylation",
        BiomarkerEnum.rppa,
        BiomarkerEnum.proteomics,
        BiomarkerEnum.sanger_proteomics,
    ]

    for dataset_enum in dataset_enums:
        if dataset_enum == "cpg_methylation":
            if BiomarkerEnum.rrbs in biomarker_enums:
                characterizations.append(
                    {
                        "id": dataset_enum,
                        "dataset": dataset_enum,
                        "display_name": "CpG Methylation",
                        "bubble_map": format_methylation_viewer(),
                    }
                )
        elif isinstance(dataset_enum, TabularDataset.TabularEnum):
            dataset = TabularDataset.get_by_name(dataset_enum)
            if dataset.table_class.has_gene(gene_id):
                characterizations.append(
                    {
                        "id": dataset_enum.name,
                        "dataset": dataset_enum.name,
                        "display_name": dataset.display_name,
                        "data_table": tabular_enum_to_format_function[dataset_enum](
                            gene_id
                        ),
                    }
                )
        elif isinstance(dataset_enum, BiomarkerDataset.BiomarkerEnum):
            if dataset_enum in biomarker_enums:  # gene is in dataset
                dataset_enum_name = dataset_enum.name
                dataset = BiomarkerDataset.get_dataset_by_name(dataset_enum_name)

                if dataset_enum_name in multiple_entities_per_gene:
                    # for datasets with multiple characterizations per gene
                    other_entities = multiple_entities_per_gene[
                        dataset_enum_name
                    ].get_from_gene_symbol(gene_symbol)
                    for entity in other_entities:
                        if isinstance(entity, TranscriptionStartSite):
                            display_entity_label = "{} {}-{}".format(
                                entity.chromosome,
                                entity.five_prime_position,
                                entity.three_prime_position,
                            )
                        elif isinstance(entity, Protein):
                            display_entity_label = entity.uniprot_id
                        else:
                            display_entity_label = entity.label
                        characterization = {
                            "id": "{}_{}".format(dataset_enum_name, entity.entity_id),
                            "dataset": dataset_enum_name,
                            "display_name": "{} ({})".format(
                                dataset.display_name, display_entity_label
                            ),
                            "sublineage_plot": EntitySummary.data_for_characterization_partial(
                                dataset_enum_name, gene_symbol, entity.entity_id, entity
                            ),
                        }
                        characterizations.append(characterization)
                else:
                    display_name = dataset.display_name
                    characterizations.append(
                        {
                            "id": dataset_enum_name,
                            "dataset": dataset_enum_name,
                            "display_name": display_name,
                            "sublineage_plot": EntitySummary.data_for_characterization_partial(
                                dataset_enum_name, gene_symbol, gene_id
                            ),
                        }
                    )
        else:
            raise ValueError("Did not expect dataset name {}".format(dataset_enum))

    return characterizations


def format_mutations(gene_id):
    return get_data_table_for_view("mutation_by_gene", gene_id=gene_id)


def format_translocations(gene_id):
    return get_data_table_for_view("translocation_by_gene", gene_id=gene_id)


def format_fusions(gene_id):
    return get_data_table_for_view("fusion_by_gene", gene_id=gene_id)


def format_methylation_viewer():
    subtype_codes = SubtypeContext.get_all_codes()
    subtypes = [
        {"name": SubtypeNode.get_display_name(subtype_code), "value": subtype_code}
        for subtype_code in subtype_codes
    ]
    options = sorted(
        subtypes, key=lambda x: x["name"],  # need to sort post- getting display names
    )
    return options
