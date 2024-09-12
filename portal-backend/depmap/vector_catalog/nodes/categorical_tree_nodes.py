from depmap.interactive import interactive_utils
from depmap.context.models import Context
from depmap.dataset.models import BiomarkerDataset
from depmap.vector_catalog.models import (
    NodeFactory,
    NodeType,
    SingleNodeFactory,
    SliceSerializer,
    SliceRowType,
)

from depmap.gene.models import Gene
from depmap.vector_catalog.nodes.continuous_tree.gene_nodes import (
    find_gene_ids_by_label_alias_prefix,
)
import itertools

MUTATION_DETAILS_DATASET_ID = "mutation_details"


class NonstandardNodeFactory(NodeFactory):
    def __init__(self):
        """
        Only supports prepopulate, and entity-less nodes
        """
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["dataset_id"],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category=lambda attrs: interactive_utils.get_feature_name(
                attrs["dataset_id"]
            ),
        )

    def get_added_attrs(self):
        datasets = interactive_utils.get_nonstandard_categorical_datasets()
        # right now, we only have prepopulate, and don't care about entity type
        # if either of these assumptions are broken, we will need to rework this node path
        assert all(
            [
                interactive_utils.is_prepopulate(dataset_id)
                and interactive_utils.legacy_get_entity_class_name(dataset_id) is None
                for dataset_id in datasets
            ]
        )
        return [dict(dataset_id=dataset_id) for dataset_id in datasets]

    def create(self, tree_id_encoder, key, dataset_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=interactive_utils.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
        )


class NonstandardRowNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["dataset_id"],
            added_attr_names=["row"],
            is_terminal=True,
        )

    def get_added_attrs(self, dataset_id):
        """
        Subclass from base to set params of this function (no prefix and limit)
        """
        rows = interactive_utils.get_all_rows(dataset_id)
        return [dict(row=row["value"]) for row in rows]

    def create(self, tree_id_encoder, key, row, dataset_id):
        return self.create_node(
            tree_id_encoder, key, self.get_attrs(locals()), label=row, value=row
        )

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            attrs["dataset_id"], attrs["row"], SliceRowType.label
        )

    def get_attrs_from_slice_id(self, slice_id):
        """

        :param slice_id:
        :return: Tree Id if slice_id is valid for this node, else None
        """
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)
        allowed_datasets = (
            interactive_utils.get_nonstandard_categorical_datasets()
        )  # this is a dict, but 'in' works all the same

        if feature_type == SliceRowType.label and dataset_id in allowed_datasets:
            return {"dataset_id": dataset_id, "row": feature}

        return None


class LineageNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["lineage_level"],
            is_terminal=True,
        )

    def get_added_attrs(self):
        """
        Subclass from base to set params of this function (no prefix and limit)
        """
        return [
            {"lineage_level": 1},
            {"lineage_level": 2},
            {"lineage_level": 3},
            {"lineage_level": 5},
            {"lineage_level": 6},
        ]

    def create(self, tree_id_encoder, key, lineage_level):
        lineage_to_label = {
            1: "Lineage",
            2: "Lineage Subtype",
            3: "Lineage Sub-subtype",
            5: "Legacy Sub-subtype",
            6: "Legacy Molecular Subtype",
        }
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=lineage_to_label[lineage_level],
            value=lineage_level,
        )

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            interactive_utils.get_lineage_dataset(),
            attrs["lineage_level"],
            SliceRowType.label,
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if dataset_id == interactive_utils.get_lineage_dataset():
            if feature == "all":
                lineage_level = 1
            else:
                lineage_level = int(feature)
            return {"lineage_level": lineage_level}
            # return {}
        else:
            return None


class PrimaryDiseaseSingletonNodeFactory(SingleNodeFactory):
    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            interactive_utils.get_primary_disease_dataset(), "all", SliceRowType.label
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if (
            dataset_id == interactive_utils.get_primary_disease_dataset()
            and feature == "all"
        ):
            return {}
        else:
            return None


class DiseaseSubtypeSingletonNodeFactory(SingleNodeFactory):
    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            interactive_utils.get_disease_subtype_dataset(), "all", SliceRowType.label
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if (
            dataset_id == interactive_utils.get_disease_subtype_dataset()
            and feature == "all"
        ):
            return {}
        else:
            return None


class TumorTypeSingletonNodeFactory(SingleNodeFactory):
    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            interactive_utils.get_tumor_type_dataset(), "all", SliceRowType.label
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if (
            dataset_id == interactive_utils.get_tumor_type_dataset()
            and feature == "all"
        ):
            return {}
        else:
            return None


class GenderSingletonNodeFactory(SingleNodeFactory):
    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            interactive_utils.get_gender_dataset(), "all", SliceRowType.label
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if dataset_id == interactive_utils.get_gender_dataset() and feature == "all":
            return {}
        else:
            return None


class GrowthPatternSingletonNodeFactory(SingleNodeFactory):
    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            interactive_utils.get_growth_pattern_dataset(), "all", SliceRowType.label
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if (
            dataset_id == interactive_utils.get_growth_pattern_dataset()
            and feature == "all"
        ):
            return {}
        else:
            return None


class ContextNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["row"],
            is_terminal=True,
        )

    def get_added_attrs(self):
        rows = interactive_utils.get_all_rows(interactive_utils.get_context_dataset())
        return [dict(row=row["value"]) for row in rows]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            interactive_utils.get_context_dataset(), attrs["row"], SliceRowType.label
        )

    def get_attrs_from_slice_id(self, slice_id):
        """

        :param slice_id:
        :return: Tree Id if slice_id is valid for this node, else None
        """
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.label:
            if dataset_id == interactive_utils.get_context_dataset():
                return {"row": feature}

        return None

    def create(self, tree_id_encoder, key, row):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=Context.get_display_name(row),
            value=row,
        )


class MutationNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["row"],
            is_terminal=True,
        )

    def get_added_attrs(self, prefix, limit):
        rows = interactive_utils.get_matching_rows(
            BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name, prefix, limit
        )
        return [dict(row=row["value"]) for row in rows]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name,
            attrs["row"],
            SliceRowType.label,
        )

    def get_attrs_from_slice_id(self, slice_id):
        """
        :param slice_id:
        :return: Tree Id if slice_id is valid for this node, else None
        """
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.label:
            if dataset_id == BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name:
                return {"row": feature}

        return None

    def create(self, tree_id_encoder, key, row):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=row,
            value=row,
            url=interactive_utils.get_dataset_url(
                BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name  # May need to keep as TabularEnum.mutations bc mutations_prioritized has no taiga id and should be derived from it
            ),
        )


class MutationDetailsNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["gene_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, prefix, limit):
        generator = find_gene_ids_by_label_alias_prefix(prefix)
        gene_ids = itertools.islice(generator, limit)
        return [dict(gene_id=gene_id) for gene_id in gene_ids]

    def get_slice_id(self, attrs):
        gene = Gene.get_by_id(attrs["gene_id"], must=True)
        return SliceSerializer.encode_slice_id(
            MUTATION_DETAILS_DATASET_ID, gene.label, SliceRowType.label,
        )

    def get_attrs_from_slice_id(self, slice_id):
        """
        :param slice_id:
        :return: Tree Id if slice_id is valid for this node, else None
        """
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.label:
            if dataset_id == MUTATION_DETAILS_DATASET_ID:
                return {"gene_id": feature}

        return None

    def create(self, tree_id_encoder, key, gene_id):
        gene = Gene.get_by_id(gene_id, must=True)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=gene.label,
            value=gene.label,
            url=None,
        )
