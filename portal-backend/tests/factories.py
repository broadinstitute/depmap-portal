from operator import mod
import tempfile
from depmap.cell_line.models_new import DepmapModel
from depmap.context_explorer.models import ContextAnalysis
from depmap.enums import DataTypeEnum

import factory.alchemy
import h5py
import numpy as np
import uuid
import json
from collections import defaultdict
from factory.alchemy import SQLAlchemyModelFactory
from depmap.proteomics.models import Protein
from depmap.settings.shared import DATASET_METADATA

from loader.dataset_loader.biomarker_loader import GENERIC_ENTITY_BIOMARKER_ENUMS
from depmap.cell_line.models import (
    CellLine,
    Lineage,
    CellLineAlias,
    PrimaryDisease,
    DiseaseSubtype,
    TumorType,
    CultureMedium,
    Conditions,
    STRProfile,
)
from depmap.context.models_new import (
    SubtypeContext,
    SubtypeContextEntity,
    SubtypeNode,
    SubtypeNodeAlias,
)
from depmap.context.models import Context, ContextEntity, ContextEnrichment
from depmap.database import db as _db
from depmap.dataset.models import (
    Dataset,
    DependencyDataset,
    BiomarkerDataset,
    TabularDataset,
    Mutation,
    Translocation,
    Fusion,
)
from depmap.entity.models import Entity, EntityAlias, GenericEntity
from depmap.gene.models import Gene, GeneExecutiveInfo, GeneScoreConfidence
from depmap.antibody.models import Antibody
from depmap.transcription_start_site.models import TranscriptionStartSite
from depmap.compound.models import (
    CompoundDoseReplicate,
    CompoundDose,
    CompoundExperiment,
    Compound,
    DoseResponseCurve,
)
from depmap.partials.matrix.models import Matrix, RowMatrixIndex, ColMatrixIndex
from depmap.interactive.nonstandard.models import (
    CustomDatasetConfig,
    NonstandardMatrixLoaderMetadata,
    NonstandardMatrix,
    RowNonstandardMatrix,
    ColNonstandardMatrix,
    PrivateDatasetMetadata,
    CellLineNameType,
)
from depmap.correlation.models import CorrelatedDataset
from depmap.compute.models import CustomCellLineGroup
from depmap.utilities.hdf5_utils import get_values_min_max
from depmap.predictability.models import (
    PredictiveFeatureResult,
    PredictiveModel,
    PredictiveFeature,
    PredictiveBackground,
)
from depmap.taiga_id.models import TaigaAlias
import pandas

from depmap.access_control import PUBLIC_ACCESS_GROUP
import sqlite3


class ContextFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Context

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    name = factory.Sequence(lambda number: "context_{}".format(number))


def ContextEntityFactory(context=None):
    if context is None:
        context = ContextFactory()

    context_entity = ContextEntity(label=context.name, context=context)
    _db.session.add(context_entity)
    return context_entity


class CellLineAliasFactory(SQLAlchemyModelFactory):
    class Meta:
        model = CellLineAlias
        sqlalchemy_session = _db.session

    alias = factory.Sequence(lambda number: "cell_line_alias_{}".format(number))


class LineageFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Lineage
        sqlalchemy_session = _db.session

    name = factory.Sequence(lambda number: "lineage_{}".format(number))
    level = 1


class PrimaryDiseaseFactory(SQLAlchemyModelFactory):
    class Meta:
        model = PrimaryDisease

        sqlalchemy_session = _db.session

    name = factory.Sequence(lambda number: "primary_disease_{}".format(number))


class DiseaseSubtypeFactory(SQLAlchemyModelFactory):
    class Meta:
        model = DiseaseSubtype

        sqlalchemy_session = _db.session

    name = factory.Sequence(lambda number: "disease_subtype_{}".format(number))

    primary_disease = factory.SubFactory(PrimaryDiseaseFactory)


class TumorTypeFactory(SQLAlchemyModelFactory):
    class Meta:
        model = TumorType

        sqlalchemy_session = _db.session

    name = factory.Sequence(lambda number: "tumor_type_{}".format(number))


class CultureMediumFactory(SQLAlchemyModelFactory):
    class Meta:
        model = CultureMedium

        sqlalchemy_session = _db.session

    name = factory.Sequence(lambda number: "culture_medium_{}".format(number))


class ConditionsFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Conditions

        sqlalchemy_session = _db.session

    name = factory.Sequence(lambda number: "conditions_{}".format(number))


