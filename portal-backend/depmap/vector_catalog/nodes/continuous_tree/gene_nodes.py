from flask import url_for

from depmap.enums import BiomarkerEnum
from depmap.partials.matrix.models import RowMatrixIndex
from depmap import data_access
from depmap.interactive import interactive_utils
from depmap.vector_catalog.models import (
    NodeFactory,
    SliceSerializer,
    SliceRowType,
    NodeType,
)
from depmap.dataset.models import Dataset, BiomarkerDataset
from depmap.interactive.config.models import DatasetSortFirstKey
from depmap.interactive.nonstandard.models import NonstandardMatrix
from depmap.gene.models import Gene
from depmap.antibody.models import Antibody
from depmap.transcription_start_site.models import TranscriptionStartSite
from depmap.global_search.models import GlobalSearchIndex
from depmap.proteomics.models import Protein

dataset_group_priority = {"Latest": 0, "Other": 1}


def find_gene_ids_by_label_alias_prefix(prefix, limit=None):
    """
    # modified from standard_utils.find_entity_ids_by_label_alias_prefix (similar to nonstandard_utils._find_gene_ids_by_label_alias_prefix)
    # the test for this is that SWI5 should appear before SOX10 for the prefix 's', since SWI5 has the alias SAE3

    Need to put symbol and alias on equal footing, so that order_by orders with exact matches first whether the exact match is a symbol or alias
    entity_ids_seen prevents a entity from being yielded twice
    This cannot be on a gene model, will cause circular dependency
    """
    indices = (
        GlobalSearchIndex.query.filter(
            (GlobalSearchIndex.type == "gene")
            | (GlobalSearchIndex.type == "gene_alias"),
            GlobalSearchIndex.label.startswith(prefix),
        )
        .order_by(GlobalSearchIndex.label)
        .from_self()
        .with_entities(GlobalSearchIndex.entity_id)
        .distinct()
        .limit(limit)
    )

    return [index.entity_id for index in indices]


def format_label_aliases(label, aliases):
    if len(aliases) > 0:
        return "{} ({})".format(label, ", ".join(aliases))
    else:
        return label


class GeneNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["gene_id"],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="dataset",
            persist_child_if_not_found=True,
        )

    def get_added_attrs(self, prefix, limit):
        """
        We cannot just use interactive util's get_matching_rows, because that requires a dataset
        """
        gene_ids = find_gene_ids_by_label_alias_prefix(prefix, limit)
        return [dict(gene_id=gene_id) for gene_id in gene_ids]

    def create(self, tree_id_encoder, key, gene_id):
        gene_label, aliases = Gene.get_label_aliases(gene_id)
        node_label = format_label_aliases(gene_label, aliases)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=node_label,
            value=gene_label,
            url=url_for("gene.view_gene", gene_symbol=gene_label),
        )


class GeneStandardDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=["dataset_id"],
            is_terminal=True,
        )

    def _get_standard_datasets_with_gene(self, gene_id):
        datasets = Dataset.find_datasets_with_entity_ids([gene_id])
        datasets.sort(key=lambda x: x.display_name)
        return [
            dataset.name.name
            for dataset in datasets
            if dataset.name
            not in {
                BiomarkerDataset.BiomarkerEnum.rppa,
                BiomarkerDataset.BiomarkerEnum.rrbs,
                BiomarkerDataset.BiomarkerEnum.mutations_prioritized,  # Don't allow this as vector catalog dropdown option bc only intended to use as category
            }
        ]

    def get_added_attrs(self, gene_id):
        """
        This separation from the create method, passing this into the create method, ensures that we add to the attrs the entire space of things necessary to specify to create a node
        Ignore prefix and limit
        """
        datasets = self._get_standard_datasets_with_gene(gene_id)

        return [dict(dataset_id=dataset) for dataset in datasets]

    def create(self, tree_id_encoder, key, gene_id, dataset_id):
        group = "Latest"
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=data_access.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
            group=group,
            sort_key=(
                dataset_group_priority[group],
                interactive_utils.get_sort_key(dataset_id),
            ),
        )

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            attrs["dataset_id"], attrs["gene_id"], SliceRowType.entity_id
        )

    def get_attrs_from_slice_id(self, slice_id):
        """

        :param slice_id:
        :return: Tree Id if slice_id is valid for this node, else None
        """
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.entity_id:
            if data_access.get_dataset_feature_type(dataset_id) == "gene":
                gene_id = int(feature)

                allowed_dataset_ids = set(
                    self._get_standard_datasets_with_gene(gene_id)
                )
                if dataset_id in allowed_dataset_ids:
                    return {"dataset_id": dataset_id, "gene_id": gene_id}

        return None


class GeneNonstandardDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=["dataset_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, gene_id):
        """
        This separation from the create method, passing this into the create method, ensures that we add to the attrs the entire space of things necessary to specify to create a node
        Ignore prefix and limit
        """
        datasets = NonstandardMatrix.find_dataset_ids_with_entity_ids([gene_id])
        return [dict(dataset_id=dataset) for dataset in datasets]

    def create(self, tree_id_encoder, key, gene_id, dataset_id):
        sort_key = interactive_utils.get_sort_key(dataset_id)
        is_latest = sort_key[0] in {
            DatasetSortFirstKey.custom_or_private.value,
            DatasetSortFirstKey.standard_or_standard_related.value,
        }
        group = "Latest" if is_latest else "Other"

        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=data_access.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
            group=group,
            sort_key=(dataset_group_priority[group], sort_key),
        )

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            attrs["dataset_id"], attrs["gene_id"], SliceRowType.entity_id
        )

    def get_attrs_from_slice_id(self, slice_id):
        """

        :param slice_id:
        :return: Tree Id if slice_id is valid for this node, else None
        """
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.entity_id:
            gene_id = int(feature)

            if (
                not data_access.is_standard(dataset_id)
                and data_access.get_entity_class(dataset_id) == Gene
            ):
                return {"dataset_id": dataset_id, "gene_id": gene_id}

        return None


class RppaDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=[],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="antibody",
        )

    def get_added_attrs(self, gene_id):
        antibody_ids = [
            antibody.entity_id for antibody in Antibody.get_from_gene_id(gene_id)
        ]
        # fixme
        # we technically don't need to check with antibodies are in the antibody dataset
        # there is only one antibody dataset, and all antibody entities created are for this dataset
        # but it feels like we should?

        if len(antibody_ids) > 0:
            return [{}]
        else:
            return []

    def create(self, tree_id_encoder, key, gene_id):
        dataset_id = BiomarkerDataset.BiomarkerEnum.rppa.name

        sort_key = interactive_utils.get_sort_key(dataset_id)
        assert sort_key[0] == DatasetSortFirstKey.standard_or_standard_related.value
        group = "Latest"
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=data_access.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
            group=group,
            sort_key=(dataset_group_priority[group], sort_key),
        )


class RppaAntibodyNodeFactory(NodeFactory):
    def __init__(self):
        # NodeFactory.__init__(self, [], is_terminal=True) # empty because this is terminal and thus uses the slice id??
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=["antibody_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, gene_id):
        antibodies = Antibody.get_from_gene_id(gene_id)
        return [dict(antibody_id=antibody.entity_id) for antibody in antibodies]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            BiomarkerDataset.BiomarkerEnum.rppa.name,
            attrs["antibody_id"],
            SliceRowType.entity_id,
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if (
            dataset_id == BiomarkerDataset.BiomarkerEnum.rppa.name
            and feature_type == SliceRowType.entity_id
        ):
            # we technically don't need to check with antibodies are in the antibody dataset
            # there is only one antibody dataset, and all antibody entities created are for this dataset
            # but it feels like we should?
            antibody_id = int(feature)
            return {
                "gene_id": Antibody.get_by_id(antibody_id)
                .gene[0]
                .entity_id,  # we just take the first gene, see pivotal #163326588
                "antibody_id": antibody_id,
            }

        return None

    def create(self, tree_id_encoder, key, gene_id, antibody_id):
        antibody = Antibody.get_by_id(antibody_id)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=antibody.label,
            value=antibody.label,
            url=url_for(
                "gene.view_gene",
                gene_symbol=antibody.gene[0].label,
                tab="characterization",
                characterization="rppa",
            ),
        )


class RrbsDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=[],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="transcription start site",
        )

    def get_added_attrs(self, gene_id):
        tss_ids = [
            tss.entity_id for tss in TranscriptionStartSite.get_from_gene_id(gene_id)
        ]
        # fixme
        # we technically don't need to check with tsses are in the tss dataset
        # there is only one tss dataset, and all tss entities created are for this dataset
        # but it feels like we should?

        if len(tss_ids) > 0:
            return [{}]
        else:
            return []

    def create(self, tree_id_encoder, key, gene_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=data_access.get_dataset_label(
                BiomarkerDataset.BiomarkerEnum.rrbs.name
            ),
            value=BiomarkerDataset.BiomarkerEnum.rrbs.name,
            url=interactive_utils.get_dataset_url(
                BiomarkerDataset.BiomarkerEnum.rrbs.name
            ),
            group="Latest",
        )


class RrbsTssNodeFactory(NodeFactory):
    def __init__(self):
        # NodeFactory.__init__(self, [], is_terminal=True) # empty because this is terminal and thus uses the slice id??
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=["tss_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, gene_id):
        antibodies = TranscriptionStartSite.get_from_gene_id(gene_id)
        return [dict(tss_id=tss.entity_id) for tss in antibodies]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            BiomarkerDataset.BiomarkerEnum.rrbs.name,
            attrs["tss_id"],
            SliceRowType.entity_id,
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)
        if (
            dataset_id == BiomarkerDataset.BiomarkerEnum.rrbs.name
            and feature_type == SliceRowType.entity_id
        ):
            # we technically don't need to check with antibodies are in the tss dataset
            # there is only one tss dataset, and all tss entities created are for this dataset
            # but it feels like we should?
            tss_id = int(feature)
            return {
                "gene_id": TranscriptionStartSite.get_by_id(
                    tss_id
                ).gene_id,  # we just take the first gene, see pivotal #163326588
                "tss_id": tss_id,
            }

        return None

    def create(self, tree_id_encoder, key, gene_id, tss_id):
        tss = TranscriptionStartSite.get_by_id(tss_id)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=tss.label,
            value=tss.label,
            url=url_for(
                "gene.view_gene",
                gene_symbol=tss.gene.label,
                tab="characterization",
                characterization="rrbs",
            ),
        )


class ProteomicsDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=[],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="protein",
        )

    def get_added_attrs(self, gene_id):
        # Filter out proteins only in Proteomics
        proteins = (
            Protein.query.join(Gene, Gene.entity_id == Protein.gene_id)
            .join(RowMatrixIndex, RowMatrixIndex.entity_id == Protein.entity_id)
            .join(
                BiomarkerDataset, BiomarkerDataset.matrix_id == RowMatrixIndex.matrix_id
            )
            .filter(BiomarkerDataset.name == BiomarkerEnum.proteomics)
            .filter(Protein.gene_id == gene_id)
            .all()
        )
        protein_ids = [protein.entity_id for protein in proteins]
        if len(protein_ids) > 0:
            return [{}]
        else:
            return []

    def create(self, tree_id_encoder, key, gene_id):
        dataset_id = BiomarkerDataset.BiomarkerEnum.proteomics.name
        sort_key = interactive_utils.get_sort_key(dataset_id)
        assert sort_key[0] == DatasetSortFirstKey.standard_or_standard_related.value
        group = "Latest"
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=data_access.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
            group=group,
            sort_key=(dataset_group_priority[group], sort_key),
        )


