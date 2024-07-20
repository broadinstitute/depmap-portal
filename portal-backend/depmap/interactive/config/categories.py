from abc import ABC, abstractmethod
from depmap.context.models import Context
from depmap.cell_line.models import (
    Lineage,
    PrimaryDisease,
    DiseaseSubtype,
    TumorType,
    CellLine,
    get_all_entities_and_indices_for_model,
)
from depmap.utilities import color_palette


class Category:
    def __init__(
        self,
        value,
        label=None,
        legend_label=None,
        color_num=None,  # this or hex color must be specified
        hex_color=None,
        sort_priority=None,
    ):
        """

        :param value: as returned by get_row_of_values
        :param label: optional. in many cases, this is fine being the same as value
            where we do need a separate field, is where the value needs to be preserved, non-capitalized string in order to use as the primary key to retrieve a database object
            e.g., for Lineage
                value remains the lowercase because it is:
                    - used to call get_category
                    - could be used retrieve a Lineage object
                    - used to resolve color number
            Thus, though it may seem tempting, get_row_of_values cannot return the display name. It needs to return a more underlying, primary-key-esqua value, so that we can further retrieve more metadata like color
        :param legend_label: if present, it will be used instead of label in data explorer
            legend_label exists due to different needs for the label of a categorical value.
            E.g., let's assume we want the tract for mutation in SOX10.
                Cell line selector wants the groups to just be "damaging", "hotspot", etc., since it populates rows where the column would be labelled "SOX10 mutation"
                Data explorer wants the groups to be labelled "SOX10 damaging", "SOX10 hotspot", etc.. Since it populates the plot legend, and we want the gene to be included in a screenshot of the plot
        :param color_num: an integer number translated into color by front end plain js code
        :param hex_color: a string representing a hex color
        :param sort_priority: provide if ordering of categories matter. -1 is least important and is used for the na value. defined (non-na) categories should start from 0
        """
        assert color_num is not None or hex_color is not None
        assert not (
            color_num and hex_color
        ), "The hex color takes precedent over the color num; it doesn't make sense to specify both"
        if hex_color is not None:
            assert hex_color.startswith("#")

        self.value = value
        actual_label = label if label else value
        self.label = actual_label
        self.legend_label = legend_label if legend_label else actual_label
        self._color_num = color_num
        self._hex_color = hex_color
        self.sort_priority = int(sort_priority) if sort_priority else 0

    @property
    def color(self):
        if self._hex_color:
            return self._hex_color
        else:
            return int(self._color_num)


class CategoryConfig(ABC):
    def get_category(self, value, feature) -> Category:
        """
        Wrapper around get_non_na_category, so that we always implement the case where value == the na value
        """
        if value == self.get_na_category().value:
            return self.get_na_category()
        return self.get_non_na_category(value, feature)

    def _get_na_value(self):
        """
        This is exposed so that it may be overriden in a subclass, if you need something more specific
        :return:
        """
        return "other"

    def _get_na_label(self):
        """
        Label is optional, defaults to value
        This is exposed so that it may be optionally overriden
        """
        return None

    def get_na_category(self):
        """
        Please override _get_na_value (and optionally _get_na_label) instead of overriding this
        This is written so that all na categories get color_num 0 and sort_priority 0
        """
        na_fill_category = Category(
            value=self._get_na_value(),
            label=self._get_na_label(),
            color_num=0,
            sort_priority=-1,
        )
        return na_fill_category

    @abstractmethod
    def get_non_na_category(self, value, feature):
        """
        :param value: as returned from get_row_of_values
        :param feature: passed as a param to get_row_of_values. a subclass implementation need not use this
        :return: a Category object. the same value param should be passed into its constructor

        For some datasets, value is implemented in get_row_of_values to sometimes be the same as the feature label.
            e.g. Context
            In these cases, get_row_of_values returns a series where the only value is the same feature. feature and value are the same, feature provides no additional information, and feature does not need to be used.
        In other datasets, e.g. mutation, one runs
            series = get_row_of_values(mutation dataset, "SOX10")
            the values in the series are "hotspot" or "damaging" etc, as returned by that function
            and the feature is "SOX10"

            This feature is thus sometimes different, and is sometimes needed to construct the label
        """
        raise NotImplementedError


class ContextConfig(CategoryConfig):
    def get_non_na_category(self, value, feature):
        return Category(value=value, label=Context.get_display_name(value), color_num=1)


OTHER_CONSERVING_INDEX = 1
OTHER_NON_CONSERVING_INDEX = 2
DAMAGING_INDEX = 3
HOTSPOT_INDEX = 4


