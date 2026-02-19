from .router import router

# import the following which register endpoints onto `router` as a side effect of being imported
import breadbox.api.temp.cas
import breadbox.api.temp.context
import breadbox.api.temp.associations
import breadbox.api.temp.sql
import breadbox.api.temp.predictive_models

__all__ = ["router"]