class CellLineFactory(SQLAlchemyModelFactory):
    class Meta:
        model = CellLine

        sqlalchemy_session = _db.session

    cell_line_name = factory.Sequence(lambda number: "cell_line_{}".format(number))
    cell_line_alias = factory.LazyAttribute(lambda o: [CellLineAliasFactory()])
    cell_line_display_name = factory.Sequence(lambda number: "{}".format(number))

    depmap_id = factory.Sequence(lambda number: "ACH-{}".format(number))
    wtsi_master_cell_id = factory.Sequence(lambda number: number)
    cosmic_id = factory.Sequence(lambda number: number)
    cell_line_passport_id = factory.Sequence(lambda number: "SIDM{}".format(number))

    lineage = factory.LazyAttribute(lambda o: [LineageFactory()])
    comments = factory.Sequence(lambda number: number)

    disease_subtype = factory.SubFactory(DiseaseSubtypeFactory)
    # TODO: Handle the case where disease_subtype is None
    primary_disease = factory.SubFactory(PrimaryDiseaseFactory)
    tumor_type = factory.SubFactory(TumorTypeFactory)

    culture_medium = factory.SubFactory(CultureMediumFactory)
    conditions = factory.SubFactory(ConditionsFactory)


class DepmapModelFactory(SQLAlchemyModelFactory):
    class Meta:
        model = DepmapModel

        sqlalchemy_session = _db.session

    stripped_cell_line_name = factory.Sequence(lambda number: "{}".format(number))
    model_id = factory.Sequence(lambda number: "ACH-{}".format(number))
    patient_id = factory.Sequence(lambda number: "ACH-{}".format(number))
    depmap_model_type = factory.Sequence(
        lambda number: "depmap_model_type_{}".format(number)
    )
    cell_line_name = factory.Sequence(lambda number: "cell_line_{}".format(number))
    cell_line_alias = factory.LazyAttribute(lambda o: [CellLineAliasFactory()])
    age_category = factory.Sequence(lambda number: "age_category_{}".format(number))

    cell_line = factory.SubFactory(
        CellLineFactory,
        depmap_id=factory.SelfAttribute("..model_id"),
        cell_line_display_name=factory.SelfAttribute("..stripped_cell_line_name"),
    )
    # TODO: Add back in once we're fully reliant on DepmapModel table. For now, CellLineFactory creates the LineageFactory.
    # oncotree_lineage = factory.LazyAttribute(lambda o: [LineageFactory()])


class EntityFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Entity

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    label = factory.Sequence(lambda number: "entity_{}".format(number))
    type = "gene"


class EntityAliasFactory(SQLAlchemyModelFactory):
    class Meta:
        model = EntityAlias

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    alias = factory.Sequence(lambda number: "alias_{}".format(number))


class CompoundFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Compound

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    type = "compound"
    compound_id = factory.Sequence(
        lambda n: f"DPC-{n:06d}"
    )  # Generates IDs like DPC-000001, DPC-000002, etc.
    label = factory.Sequence(lambda number: "compound_{}".format(number))
    entity_alias = factory.LazyAttribute(lambda o: [EntityAliasFactory()])
    units = "μM"


class CompoundExperimentFactory(SQLAlchemyModelFactory):
    class Meta:
        model = CompoundExperiment

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    xref_type = "CTRP"
    xref = factory.Sequence(lambda number: "{}".format(number))

    type = "compound_experiment"
    compound_id = factory.Sequence(lambda number: number)
    compound = factory.SubFactory(
        CompoundFactory, compound_id=factory.SelfAttribute("..compound_id")
    )
    label = factory.Sequence(lambda number: "CTRP:{}".format(number))
    entity_alias = factory.LazyAttribute(lambda o: [EntityAliasFactory()])


class CompoundDoseFactory(SQLAlchemyModelFactory):
    class Meta:
        model = CompoundDose

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    type = "compound_dose"
    label = factory.Sequence(lambda number: "BRD:{} dose".format(number))

    compound_experiment = factory.LazyAttribute(lambda o: CompoundExperimentFactory())
    dose = factory.Sequence(lambda number: number)


class CompoundDoseReplicateFactory(SQLAlchemyModelFactory):
    class Meta:
        model = CompoundDoseReplicate

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    type = "compound_dose_replicate"
    label = factory.Sequence(lambda number: "CTRP:{} dose rep".format(number))

    compound_experiment_id = factory.Sequence(lambda number: number)
    dose = factory.Sequence(lambda number: number)
    replicate = factory.Sequence(lambda number: number)
    is_masked = None


class DoseResponseCurveFactory(SQLAlchemyModelFactory):
    class Meta:
        model = DoseResponseCurve

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    cell_line = factory.SubFactory(CellLineFactory)
    compound_exp = factory.SubFactory(CompoundExperimentFactory)
    ec50 = 0
    slope = 0
    upper_asymptote = 0
    lower_asymptote = 0


class GeneFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Gene

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    type = "gene"
    label = factory.Sequence(lambda number: "gene_{}".format(number))
    entity_alias = factory.LazyAttribute(lambda o: [EntityAliasFactory()])
    name = factory.Sequence(lambda number: "Gene {}".format(number))
    description = factory.Sequence(lambda number: "description_{}".format(number))
    entrez_id = factory.Sequence(lambda number: number)
    ensembl_id = factory.Sequence(lambda number: "ENSG_{}".format(number))
    hgnc_id = factory.Sequence(lambda number: "HGNC:_{}".format(number))
    locus_type = "pseudogene"


class GeneExecutiveInfoFactory(SQLAlchemyModelFactory):
    class Meta:
        model = GeneExecutiveInfo

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    gene = factory.LazyAttribute(lambda o: [GeneFactory()])
    dataset = DependencyDataset.DependencyEnum.Chronos_Combined
    num_dependent_cell_lines = 0
    num_lines_with_data = 1
    is_strongly_selective = False
    is_common_essential = False


class GeneScoreConfidenceFactory(SQLAlchemyModelFactory):
    class Meta:
        model = GeneScoreConfidence

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    gene = factory.SubFactory(GeneFactory)
    score = 0.5
    guide_consistency_mean = 0.5
    guide_consistency_max = 0.5
    unique_guides = 3
    sanger_crispr_consistency = 0.5
    rnai_consistency = 0.5
    normLRT = 0.5
    predictability = 0.5
    top_feature_importance = 0.5
    top_feature_confounder = False


class ProteinFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Protein

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    type = "protein"
    gene = factory.SubFactory(GeneFactory)
    uniprot_id = factory.Sequence(lambda number: "P{}".format(number))
    label = factory.LazyAttribute(
        lambda obj: "{} ({})".format(obj.gene.label, obj.uniprot_id)
    )


class AntibodyFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Antibody

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    type = "antibody"
    label = factory.Sequence(lambda number: "antibody_{}".format(number))
    entity_alias = factory.LazyAttribute(lambda o: [EntityAliasFactory()])

    gene = factory.LazyAttribute(lambda o: [GeneFactory()])
    protein = factory.Sequence(lambda number: "protein_{}".format(number))
    phosphorylation = None
    is_caution = False
    is_validation_unavailable = False


class TranscriptionStartSiteFactory(SQLAlchemyModelFactory):
    class Meta:
        model = TranscriptionStartSite

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    type = "transcription_start_site"
    label = factory.Sequence(
        lambda number: "transcription_start_site_{}".format(number)
    )
    entity_alias = factory.LazyAttribute(lambda o: [EntityAliasFactory()])

    gene = factory.SubFactory(GeneFactory)
    chromosome = "chr1"
    five_prime_position = 10000000
    three_prime_position = 10001000
    average_coverage = 100


class GenericEntityFactory(SQLAlchemyModelFactory):
    class Meta:
        model = GenericEntity

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    type = "generic_entity"
    label = factory.Sequence(lambda number: "generic_entity_{}".format(number))
    entity_alias = factory.LazyAttribute(lambda o: [EntityAliasFactory()])


class RowMatrixIndexFactory(SQLAlchemyModelFactory):
    class Meta:
        model = RowMatrixIndex

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    index = 0
    # 90% of the tests want gene, we can override this default
    entity = factory.SubFactory(GeneFactory)
    owner_id = PUBLIC_ACCESS_GROUP


class ColMatrixIndexFactory(SQLAlchemyModelFactory):
    class Meta:
        model = ColMatrixIndex

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    index = 0
    cell_line = factory.SubFactory(CellLineFactory)
    owner_id = PUBLIC_ACCESS_GROUP


def create_hdf5(file_path, row_list, col_list, data=None):
    """
    :param data: np array
    """
    dest = h5py.File(file_path, mode="w")

    dest["dim_0"] = [str.encode(row) for row in row_list]
    dest["dim_1"] = [str.encode(col) for col in col_list]

    if data is None:
        sequence = np.arange(len(row_list) * len(col_list))
        data = np.reshape(sequence, (len(row_list), len(col_list)))
    else:
        assert isinstance(data, np.ndarray)
        # make sure the dimensions are correct
        assert data.shape == (
            len(row_list),
            len(col_list),
        ), "expected {} but got {}".format((len(row_list), len(col_list)), data.shape)
    dest["data"] = data

    return file_path


