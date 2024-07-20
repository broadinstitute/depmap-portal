import pytest
from depmap.interactive.config.categories import (
    Category,
    CategoryConfig,
    MutationConfig,
    LineageConfig,
    MsiConfig,
)
from tests.factories import LineageFactory, CellLineFactory
from depmap.utilities import color_palette


def test_category():
    """
    Test that
        value, label, and legend label end up as expected when they are optional
        color ends up as expected
        test sort priority defaults to 0 and coerces to int
    """
    # test value, label, and legend label autofills
    value_cat = Category("test", color_num=0)
    assert value_cat.label == "test"
    assert value_cat.legend_label == "test"

    label_cat = Category("value", label="test", color_num=0)
    assert label_cat.value == "value"
    assert label_cat.label == "test"
    assert label_cat.legend_label == "test"

    legend_label_cat = Category(
        "value", label="label", legend_label="legend", color_num=0
    )
    assert legend_label_cat.value == "value"
    assert legend_label_cat.label == "label"
    assert legend_label_cat.legend_label == "legend"

    # label is not filled, but legend label is. label should be the value
    legend_label_no_label_cat = Category("value", legend_label="legend", color_num=0)
    assert legend_label_no_label_cat.label == "value"

    # test color
    with pytest.raises(AssertionError):
        Category("no color specified")

    assert Category("test", color_num=0).color == 0
    assert Category("test", hex_color="#aaa").color == "#aaa"

    # test sort priority
    assert Category("test", color_num=0).sort_priority == 0
    assert isinstance(
        Category("test", color_num=0, sort_priority=1.0).sort_priority, int
    )


def test_category_config():
    # we cant instantiate CategoryConfig(), so instantiate a subclass instead
    assert MutationConfig().get_na_category().sort_priority == -1


def test_mutation_config():
    """
    test that
        feature is replaced and appears in the legend label
    :return:
    """

    cat = MutationConfig().get_category("Other non-conserving", "SOX10")
    assert cat.legend_label == "SOX10 other non-conserving"
    assert cat.label == "Other non-conserving"


def test_lineage_config(empty_db_mock_downloads):
    """
    Test that
        each lineage gets a different color num
        the same lineage gets the same color, even as LineageConfig() is re-instantiated
        in the code it should only be instantiated once, but this is a stronger claim
    :return:
    """
    cell_line = CellLineFactory()
    lineages = LineageFactory.create_batch(20, cell_line=cell_line)
    empty_db_mock_downloads.session.flush()

    saved_config = LineageConfig()

    seen_numbers = set()
    for lineage in lineages:
        color_num = saved_config.get_category(lineage.name, "all").color
        assert color_num == LineageConfig().get_category(lineage.name, "all").color
        assert color_num not in seen_numbers
        seen_numbers.add(color_num)


@pytest.mark.parametrize(
    "value, feature, color, priority",
    [
        ("MSS", "CCLE (NGS)", color_palette.other_conserving_color, 0),
        ("MSI", "CCLE (NGS)", color_palette.damaging_color, 1),
        ("MSS/MSI-L", "GDSC (PCR)", color_palette.other_conserving_color, 0),
        ("MSI-H", "GDSC (PCR)", color_palette.damaging_color, 1),
    ],
)
def test_msi_config_get_category(value, feature, color, priority):
    cat = MsiConfig().get_category(value, feature)
    assert cat.color == color
    assert cat.sort_priority == priority


@pytest.mark.parametrize(
    "matrix_value, feature, return_value",
    [
        (0, "CCLE (NGS)", "unannotated"),
        (1, "CCLE (NGS)", "MSS"),
        (2, "CCLE (NGS)", "MSI"),
        (0, "GDSC (PCR)", "unannotated"),
        (1, "GDSC (PCR)", "MSS/MSI-L"),
        (2, "GDSC (PCR)", "MSI-H"),
    ],
)
def test_msi_map_value(matrix_value, feature, return_value):
    assert MsiConfig().map_value(matrix_value, feature) == return_value
