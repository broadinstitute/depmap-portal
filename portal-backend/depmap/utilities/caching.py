class LazyCache:
    def __init__(self, eval_fn):
        self.eval = eval_fn
        self.cache = {}

    def get(self, key):
        if key in self.cache:
            return self.cache[key]
        value = self.eval(key)
        self.cache[key] = value
        return value