def MatrixFactory(
    entities=None,
    cell_lines=None,
    data=None,
    units=None,
    owner_id=PUBLIC_ACCESS_GROUP,
    using_depmap_model_table=False,
):
    """
    :param entities: List of entities, e.g. from GeneFactory.create_batch(5)
    :param cell_lines: List of cell_lines, e.g. from CellLineFactory.create_batch(5)
    :param data: nd array, e.g. df.values
    :param units: string
    """

    # Hack to make this work with both the DepmapModel table and CellLine until we move fully over to Models
    cell_lines = (
        [model.cell_line for model in cell_lines]
        if using_depmap_model_table
        else cell_lines
    )

    (
        file_path,
        row_index_objects,
        col_index_objects,
    ) = create_hdf5_file_row_and_col_indices(
        entities,
        cell_lines,
        data,
        owner_id,
        RowMatrixIndexFactory,
        ColMatrixIndexFactory,
        rows_are_entities=True,
    )
    min, max = get_values_min_max("/", file_path)

    matrix = Matrix(
        file_path=file_path,
        row_index=row_index_objects,
        col_index=col_index_objects,
        units=units if units is not None else "units",
        min=min,
        max=max,
        owner_id=owner_id,
        matrix_uuid=uuid.uuid4().hex,
    )

    _db.session.add(matrix)
    return matrix


def create_hdf5_file_row_and_col_indices(
    entities,
    cell_lines,
    data,
    owner_id,
    row_index_factory,
    col_index_factory,
    rows_are_entities,
):
    """
    Used by MatrixFactory and NonstandardMatrixFactory to create an hdf5 file, and row and col index objects based on optionally provided entities, cell lines, and data
    :param entities: list of an Entity subclass objects, or None
    :param cell_lines: list of CellLine objects, or None
    :param data: pandas dataframe, or None
    :param row_index_factory: factory class to use, e.g. RowMatrixIndexFactory
    :param col_index_factory: factory class to use
    :return:
    """
    t = tempfile.NamedTemporaryFile(delete=False)
    t.close()
    file_path = t.name

    row_count, col_count, data = get_row_col_count_data(entities, cell_lines, data)

    if entities is None:
        row_index_objects = []
        row_list = []

        for row in range(row_count):
            row_matrix_index = row_index_factory(owner_id=owner_id, index=row)
            row_index_objects.append(row_matrix_index)
            row_list.append(row_matrix_index.entity.label)
    else:
        row_index_objects = []
        for index, entity in enumerate(entities):
            if rows_are_entities:
                row_index = row_index_factory(
                    index=index, entity=entity, owner_id=owner_id
                )
            else:
                row_index = row_index_factory(
                    index=index, entity=None, row_name=entity, owner_id=owner_id
                )
            row_index_objects.append(row_index)
        row_list = [
            entity.label if rows_are_entities else entity for entity in entities
        ]

    if cell_lines is None:
        col_index_objects = []
        col_list = []

        for col in range(col_count):
            col_matrix_index = col_index_factory(index=col, owner_id=owner_id)
            col_index_objects.append(col_matrix_index)
            col_list.append(col_matrix_index.cell_line.cell_line_name)
    else:
        col_index_objects = []
        for index, cell_line in enumerate(cell_lines):
            col_index_objects.append(
                col_index_factory(index=index, cell_line=cell_line, owner_id=owner_id)
            )
        col_list = [cell_line.cell_line_name for cell_line in cell_lines]

    create_hdf5(file_path, row_list, col_list, data)

    return file_path, row_index_objects, col_index_objects


def get_row_col_count_data(rows=None, cols=None, data=None):
    """
    Utility function for factories making matrices
    :param rows: list used to determine length
    :param cols: list used to determine length
    :param data:
    :return:
    """
    row_count = None
    if rows is not None:
        row_count = len(rows)

    col_count = None
    if cols is not None:
        col_count = len(cols)

    if data is not None:
        if type(data) is list or isinstance(data, pandas.DataFrame):
            data = np.array(data)  # this is why we need to return data

        assert isinstance(data, np.ndarray)

        if row_count is None:
            row_count = data.shape[0]
        else:
            assert row_count == data.shape[0]

        if col_count is None:
            col_count = data.shape[1]
        else:
            assert col_count == data.shape[1]
    else:
        if col_count is None:
            col_count = 1
        if row_count is None:
            row_count = 1

    return row_count, col_count, data


class DatasetFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Dataset

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    units = ""
    data_type = DataTypeEnum.crispr
    taiga_id = "placeholder-taiga-id.1"
    entity_type = "gene"
    owner_id = PUBLIC_ACCESS_GROUP
    priority: int = None
    global_priority: int = None