class ProteinNodeFactory(NodeFactory):
    def __init__(self):
        # NodeFactory.__init__(self, [], is_terminal=True) # empty because this is terminal and thus uses the slice id??
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=["protein_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, gene_id):
        proteins = Protein.get_from_gene_id(gene_id)
        return [dict(protein_id=protein.entity_id) for protein in proteins]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            BiomarkerDataset.BiomarkerEnum.proteomics.name,
            attrs["protein_id"],
            SliceRowType.entity_id,
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if (
            dataset_id == BiomarkerDataset.BiomarkerEnum.proteomics.name
            and feature_type == SliceRowType.entity_id
        ):
            protein_id = int(feature)
            return {
                "gene_id": Protein.get_by_id(
                    protein_id
                ).gene.entity_id,  # we just take the first gene, see pivotal #163326588
                "protein_id": protein_id,
            }

        return None

    def create(self, tree_id_encoder, key, gene_id, protein_id):
        protein = Protein.get_by_id(protein_id)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=protein.label,
            value=protein.label,
            url=url_for(
                "gene.view_gene",
                gene_symbol=protein.gene.label,
                tab="characterization",
                characterization="proteomics",
            ),
        )


class SangerProteomicsDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=[],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="protein",
        )

    def get_added_attrs(self, gene_id):
        # Filter out proteins only in Sanger Proteomics dataset
        proteins = (
            Protein.query.join(Gene, Gene.entity_id == Protein.gene_id)
            .join(RowMatrixIndex, RowMatrixIndex.entity_id == Protein.entity_id)
            .join(
                BiomarkerDataset, BiomarkerDataset.matrix_id == RowMatrixIndex.matrix_id
            )
            .filter(BiomarkerDataset.name == BiomarkerEnum.sanger_proteomics)
            .filter(Protein.gene_id == gene_id)
            .all()
        )
        protein_ids = [protein.entity_id for protein in proteins]

        if len(protein_ids) > 0:
            return [{}]
        else:
            return []

    def create(self, tree_id_encoder, key, gene_id):
        dataset_id = BiomarkerDataset.BiomarkerEnum.sanger_proteomics.name
        sort_key = interactive_utils.get_sort_key(dataset_id)
        assert sort_key[0] == DatasetSortFirstKey.standard_or_standard_related.value
        group = "Latest"
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=data_access.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
            group=group,
            sort_key=(dataset_group_priority[group], sort_key),
        )


class SangerProteinNodeFactory(NodeFactory):
    def __init__(self):
        # NodeFactory.__init__(self, [], is_terminal=True) # empty because this is terminal and thus uses the slice id??
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["gene_id"],
            added_attr_names=["protein_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, gene_id):
        proteins = Protein.get_from_gene_id(gene_id)
        return [dict(protein_id=protein.entity_id) for protein in proteins]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            BiomarkerDataset.BiomarkerEnum.sanger_proteomics.name,
            attrs["protein_id"],
            SliceRowType.entity_id,
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if (
            dataset_id == BiomarkerDataset.BiomarkerEnum.sanger_proteomics.name
            and feature_type == SliceRowType.entity_id
        ):
            protein_id = int(feature)
            return {
                "gene_id": Protein.get_by_id(
                    protein_id
                ).gene.entity_id,  # we just take the first gene, see pivotal #163326588
                "protein_id": protein_id,
            }

        return None

    def create(self, tree_id_encoder, key, gene_id, protein_id):
        protein = Protein.get_by_id(protein_id)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=protein.label,
            value=protein.label,
            url=url_for(
                "gene.view_gene",
                gene_symbol=protein.gene.label,
                tab="characterization",
                characterization="sanger_proteomics",
            ),
        )
