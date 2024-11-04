from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.feature_sample_identifier import FeatureSampleIdentifier
from ..types import UNSET, Unset

T = TypeVar("T", bound="MatrixDimensionsInfo")


@_attrs_define
class MatrixDimensionsInfo:
    """
    Attributes:
        feature_identifier (Union[FeatureSampleIdentifier, None, Unset]): Denotes whether the list of features are given
            as ids or feature labels
        features (Union[List[str], None, Unset]): List of feature labels or ids for which data should be retrieved
        sample_identifier (Union[FeatureSampleIdentifier, None, Unset]): Denotes whether the list of samples are given
            as ids or sample labels
        samples (Union[List[str], None, Unset]): List of sample labels or ids for which data should be retrieved
    """

    feature_identifier: Union[FeatureSampleIdentifier, None, Unset] = UNSET
    features: Union[List[str], None, Unset] = UNSET
    sample_identifier: Union[FeatureSampleIdentifier, None, Unset] = UNSET
    samples: Union[List[str], None, Unset] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        feature_identifier: Union[None, Unset, str]
        if isinstance(self.feature_identifier, Unset):
            feature_identifier = UNSET
        elif isinstance(self.feature_identifier, FeatureSampleIdentifier):
            feature_identifier = self.feature_identifier.value
        else:
            feature_identifier = self.feature_identifier

        features: Union[List[str], None, Unset]
        if isinstance(self.features, Unset):
            features = UNSET
        elif isinstance(self.features, list):
            features = self.features

        else:
            features = self.features

        sample_identifier: Union[None, Unset, str]
        if isinstance(self.sample_identifier, Unset):
            sample_identifier = UNSET
        elif isinstance(self.sample_identifier, FeatureSampleIdentifier):
            sample_identifier = self.sample_identifier.value
        else:
            sample_identifier = self.sample_identifier

        samples: Union[List[str], None, Unset]
        if isinstance(self.samples, Unset):
            samples = UNSET
        elif isinstance(self.samples, list):
            samples = self.samples

        else:
            samples = self.samples

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if feature_identifier is not UNSET:
            field_dict["feature_identifier"] = feature_identifier
        if features is not UNSET:
            field_dict["features"] = features
        if sample_identifier is not UNSET:
            field_dict["sample_identifier"] = sample_identifier
        if samples is not UNSET:
            field_dict["samples"] = samples

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()

        def _parse_feature_identifier(
            data: object,
        ) -> Union[FeatureSampleIdentifier, None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                feature_identifier_type_0 = FeatureSampleIdentifier(data)

                return feature_identifier_type_0
            except:  # noqa: E722
                pass
            return cast(Union[FeatureSampleIdentifier, None, Unset], data)

        feature_identifier = _parse_feature_identifier(
            d.pop("feature_identifier", UNSET)
        )

        def _parse_features(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                features_type_0 = cast(List[str], data)

                return features_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        features = _parse_features(d.pop("features", UNSET))

        def _parse_sample_identifier(
            data: object,
        ) -> Union[FeatureSampleIdentifier, None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sample_identifier_type_0 = FeatureSampleIdentifier(data)

                return sample_identifier_type_0
            except:  # noqa: E722
                pass
            return cast(Union[FeatureSampleIdentifier, None, Unset], data)

        sample_identifier = _parse_sample_identifier(d.pop("sample_identifier", UNSET))

        def _parse_samples(data: object) -> Union[List[str], None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                samples_type_0 = cast(List[str], data)

                return samples_type_0
            except:  # noqa: E722
                pass
            return cast(Union[List[str], None, Unset], data)

        samples = _parse_samples(d.pop("samples", UNSET))

        matrix_dimensions_info = cls(
            feature_identifier=feature_identifier,
            features=features,
            sample_identifier=sample_identifier,
            samples=samples,
        )

        matrix_dimensions_info.additional_properties = d
        return matrix_dimensions_info

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
