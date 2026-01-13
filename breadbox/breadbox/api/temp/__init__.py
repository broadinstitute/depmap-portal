from .router import router

# import the following which register endpoints onto `router` as a side effect of being imported
import breadbox.api.temp.cas
import breadbox.api.temp.context
import breadbox.api.temp.associations
import breadbox.api.temp.sql

__all__ = ["router"]