class DependencyDatasetFactory(DatasetFactory):
    class Meta:
        model = DependencyDataset

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    # cannot use Sequence because factory boy reuses the sequence across tests, also sequence suggests infiniteness when we have max number of DependencyEnums and the column must be unique
    name = DependencyDataset.DependencyEnum.Avana
    display_name = factory.LazyAttribute(
        lambda o: "{} display name".format(o.name.name)
    )
    taiga_id = "test-taiga-id.1"
    matrix = factory.LazyAttribute(lambda x: MatrixFactory())
    entity_type = factory.LazyAttribute(
        lambda o: defaultdict(
            lambda: "gene",
            {
                DependencyDataset.DependencyEnum.GDSC1_AUC: "compound_experiment",
                DependencyDataset.DependencyEnum.GDSC1_IC50: "compound_experiment",
                DependencyDataset.DependencyEnum.GDSC2_AUC: "compound_experiment",
                DependencyDataset.DependencyEnum.GDSC2_IC50: "compound_experiment",
                DependencyDataset.DependencyEnum.CTRP_AUC: "compound_experiment",
                DependencyDataset.DependencyEnum.Rep_all_single_pt: "compound_experiment",
                DependencyDataset.DependencyEnum.Repurposing_secondary_AUC: "compound_experiment",
                DependencyDataset.DependencyEnum.Repurposing_secondary_dose: "compound_dose",
                DependencyDataset.DependencyEnum.Repurposing_secondary_dose_replicate: "compound_dose_replicate",
                DependencyDataset.DependencyEnum.CTRP_dose_replicate: "compound_dose_replicate",
                DependencyDataset.DependencyEnum.Prism_oncology_AUC: "compound_experiment",
                DependencyDataset.DependencyEnum.Prism_oncology_IC50: "compound_experiment",
                DependencyDataset.DependencyEnum.Prism_oncology_dose_replicate: "compound_dose_replicate",
            },
        )[o.name]
    )
    owner_id = PUBLIC_ACCESS_GROUP
    units = factory.LazyAttribute(lambda o: DATASET_METADATA[o.name].units)
    data_type = factory.LazyAttribute(lambda o: DATASET_METADATA[o.name].data_type)


class BiomarkerDatasetFactory(DatasetFactory):
    class Meta:
        model = BiomarkerDataset

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    # cannot use Sequence because factory boy reuses the sequence across tests, also sequence suggests infiniteness when we have max number of BiomarkerEnums and the column must be unique
    name = BiomarkerDataset.BiomarkerEnum.expression

    display_name = factory.LazyAttribute(
        lambda o: "{} display name".format(o.name.name)
    )
    taiga_id = "test-taiga-id.1"
    matrix = factory.LazyAttribute(lambda x: MatrixFactory())
    entity_type = factory.LazyAttribute(
        lambda o: defaultdict(
            lambda: "gene",
            {
                BiomarkerDataset.BiomarkerEnum.context: "context",
                BiomarkerDataset.BiomarkerEnum.rppa: "antibody",
                BiomarkerDataset.BiomarkerEnum.rrbs: "transcription_start_site",
                **{enum: "generic_entity" for enum in GENERIC_ENTITY_BIOMARKER_ENUMS},
            },
        )[o.name]
    )
    owner_id = PUBLIC_ACCESS_GROUP
    units = factory.LazyAttribute(lambda o: DATASET_METADATA[o.name].units)
    data_type = factory.LazyAttribute(lambda o: DATASET_METADATA[o.name].data_type)


class TabularDatasetFactory(SQLAlchemyModelFactory):
    class Meta:
        model = TabularDataset

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    # cannot use Sequence because factory boy reuses the sequence across tests, also sequence suggests infiniteness when we have max number of TabularEnums and the column must be unique
    name = TabularDataset.TabularEnum.mutation
    taiga_id = "test-taiga-id.1"


class MutationFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Mutation

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    gene = factory.SubFactory(GeneFactory)
    cell_line = factory.SubFactory(CellLineFactory)

    chrom = "test_chrom"
    pos = 0
    ref = "test_red"
    alt = "test_alt"
    af = None
    variant_type = "test_variant_type"
    variant_info = "test_variant_info"
    protein_change = "p.R177W"


class FusionFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Fusion

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    left_gene = factory.SubFactory(GeneFactory)
    right_gene = factory.SubFactory(GeneFactory)
    cell_line = factory.SubFactory(CellLineFactory)

    fusion_name = "test_fusion_name"
    left_breakpoint = "test_left_breakpoint"
    right_breakpoint = "test_right_breakpoint"
    junction_read_count = 0
    spanning_frag_count = 0

    splice_type = "test_splice_type"
    large_anchor_support = "test_large_anchor_support"
    left_break_dinuc = "test_left_break_dinuc"
    left_break_entropy = 0
    right_break_dinc = "test_right_break_dinc"
    right_break_entropy = 0
    ffpm = 0
    annots = "test_annots"


class TranslocationFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Translocation

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    gene_1 = factory.SubFactory(GeneFactory)
    gene_2 = factory.SubFactory(GeneFactory)
    cell_line = factory.SubFactory(CellLineFactory)

    map_id = "test_map_id"
    break_point_1 = "test_break_point_1"
    break_point_2 = "test_break_point_2"
    trans_class = "test_trans_class"
    site_1 = "test_site_1"
    site_2 = "test_site_2"
    fusion = "test_fusion"
    multi_sv_fusion = "test_multi_sv_fusion"
    cosmic_fus = "test_cosmic_fus"


def CustomCellLineGroupFactory(uuid=None, cell_lines=None, depmap_ids=None):
    """
    Option to provide either a list of cell lines or depmap ids
    a pseudo-factory so that we can take in cell lines instead of depmap ids
    the factory is useful (vs just using CustomCellLineGroup add, so that the interactive_db_mock_downloads fixture can have a consistent, deterministic/stable uuid
    """
    if uuid is None:
        uuid = str(uuid.uuid4())

    if cell_lines is not None:
        assert depmap_ids is None
        depmap_ids = [cell_line.depmap_id for cell_line in cell_lines]
    elif depmap_ids is not None:
        pass
    else:
        depmap_ids = []

    group = CustomCellLineGroup(uuid=uuid, depmap_ids=json.dumps(depmap_ids))
    _db.session.add(group)
    return group


class SubtypeNodeFactory(SQLAlchemyModelFactory):
    class Meta:
        model = SubtypeNode

        sqlalchemy_session = _db.session

    subtype_code = factory.Sequence(lambda number: "subtype_code_{}".format(number))

    oncotree_code = factory.Sequence(lambda number: "oncotree_code_{}".format(number))
    depmap_model_type = factory.Sequence(
        lambda number: "depmap_model_type_{}".format(number)
    )
    node_name = factory.Sequence(lambda number: "node_name_{}".format(number))
    node_level = factory.Sequence(lambda number: number)
    level_0 = factory.Sequence(lambda number: "level_0_{}".format(number))
    level_1 = factory.Sequence(lambda number: "level_1_{}".format(number))
    level_2 = factory.Sequence(lambda number: "level_2_{}".format(number))
    level_3 = factory.Sequence(lambda number: "level_3_{}".format(number))
    level_4 = factory.Sequence(lambda number: "level_4_{}".format(number))
    level_5 = factory.Sequence(lambda number: "level_5_{}".format(number))
    subtype_node_alias = factory.LazyAttribute(lambda o: [SubtypeNodeAliasFactory()])


class SubtypeNodeAliasFactory(SQLAlchemyModelFactory):
    class Meta:
        model = SubtypeNodeAlias
        sqlalchemy_session = _db.session

    alias_name = factory.Sequence(
        lambda number: "subtype_node_alias_name_{}".format(number)
    )
    alias_subtype_code = factory.Sequence(
        lambda number: "subtype_node_alias_subtype_code_{}".format(number)
    )


class SubtypeContextFactory(SQLAlchemyModelFactory):
    class Meta:
        model = SubtypeContext

        sqlalchemy_session = _db.session

    subtype_code = factory.Sequence(lambda number: "subtype_code_{}".format(number))


def SubtypeContextEntityFactory(context=None):
    if context is None:
        context = SubtypeContextFactory()

    context_entity = SubtypeContextEntity(
        label=context.subtype_code, subtype_context=context
    )
    _db.session.add(context_entity)
    return context_entity


class ContextAnalysisFactory(SQLAlchemyModelFactory):
    class Meta:
        model = ContextAnalysis

        sqlalchemy_session = _db.session

    subtype_code = factory.Sequence(lambda number: "subtype_code_{}".format(number))
    subtype_context = factory.SubFactory(
        SubtypeContextFactory, subtype_code=factory.SelfAttribute("..subtype_code")
    )

    dependency_dataset_id = factory.Sequence(lambda number: number)
    dataset = factory.SubFactory(
        DependencyDatasetFactory,
        dependency_dataset_id=factory.SelfAttribute("..dependency_dataset_id"),
    )

    entity_id = factory.Sequence(lambda number: number)
    entity = factory.SubFactory(
        EntityFactory, entity_id=factory.SelfAttribute("..entity_id")
    )
    out_group = factory.Sequence(lambda number: "out_group_{}".format(number))
    t_pval = factory.Sequence(lambda number: number)
    mean_in = factory.Sequence(lambda number: number)
    mean_out = factory.Sequence(lambda number: number)
    effect_size = factory.Sequence(lambda number: number)
    t_qval = factory.Sequence(lambda number: number)
    t_qval_log = factory.Sequence(lambda number: number)
    n_dep_in = factory.Sequence(lambda number: number)
    n_dep_out = factory.Sequence(lambda number: number)
    frac_dep_in = factory.Sequence(lambda number: number)
    frac_dep_out = factory.Sequence(lambda number: number)
    selectivity_val = factory.Sequence(lambda number: number)


