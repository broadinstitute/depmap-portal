# Collapsible box plots are used in both Context Explorer
# and the Gene/Compound overview page tiles. This sets the filter
# defaults for the enrichment tile on the overview page. The
# Context Explorer defaults are set in frontend/packages/portal-frontend/src/contextExplorer/json.
from depmap.context_explorer.models import ContextExplorerDatasets


def get_enrichment_tile_filters(feature_type: str, dataset_given_id: str):
    max_fdr: float = 0.1
    min_abs_effect_size: float = 0.25
    min_frac_dep_in: float = 0.1  # ignored for compounds

    if feature_type == "compound":
        # TODO also allow new OncRef
        if (
            dataset_given_id
            == ContextExplorerDatasets.Prism_oncology_AUC_collapsed.name
        ):
            max_fdr = 0.1
            min_abs_effect_size = 0.1
        else:
            max_fdr = 0.1
            min_abs_effect_size = 0.5

    return max_fdr, min_abs_effect_size, min_frac_dep_in
