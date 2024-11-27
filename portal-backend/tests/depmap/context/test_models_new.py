import pandas as pd

from depmap.dataset.models import DependencyDataset
from depmap.context.models import Context, ContextEntity, ContextEnrichment
from depmap.context.models_new import SubtypeContext, SubtypeContextEntity
from tests.factories import (
    DepmapModelFactory,
    SubtypeContextFactory,
    SubtypeNodeFactory,
    SubtypeContextEntityFactory,
    ContextEnrichmentFactory,
    GeneFactory,
    DependencyDatasetFactory,
    CompoundExperimentFactory,
)
from tests.utilities.df_test_utils import dfs_equal_ignoring_column_order


def test_get_all_names(empty_db_mock_downloads):
    context_1 = SubtypeContextFactory()
    context_2 = SubtypeContextFactory()
    empty_db_mock_downloads.session.flush()

    assert set(SubtypeContext.get_all_codes()) == {
        context_1.subtype_code,
        context_2.subtype_code,
    }


def test_subtype_context_get_by_subtype_code(empty_db_mock_downloads):
    depmap_model = DepmapModelFactory()
    context = SubtypeContextFactory(depmap_model=[depmap_model])
    empty_db_mock_downloads.session.flush()

    assert SubtypeContext.get_by_code(context.subtype_code) == context


def test_subtype_context_entity_get_by_label(empty_db_mock_downloads):
    context_entity = SubtypeContextEntityFactory()
    empty_db_mock_downloads.session.flush()

    assert SubtypeContextEntity.get_by_label(context_entity.label) == context_entity


def test_get_cell_line_table_query(empty_db_mock_downloads):
    model = DepmapModelFactory(primary_or_metastasis=None)
    node = SubtypeNodeFactory(
        subtype_code=model.depmap_model_type, level_1=model.oncotree_primary_disease
    )
    context = SubtypeContextFactory(
        subtype_code=model.depmap_model_type, depmap_model=[model]
    )
    empty_db_mock_downloads.session.flush()
    query = SubtypeContext.get_cell_line_table_query(context.subtype_code)

    df = pd.read_sql(query.statement, query.session.connection())

    assert len(df) == 1
    assert df["cell_line_display_name"][0] == model.stripped_cell_line_name
    assert df["primary_disease"][0] == model.oncotree_primary_disease
    assert df["tumor_type"][0] == None
