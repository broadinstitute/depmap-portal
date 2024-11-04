from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.feature_response_values import FeatureResponseValues


T = TypeVar("T", bound="FeatureResponse")


@_attrs_define
class FeatureResponse:
    """
    Attributes:
        dataset_id (str):
        dataset_label (str):
        feature_id (str):
        label (str):
        units (str):
        values (FeatureResponseValues):
    """

    dataset_id: str
    dataset_label: str
    feature_id: str
    label: str
    units: str
    values: "FeatureResponseValues"
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        dataset_id = self.dataset_id

        dataset_label = self.dataset_label

        feature_id = self.feature_id

        label = self.label

        units = self.units

        values = self.values.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "dataset_id": dataset_id,
                "dataset_label": dataset_label,
                "feature_id": feature_id,
                "label": label,
                "units": units,
                "values": values,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.feature_response_values import FeatureResponseValues

        d = src_dict.copy()
        dataset_id = d.pop("dataset_id")

        dataset_label = d.pop("dataset_label")

        feature_id = d.pop("feature_id")

        label = d.pop("label")

        units = d.pop("units")

        values = FeatureResponseValues.from_dict(d.pop("values"))

        feature_response = cls(
            dataset_id=dataset_id,
            dataset_label=dataset_label,
            feature_id=feature_id,
            label=label,
            units=units,
            values=values,
        )

        feature_response.additional_properties = d
        return feature_response

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
