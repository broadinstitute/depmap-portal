from depmap.context_explorer.models import ContextExplorerDatasets
import pytest
from depmap.gene.views.executive import (
    format_dep_dist_info,
    format_crispr_possible_missing_reason,
    get_dependency_distribution,
    plot_mutation_profile,
)
from depmap.dataset.models import DependencyDataset
from depmap.enums import DependencyEnum
from tests.factories import (
    ContextAnalysisFactory,
    DepmapModelFactory,
    GeneFactory,
    GeneExecutiveInfoFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    SubtypeContextFactory,
    SubtypeNodeFactory,
)
from tests.depmap.utilities.test_svg_utils import assert_is_svg
from depmap.settings.settings import TestConfig
from tests.utilities.override_fixture import override


def test_format_dep_dist_info(empty_db_mock_downloads):
    gene_1 = GeneFactory()
    gene_2 = GeneFactory()
    gene_3 = GeneFactory()
    GeneExecutiveInfoFactory(
        gene=gene_1, dataset=DependencyEnum.Avana, is_strongly_selective=True
    )
    GeneExecutiveInfoFactory(gene=gene_1, dataset=DependencyEnum.RNAi_merged)
    GeneExecutiveInfoFactory(
        gene=gene_2, dataset=DependencyEnum.Avana, is_strongly_selective=True
    )
    empty_db_mock_downloads.session.flush()

    crispr_dataset = DependencyDatasetFactory(
        name=DependencyEnum.Avana, matrix=MatrixFactory(entities=[gene_1, gene_2])
    )
    rnai_dataset = DependencyDatasetFactory(
        name=DependencyEnum.RNAi_merged, matrix=MatrixFactory(entities=[gene_1])
    )

    empty_db_mock_downloads.session.flush()

    crispr_expect = {
        "num_lines": "0/1",
        "is_common_essential": False,
        "is_strongly_selective": True,
        "display_name": crispr_dataset.display_name,
    }
    rnai_expect = {
        "num_lines": "0/1",
        "is_common_essential": False,
        "is_strongly_selective": False,
        "display_name": rnai_dataset.display_name,
    }

    assert format_dep_dist_info(gene_1, crispr_dataset, rnai_dataset) == {
        "crispr": crispr_expect,
        "rnai": rnai_expect,
    }

    assert format_dep_dist_info(gene_2, crispr_dataset, None) == {
        "crispr": crispr_expect
    }
    assert format_dep_dist_info(gene_3, None, None) == {}


def test_format_crispr_possible_missing_reason_not_chronos(empty_db_mock_downloads,):
    gene = GeneFactory()
    GeneExecutiveInfoFactory(
        gene=gene, dataset=DependencyEnum.Chronos_Combined, is_dropped_by_chronos=True,
    )

    # does not contain gene
    DependencyDatasetFactory(name=DependencyEnum.Avana, priority=1)
    DependencyDatasetFactory(name=DependencyEnum.Chronos_Combined, priority=2)

    empty_db_mock_downloads.session.flush()

    expected = None

    assert format_crispr_possible_missing_reason(gene) == expected


def test_format_crispr_possible_missing_reason_chronos(empty_db_mock_downloads,):
    gene = GeneFactory()
    GeneExecutiveInfoFactory(
        gene=gene, dataset=DependencyEnum.Chronos_Combined, is_dropped_by_chronos=True,
    )

    # does not contain gene
    default_crispr_dataset = DependencyDatasetFactory(
        name=DependencyEnum.Chronos_Combined, priority=1
    )

    empty_db_mock_downloads.session.flush()

    expected = {
        "should_show_dropped_by_chronos": True,
        "display_name": default_crispr_dataset.display_name,
    }

    assert format_crispr_possible_missing_reason(gene) == expected


def test_plot_mutation_profile():
    "Test we can generate svg plot without getting an exception"
    svg = plot_mutation_profile([["Silent", 10], ["Frame_Shift_Ins", 5]])
    assert_is_svg(svg)
