import pytest
import pandas as pd
from depmap.gene.views.executive import (
    format_dep_dist_and_enrichment_boxes,
    format_dep_dist_info,
    format_crispr_possible_missing_reason,
    plot_mutation_profile,
    format_enrichment_boxes,
    format_codependencies,
)
from depmap.dataset.models import DependencyDataset
from depmap.utilities import color_palette
from depmap.enums import DependencyEnum, BiomarkerEnum
from tests.factories import (
    GeneFactory,
    GeneExecutiveInfoFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    BiomarkerDatasetFactory,
    CellLineFactory,
    ContextFactory,
    ContextEnrichmentFactory,
)
from tests.depmap.utilities.test_svg_utils import assert_is_svg
from depmap.settings.settings import TestConfig
from tests.utilities.override_fixture import override


"""
        have crispr and rnai
        only crispr
        only rnai
        have rnai, no crispr, have crispr reason for the current default enum
        have rnai, no crispr, have crispr reason for the wrong crispr enum
        no rnai, no crispr, have crispr reason for the current default enum
        no rnai, no crispr, have crispr reason for the wrong crispr enum (should not show anything)
"""


@pytest.mark.parametrize(
    "has_chronos, has_rnai, is_dropped_by_chronos",
    [
        # no dropped by chronos
        (True, True, False),
        (True, False, False),
        (False, True, False),
        (False, False, False),
        # dropped by chronos, has rnai
        (False, True, True),
        # dropped by chronos, no datasets
        (False, False, True),
    ],
)
def test_format_dep_dist_and_enrichment_boxes_default_crispr_enum_chronos(
    empty_db_mock_downloads, has_chronos, has_rnai, is_dropped_by_chronos
):
    gene = GeneFactory()

    crispr_dataset = None
    rnai_dataset = None

    if has_chronos:
        crispr_dataset = DependencyDatasetFactory(
            matrix=MatrixFactory(
                entities=[gene], cell_lines=[CellLineFactory(), CellLineFactory()]
            ),
            name=DependencyEnum.Chronos_Combined,
            priority=1,
        )
        GeneExecutiveInfoFactory(
            gene=gene, dataset=DependencyEnum.Chronos_Combined,
        )

    if has_rnai:
        rnai_dataset = DependencyDatasetFactory(
            matrix=MatrixFactory(
                entities=[gene], cell_lines=[CellLineFactory(), CellLineFactory()]
            ),
            name=DependencyEnum.RNAi_merged,
            priority=1,
        )
        GeneExecutiveInfoFactory(
            gene=gene, dataset=DependencyEnum.RNAi_merged,
        )

    if is_dropped_by_chronos:
        DependencyDatasetFactory(
            matrix=MatrixFactory(),  # does not contain the gene
            name=DependencyEnum.Chronos_Combined,
            priority=1,
        )
        GeneExecutiveInfoFactory(
            gene=gene,
            dataset=DependencyEnum.Chronos_Combined,
            is_dropped_by_chronos=True,
        )

    empty_db_mock_downloads.session.flush()

    dep_dist, enrichment_boxes = format_dep_dist_and_enrichment_boxes(
        gene, crispr_dataset=crispr_dataset, rnai_dataset=rnai_dataset
    )
    if has_chronos or has_rnai:
        assert enrichment_boxes is not None
        assert "svg" in dep_dist
    else:
        assert enrichment_boxes is None
        if not is_dropped_by_chronos:
            assert not dep_dist  # dep_dist gates whether the card shows at all
        else:
            assert "svg" not in dep_dist

    if has_chronos or is_dropped_by_chronos:
        assert "crispr" in dep_dist["info"]
    else:
        assert (
            not dep_dist or "info" not in dep_dist or "crispr" not in dep_dist["info"]
        )

    if has_rnai:
        assert "rnai" in dep_dist["info"]
    else:
        assert not dep_dist or "info" not in dep_dist or "rnai" not in dep_dist["info"]

    if is_dropped_by_chronos:
        assert "should_show_dropped_by_chronos" in dep_dist["info"]["crispr"]
    else:
        assert (
            not dep_dist
            or "info" not in dep_dist
            or "crispr" not in dep_dist["info"]
            or "should_show_dropped_by_chronos" not in dep_dist["info"]["crispr"]
        )


