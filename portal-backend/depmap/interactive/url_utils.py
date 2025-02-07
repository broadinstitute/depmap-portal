import flask
from depmap.dataset.models import (
    BiomarkerDataset,
    DependencyDataset,
    Dataset,
)
from depmap.interactive import interactive_utils
from depmap.vector_catalog.trees import InteractiveTree, ContinuousValuesTree
from depmap.vector_catalog.models import Serializer


def _get_dataset_id(dataset_obj):
    """
    Deprecated: Not supported for breadbox datasets.
    Returns dataset_id in interactive_config, or None if not in the config
    Currently only supports taking in a Dataset object
    Could imagine this being extended to take any interactive id, e.g. nonstandard datasets
    """
    if dataset_obj is None:
        return None
    assert isinstance(dataset_obj, Dataset), "{} is not a Dataset".format(dataset_obj)

    dataset_id = dataset_obj.name.name
    assert interactive_utils.is_continuous(
        dataset_id
    ), "If this is hit in a test, check that the interactive config has been set up correctly"
    return dataset_id


def get_interactive_url(
    x_dataset_obj,
    x_feature,
    y_dataset_obj=None,
    y_feature=None,
    color_dataset=None,
    color_feature=None,
):
    """
    Not supported for breadbox datasets. 
    If you are constructing a url to interactive for an announcement or static page, please instead use:
        url_for(
            "interactive.view_interactive",
            xDataset="",
            xFeature="",
            yDataset="",
            yFeature="",
        )

    This should be used if you are holding dataset objects
    """
    x_dataset_id = _get_dataset_id(x_dataset_obj)
    y_dataset_id = _get_dataset_id(y_dataset_obj)

    # Each of x, y and color must be specified fully or not at all. x is required.
    assert (
        x_dataset_id and x_feature
    ), "Must fully specify x dataset and feature. Otherwise, just use url_for('interactive.view_interactive') without arguments."
    if not y_dataset_id:
        assert (
            not y_feature
        ), "y axis is optional, but must be fully specified if specified at all"
    if not color_dataset:
        assert not color_feature

    kwargs = {
        "x": InteractiveTree.get_id_from_dataset_feature(x_dataset_id, x_feature),
    }

    if y_dataset_id:
        kwargs["y"] = InteractiveTree.get_id_from_dataset_feature(
            y_dataset_id, y_feature
        )
    else:  # if y is not specified, we try to autofill
        x_entity_type = interactive_utils.get_entity_type(x_dataset_id)

        if x_entity_type == "gene":
            y_dataset_id = fill_y_dataset_from_x_gene(x_dataset_id, x_feature)
            if y_dataset_id:
                kwargs["y"] = InteractiveTree.get_id_from_dataset_feature(
                    y_dataset_id, x_feature
                )
            else:  # x feature was not found in attempted y dataset
                gene_entity_class = interactive_utils.get_entity_class(x_dataset_id)
                assert gene_entity_class is not None
                gene = gene_entity_class.get_by_label(x_feature)
                kwargs["y"] = ContinuousValuesTree().get_gene_node_id(
                    gene.entity_id
                )  # this is why y_**justid is in the if else blockssaid&p

        elif x_entity_type == "compound_experiment":
            y_dataset_id = fill_y_dataset_from_x_compound(x_dataset_id)
            if y_dataset_id:
                kwargs["y"] = InteractiveTree.get_id_from_dataset_feature(
                    y_dataset_id, x_feature
                )
            else:
                # we only know how to autofill the GDSC compound datasets, this block is for the others
                pass
        else:
            # for everything else, just show x with no y
            pass

        # autofill color only if y (and color) are not specified
        if not color_dataset:
            if x_entity_type == "gene":
                color_dataset, color_feature = fill_color_from_x_gene(x_feature)
            elif x_entity_type == "compound_experiment":
                color_dataset = "lineage"
                color_feature = "all"
            else:
                # x is not a gene or compound experiment. not yet implemented how to autofill for other entity types, so don't color
                pass

    if color_dataset:

        kwargs["color"] = (
            InteractiveTree.get_id_from_dataset_feature(color_dataset, color_feature),
        )

    q = Serializer.quote

    url = flask.url_for("data_explorer_2.view_data_explorer_2")
    url += f"?xDataset={ q(x_dataset_id) }"
    url += f"&xFeature={ q(x_feature) }"

    if y_dataset_id:
        url += f"&yDataset={ q(y_dataset_id) }"
        url += f"&yFeature={ q(y_feature or x_feature) }"

    if color_dataset:
        color_property = kwargs["color"][0].replace("/lineage/all/", "/lineage/1/")
        url += f"&color_property={ q(color_property) }"

    return url


def fill_y_dataset_from_x_gene(x_dataset_id, x_feature):
    """
    These rules are ONLY applicable if x_feature is a gene
    Given an x dataset and feature, tries to fill y and color the best it can

    If x dataset is not expression, make the tentative y dataset expression
    Otherwise, make the tentative y dataset copy number

    If the x feature is present in the tentative y dataset, select the y dataset
    Otherwise, return None
    """
    y_dataset_id = None

    expression_enum = BiomarkerDataset.BiomarkerEnum.expression
    if x_dataset_id != expression_enum.name:
        if BiomarkerDataset.has_entity(expression_enum, x_feature, by_label=True):
            y_dataset_id = expression_enum.name
    else:
        if BiomarkerDataset.has_entity(
            BiomarkerDataset.BiomarkerEnum.copy_number_relative,
            x_feature,
            by_label=True,
        ):
            y_dataset_id = BiomarkerDataset.BiomarkerEnum.copy_number_relative.name

    return y_dataset_id


def fill_y_dataset_from_x_compound(x_dataset_id):
    """
    Fixme this does not check for whether the entity (compound) is in the y dataset. Need to implement by_label on DependencyDataset.has_entity
    Implementing this will be easier after we put name on the Dataset model. Until this, this seems like a decent assumption for compounds
    """
    pairs = [
        (
            DependencyDataset.DependencyEnum.GDSC1_AUC,
            DependencyDataset.DependencyEnum.GDSC1_IC50,
        ),
        (
            DependencyDataset.DependencyEnum.GDSC2_AUC,
            DependencyDataset.DependencyEnum.GDSC2_IC50,
        ),
        (
            DependencyDataset.DependencyEnum.Prism_oncology_AUC,
            DependencyDataset.DependencyEnum.Prism_oncology_IC50,
        ),
    ]
    for auc, ic50 in pairs:
        if x_dataset_id == auc.name:
            return ic50.name
        if x_dataset_id == ic50.name:
            return auc.name

    return None


def fill_color_from_x_gene(x_feature):
    """
    These rules are ONLY applicable if x_feature is a gene
    If the x feature is present in mutations, color by x feature mutations
    Otherwise, don't set color
    """
    if BiomarkerDataset.has_entity(
        BiomarkerDataset.BiomarkerEnum.mutations_prioritized, x_feature, by_label=True
    ):
        color_dataset = BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name
        return color_dataset, x_feature
    else:
        return None, None