class MutationConfig(CategoryConfig):
    def _get_na_value(self):
        return "Other"

    def get_non_na_category(self, value, feature):
        # these are duplicately defined in color_utils.py, rna_mutations_color_num_to_category, using labels=True
        config = {
            "Other conserving": {
                "color": color_palette.other_conserving_color,
                "sort_priority": OTHER_CONSERVING_INDEX,
                "legend_label": "feature other conserving",
            },
            "Other non-conserving": {
                "color": color_palette.other_non_conserving_color,
                "sort_priority": OTHER_NON_CONSERVING_INDEX,
                "legend_label": "feature other non-conserving",
            },
            "Damaging": {
                "color": color_palette.damaging_color,
                "sort_priority": DAMAGING_INDEX,
                "legend_label": "feature damaging",
            },
            "Hotspot": {
                "color": color_palette.hotspot_color,
                "sort_priority": HOTSPOT_INDEX,
                "legend_label": "feature hotspot",
            },
        }
        return Category(
            value,
            legend_label=config[value]["legend_label"].replace("feature", feature),
            hex_color=config[value]["color"],
            sort_priority=config[value]["sort_priority"],
        )


class MutationsPrioritizedConfig(CategoryConfig):
    def _get_na_value(self):
        return "Other"

    def get_non_na_category(self, value, feature):
        # these are duplicate from MutationConfig. Not sure if used
        config = {
            "Other conserving": {
                "color": color_palette.other_conserving_color,
                "sort_priority": OTHER_CONSERVING_INDEX,
                "legend_label": "feature other conserving",
            },
            "Other non-conserving": {
                "color": color_palette.other_non_conserving_color,
                "sort_priority": OTHER_NON_CONSERVING_INDEX,
                "legend_label": "feature other non-conserving",
            },
            "Damaging": {
                "color": color_palette.damaging_color,
                "sort_priority": DAMAGING_INDEX,
                "legend_label": "feature damaging",
            },
            "Hotspot": {
                "color": color_palette.hotspot_color,
                "sort_priority": HOTSPOT_INDEX,
                "legend_label": "feature hotspot",
            },
        }
        return Category(
            value,
            legend_label=config[value]["legend_label"].replace("feature", feature),
            hex_color=config[value]["color"],
            sort_priority=config[value]["sort_priority"],
        )

    def map_value(self, value, feature):
        """
        Defined for mutations prioritized matrix. 
        Duplicated in rna_mutations_color_num_to_category (deprecated & unused)

        :param value: number in the matrix (0,1,2,3,4)
        :param feature: "SOX10"
        :return: "Other", "Other conserving", "Other non-conserving", "Damaging", or "Hotspot"
        """
        if value == HOTSPOT_INDEX:
            return "Hotspot"
        elif value == DAMAGING_INDEX:
            return "Damaging"
        elif value == OTHER_NON_CONSERVING_INDEX:
            return "Other non-conserving"
        elif value == OTHER_CONSERVING_INDEX:
            return "Other conserving"
        else:
            # the underlying thing is a matrix, where the holes are 0s
            return self.get_na_category().value


class CategoricalSingletonConfig(CategoryConfig):
    def __init__(self, type):
        cat_to_num = {}
        all_ids = {}
        assert type in [
            "Primary Disease",
            "Disease Subtype",
            "Tumor Type",
            "Gender",
            "Growth Pattern",
        ]
        if type == "Primary Disease":
            all_ids = get_all_entities_and_indices_for_model(PrimaryDisease)
        elif type == "Disease Subtype":
            all_ids = get_all_entities_and_indices_for_model(DiseaseSubtype)
        elif type == "Tumor Type":
            all_ids = get_all_entities_and_indices_for_model(TumorType)
        elif type == "Gender":
            all_ids = CellLine.get_all_genders()
        elif type == "Growth Pattern":
            all_ids = CellLine.get_all_growth_patterns()

        for cat, num in all_ids:
            assert num != 0
            cat_to_num[cat] = num

        self.cat_to_num = cat_to_num

    def _get_na_value(self):
        return "No data on cell line"

    def get_non_na_category(self, value, feature):
        return Category(value, label=value, color_num=self.cat_to_num[value])


class LineageConfig(CategoryConfig):
    def __init__(self):
        levels = ["1", "2", "3", "5", "6"]
        lineage_to_num = {}
        for level in levels:
            lineage_to_num[level] = {}
            for lineage, num in Lineage.get_lineage_ids_by_level(level):
                assert num != 0
                lineage_to_num[level][lineage] = num
        self.lineage_to_num = lineage_to_num

    def _get_na_value(self):
        return "No data on cell line"

    def get_non_na_category(self, value, feature):
        feat = feature
        if feature == "all":
            feat = "1"
        return Category(
            value,
            label=Lineage.get_display_name(value),
            color_num=self.lineage_to_num[feat][value],
        )


class CustomCellLinesConfig(CategoryConfig):
    """
    These group names make use of the nature by which we use custom cell line groups to color, which is currently only for two class comparison.
    This is an assumption that does not hold for any futher, other, use cases of custom cell line groups
    """

    def _get_na_value(self):
        return 0

    def _get_na_label(self):
        return "out group"

    def get_non_na_category(self, value, feature):
        return Category(value, label="in group", color_num=1)


