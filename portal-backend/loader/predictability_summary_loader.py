from cmath import nan
from depmap.gene.models import Gene
from depmap.predictability_prototype.models import (
    PredictabilitySummary,
    PredictiveInsightsFeature,
)
from depmap.utilities.caching import LazyCache
from depmap.utilities.models import log_data_issue
from loader.dataset_loader.biomarker_loader import _batch_load


def _read_predictability_summaries(dr, pbar, gene_cache, cell_line_cache):
    gene_cache = LazyCache(lambda name: Gene.get_gene_from_rowname(name, must=False))

    skipped_entity = 0
    loaded = 0

    def _to_nan(num_value):
        if num_value == "" or num_value == "NA":
            return nan
        else:
            return num_value

    for row in dr:
        gene = gene_cache.get(row["gene"])
        if gene is None:
            skipped_entity += 1
            log_data_issue(
                "PredictabilitySummary",
                "Missing entity",
                identifier=row["gene"],
                id_type="entity",
            )
            continue

        entity_id = None
        if gene is not None:
            entity_id = gene.entity_id

        summary = dict(
            entity_id=entity_id,
            model=row["model"],
            pearson=float(_to_nan(row["pearson"])),
            feature0=row["feature0"],
            feature0_importance=float(_to_nan(row["feature0_importance"])),
            feature1=row["feature1"],
            feature1_importance=float(_to_nan(row["feature1_importance"])),
            feature2=row["feature2"],
            feature2_importance=float(_to_nan(row["feature2_importance"])),
            feature3=row["feature3"],
            feature3_importance=float(_to_nan(row["feature3_importance"])),
            feature4=row["feature4"],
            feature4_importance=float(_to_nan(row["feature4_importance"])),
            feature5=row["feature5"],
            feature5_importance=float(_to_nan(row["feature5_importance"])),
            feature6=row["feature6"],
            feature6_importance=float(_to_nan(row["feature6_importance"])),
            feature7=row["feature7"],
            feature7_importance=float(_to_nan(row["feature7_importance"])),
            feature8=row["feature8"],
            feature8_importance=float(_to_nan(row["feature8_importance"])),
            feature9=row["feature9"],
            feature9_importance=float(_to_nan(row["feature9_importance"])),
        )

        yield summary
        loaded += 1
        pbar.update(1)

    print(
        "Loaded {} predictability summary records ({} missing genes)".format(
            loaded, skipped_entity
        )
    )


def load_predictability_summaries(db_file):
    _batch_load(
        db_file, _read_predictability_summaries, PredictabilitySummary.__table__
    )


def _read_predictive_insights_features(dr, pbar, gene_cache, cell_line_cache):
    loaded = 0

    for row in dr:
        summary = dict(
            model=row["model"],
            feature_name=row["feature_name"],
            feature_label=row["feature_name"],
            dim_type=row["dim_type"],
            taiga_id=row["taiga_id"],
            given_id=row["given_id"],
        )

        yield summary
        loaded += 1
        pbar.update(1)

    print("Loaded {} predictive insights features records".format(loaded))


def load_predictive_insights_features(db_file):
    _batch_load(
        db_file, _read_predictive_insights_features, PredictiveInsightsFeature.__table__
    )
