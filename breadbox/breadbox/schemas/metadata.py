from typing import Any, List
from pydantic import BaseModel, field_validator
from ..models.dataset import AnnotationType


# Metadata associated with either sample or feature. Label can
# be feature_label (e.g. SOX10) or sample_id (e.g. ACH-00005).
# metadata is a list of names and values of metadata such as ensemble_id for
# this particular feature/sample, entrez_id, label, comments, etc.
class FormattedMetadata(BaseModel):
    given_id: str
    value: Any
    annotation_type: str

    @field_validator("annotation_type")
    def check_value_type_in_annotation_type(cls, annotation_type):
        assert annotation_type in [x.value for x in AnnotationType]
        return annotation_type


class MetadataResponse(BaseModel):
    label: str
    metadata: List[FormattedMetadata]
