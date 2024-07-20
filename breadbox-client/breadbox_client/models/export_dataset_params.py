from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ExportDatasetParams")


@_attrs_define
class ExportDatasetParams:
    """
    Attributes:
        dataset_id (str):
        add_cell_line_metadata (Union[None, Unset, bool]):  Default: False.
        cell_line_ids (Union[List[str], None, Unset]):
        drop_empty (Union[None, Unset, bool]):  Default: False.
        feature_labels (Union[List[str], None, Unset]):
    """

    dataset_id: str
    add_cell_line_metadata: Union[None, Unset, bool] = False
    cell_line_ids: Union[List[str], None, Unset] = UNSET
    drop_empty: Union[None, Unset, bool] = False
    feature_labels: Union[List[str], None, Unset] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        dataset_id = self.dataset_id

        add_cell_line_metadata: Union[None, Unset, bool]
        if isinstance(self.add_cell_line_metadata, Unset):
            add_cell_line_metadata = UNSET
        else:
            add_cell_line_metadata = self.add_cell_line_metadata

        cell_line_ids: Union[List[str], None, Unset]
        if isinstance(self.cell_line_ids, Unset):
            cell_line_ids = UNSET
        elif isinstance(self.cell_line_ids, list):
            cell_line_ids = self.cell_line_ids

        else:
            cell_line_ids = self.cell_line_ids

        drop_empty: Union[None, Unset, bool]
        if isinstance(self.drop_empty, Unset):
            drop_empty = UNSET
        else:
            drop_empty = self.drop_empty

        feature_labels: Union[List[str], None, Unset]
        if isinstance(self.feature_labels, Unset):
            feature_labels = UNSET
        elif isinstance(self.feature_labels, list):
            feature_labels = self.feature_labels

        else:
            feature_labels = self.feature_labels

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "datasetId": dataset_id,
            }
        )
        if add_cell_line_metadata is not UNSET:
            field_dict["addCellLineMetadata"] = add_cell_line_metadata
        if cell_line_ids is not UNSET:
            field_dict["cellLineIds"] = cell_line_ids
        if drop_empty is not UNSET:
            field_dict["dropEmpty"] = drop_empty
        if feature_labels is not UNSET:
            field_dict["featureLabels"] = feature_labels

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        dataset_id = d.pop("datasetId")

        def _parse_add_cell_line_metadata(data: object) -> Union[None, Unset, bool]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, bool], data)

        add_cell_line_metadata = _parse_add_cell_line_metadata(
            d.pop("addCellLineMetadata", UNSET)
        )

        def _parse_cell_line_ids(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                cell_line_ids_type_0 = cast(List[str], data)

                return cell_line_ids_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        cell_line_ids = _parse_cell_line_ids(d.pop("cellLineIds", UNSET))

        def _parse_drop_empty(data: object) -> Union[None, Unset, bool]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, bool], data)

        drop_empty = _parse_drop_empty(d.pop("dropEmpty", UNSET))

        def _parse_feature_labels(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                feature_labels_type_0 = cast(List[str], data)

                return feature_labels_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        feature_labels = _parse_feature_labels(d.pop("featureLabels", UNSET))

        export_dataset_params = cls(
            dataset_id=dataset_id,
            add_cell_line_metadata=add_cell_line_metadata,
            cell_line_ids=cell_line_ids,
            drop_empty=drop_empty,
            feature_labels=feature_labels,
        )

        export_dataset_params.additional_properties = d
        return export_dataset_params

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
