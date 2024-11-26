from flask import url_for
import pytest
from json import loads as json_loads

from depmap.gene.models import Gene
from depmap.gene.views.index import (
    dependency_datasets_with_gene,
    biomarker_datasets_with_gene,
    format_gene_summary,
)
from depmap.dataset.models import DependencyDataset, BiomarkerDataset
from tests.factories import (
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    BiomarkerDatasetFactory,
    CellLineFactory,
    MutationFactory,
    PredictiveModelFactory,
    PredictiveFeatureFactory,
    PredictiveFeatureResultFactory,
)
from tests.utilities import interactive_test_utils


def test_render_view_gene_mobile(populated_db):
    """
    This is a very dumb test -- but we had a problem where the mobile rendering of this page was throwing an exception
    and we didn't notice. This will at least verify the page can render without error.
    """
    with populated_db.app.test_client() as c:
        symbol = "SOX10"
        r = c.get(url_for("gene.view_gene", gene_symbol=symbol, mobile="true"))
        assert r.status_code == 200, r.status_code


# TODO: finish implementations. For other functions, and for handling of things that do not exist
def test_render_view_gene(populated_db):
    """
    Test that the gene page for every gene in the db renders (tests templating)
    Specifically for the executive summary, renders regardless of crispr/rnai membership
    Checking all the genes is very important, and has helped catch cases where we don't handle genes that aren't in certain datasets
    """
    # Verify that genes have different memberships in different datasets, at least for the crispr/rnai combination
    crispr_yes_rnai_no_tested = False
    crispr_no_rnai_yes_tested = False
    both_crispr_rnai_no_tested = False

    with populated_db.app.test_client() as c:
        for gene in Gene.query.all():
            symbol = gene.symbol
            # a bunch of ME genes were added for another test
            # but we do want to test the genes in sample_data/___/subsets.py, since those were picked for memberships in different datasets
            # METTL14 has no information except description, and is a good test for missing stuff.
            if not symbol.startswith("ME") or symbol == "METTL14":
                try:
                    r = c.get(url_for("gene.view_gene", gene_symbol=symbol))
                except Exception as e:
                    raise Exception(
                        "{} gene page failed to render".format(symbol)
                    ) from e
                assert r.status_code == 200, r.status_code

                if not (
                    crispr_yes_rnai_no_tested
                    and crispr_no_rnai_yes_tested
                    and both_crispr_rnai_no_tested
                ):
                    in_crispr = False
                    in_rnai = False
                    if DependencyDataset.has_entity(
                        DependencyDataset.DependencyEnum.Avana, gene.entity_id
                    ):
                        in_crispr = True
                    if DependencyDataset.has_entity(
                        DependencyDataset.DependencyEnum.RNAi_merged, gene.entity_id
                    ):
                        in_rnai = True
                    if in_crispr and not in_rnai:
                        crispr_yes_rnai_no_tested = True
                    if not in_crispr and in_rnai:
                        crispr_no_rnai_yes_tested = True
                    if not in_crispr and not in_rnai:
                        both_crispr_rnai_no_tested = True

        assert crispr_yes_rnai_no_tested
        assert crispr_no_rnai_yes_tested
        assert both_crispr_rnai_no_tested


def test_render_view_gene_404(populated_db):
    """
    Test that nonexistent gene returns 404
    """
    with populated_db.app.test_client() as c:
        r = c.get(url_for("gene.view_gene", gene_symbol="notagene"))
        assert r.status_code == 404, r.status_code


@pytest.mark.parametrize(
    "entity_id, expected_names",
    [
        (
            9,
            [
                "Chronos_Combined",
                "Avana",
                "GeCKO",
                "RNAi_merged",
                "RNAi_Ach",
                "RNAi_Nov_DEM",
            ],
        ),  # NRAS. Coincidentally this also tests order
        (14, ["GeCKO", "RNAi_merged"]),  # TRIL
    ],
)
def test_gene_dependency_datasets_where_present(
    populated_db, entity_id, expected_names
):
    dependency_dataset_names = [
        dataset.name.name for dataset in dependency_datasets_with_gene(entity_id)
    ]
    assert dependency_dataset_names == expected_names


