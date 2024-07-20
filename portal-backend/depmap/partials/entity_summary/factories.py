from depmap.enums import DatasetEnum
from depmap.partials.entity_summary.models import EntitySummary

"""
This is a little different from factories for other partials, since there is only one 'type' of gene summary
There is no registering of factories etc.
Really, this just exists to provide a common api/contract for using partials
"""


def get_entity_summary(entity, dep_enum_name, size_biom_enum, color):
    enum = DatasetEnum.get_enum_from_enum_name(dep_enum_name)
    summary = EntitySummary(entity, enum, size_biom_enum, color)
    return summary


def get_entity_summary_for_view(entity, dep_enum_name, size_biom_enum, color):
    return get_entity_summary(
        entity, dep_enum_name, size_biom_enum, color
    ).data_for_ajax_partial()