class ContextEnrichmentFactory(SQLAlchemyModelFactory):
    """
    This needs to be defined after ContextFactory, GeneFactory, and DependencyDatasetFactory
    """

    class Meta:
        model = ContextEnrichment

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    context = factory.SubFactory(ContextFactory)
    entity = factory.SubFactory(GeneFactory)
    dataset = factory.SubFactory(DependencyDatasetFactory)

    p_value = 1e-5
    t_statistic = 3.0
    effect_size_means_difference = 0.5


class CustomDatasetConfigFactory(SQLAlchemyModelFactory):
    class Meta:
        model = CustomDatasetConfig

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    # uuids should be unique
    # however, in testing, we may run into issues from generating one custom and one private dataset, and not realizing that they had the same uuid
    # adding 100 is just too hopefully avoid clashes with private dataset metadata uuids
    uuid = factory.Sequence(lambda number: str(uuid.UUID(int=number + 100)))
    config = json.dumps(
        {
            "label": "test custom label",
            "units": "test custom axis label",
            "feature_name": "test custom feature",
            "data_type": "user_upload",
            "is_custom": True,
            "is_continuous": True,
            "is_standard": False,
            "is_discoverable": False,
            "transpose": False,
        }
    )


class RowNonstandardMatrixFactory(SQLAlchemyModelFactory):
    class Meta:
        model = RowNonstandardMatrix

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    index = factory.Sequence(lambda number: number)
    # 90% of the tests want gene, we can override this default
    entity = factory.SubFactory(GeneFactory)
    owner_id = PUBLIC_ACCESS_GROUP
    row_name = None


class ColNonstandardMatrixFactory(SQLAlchemyModelFactory):
    class Meta:
        model = ColNonstandardMatrix

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    index = factory.Sequence(lambda number: number)
    cell_line = factory.SubFactory(CellLineFactory)
    owner_id = PUBLIC_ACCESS_GROUP


def NonstandardMatrixFactory(
    nonstandard_dataset_id,
    data_type="user_upload",
    entities=None,
    cell_lines=None,
    data=None,
    owner_id=PUBLIC_ACCESS_GROUP,
    rows_are_entities=True,
):
    """
    Note: if you are using this, you probably need to patch GET_NONSTANDARD_DATASETS into the test config. See test_gene_nodes/test_dataset_sort_key for an example.
    We should probably write a function to make it easier to do that.

    This creates the hdf5 file and gives you a rows in the database tables, but it DOES NOT add to the settings config. See above. The patched-in config needs to match this (e.g. nonstandard_dataset_id need to be the key, must be entity mapped, etc.). We could probably make this process easier.

    The test test_nonstandard_utils/test_get_row_of_values doesn't use this because it was written before this hdf5-creating factory was written. Now, there's no reason it shouldn't.

    This does not (yet) have the option of creating a nonstandard dataset with non-entity mapped rows. No reason to not add this funtionality, we just haven't implemented it.

    Like MatrixFactory, if nothing is provided, creates with one row and one column by default
    """
    (
        file_path,
        row_index_objects,
        col_index_objects,
    ) = create_hdf5_file_row_and_col_indices(
        entities,
        cell_lines,
        data,
        owner_id,
        RowNonstandardMatrixFactory,
        ColNonstandardMatrixFactory,
        rows_are_entities,
    )
    matrix = NonstandardMatrix(
        file_path=file_path,
        nonstandard_dataset_id=nonstandard_dataset_id,  # can't get factory.Sequence working here, so forcing the test writer to specify
        row_index=row_index_objects,
        col_index=col_index_objects,
        owner_id=owner_id,
        data_type=data_type,
    )
    _db.session.add(matrix)
    return matrix


class NonstandardMatrixLoaderMetadataFactory(SQLAlchemyModelFactory):
    class Meta:
        model = NonstandardMatrixLoaderMetadata

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    nonstandard_dataset_id = factory.Sequence(
        lambda number: "dataset-id.{}".format(number)
    )
    transpose = False


class PrivateDatasetMetadataFactory(SQLAlchemyModelFactory):
    # Note: A NonstandardMatrix object must also be created in order for this to show up in the interactive config, because get_allowed_private_datasets loops through all nonstandard matrices
    class Meta:
        model = PrivateDatasetMetadata

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    uuid = factory.Sequence(lambda number: str(uuid.UUID(int=number)))
    csv_path = factory.Sequence(lambda number: "private_factory_{}.csv".format(number))
    display_name = factory.Sequence(lambda number: "Private Dataset {}".format(number))
    units = "units"
    feature_name = "feature"
    is_transpose = True
    cell_line_name_type = CellLineNameType.depmap_id
    owner_id = PUBLIC_ACCESS_GROUP
    data_type = "user_upload"