@pytest.mark.parametrize(
    "gene_label, expected_names",
    [
        (
            "MAP4K4",
            [
                "expression",
                "copy_number_absolute",
                "copy_number_relative",
                "mutation_pearson",
                "mutations_damaging",
                "mutations_driver",
                "rrbs",
                "proteomics",
                "sanger_proteomics",
            ],
        ),
        (
            "TNS2",
            [
                "expression",
                "copy_number_absolute",
                "copy_number_relative",
                "mutation_pearson",
            ],
        ),  # TNS2, not in rppa
    ],
)
def test_biomarker_datasets_where_present(populated_db, gene_label, expected_names):
    gene = Gene.get_by_label(gene_label)
    biomarker_dataset_names = [
        dataset.name.name for dataset in biomarker_datasets_with_gene(gene.entity_id)
    ]

    assert biomarker_dataset_names == expected_names


def test_format_gene_summary(empty_db_mock_downloads):
    """
    Test that the ajax_url generated uses the expected parameters
    I.e. mutation and expression are used
    """
    cell_line = CellLineFactory()
    gene = GeneFactory()

    dep_matrix = MatrixFactory(entities=[gene], cell_lines=[cell_line])
    expression_matrix = MatrixFactory(entities=[gene], cell_lines=[cell_line])

    dep_dataset = DependencyDatasetFactory(
        matrix=dep_matrix, name=DependencyDataset.DependencyEnum.Avana
    )
    BiomarkerDatasetFactory(
        matrix=expression_matrix, name=BiomarkerDataset.BiomarkerEnum.expression
    )
    MutationFactory(gene=gene, cell_line=cell_line, variant_info="MISSENSE")
    empty_db_mock_downloads.session.flush()

    summary = format_gene_summary(gene, [dep_dataset])
    for param in {"color=mutation", "size_biom_enum_name=expression"}:
        assert param in summary["ajax_url"]


def test_get_predictive_table(app, empty_db_mock_downloads):
    """
    Test that includes rnai, crispr, and nothing else
    """
    gene = GeneFactory()
    crispr = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Combined,
        matrix=MatrixFactory(entities=[gene]),
        priority=1,
    )
    rnai = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.RNAi_merged,
        matrix=MatrixFactory(entities=[gene]),
        priority=1,
    )
    other = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GeCKO,
        matrix=MatrixFactory(entities=[gene]),
    )

    feature_gene = GeneFactory()
    biomarker_matrix = MatrixFactory(entities=[feature_gene])
    biomarker_dataset = BiomarkerDatasetFactory(matrix=biomarker_matrix)

    for dataset in [crispr, rnai, other]:
        model = PredictiveModelFactory(
            label="Core_omics", dataset=dataset, entity=gene, pearson=1
        )
        feature_0 = PredictiveFeatureFactory(
            feature_name=feature_gene.label, dataset_id=biomarker_dataset.name.name,
        )
        feature_1 = PredictiveFeatureFactory(
            feature_name=feature_gene.label, dataset_id=biomarker_dataset.name.name,
        )
        PredictiveFeatureResultFactory(
            predictive_model=model, importance=0, rank=0, feature=feature_0,
        )
        PredictiveFeatureResultFactory(
            predictive_model=model, importance=1, rank=1, feature=feature_1
        )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        r = c.get(url_for("gene.get_predictive_table", entityId=gene.entity_id))
        assert r.status_code == 200, r.status_code
        response = json_loads(r.data.decode("utf8"))

        # test shape of response
        assert len(response) == 2
        crispr_row = next(
            (x for x in response if x["screen"] == crispr.display_name), None
        )
        rnai_row = next(
            (x for x in response if x["screen"] == crispr.display_name), None
        )
        assert crispr_row is not None and rnai_row is not None

        for row in crispr_row, rnai_row:
            print(row)
            assert set(row.keys()) == {"screen", "screenType", "modelsAndResults"}
            assert set(row["modelsAndResults"][0].keys()) == {
                "modelName",
                "modelCorrelation",
                "results",
            }
            assert len(row["modelsAndResults"][0]["results"]) == 2
            assert all(
                [
                    set(subrow["results"][0].keys())
                    == {
                        "featureName",
                        "featureImportance",
                        "correlation",
                        "featureType",
                        "relatedType",
                        "interactiveUrl",
                    }
                    for subrow in row["modelsAndResults"]
                ]
            )
