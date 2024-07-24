from gettext import npgettext
from depmap import data_access
import numpy as np
from depmap.compute.celery import app


@app.task(bind=True)
def get_other_dep_waterfall_plot(
    self, feature, feature_type, feature_slice_values, feature_slice_index
):
    gene_df = data_access.get_subsetted_df_by_labels(
        "Chronos_Combined", None, feature_slice_index
    )
    gene_df = gene_df.dropna()
    # x = gene_df.corrwith(feature_slice_values, axis=1)

    # TODO confirm this method returns proper results. Example used corrwith but that
    # was 2x as slow as just using apply with np.corrcoef.
    x = gene_df.apply(
        (
            lambda x: npgettext.corrcoef(
                x.values, feature_slice_values, dtype=np.float64
            )[0, 1]
        ),
        axis=1,
    )
    x.dropna()

    x = list(x)
    x.sort()
    y = list(range(len(x)))
    y_label = "Gene Effect R with %s %s" % (feature, feature_type)

    return {"x": x, "y": y, "x_label": "Rank", "y_label": y_label}