class PredictiveModelFactory(SQLAlchemyModelFactory):
    class Meta:
        model = PredictiveModel

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    dataset = factory.SubFactory(DependencyDatasetFactory)
    entity = factory.SubFactory(GeneFactory)
    label = factory.Sequence(lambda number: "label_{}".format(number))
    pearson = factory.Sequence(lambda number: number)


class PredictiveFeatureFactory(SQLAlchemyModelFactory):
    class Meta:
        model = PredictiveFeature

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    feature_id = factory.Sequence(lambda n: n)
    feature_name = factory.Sequence(lambda n: n)


class PredictiveFeatureResultFactory(SQLAlchemyModelFactory):
    class Meta:
        model = PredictiveFeatureResult

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    class Params:
        feature_id = factory.Sequence(lambda number: "feature_label_{}".format(number))
        feature_name = factory.Sequence(lambda number: f"feature_name_{number}")

    predictive_model = factory.SubFactory(PredictiveModelFactory)
    rank = factory.Sequence(lambda number: number)
    importance = factory.Sequence(lambda number: number)

    feature = factory.SubFactory(
        PredictiveFeatureFactory,
        feature_id=factory.SelfAttribute("..feature_id"),
        feature_name=factory.SelfAttribute("..feature_name"),
    )


class PredictiveBackgroundFactory(SQLAlchemyModelFactory):
    class Meta:
        model = PredictiveBackground

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    dataset = factory.SubFactory(DependencyDatasetFactory)
    background = json.dumps([1, 2, 3, 4])


class STRProfileFactory(SQLAlchemyModelFactory):
    class Meta:
        model = STRProfile
        sqlalchemy_session = _db.session

    depmap_id = factory.Sequence(lambda number: "ACH-{}".format(number))
    cell_line = factory.SubFactory(CellLineFactory)
    name = factory.Sequence(lambda number: "name_{}".format(number))
    notation = factory.Sequence(lambda number: "notation_{}".format(number))
    d3s1358 = factory.Sequence(lambda number: "d3s1358_{}".format(number))
    th01 = factory.Sequence(lambda number: "th01_{}".format(number))
    d21s11 = factory.Sequence(lambda number: "d21s11_{}".format(number))
    d18s51 = factory.Sequence(lambda number: "d18s51_{}".format(number))
    penta_e = factory.Sequence(lambda number: "penta_e_{}".format(number))
    d5s818 = factory.Sequence(lambda number: "d5s818_{}".format(number))
    d13s317 = factory.Sequence(lambda number: "d13s317_{}".format(number))
    d7s820 = factory.Sequence(lambda number: "d7s820_{}".format(number))
    d16s539 = factory.Sequence(lambda number: "d16s539_{}".format(number))
    csf1po = factory.Sequence(lambda number: "csf1po_{}".format(number))
    penta_d = factory.Sequence(lambda number: "penta_d_{}".format(number))
    vwa = factory.Sequence(lambda number: "vwa_{}".format(number))
    d8s1179 = factory.Sequence(lambda number: "d8s1179_{}".format(number))
    tpox = factory.Sequence(lambda number: "tpox_{}".format(number))
    fga = factory.Sequence(lambda number: "fga_{}".format(number))
    amel = factory.Sequence(lambda number: "amel_{}".format(number))
    mouse = factory.Sequence(lambda number: "mouse_{}".format(number))


class TaigaAliasFactory(SQLAlchemyModelFactory):
    class Meta:
        model = TaigaAlias

        # Use the not-so-global scoped_session
        # Warning: DO NOT USE common.Session()!
        sqlalchemy_session = _db.session

    taiga_id = factory.Sequence(lambda number: "taiga-id.{}/file".format(number))
    canonical_taiga_id = factory.Sequence(
        lambda number: "canonical-taiga-id.{}/file".format(number)
    )


def CorrelationFactory(dataset_1, dataset_2, filename, cor_values=[[0.5]]):
    create_correlation_file(filename, cor_values)
    _db.session.add(
        CorrelatedDataset(dataset_1=dataset_1, dataset_2=dataset_2, filename=filename)
    )


def create_correlation_file(filename, cor_values):
    conn = sqlite3.connect(filename)
    conn.execute("create table correlation (dim_0 INTEGER, dim_1 INTEGER, cor REAL)")
    rows = []
    for i in range(len(cor_values)):
        for j in range(len(cor_values[i])):
            v = cor_values[i][j]
            if v is not None:
                rows.append((i, j, v))
    conn.executemany(
        "insert into correlation (dim_0, dim_1, cor) values (?, ?, ?)", rows
    )
    conn.commit()
    conn.close()