@pytest.mark.parametrize(
    "has_avana, has_rnai", [(True, True), (False, True), (True, False), (False, False)],
)
def test_format_dep_dist_and_enrichment_boxes_default_crispr_enum_not_chronos(
    empty_db_mock_downloads, has_avana, has_rnai
):
    """
    Load dropped by chronos for every test
    Should never show dropped by chronos
    """
    gene = GeneFactory()

    crispr_dataset = None
    rnai_dataset = None

    DependencyDatasetFactory(
        matrix=MatrixFactory(),  # does not contain the gene
        name=DependencyEnum.Chronos_Combined,
    )

    if has_avana:
        crispr_dataset = DependencyDatasetFactory(
            matrix=MatrixFactory(
                entities=[gene], cell_lines=[CellLineFactory(), CellLineFactory()]
            ),
            name=DependencyEnum.Avana,
            priority=1,
        )
        GeneExecutiveInfoFactory(
            gene=gene, dataset=DependencyEnum.Avana, is_dropped_by_chronos=True,
        )
    else:
        GeneExecutiveInfoFactory(
            gene=gene,
            dataset=DependencyEnum.Chronos_Combined,
            is_dropped_by_chronos=True,
        )

    if has_rnai:
        rnai_dataset = DependencyDatasetFactory(
            matrix=MatrixFactory(
                entities=[gene], cell_lines=[CellLineFactory(), CellLineFactory()]
            ),
            name=DependencyEnum.RNAi_merged,
            priority=1,
        )
        GeneExecutiveInfoFactory(
            gene=gene, dataset=DependencyEnum.RNAi_merged,
        )

    empty_db_mock_downloads.session.flush()

    dep_dist, enrichment_boxes = format_dep_dist_and_enrichment_boxes(
        gene, crispr_dataset=crispr_dataset, rnai_dataset=rnai_dataset
    )
    if has_avana or has_rnai:
        assert enrichment_boxes is not None
        assert "svg" in dep_dist
    else:
        assert enrichment_boxes is None
        assert not dep_dist  # dep_dist gates whether the card shows at all

    if has_avana:
        assert "crispr" in dep_dist["info"]
    else:
        assert (
            not dep_dist or "info" not in dep_dist or "crispr" not in dep_dist["info"]
        )

    if has_rnai:
        assert "rnai" in dep_dist["info"]
    else:
        assert not dep_dist or "info" not in dep_dist or "rnai" not in dep_dist["info"]

    # never show dropped by chronos
    assert (
        not dep_dist
        or "info" not in dep_dist
        or "crispr" not in dep_dist["info"]
        or "should_show_dropped_by_chronos" not in dep_dist["info"]["crispr"]
    )


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


def test_format_enrichment_boxes(empty_db_mock_downloads):
    """
    Test that negative t_statistic enrichments are filtered out
    """
    cell_line_A = CellLineFactory(cell_line_name="cell_line_A")
    cell_line_B = CellLineFactory(cell_line_name="cell_line_B")

    context_A = ContextFactory(name="context_A", cell_line=[cell_line_A])
    context_B = ContextFactory(name="context_B", cell_line=[cell_line_B])
    entity = GeneFactory()

    matrix = MatrixFactory(entities=[entity], cell_lines=[cell_line_A, cell_line_B])
    dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana, matrix=matrix
    )

    ContextEnrichmentFactory(
        context=context_A, entity=entity, dataset=dataset, t_statistic=1
    )
    ContextEnrichmentFactory(
        context=context_B, entity=entity, dataset=dataset, t_statistic=-1
    )

    empty_db_mock_downloads.session.flush()

    enrichment_boxes = format_enrichment_boxes(entity, dataset, None)

    assert len(enrichment_boxes) == 1  # only one dataset
    assert (
        len(enrichment_boxes[0]["labels"]) == 2
    )  # test that no enrichment was filtered out
    assert enrichment_boxes[0]["units"] == dataset.matrix.units
    assert enrichment_boxes[0]["color"] == color_palette.crispr_color
    assert enrichment_boxes[0]["title_color"] == color_palette.crispr_color
    assert enrichment_boxes[0]["title"] == dataset.display_name


def test_plot_mutation_profile():
    "Test we can generate svg plot without getting an exception"
    svg = plot_mutation_profile([["Silent", 10], ["Frame_Shift_Ins", 5]])
    assert_is_svg(svg)


from tests.factories import CorrelationFactory


def test_format_codependencies(empty_db_mock_downloads, tmpdir):
    gene1 = GeneFactory(label="G1")
    gene2 = GeneFactory(label="G2")
    matrix = MatrixFactory(entities=[gene1, gene2])
    dataset = DependencyDatasetFactory(
        display_name="test display name",
        name=DependencyDataset.DependencyEnum.Chronos_Combined,
        matrix=matrix,
        priority=1,
    )

    CorrelationFactory(
        dataset, dataset, str(tmpdir.join("cor")), cor_values=[[1.0, None], [0.5, 1.0]]
    )

    empty_db_mock_downloads.session.flush()

    tables = format_codependencies("G1")
    assert len(tables) == 1
    assert tables[0].dataset_name == "Chronos_Combined"
    assert tables[0].dataset_display_name == "test display name"
    assert len(tables[0].entries) == 1
    entry = tables[0].entries[0]
    assert entry.label == "G2"
    assert entry.correlation == 0.5
