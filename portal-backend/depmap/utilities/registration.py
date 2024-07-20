import inspect

_factories = {}


def _make_factory(key):
    def register(fn):
        _factories[key] = fn
        return fn

    return register


def _get_factory_output(key, **kwargs):
    """
    The jQuery DataTables library tacks on additional params that need to be filtered out of kwargs 
    """
    factory_func = _factories[key]
    func_args = set(inspect.signature(factory_func).parameters)
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in func_args}
    output = factory_func(**filtered_kwargs)
    return output
