from flask import url_for
from depmap.interactive import interactive_utils
from depmap.vector_catalog.models import (
    NodeFactory,
    SliceSerializer,
    SliceRowType,
    NodeType,
)
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.compound.models import (
    Compound,
    CompoundExperiment,
    CompoundDose,
    CompoundDoseReplicate,
)


class CompoundNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["compound_id"],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="dataset",
            persist_child_if_not_found=True,
        )

    def get_added_attrs(self, prefix, limit):
        compounds = Compound.find_by_name_prefix(prefix, limit)
        return [dict(compound_id=compound.entity_id) for compound in compounds]

    def create(self, tree_id_encoder, key, compound_id):
        compound = Compound.get_by_id(compound_id)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=compound.label,
            value=compound.label,
            url=url_for("compound.view_compound", name=compound.label),
        )


class CompoundExperimentTerminatingDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["compound_id"],
            added_attr_names=["dataset_id"],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="compound instance",
        )

    def get_added_attrs(self, compound_id):
        compound_exp_ids = [
            cpd_exp.entity_id
            for cpd_exp in CompoundExperiment.get_all_by_compound_id(compound_id)
        ]
        return [
            dict(dataset_id=dataset.name.name)
            for dataset in Dataset.find_datasets_with_entity_ids(compound_exp_ids)
            # Dataset.find_datasets_with_entity_ids automatically excludes dose datasets because a CompoundExperiment is never a row entity in a dose dataset
        ]

    def create(self, tree_id_encoder, key, compound_id, dataset_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=interactive_utils.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
        )


class CompoundDoseDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["compound_id"],
            added_attr_names=["dataset_id"],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="compound instance",
        )

    def get_added_attrs(self, compound_id):
        compound_exp_ids = [
            cpd_exp.entity_id
            for cpd_exp in CompoundExperiment.get_all_by_compound_id(compound_id)
        ]
        compound_dose_ids = [
            dose.entity_id
            for cpd_exp_id in compound_exp_ids
            for dose in CompoundDose.get_all_with_compound_experiment_id(cpd_exp_id)
        ]

        return [
            dict(dataset_id=dataset.name.name)
            for dataset in Dataset.find_datasets_with_entity_ids(compound_dose_ids)
            # Dataset.find_datasets_with_entity_ids automatically excludes non-dose datasets because a CompoundDose is never a row entity in a non-dose dataset
        ]

    def create(self, tree_id_encoder, key, compound_id, dataset_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=interactive_utils.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
        )


class CompoundDoseReplicateDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["compound_id"],
            added_attr_names=["dataset_id"],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="compound instance",
        )

    def get_added_attrs(self, compound_id):
        compound_exp_ids = [
            cpd_exp.entity_id
            for cpd_exp in CompoundExperiment.get_all_by_compound_id(compound_id)
        ]
        compound_dose_replicate_ids = [
            dose_replicate.entity_id
            for cpd_exp_id in compound_exp_ids
            for dose_replicate in CompoundDoseReplicate.get_all_with_compound_experiment_id(
                cpd_exp_id
            )
        ]

        return [
            dict(dataset_id=dataset.name.name)
            for dataset in Dataset.find_datasets_with_entity_ids(
                compound_dose_replicate_ids
            )
            # Dataset.find_datasets_with_entity_ids automatically excludes non-dose replicate datasets because a CompoundDoseReplicate is never a row entity in a non-dose dataset
            if dataset.get_dose_enum() is None
            # only expose replicate-level dataset if there is no simpler dose dataset, that collapses across replicates
        ]

    def create(self, tree_id_encoder, key, compound_id, dataset_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=interactive_utils.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
        )


class CompoundExperimentNodeFactory(NodeFactory):
    def __init__(self, is_terminal):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["compound_id", "dataset_id"],
            added_attr_names=["compound_experiment_id"],
            is_terminal=is_terminal,
            children_list_type=None
            if is_terminal
            else NodeType.static,  # not used for terminal, non-dose branch
            children_category=None
            if is_terminal
            else "dose",  # not used for terminal, non-dose branch
        )

    def get_added_attrs(self, compound_id, dataset_id):
        compound_experiments = DependencyDataset.get_compound_experiments_in_dataset_with_compound(
            dataset_id, compound_id
        )
        return [
            dict(compound_experiment_id=compound_experiment.entity_id)
            for compound_experiment in compound_experiments
        ]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            attrs["dataset_id"], attrs["compound_experiment_id"], SliceRowType.entity_id
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.entity_id:
            dataset = DependencyDataset.get_dataset_by_name(dataset_id, must=False)
            if dataset is not None and dataset.is_compound_experiment:
                compound_experiment_id = int(feature)
                compound_id = CompoundExperiment.get_by_id(
                    compound_experiment_id
                ).compound_id
                return {
                    "dataset_id": dataset_id,
                    "compound_id": compound_id,
                    "compound_experiment_id": compound_experiment_id,
                }

        return None

    def create(
        self, tree_id_encoder, key, compound_id, dataset_id, compound_experiment_id
    ):
        compound_experiment = CompoundExperiment.get_by_id(compound_experiment_id)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=compound_experiment.label,
            value=compound_experiment.label,
        )


class CompoundDoseNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[
                "compound_id",
                "dataset_id",
                "compound_experiment_id",
            ],
            added_attr_names=["compound_dose_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, dataset_id, compound_experiment_id):
        # this makes the assumption that there is only one dose dataset per type of compound experiment, but we make that assumption in the compound page anyway. theoretically we should also use the dataset_id
        doses = CompoundDose.get_all_with_compound_experiment_id(compound_experiment_id)
        doses.sort(key=lambda x: x.dose)
        return [dict(compound_dose_id=dose.entity_id) for dose in doses]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            attrs["dataset_id"], attrs["compound_dose_id"], SliceRowType.entity_id
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.entity_id:
            dataset = DependencyDataset.get_dataset_by_name(dataset_id, must=False)
            if dataset is not None and dataset.is_dose:
                compound_dose_id = int(feature)
                compound_experiment_id = CompoundDose.get_by_id(
                    compound_dose_id
                ).compound_experiment_id
                compound_id = CompoundExperiment.get_by_id(
                    compound_experiment_id
                ).compound_id
                return {
                    "dataset_id": dataset_id,
                    "compound_id": compound_id,
                    "compound_experiment_id": compound_experiment_id,
                    "compound_dose_id": compound_dose_id,
                }

        return None

    def create(
        self,
        tree_id_encoder,
        key,
        dataset_id,
        compound_id,
        compound_experiment_id,
        compound_dose_id,
    ):
        compound_dose = CompoundDose.get_by_id(compound_dose_id)
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=compound_dose.label_without_compound_name,
            value=compound_dose.dose,
        )


class CompoundDoseReplicateNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[
                "compound_id",
                "dataset_id",
                "compound_experiment_id",
            ],
            added_attr_names=["compound_dose_replicate_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, dataset_id, compound_experiment_id):
        # this makes the assumption that there is only one dose dataset per type of compound experiment, but we make that assumption in the compound page anyway. theoretically we should also use the dataset_id
        dose_replicates = CompoundDoseReplicate.get_all_with_compound_experiment_id(
            compound_experiment_id
        )
        dose_replicates.sort(key=lambda x: (float(x.dose), x.replicate))
        return [
            dict(compound_dose_replicate_id=dose_replicate.entity_id)
            for dose_replicate in dose_replicates
        ]

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            attrs["dataset_id"],
            attrs["compound_dose_replicate_id"],
            SliceRowType.entity_id,
        )

    def get_attrs_from_slice_id(self, slice_id):
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.entity_id:
            dataset = DependencyDataset.get_dataset_by_name(dataset_id, must=False)
            if dataset is not None and dataset.is_dose_replicate:
                compound_dose_replicate_id = int(feature)
                compound_experiment_id = CompoundDoseReplicate.get_by_id(
                    compound_dose_replicate_id
                ).compound_experiment_id
                compound_id = CompoundExperiment.get_by_id(
                    compound_experiment_id
                ).compound_id
                return {
                    "dataset_id": dataset_id,
                    "compound_id": compound_id,
                    "compound_experiment_id": compound_experiment_id,
                    "compound_dose_replicate_id": compound_dose_replicate_id,
                }

        return None

    def create(
        self,
        tree_id_encoder,
        key,
        dataset_id,
        compound_id,
        compound_experiment_id,
        compound_dose_replicate_id,
    ):
        compound_dose_replicate = CompoundDoseReplicate.get_by_id(
            compound_dose_replicate_id
        )
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=compound_dose_replicate.label_without_compound_name,
            value=compound_dose_replicate.label,  # Jordan Rossen says that often times there aren't shared doses between datasets, so not worrying about keeping does across changes
        )
