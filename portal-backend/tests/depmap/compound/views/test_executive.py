from depmap import data_access
from depmap.compound.models import Compound, CompoundExperiment
from depmap.compound.views.executive import (
    determine_compound_experiment_and_dataset,
    format_availability_tile,
    format_dep_dist,
    format_top_corr_table,
)
from depmap.context_explorer.models import ContextAnalysis
from depmap.dataset.models import DependencyDataset
from depmap.enums import BiomarkerEnum
from tests.depmap.utilities.test_svg_utils import assert_is_svg
from tests.factories import (
    BiomarkerDatasetFactory,
    CompoundExperimentFactory,
    CompoundFactory,
    SubtypeContextFactory,
    ContextAnalysisFactory,
    CorrelationFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    GeneFactory,
    MatrixFactory,
    SubtypeNodeFactory,
)
from tests.utilities import interactive_test_utils


def test_format_dep_dist(empty_db_mock_downloads):
    """
    test that
        one element for every compound experiment, dataset
        expected keys in every element
    """
    compound_experiment_1 = CompoundExperimentFactory()
    compound_experiment_2 = CompoundExperimentFactory()

    assert isinstance(compound_experiment_1, CompoundExperiment)
    assert isinstance(compound_experiment_2, CompoundExperiment)

    # multiple cell lines so can plot distplot
    matrix = MatrixFactory(
        [compound_experiment_1, compound_experiment_2],
        [DepmapModelFactory(), DepmapModelFactory()],
        using_depmap_model_table=True,
    )
    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_AUC, matrix=matrix
    )
    dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.CTRP_AUC, matrix=matrix
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    top_priority_dataset = data_access.get_matrix_dataset(dataset_1.name.name)

    dep_dist = format_dep_dist(
        compound_experiment_1.compound, top_priority_dataset
    )  # pyright: ignore

    assert dep_dist.keys() == {"svg", "title", "units", "num_lines", "color"}
    assert dep_dist["num_lines"] == 2
    assert_is_svg(dep_dist["svg"])


def test_format_top_corr_table(tmpdir, empty_db_mock_downloads):
    gene = GeneFactory(label="G")
    compound_experiment = CompoundExperimentFactory(label="C")

    matrix = MatrixFactory(entities=[compound_experiment])
    dataset = DependencyDatasetFactory(
        display_name="avana", name=DependencyDataset.DependencyEnum.Avana, matrix=matrix
    )

    expr_matrix = MatrixFactory(entities=[gene])
    expression_dataset = BiomarkerDatasetFactory(
        name=BiomarkerEnum.expression, matrix=expr_matrix
    )
    CorrelationFactory(
        expression_dataset,
        dataset,
        str(tmpdir.join("cors.sqlite3")),
        cor_values=[[0.5]],
    )

    empty_db_mock_downloads.session.flush()

    table = format_top_corr_table([(compound_experiment, dataset)])
    assert len(table) == 1
    entry = table[0]
    assert (
        entry["interactive_url"]
        == "/data_explorer_2/?xDataset=Avana&xFeature=C&yDataset=expression&yFeature=G"
    )
    assert entry["gene_url"] == "/gene/G"
    assert entry["correlation"] == 0.5
    assert entry["gene_symbol"] == "G"


def test_format_availability_tile(empty_db_mock_downloads):
    compound: Compound = CompoundFactory()  # pyright: ignore
    compound_experiment_1 = CompoundExperimentFactory(
        label="exp_label_1", compound=compound
    )
    compound_experiment_2 = CompoundExperimentFactory(
        label="exp_label_2", compound=compound
    )

    models = [DepmapModelFactory() for _ in range(3)]

    matrix_1 = MatrixFactory(
        entities=[compound_experiment_1],
        cell_lines=models,
        using_depmap_model_table=True,
    )
    matrix_2 = MatrixFactory(
        entities=[compound_experiment_2],
        cell_lines=models,
        using_depmap_model_table=True,
    )

    DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_AUC, matrix=matrix_1
    )
    DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.CTRP_AUC, matrix=matrix_2
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    expected = [
        {
            "dataset_name": "CTRP",
            "dose_range": "1nM - 10μM",
            "assay": "CellTitreGlo",
            "cell_lines": 3,
            "dataset_url": "/download/all/?release=test+name+version&file=test+file+name+2",
        },
        {
            "dataset_name": "GDSC1",
            "dose_range": "1nM - 10μM",
            "assay": "Resazurin or Syto60",
            "cell_lines": 3,
            "dataset_url": "/download/all/?release=test+name+version&file=test+file+name+2",
        },
    ]
    availability = format_availability_tile(compound)

    assert expected == availability


def test_determine_compound_experiment_and_dataset(empty_db_mock_downloads):
    """
    test that the compound experiment and dataset is returned given the ranking provided
    Currently: OncRef > Repurposing Secondary > Rep All Single Pt > Others
    """
    compound_experiment_1 = CompoundExperimentFactory()
    compound_experiment_2 = CompoundExperimentFactory()
    # multiple cell lines so can plot distplot
    matrix = MatrixFactory(
        [compound_experiment_1, compound_experiment_2],
        [DepmapModelFactory(), DepmapModelFactory()],
        using_depmap_model_table=True,
    )
    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Rep_all_single_pt, matrix=matrix
    )
    dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Prism_oncology_AUC, matrix=matrix
    )
    compound_experiment_and_datasets = [
        (compound_experiment_1, dataset_1),
        (compound_experiment_2, dataset_1),
        (compound_experiment_1, dataset_2),
        (compound_experiment_2, dataset_2),
    ]
    empty_db_mock_downloads.session.flush()
    assert determine_compound_experiment_and_dataset(
        compound_experiment_and_datasets
    ) == [[compound_experiment_1, dataset_2]]
