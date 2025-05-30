from flask import url_for
from depmap.enums import DependencyEnum, GeneTileEnum, CompoundTileEnum

from depmap.gene.models import Gene
from depmap.compound.models import Compound
from tests.factories import (
    CompoundExperimentFactory,
    CompoundFactory,
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    BiomarkerDatasetFactory,
    MatrixFactory,
    PredictiveFeatureFactory,
    PredictiveModelFactory,
    PredictiveFeatureResultFactory,
    PredictiveBackgroundFactory,
)
from tests.utilities.override_fixture import override
from depmap.dataset.models import DependencyDataset
from depmap.tile.views import render_tile
import pytest
import requests.exceptions


@pytest.mark.parametrize(
    "tile", [pytest.param(tile, id=tile.name) for tile in GeneTileEnum],
)
def test_render_gene_tiles(populated_db, tile, mock_cansar_client):
    """
    Test that the gene page for every gene in the db renders (tests templating)
    Checking all the genes is very important, and has helped catch cases where we don't handle genes that aren't in certain datasets
    Also tests tiles html are fetched
    """
    with populated_db.app.test_client() as c:
        for gene in Gene.query.all():
            try:
                html_res = c.get(
                    url_for(
                        "tile.render_tile",
                        subject_type="gene",
                        tile_name=tile.value,
                        identifier=gene.label,
                    )
                )

            except requests.exceptions.SSLError as e:
                if tile == GeneTileEnum.target_tractability:
                    print(
                        "Got an SSLError because cansar site cert expired. Check if this continues in future!"
                    )
                    # Hack until this is mocked out
                    break
                else:
                    raise
            except requests.exceptions.ConnectionError as e:
                if tile == GeneTileEnum.target_tractability:
                    # Hack until this is mocked out
                    break
                else:
                    raise
            except Exception as e:
                raise Exception("{} tile failed to render".format(tile.value)) from e
            assert html_res.status_code == 200
            r_json = html_res.get_json()
            print("tile: ", tile, "gene: ", gene)
            assert "html" in r_json
            if tile == GeneTileEnum.description:
                assert r_json["postRenderCallback"] is not None


def test_no_render_gene_tiles(populated_db):
    with populated_db.app.test_client() as c:
        gene = Gene.query.filter_by(label="SOX10").one_or_none()
        """
        Tests nonexistent tiles returns 400
        """
        non_tile = c.get(
            url_for(
                "tile.render_tile",
                subject_type="gene",
                tile_name="fake_tile",
                identifier=gene.label,
            )
        )
        assert non_tile.status_code == 400, non_tile.status_code
        """
        Test that nonexistent gene returns 400
        """
        non_subject = c.get(
            url_for(
                "tile.render_tile",
                subject_type="notgene",
                tile_name="predictability",
                identifier=gene.label,
            )
        )
        assert non_subject.status_code == 400, non_subject.status_code
        """
        Test that nonexistent gene returns 404
        """
        non_identifier = c.get(
            url_for(
                "tile.render_tile",
                subject_type="gene",
                tile_name="predictability",
                identifier="something",
            )
        )
        assert non_identifier.status_code == 404, non_identifier.status_code


def test_render_predictability_tile(app, empty_db_mock_downloads):
    gene = GeneFactory(label="SOX10")
    dataset = DependencyDatasetFactory(
        name=DependencyEnum.Chronos_Combined,
        matrix=MatrixFactory(entities=[gene]),
        priority=1,
    )
    dataset_model = PredictiveModelFactory(
        dataset=dataset, entity=gene, pearson=10, label="model_1"
    )
    predictive_feature = PredictiveFeatureFactory(
        dataset_id=BiomarkerDatasetFactory().name.value
    )
    PredictiveFeatureResultFactory(
        predictive_model=dataset_model,
        feature=predictive_feature,
        rank=0,
        importance=0.5,
    )
    PredictiveBackgroundFactory(dataset=dataset)

    empty_db_mock_downloads.session.flush()

    with app.test_client() as c:
        r = c.get(
            url_for(
                "tile.render_tile",
                subject_type="gene",
                tile_name="predictability",
                identifier=gene.label,
            )
        )
        r_json = r.get_json()
        assert r.status_code == 200
        assert "html" in r_json
        assert r_json["html"] != ""


