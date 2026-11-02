import json
from typing import Any, Union


def _reject_constant(name: str):
    raise ValueError(f"unexpected JSON constant {name}")


def loads_strict(data: Union[str, bytes]) -> Any:
    """
    json.loads, but rejecting the NaN/Infinity/-Infinity tokens that Python accepts and
    JSON does not. Raises ValueError (json.JSONDecodeError is one) on any bad input.
    """
    return json.loads(data, parse_constant=_reject_constant)
