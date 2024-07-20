import pytest
from depmap.interactive import url_utils
from depmap.dataset.models import BiomarkerDataset, DependencyDataset, TabularDataset
from tests.factories import (
    DependencyDatasetFactory,
    BiomarkerDatasetFactory,
    MatrixFactory,
    GeneFactory,
    MutationFactory,
    CompoundExperimentFactory,
    AntibodyFactory,
)
from tests.depmap.utilities.test_url_utils import assert_url_contains_parts
from tests.utilities import interactive_test_utils
from depmap.vector_catalog.models import Serializer


def test_get_dataset_id(app, empty_db_mock_downloads):
    dataset = DependencyDatasetFactory()
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    assert url_utils._get_dataset_id(None) == None
    assert url_utils._get_dataset_id(dataset) == dataset.name.name


def test_get_interactive_url(app, empty_db_mock_downloads):
    """
    Test that
        passing in a dataset works
        leaving y blank with an x gene with expression works
        leaving y blank with an x gene without expression works
        leaving y blank with an x compound experiment with GDSC dataset works
        leaving y blank with an x compound experiment with non-GDSC dataset works
    """
    gene = GeneFactory()
    gene_no_expression = GeneFactory()
    gene_dep_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        matrix=MatrixFactory(entities=[gene, gene_no_expression]),
    )
    BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.expression,
        matrix=MatrixFactory(entities=[gene]),
    )
    MutationFactory(gene=gene)
    BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.mutations_prioritized,
        matrix=MatrixFactory(entities=[gene]),
    )
    cpd_exp = CompoundExperimentFactory()
    cpd_gdsc_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_AUC,
        matrix=MatrixFactory(entities=[cpd_exp]),
    )
    # need to create this for existence in the interactive config
    DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_IC50,
        matrix=MatrixFactory(
            entities=[cpd_exp]
        ),  # need an entity so that entity class is correct
    )

    cpd_non_gdsc_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.CTRP_AUC,
        matrix=MatrixFactory(entities=[cpd_exp]),
    )

    antibody = AntibodyFactory()
    antibody_dataset = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.rppa,
        matrix=MatrixFactory(entities=[antibody]),
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    all_specified_url = url_utils.get_interactive_url(
        gene_dep_dataset, gene.label, cpd_gdsc_dataset, cpd_exp.label, "lineage", "all"
    )
    assert_url_contains_parts(
        all_specified_url,
        [
            f"xDataset={ DependencyDataset.DependencyEnum.Avana.name }",
            f"xFeature={ gene.label }",
            f"yDataset={ DependencyDataset.DependencyEnum.GDSC1_AUC.name }",
            f"yFeature={ Serializer.quote(cpd_exp.label) }",
            f"color_property={ Serializer.quote('slice/lineage/1/label') }",
        ],
    )

    # y not specified, gene with expression
    gene_url = url_utils.get_interactive_url(gene_dep_dataset, gene.label, None, None)
    assert_url_contains_parts(
        gene_url,
        [
            f"xDataset={ DependencyDataset.DependencyEnum.Avana.name }",
            f"xFeature={ gene.label }",
            f"yDataset={ BiomarkerDataset.BiomarkerEnum.expression.name }",
            f"yFeature={ Serializer.quote(gene.label) }",
            f"color_property={ Serializer.quote(f'slice/mutations_prioritized/{gene.label}/label') }",
        ],
    )

    # y not specified, gene without expression
    no_expression_url = url_utils.get_interactive_url(
        gene_dep_dataset, gene_no_expression.label, None, None
    )
    assert_url_contains_parts(
        no_expression_url,
        [
            f"xDataset={ DependencyDataset.DependencyEnum.Avana.name }",
            f"xFeature={ gene_no_expression.label }",
        ],
    )

    # y not specified, compound GDSC
    gdsc_url = url_utils.get_interactive_url(
        cpd_gdsc_dataset, cpd_exp.label, None, None
    )
    assert_url_contains_parts(
        gdsc_url,
        [
            f"xDataset={ DependencyDataset.DependencyEnum.GDSC1_AUC.name }",
            f"xFeature={ Serializer.quote(cpd_exp.label) }",
            f"yDataset={ DependencyDataset.DependencyEnum.GDSC1_IC50.name }",
            f"yFeature={ Serializer.quote(cpd_exp.label) }",
            f"color_property={ Serializer.quote('slice/lineage/1/label') }",
        ],
    )

    # y not specified, compound not GDSC
    non_gdsc_url = url_utils.get_interactive_url(
        cpd_non_gdsc_dataset, cpd_exp.label, None, None
    )
    assert_url_contains_parts(
        non_gdsc_url,
        [
            f"xDataset={ DependencyDataset.DependencyEnum.CTRP_AUC.name }",
            f"xFeature={ Serializer.quote(cpd_exp.label) }",
            f"color_property={ Serializer.quote('slice/lineage/1/label') }",
        ],
    )
    assert "yDataset=" not in non_gdsc_url

    # all other cases where y not specified
    antibody_url = url_utils.get_interactive_url(
        antibody_dataset, antibody.label, None, None
    )
    assert_url_contains_parts(
        antibody_url,
        [
            f"xDataset={ BiomarkerDataset.BiomarkerEnum.rppa.name }",
            f"xFeature={antibody.label}",
        ],
    )
    assert "yDataset=" not in antibody_url
    assert "color_property=" not in antibody_url