def test_render_predictability_tile_for_compound_dataset(app, empty_db_mock_downloads):
    compound1 = CompoundFactory(label="Compound 1")
    compound2 = CompoundFactory(label="Compound 2")
    compound_experiment1 = CompoundExperimentFactory(compound=compound1)
    compound_experiment2 = CompoundExperimentFactory(compound=compound2)
    non_existing_compound = CompoundFactory(label="fake")

    rep_all_single_pt_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Rep_all_single_pt,
        matrix=MatrixFactory(entities=[compound_experiment1]),
        priority=1,
    )
    oncref_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Prism_oncology_AUC,
        matrix=MatrixFactory(entities=[compound_experiment1, compound_experiment2]),
        priority=None,
    )

    rep_all_single_pt_dataset_model = PredictiveModelFactory(
        dataset=rep_all_single_pt_dataset,
        entity=compound_experiment1,
        pearson=10,
        label="Core_omics",
    )
    oncref_dataset_model1 = PredictiveModelFactory(
        dataset=oncref_dataset,
        entity=compound_experiment1,
        pearson=10,
        label="Core_omics",
    )
    oncref_dataset_model2 = PredictiveModelFactory(
        dataset=oncref_dataset,
        entity=compound_experiment2,
        pearson=10,
        label="Core_omics",
    )

    predictive_feature = PredictiveFeatureFactory(
        dataset_id=BiomarkerDatasetFactory().name.value
    )

    PredictiveFeatureResultFactory(
        predictive_model=rep_all_single_pt_dataset_model,
        feature=predictive_feature,
        rank=0,
        importance=0.5,
    )
    PredictiveFeatureResultFactory(
        predictive_model=oncref_dataset_model1,
        feature=predictive_feature,
        rank=0,
        importance=0.5,
    )
    PredictiveFeatureResultFactory(
        predictive_model=oncref_dataset_model2,
        feature=predictive_feature,
        rank=0,
        importance=0.5,
    )

    PredictiveBackgroundFactory(dataset=rep_all_single_pt_dataset)
    PredictiveBackgroundFactory(dataset=oncref_dataset)

    empty_db_mock_downloads.session.flush()

    with app.test_client() as c:
        # Tile should render if data for compound exists
        # Data exists for compound 1 in rep_all_single_pt
        r_show_compound1_tile = c.get(
            url_for(
                "tile.render_tile",
                subject_type="compound",
                tile_name="predictability",
                identifier=compound1.label,
            )
        )
        r_show_compound1_tile_json = r_show_compound1_tile.get_json()
        assert r_show_compound1_tile.status_code == 200
        assert "html" in r_show_compound1_tile_json
        assert r_show_compound1_tile_json["html"] != ""
        # Data exists for compund 2 for only oncref
        r_show_compound2_tile = c.get(
            url_for(
                "tile.render_tile",
                subject_type="compound",
                tile_name="predictability",
                identifier=compound2.label,
            )
        )
        r_show_compound2_tile_json = r_show_compound2_tile.get_json()
        assert r_show_compound2_tile.status_code == 200
        assert "html" in r_show_compound2_tile_json
        assert r_show_compound2_tile_json["html"] != ""

        # Tile should not render if no data for compound exists
        r_no_show_tile = c.get(
            url_for(
                "tile.render_tile",
                subject_type="compound",
                tile_name="predictability",
                identifier=non_existing_compound.label,
            )
        )
        r_no_show_tile_json = r_no_show_tile.get_json()
        assert r_no_show_tile.status_code == 200
        assert "html" in r_no_show_tile_json
        assert r_no_show_tile_json["html"] == ""


def test_render_description_tile(app, empty_db_mock_downloads):
    gene = GeneFactory(label="SOX10")
    empty_db_mock_downloads.session.flush()

    with app.test_client() as c:
        r = c.get(
            url_for(
                "tile.render_tile",
                subject_type="gene",
                tile_name="description",
                identifier=gene.label,
            )
        )
        r_json = r.get_json()
        assert r.status_code == 200
        assert "html" in r_json
        assert r_json["html"]
        assert r_json["postRenderCallback"] is not None
        assert (
            '(function() {getAbout("' + str(gene.entrez_id) + '")})'
            in r_json["postRenderCallback"]
        )


def test_render_targeting_compounds_tile(app, empty_db_mock_downloads):
    gene = GeneFactory(label="NRAS")
    compound = CompoundFactory(
        label="lonafarnib",
        target_or_mechanism="farnesyltransferase inhibitor",
        target_gene=[gene],
    )
    empty_db_mock_downloads.session.flush()

    with app.test_client() as c:
        r = c.get(
            url_for(
                "tile.render_tile",
                subject_type="gene",
                tile_name="targeting_compounds",
                identifier=gene.label,
            )
        )
        r_json = r.get_json()
        assert r.status_code == 200
        assert "html" in r_json

        # html should be present and not empty
        assert r_json["html"] != ""


def test_no_show_targeting_compounds_tile(app, empty_db_mock_downloads):
    gene = GeneFactory(label="NRAS")

    empty_db_mock_downloads.session.flush()

    with app.test_client() as c:
        r = c.get(
            url_for(
                "tile.render_tile",
                subject_type="gene",
                tile_name="targeting_compounds",
                identifier=gene.label,
            )
        )
        r_json = r.get_json()
        assert r.status_code == 200
        assert "html" in r_json
        assert r_json["html"] == ""


@pytest.mark.parametrize(
    "tile", [pytest.param(tile, id=tile.name) for tile in CompoundTileEnum],
)
def test_render_compound_tiles(populated_db, tile):
    """
    Test that the compound page for every compound in the db renders (tests templating)
    Also tests tiles html are fetched
    """
    with populated_db.app.test_client() as c:
        for compound in Compound.query.all():
            try:
                html_res = c.get(
                    url_for(
                        "tile.render_tile",
                        subject_type="compound",
                        tile_name=tile.value,
                        identifier=compound.label,
                    )
                )
            except Exception as e:
                raise Exception("{} tile failed to render".format(tile.value)) from e
            assert html_res.status_code == 200
            r_json = html_res.get_json()
            assert "html" in r_json
