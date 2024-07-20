from breadbox_client.models import AddDimensionTypeAxis, AnnotationType
from breadbox_facade.client import BBClient, ColumnMetadata
from breadbox_facade.exceptions import BreadboxException

# defining a few constants to make it more concise to refer to types for columns
COL_TYPE_TEXT = AnnotationType.TEXT
COL_TYPE_CONTINUOUS = AnnotationType.CONTINUOUS
LIST_STRINGS = AnnotationType.LIST_STRINGS

AXIS_FEATURE = AddDimensionTypeAxis.FEATURE
AXIS_SAMPLE = AddDimensionTypeAxis.SAMPLE
