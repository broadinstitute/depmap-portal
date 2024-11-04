from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.feature_sample_identifier import FeatureSampleIdentifier
from ..types import UNSET, Unset

T = TypeVar("T", bound="TabularDimensionsInfo")


@_attrs_define
class TabularDimensionsInfo:
    """
    Attributes:
        columns (Union[List[str], None, Unset]): Column names in the table to include in subsetted data. If None, return
            all columns
        identifier (Union[FeatureSampleIdentifier, None, Unset]): Specifies whether the indices given are dimension ids
            or their labels
        indices (Union[List[str], None, Unset]): Dimension indices to subset the dataset by. If None, return all the
            indices in the dataset
    """

    columns: Union[List[str], None, Unset] = UNSET
    identifier: Union[FeatureSampleIdentifier, None, Unset] = UNSET
    indices: Union[List[str], None, Unset] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        columns: Union[List[str], None, Unset]
        if isinstance(self.columns, Unset):
            columns = UNSET
        elif isinstance(self.columns, list):
            columns = self.columns

        else:
            columns = self.columns

        identifier: Union[None, Unset, str]
        if isinstance(self.identifier, Unset):
            identifier = UNSET
        elif isinstance(self.identifier, FeatureSampleIdentifier):
            identifier = self.identifier.value
        else:
            identifier = self.identifier

        indices: Union[List[str], None, Unset]
        if isinstance(self.indices, Unset):
            indices = UNSET
        elif isinstance(self.indices, list):
            indices = self.indices

        else:
            indices = self.indices

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if columns is not UNSET:
            field_dict["columns"] = columns
        if identifier is not UNSET:
            field_dict["identifier"] = identifier
        if indices is not UNSET:
            field_dict["indices"] = indices

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()

        def _parse_columns(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                columns_type_0 = cast(List[str], data)

                return columns_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        columns = _parse_columns(d.pop("columns", UNSET))

        def _parse_identifier(
            data: object,
        ) -> Union[FeatureSampleIdentifier, None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                identifier_type_0 = FeatureSampleIdentifier(data)

                return identifier_type_0
            except:  # noqa: E722
                pass
            return cast(Union[FeatureSampleIdentifier, None, Unset], data)

        identifier = _parse_identifier(d.pop("identifier", UNSET))

        def _parse_indices(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                indices_type_0 = cast(List[str], data)

                return indices_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        indices = _parse_indices(d.pop("indices", UNSET))

        tabular_dimensions_info = cls(
            columns=columns,
            identifier=identifier,
            indices=indices,
        )

        tabular_dimensions_info.additional_properties = d
        return tabular_dimensions_info

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
