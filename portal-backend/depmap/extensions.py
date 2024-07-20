# -*- coding: utf-8 -*-
"""Extensions module. Each extension is initialized in the app factory located in app.py."""
import contextvars
from flask_bcrypt import Bcrypt
from flask_caching import Cache
from flask_debugtoolbar import DebugToolbarExtension
from flask_humanize import Humanize
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect
from flaskext.markdown import Markdown

from .utilities.gcs_reporter import ExceptionReporter

from .methylation.extension import MethylationDbExtension
from depmap.cansar.extension import CansarExtension
from depmap.breadbox_shim.extension import BreadboxClientExtension
from functools import wraps

bcrypt = Bcrypt()
csrf_protect = CSRFProtect()
login_manager = LoginManager()
db = SQLAlchemy()
cache = Cache()
in_memory_cache = Cache()
debug_toolbar = DebugToolbarExtension()
exception_reporter = ExceptionReporter()
markdown = Markdown
humanize = Humanize
methylation_db = MethylationDbExtension()
cansar = CansarExtension()
breadbox = BreadboxClientExtension()

# tracks how many functions decorated with @cached() have been called in the current call stack
_caching_call_depth = contextvars.ContextVar("caching_call_depth", default=0)


def _prep_cache_function(decorator_func):
    from depmap.access_control import assume_user

    # decorator_func is the function which be invoked to wrap some function with
    # conditional logic which checks for a cache hit before calling. However, we want
    # to record when that function is invoked so that we can check for it in
    # assert_result_will_not_be_cached. We do this by wrapping the decorator with another function
    # which will wrap the function returned from the first (caching) decorator
    @wraps(decorator_func)
    def add_call_depth_counter(target_func):
        @wraps(target_func)
        def update_call_depth_aspect_and_delegate(*args, **kwargs):
            # increment the call depth we're tracking which assert_result_will_not_be_cached() checks
            depth = _caching_call_depth.get()
            _caching_call_depth.set(depth + 1)
            try:
                if depth == 0:
                    with assume_user("nobody-cached-call"):
                        return target_func(*args, **kwargs)
                else:
                    return target_func(*args, **kwargs)
            finally:
                # restore the previous value of depth
                _caching_call_depth.set(depth)

        decorated_func = decorator_func(update_call_depth_aspect_and_delegate)

        return decorated_func

    return add_call_depth_counter


# a wrapper around cache.memoize which drops the current user information while the function executes
# so that we are not in risk of caching private information from the current user
def memoize_without_user_permissions(**kwargs):
    decorator_func = cache.memoize(**kwargs)
    return _prep_cache_function(decorator_func)


# a wrapper around cache.cache which drops the current user information while the function executes
# so that we are not in risk of caching private information from the current user
def cache_without_user_permissions(**kwargs):
    _kwargs = {"query_string": True}
    _kwargs.update(kwargs)
    decorator_func = cache.cached(**_kwargs)
    return _prep_cache_function(decorator_func)


def restplus_handle_exception(error):
    # log exception to stackdriver if enabled
    exception_reporter.report()
    return {"message": "An internal error occurred"}, 500
