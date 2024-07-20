import functools
import inspect
from pytest import fixture


def override(**kwargs):
    def decorator(f):
        f.fixture_overrides = kwargs
        return f

    return decorator


def overridable_fixture(f):
    assert not inspect.isgeneratorfunction(
        f
    ), "Not set up to override generator fixtures; does not work out of the box"

    @functools.wraps(f)  # preserve the meta about the function, replaces the contents
    def f_wrapper(*args, **kwargs):
        fixture_name = f.__name__
        request = kwargs["request"]
        if (
            hasattr(request.function, "fixture_overrides")
            and fixture_name in request.function.fixture_overrides
        ):
            old_parameters = inspect.signature(f).parameters

            new_fixture = request.function.fixture_overrides[fixture_name]
            new_parameters = inspect.signature(new_fixture).parameters

            assert (
                old_parameters == new_parameters
            ), "Signature of fixture override does not match that of the overriden fixture.\nOriginal fixture params: {}\nNew override params: {}".format(
                old_parameters, new_parameters
            )
            return new_fixture(*args, **kwargs)
        return f(*args, **kwargs)

    # manually encompassing the function of the "fixture" decorator, to not have to double decorate
    # this also enforces the "ordering" of decorators (though unclear that ordering matters)
    f_wrapper = fixture(f_wrapper)

    return f_wrapper