class MsiConfig(CategoryConfig):
    def _get_na_value(self):
        # value is encoded in the pulling matrix as 0
        return "unannotated"

    def get_non_na_category(self, value, feature):
        """
        defined for taiga dataset msi-0584.6
        get_row_of_values handles converting the matrix's numeric encoding to strings
        """

        if "CCLE" in feature:
            config = {
                "MSS": {
                    "color": color_palette.other_conserving_color,
                    "sort_priority": 0,
                },
                "MSI": {"color": color_palette.damaging_color, "sort_priority": 1},
            }
            legend_label = "CCLE {}".format(value)
        else:
            assert "GDSC" in feature
            config = {
                "MSS/MSI-L": {
                    "color": color_palette.other_conserving_color,
                    "sort_priority": 0,
                },
                "MSI-H": {"color": color_palette.damaging_color, "sort_priority": 1},
            }
            legend_label = "GDSC {}".format(value)

        return Category(
            value,
            legend_label=legend_label,
            hex_color=config[value]["color"],
            sort_priority=config[value]["sort_priority"],
        )

    def map_value(self, value, feature):
        """
        defined for taiga dataset msi-0584.6
            For CCLE, 1 means "CCLE MSS" and 2 means "CCLE MSI"
            For GDSC, 1 means "GDSC MSS/MSI-L" and 2 means "GDSC MSI-H"

        :param value: number in the matrix, 1 or 2
        :param feature: "CCLE (NGS)" or "GDSC (PCR)"
        :return: "MSS", "MSI", "MSS/MSI-L" or "MSI-H"

        """
        if value == 0.0:
            # the underlying thing is a matrix, where the holes are 0s
            return self.get_na_category().value

        if "CCLE" in feature:
            return {1.0: "MSS", 2.0: "MSI"}[value]
        else:
            assert "GDSC" in feature
            return {1.0: "MSS/MSI-L", 2.0: "MSI-H"}[value]


prism_pool_label_to_value = {
    "P101": 1.0,
    "P102": 2.0,
    "P103": 3.0,
    "P104": 4.0,
    "P105": 5.0,
    "P106": 6.0,
    "P107": 7.0,
    "P108": 8.0,
    "P109": 9.0,
    "P110": 10.0,
    "P111": 11.0,
    "P112": 12.0,
    "P113": 13.0,
    "P114": 14.0,
    "P115": 15.0,
    "P116": 16.0,
    "P117": 17.0,
    "P118": 18.0,
    "P119": 19.0,
    "P120": 20.0,
    "P121": 21.0,
    "P122": 22.0,
    "P123": 23.0,
    "P124": 24.0,
    "P125": 25.0,
    "P126": 26.0,
    "P944.3": 27.0,
    "P945.2": 28.0,
    "P946.2": 29.0,
    "P947": 30.0,
    "P948.2": 31.0,
    "P949.2": 32.0,
    "P950": 33.0,
    "P951": 34.0,
    "P952": 35.0,
    "P953": 36.0,
    "P954": 37.0,
    "P955": 38.0,
    "P956": 39.0,
    "PR300P": 40.0,
    "PR500": 41.0,
}
prism_pool_value_to_label = {v: k for k, v in prism_pool_label_to_value.items()}
prism_pool_config = {
    k: {"color": color_palette.other_conserving_color, "sort_priority": i,}
    for i, k in enumerate(sorted(prism_pool_label_to_value.keys()))
}


class PrismPoolConfig(CategoryConfig):
    def _get_na_value(self):
        # value is encoded in the pulling matrix as 0
        return "unannotated"

    def get_non_na_category(self, value, feature):
        """
        defined for taiga dataset prism-pools-4441
        get_row_of_values handles converting the matrix's numeric encoding to strings
        """

        if "cell_line_set" in feature:
            legend_label = "cell_line_set {}".format(value)
        else:
            assert "pool_id" in feature
            legend_label = "pool_id {}".format(value)

        return Category(
            value,
            legend_label=legend_label,
            hex_color=prism_pool_config[value]["color"],
            sort_priority=prism_pool_config[value]["sort_priority"],
        )

    def map_value(self, value, feature):
        """
        defined for taiga dataset prism-pools-4441

        :param value: number in the matrix, 1 or 2
        :param feature: column name in table
        :return: label for value

        """
        if value == 0.0:
            # the underlying thing is a matrix, where the holes are 0s
            return self.get_na_category().value

        return prism_pool_value_to_label[value]


# Weird workaround needed to support private datasets with entities in DE2
# (temporary until these datasets are moved to breadbox)
gene_datasets_with_entrez_labels = set(
    [
        # Methylation Expression Impact (Broad) [nonstandard_entity]
        "f325e2b0-3e1b-47cd-b1fb-66e8c8919638",
        # Methylation Expression Impact (Sanger) [nonstandard_entity]
        "2a8d18d2-0707-4b4c-9ceb-279d5592703a",
        # OmicsAbsoluteCNGene [nonstandard_entity]
        "8c5c677a-c3c0-4140-864a-edc113ecfc8b",
        # OmicsLoH [nonstandard_entity]
        "4ab1c78d-9f64-47a4-95f1-42d554fbc185",
    ]
)
