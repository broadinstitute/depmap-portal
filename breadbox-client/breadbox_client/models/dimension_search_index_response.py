from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    List,
    Type,
    TypeVar,
    Union,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.dimension_search_index_response_matching_properties_item import (
        DimensionSearchIndexResponseMatchingPropertiesItem,
    )
    from ..models.name_and_id import NameAndID


T = TypeVar("T", bound="DimensionSearchIndexResponse")


@_attrs_define
class DimensionSearchIndexResponse:
    """
    Attributes:
        id (str):
        label (str):
        matching_properties (List['DimensionSearchIndexResponseMatchingPropertiesItem']):
        referenced_by (Union[List['NameAndID'], None]):
        type_name (str):
    """

    id: str
    label: str
    matching_properties: List["DimensionSearchIndexResponseMatchingPropertiesItem"]
    referenced_by: Union[List["NameAndID"], None]
    type_name: str
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        id = self.id

        label = self.label

        matching_properties = []
        for matching_properties_item_data in self.matching_properties:
            matching_properties_item = matching_properties_item_data.to_dict()
            matching_properties.append(matching_properties_item)

        referenced_by: Union[List[Dict[str, Any]], None]
        if isinstance(self.referenced_by, list):
            referenced_by = []
            for referenced_by_type_0_item_data in self.referenced_by:
                referenced_by_type_0_item = referenced_by_type_0_item_data.to_dict()
                referenced_by.append(referenced_by_type_0_item)

        else:
            referenced_by = self.referenced_by

        type_name = self.type_name

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "label": label,
                "matching_properties": matching_properties,
                "referenced_by": referenced_by,
                "type_name": type_name,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.dimension_search_index_response_matching_properties_item import (
            DimensionSearchIndexResponseMatchingPropertiesItem,
        )
        from ..models.name_and_id import NameAndID

        d = src_dict.copy()
        id = d.pop("id")

        label = d.pop("label")

        matching_properties = []
        _matching_properties = d.pop("matching_properties")
        for matching_properties_item_data in _matching_properties:
            matching_properties_item = (
                DimensionSearchIndexResponseMatchingPropertiesItem.from_dict(
                    matching_properties_item_data
                )
            )

            matching_properties.append(matching_properties_item)

        def _parse_referenced_by(data: object) -> Union[List["NameAndID"], None]:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                referenced_by_type_0 = []
                _referenced_by_type_0 = data
                for referenced_by_type_0_item_data in _referenced_by_type_0:
                    referenced_by_type_0_item = NameAndID.from_dict(
                        referenced_by_type_0_item_data
                    )

                    referenced_by_type_0.append(referenced_by_type_0_item)

                return referenced_by_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List["NameAndID"], None], data)

        referenced_by = _parse_referenced_by(d.pop("referenced_by"))

        type_name = d.pop("type_name")

        dimension_search_index_response = cls(
            id=id,
            label=label,
            matching_properties=matching_properties,
            referenced_by=referenced_by,
            type_name=type_name,
        )

        dimension_search_index_response.additional_properties = d
        return dimension_search_index_response

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