@pytest.mark.parametrize(
    "x_dataset_id_is_expression, x_feature_is_in_potential_y",
    [(True, True), (True, False), (False, True), (False, False)],
)
def test_fill_y_dataset_from_x_gene(
    empty_db_mock_downloads, x_dataset_id_is_expression, x_feature_is_in_potential_y
):
    """
    This test uses strings like is_expression, other, is_copy_number to make things simpler.
    These are not values parametized above are not the expected inputs or outputs to the tested function
    The 'is_' prefix is added to be clear
    """
    gene = GeneFactory()
    expression_enum = BiomarkerDataset.BiomarkerEnum.expression
    if x_dataset_id_is_expression:
        x_dataset_id = expression_enum.name
        expected_y_dataset_id = BiomarkerDataset.BiomarkerEnum.copy_number_relative.name
    else:
        x_dataset_id = "other_value"
        expected_y_dataset_id = expression_enum.name

    if x_feature_is_in_potential_y:
        matrix = MatrixFactory(entities=[gene])
    else:
        matrix = MatrixFactory()
        expected_y_dataset_id = None

    BiomarkerDatasetFactory(
        matrix=matrix, name=BiomarkerDataset.BiomarkerEnum.expression
    )
    BiomarkerDatasetFactory(
        matrix=matrix, name=BiomarkerDataset.BiomarkerEnum.copy_number_relative
    )
    empty_db_mock_downloads.session.flush()

    y_dataset_id = url_utils.fill_y_dataset_from_x_gene(x_dataset_id, gene.label)
    assert y_dataset_id == expected_y_dataset_id


def test_fill_y_dataset_from_x_compound():
    """
    Test that providing the gdsc auc dataset fills in ic50, and vice versa
    The tested function does not check if the entity (compound) is present in the other dataset
    """
    compound_ids = [
        DependencyDataset.DependencyEnum.GDSC1_AUC.name,
        DependencyDataset.DependencyEnum.GDSC1_IC50.name,
    ]

    for index, other_index in [(0, 1), (1, 0)]:
        id = compound_ids[index]
        other_id = compound_ids[other_index]

        y_dataset_id = url_utils.fill_y_dataset_from_x_compound(id)
        assert y_dataset_id == other_id

    assert url_utils.fill_y_dataset_from_x_compound("not gdsc") == None


@pytest.mark.parametrize("x_feature_has_mutation", [(True), (False)])
def test_fill_color_from_x_gene(empty_db_mock_downloads, x_feature_has_mutation):
    gene = GeneFactory()
    if x_feature_has_mutation:
        MutationFactory(gene=gene, variant_info="MISSENSE")
        # Test that if gene in mutation dataset but not mutations prioritized, color is None
        color_dataset, color_feature = url_utils.fill_color_from_x_gene(gene.label)
        assert color_dataset == None
        assert color_feature == None

        # Test that if gene in mutations prioritized, color is present
        BiomarkerDatasetFactory(
            name=BiomarkerDataset.BiomarkerEnum.mutations_prioritized,
            matrix=MatrixFactory(entities=[gene]),
        )
        color_dataset, color_feature = url_utils.fill_color_from_x_gene(gene.label)
        expected_color_dataset = (
            BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name
        )
        expected_color_feature = gene.label
    else:
        expected_color_dataset = None
        expected_color_feature = None

    color_dataset, color_feature = url_utils.fill_color_from_x_gene(gene.label)
    assert color_dataset == expected_color_dataset
    assert color_feature == expected_color_feature
