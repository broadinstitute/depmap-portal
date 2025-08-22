# -*- coding: utf-8 -*-
"""Dataset models"""
from collections import defaultdict, OrderedDict
from typing import List, Optional, Tuple, Union
from depmap.cell_line.models_new import DepmapModel

import pandas as pd
import sqlalchemy as sa
from sqlalchemy import UniqueConstraint, distinct, func, nullslast, case  # type: ignore
from sqlalchemy.orm import backref
from sqlalchemy.exc import NoResultFound  # pyright: ignore
from depmap import enums
from depmap.antibody.models import Antibody
from depmap.cell_line.models import (
    CellLine,
    DiseaseSubtype,
    Lineage,
    PrimaryDisease,
)
from depmap.compound.models import (
    Compound,
    CompoundExperiment,
)
from depmap.database import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    Model,
    String,
    db,
    relationship,
)
from depmap.entity.models import Entity, entity_type_db_enum
from depmap.gene.models import Gene
from depmap.partials.matrix.models import ColMatrixIndex, Matrix, RowMatrixIndex
from depmap.predictability.utilities import DATASET_LABEL_TO_ENUM
from depmap.proteomics.models import Protein
from depmap.settings.shared import DATASET_METADATA
from depmap.transcription_start_site.models import TranscriptionStartSite
from depmap.utilities.exception import InvalidDatasetEnumError

from depmap.enums import DataTypeEnum, BiomarkerEnum


# Used for predictive features' feature type labels in predictability tile and celfie tile omics features
DATASET_NAME_TO_FEATURE_TYPE = {
    BiomarkerEnum.expression.name: "Expression",
    BiomarkerEnum.mutations_damaging.name: "Dam. Mut.",
    BiomarkerEnum.mutations_driver.name: "Driver Mut.",
    BiomarkerEnum.mutations_hotspot.name: "Hot. Mut.",
    BiomarkerEnum.context.name: "Lineage",
    BiomarkerEnum.rppa.name: "RPPA",
    BiomarkerEnum.rrbs.name: "Methylation",
    BiomarkerEnum.metabolomics.name: "Metabolomics",
    BiomarkerEnum.fusions.name: "Fusion",
    BiomarkerEnum.copy_number_relative.name: "Copy num.",
    BiomarkerEnum.copy_number_absolute.name: "Copy num. abs",
    BiomarkerEnum.crispr_confounders.name: "Confounders",
    BiomarkerEnum.rnai_confounders.name: "Confounders",
    BiomarkerEnum.rep1m_confounders.name: "Confounders",
    BiomarkerEnum.proteomics.name: "Proteomics",
    BiomarkerEnum.sanger_proteomics.name: "Sanger Proteomics",
}


class Dataset(Model):
    """Abstract class of Datasets"""

    __tablename__ = "dataset"
    __table_args__ = (
        UniqueConstraint("data_type", "priority", name="_data_type_priority_uc"),
    )

    DataTypeEnum = enums.DataTypeEnum

    dataset_id = Column(Integer, primary_key=True, autoincrement=True)
    display_name = Column(String, nullable=False, unique=True)
    type = Column(String, nullable=False)
    units = Column(String)
    data_type: "Column[enums.DataTypeEnum]" = Column(
        db.Enum(DataTypeEnum, name="DataTypeEnum"), nullable=False
    )
    Column(String, nullable=False)
    priority = Column(Integer)
    global_priority = Column(Integer, unique=True)
    taiga_id = Column(String, nullable=False)
    download_file = Column(String)
    owner_id = Column(Integer, nullable=False)

    matrix_id = Column(Integer, ForeignKey("matrix.matrix_id"), nullable=False)
    matrix: Matrix = relationship(
        "Matrix",
        backref=backref(__tablename__, uselist=False),
        foreign_keys="Dataset.matrix_id",
    )
    # uselist **needs** to be in this syntax. putting it at the end doesn't work
    # see final one-to-one example in http://docs.sqlalchemy.org/en/latest/orm/basic_relationships.html#relationships-one-to-one

    entity_type = Column(entity_type_db_enum, nullable=False)

    __mapper_args__ = {"polymorphic_identity": "dataset", "polymorphic_on": type}

    @property
    def nominal_range(self):  # No longer used
        return DATASET_METADATA[self.name].nominal_range

    @property
    def is_compound_experiment(self):
        return enums.DependencyEnum.is_compound_experiment_enum(self.name)

    @property
    def is_dose_replicate(self):
        return self.units == "Viability"

    @property
    def is_predictability_feature(self):
        return self.is_predictability_feature_enum(self.name)

    @staticmethod
    def is_predictability_feature_enum(enum: enums.DatasetEnum):
        return enum in DATASET_LABEL_TO_ENUM.values()

    def get_dose_replicate_enum(self):
        """
        Gets the enum of the dose replicate dataset associated with this self dataset
        Or returns none if there is no dose replicate dataset
        A dose replicate dataset refers to a dataset with per-replicate information for a particular dose. See the CompoundeDoseReplicate entity
        """
        dataset_to_dose_replicate_dataset = {
            DependencyDataset.DependencyEnum.CTRP_AUC: DependencyDataset.DependencyEnum.CTRP_dose_replicate,
            DependencyDataset.DependencyEnum.GDSC1_AUC: DependencyDataset.DependencyEnum.GDSC1_dose_replicate,
            DependencyDataset.DependencyEnum.GDSC2_AUC: DependencyDataset.DependencyEnum.GDSC2_dose_replicate,
            DependencyDataset.DependencyEnum.Repurposing_secondary_AUC: DependencyDataset.DependencyEnum.Repurposing_secondary_dose_replicate,
            DependencyDataset.DependencyEnum.Prism_oncology_AUC: DependencyDataset.DependencyEnum.Prism_oncology_dose_replicate,
        }
        if self.name in dataset_to_dose_replicate_dataset:
            return dataset_to_dose_replicate_dataset[self.name]
        else:
            return None

    @staticmethod
    def _get_class_from_enum_name(enum_name):
        """        
        :param enum_name: 
        :return: Either the DependencyDataset or BiomarkerDataset class 
        """
        if enum_name in DependencyDataset.DependencyEnum.values():
            return DependencyDataset
        elif enum_name in BiomarkerDataset.BiomarkerEnum.values():
            return BiomarkerDataset
        else:
            raise InvalidDatasetEnumError(
                "{} is not a valid DependencyEnum or BiomarkerEnum name string".format(
                    enum_name
                )
            )

    @staticmethod
    def _get_class_from_enum(enum):
        """        
        :param enum: 
        :return: Either the DependencyDataset or BiomarkerDataset class 
        """
        if enum in DependencyDataset.DependencyEnum:
            return DependencyDataset
        elif enum in BiomarkerDataset.BiomarkerEnum:
            return BiomarkerDataset
        else:
            raise InvalidDatasetEnumError(
                "{} is not a valid DependencyEnum or BiomarkerEnum".format(enum)
            )

    @classmethod
    def get_dataset_by_id(cls, dataset_id, must=False):
        q = db.session.query(cls).filter(cls.dataset_id == dataset_id)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_dataset_by_name(dataset_name: str, must=False) -> Optional["Dataset"]:
        try:
            dataset_class = Dataset._get_class_from_enum_name(dataset_name)
        except InvalidDatasetEnumError as e:
            if must:
                raise e
            else:
                return None

        assert (
            dataset_class.get_dataset_by_name != Dataset.get_dataset_by_name
        ), "get_dataset_by_name({}) -> {}".format(repr(dataset_name), dataset_class)

        return dataset_class.get_dataset_by_name(dataset_name, must)

    @classmethod
    def find_datasets_with_entity_ids(cls, entity_ids) -> List["Dataset"]:
        """
        :param entity_ids: List/set of entity ids search for in RowMatrixIndex
        This SHOULD NOT infer related entity ids, other code (such as populating the tree) relies on such behavior.
        For instance, the RowMatrixIndex for the RPPA dataset entity_ids of antibodies, not genes.
        If the entity_id passed in is for a gene, it should not not return the RPPA dataset with an antibody for that gene
        This behavior is relied on in multiple places
        NOTE: It is not confirmed whether or not crispr datasets MUST appear first but we make that assumption here due to precedent.
        :return: Dataset objects
        """

        return (
            RowMatrixIndex.query.filter(RowMatrixIndex.entity_id.in_(entity_ids))
            .join(Matrix)
            .join(cls)
            .with_entities(cls)
            .order_by(
                case([(DependencyDataset.data_type == "crispr", 0)], else_=1),
                nullslast(DependencyDataset.priority),
            )  # Unsure if format_gene_summary() gets first dataset from ordered dataset enums previously so add case just in case. Also, test_gene_dependency_datasets_where_present() assumes some kind of order
            .all()
        )

    def get_entity_id(self, entity_label, must=True):
        q = (
            self.matrix.row_index.join(Entity)
            .filter(Entity.label == entity_label)
            .with_entities(Entity.entity_id)
        )
        row = q.one_or_none()
        if must:
            assert row is not None
        return row[0]

    @staticmethod
    def get_dataset_by_taiga_id(taiga_id, must=True):
        """
        Used in downloads to get display name
        """
        q = Dataset.query.filter_by(taiga_id=taiga_id)

        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def has_cell_line(dataset_name, depmap_id):
        """
        This cannot yet be combined, because it needs to filter on name, which is not yet on Dataset 
        """
        dataset_class = Dataset._get_class_from_enum_name(dataset_name)
        return dataset_class.has_cell_line(dataset_name, depmap_id)

    @staticmethod
    def has_entity(dataset, entity_id):
        """
        This cannot yet be combined, because it needs to filter on name, which is not yet on Dataset
        """
        if isinstance(dataset, str):
            dataset_class = Dataset._get_class_from_enum_name(dataset)
        else:
            dataset_class = Dataset._get_class_from_enum(dataset)
        return dataset_class.has_entity(dataset, entity_id)

    @staticmethod
    def taiga_id_exists(taiga_id):
        # only used in loader
        return db.session.query(
            Dataset.query.filter_by(taiga_id=taiga_id).exists()
        ).scalar()

    @staticmethod
    def get_all_taiga_ids():
        """
        This is only used by the taiga alias loader, for getting all values in the taiga id column to assert they are loaded
        :return: all values in the taiga id column of this table
        """
        return [x[0] for x in Dataset.query.with_entities(Dataset.taiga_id).all()]

    @classmethod
    def get_dataset_by_data_type_priority(
        cls, data_type_enum: Union[str, enums.DataTypeEnum], priority: int = 1
    ):
        """
        Gets the dataset by its datatype and priority
        """
        if isinstance(data_type_enum, str):
            assert data_type_enum in DataTypeEnum.__members__
        return (
            db.session.query(cls)
            .filter(cls.data_type == data_type_enum)
            .filter(cls.priority == priority)
            .one_or_none()
        )

    @classmethod
    def get_datasets_in_order(cls, data_type=DataTypeEnum.crispr):
        """
        :param data_type: Defaults to crispr data type. This option puts all datasets of the same data type first in the list of prioritized datasets
        Gets datasets in order by priority regardless of data type (except given data type) while datasets with no priority assigned are shown last.
        * NOTE: It is undetermined whether crispr datasets MUST appear first but we provide this option as default to match behavior of deprecated function get_enums_in_order(). 
        """
        return cls.query.order_by(
            case([(cls.data_type == data_type.name, 0)], else_=1),
            nullslast(cls.priority),
        ).all()


class DependencyDataset(Dataset):
    """Dependency dataset information"""

    __tablename__ = "dependency_dataset"

    DependencyEnum = enums.DependencyEnum

    dependency_dataset_id = Column(
        Integer, ForeignKey("dataset.dataset_id"), primary_key=True
    )
    name: "Column[enums.DependencyEnum]" = Column(
        db.Enum(DependencyEnum, name="DependencyEnum"), nullable=False, unique=True
    )

    __mapper_args__ = {"polymorphic_identity": "dependency_dataset"}

    @staticmethod
    def get_dataset_by_name(
        dependency_dataset_name: str, must=False
    ) -> Optional["DependencyDataset"]:
        q = db.session.query(DependencyDataset).filter(
            DependencyDataset.name == dependency_dataset_name
        )
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def has_cell_line(dependency_dataset_name, depmap_id):
        row = (
            db.session.query(DependencyDataset)
            .join(Matrix, DependencyDataset.matrix_id == Matrix.matrix_id)
            .join(ColMatrixIndex)
            .filter(DependencyDataset.name == dependency_dataset_name)
            .filter(ColMatrixIndex.depmap_id == depmap_id)
            .one_or_none()
        )
        return row is not None

    @staticmethod
    def has_entity(dep_enum_or_name, entity_id):
        """
        Takes in DependencyEnum instead of being a method on a DependencyDataset so that we can query for presence of a gene without having to first retrieve the DependencyDataset
        """
        if isinstance(dep_enum_or_name, DependencyDataset.DependencyEnum):
            dep_enum_name = dep_enum_or_name.name
        else:
            dep_enum_name = dep_enum_or_name
        dep_dataset = DependencyDataset.query.filter_by(name=dep_enum_name)
        score_row_index = (
            dep_dataset.join(Matrix, DependencyDataset.matrix_id == Matrix.matrix_id)
            .join(RowMatrixIndex)
            .filter(RowMatrixIndex.entity_id == entity_id)
        )
        return db.session.query(score_row_index.exists()).scalar()

    @staticmethod
    def get_case_sensitive_name(name):
        for enum in list(DependencyDataset.DependencyEnum):
            if enum.name.lower() == name.lower():
                return enum.name
        return None

    @staticmethod
    def get_compound_experiment_priority_sorted_datasets_with_compound(
        compound_id: int,  # Expects compound.entity_id, not compound.compound_id
    ) -> List[Tuple["CompoundExperiment", "DependencyDataset"]]:
        # DEPRECATED: this will not work with breadbox datasets.
        # Calls to this should be replaced with get_all_datasets_containing_compound
        """
        :compound_id: entity id of compound object
        :return: List of (compound experiment object, dependency dataset object) tuples sorted by dataset priority first and secondly by compound experiment entity id
        """
        object_tuples = (
            db.session.query(CompoundExperiment, DependencyDataset)
            .join(
                Matrix, DependencyDataset.matrix_id == Matrix.matrix_id
            )  # NOTE: I'm not sure if this join is necessary since RowMatrixIndex already has a matrix_id
            .join(RowMatrixIndex)
            .join(
                CompoundExperiment,
                RowMatrixIndex.entity_id == CompoundExperiment.entity_id,
            )
            .join(Compound, Compound.entity_id == CompoundExperiment.compound_id)
            .filter(Compound.entity_id == compound_id)
            .order_by(
                nullslast(DependencyDataset.priority),
                CompoundExperiment.entity_id,
                case([(DependencyDataset.data_type == "drug_screen", 0)], else_=1),
            )
            .all()
        )

        return object_tuples


class BiomarkerDataset(Dataset):
    """
    E.g. expression, copy number, mutation
    """

    __tablename__ = "biomarker_dataset"

    BiomarkerEnum = enums.BiomarkerEnum

    biomarker_dataset_id = Column(
        Integer, ForeignKey("dataset.dataset_id"), primary_key=True
    )
    name: "Column[enums.BiomarkerEnum]" = Column(
        db.Enum(BiomarkerEnum, name="BiomarkerEnum"), nullable=False, unique=True
    )

    __mapper_args__ = {"polymorphic_identity": "biomarker_dataset"}

    @staticmethod
    def get_dataset_by_name(enum_name, must=False) -> Optional["BiomarkerDataset"]:
        q = db.session.query(BiomarkerDataset).filter(
            BiomarkerDataset.name == enum_name
        )
        if must:
            try:
                return q.one()
            except NoResultFound:
                raise NoResultFound(f"get_dataset_by_name did not find {enum_name}")
        else:
            return q.one_or_none()

    @staticmethod
    def has_cell_line(biomarker_dataset_name, depmap_id):
        row = (
            db.session.query(BiomarkerDataset)
            .join(Matrix)
            .join(ColMatrixIndex)
            .filter(BiomarkerDataset.name == biomarker_dataset_name)
            .filter(ColMatrixIndex.depmap_id == depmap_id)
            .one_or_none()
        )
        return row is not None

    @staticmethod
    def has_entity(biom_enum_or_name, entity, direct=True, by_label=False):
        """
        :param biom_enum_or_name: Takes in BiomarkerEnum instead of being a method on a BiomarkerDataset so that we can query for presence of a gene without having to first retrieve the BiomarkerDataset
        :param direct:
            Only used if the biomarker dataset has an entity type related to gene
                For a given gene, there maybe be associated antibody entity object(s).
                If direct=True, has_entity checks whether the dataset has the exact entity provided
                    N-ras (antibody entity) in the RPPA dataset returns True
                    NRAS (gene entity with the associated antibody) in the RPPA dataset returns **False**
                If direct=False, has_entity will further check whether the provided entity (a gene) has related entities in the dataset
                    N-ras in RPPA returns True
                    NRAS (gene entity in RPPA dataset also returns **True**
        :param by_label: by label vs by entity id
        """
        if isinstance(biom_enum_or_name, str):
            biom_enum = BiomarkerDataset.BiomarkerEnum[biom_enum_or_name]
        else:
            biom_enum = biom_enum_or_name

        row_index = BiomarkerDataset.query.filter_by(name=biom_enum.name).join(
            Matrix, RowMatrixIndex
        )

        gene_related_with_multiple_entities = {
            BiomarkerDataset.BiomarkerEnum.rrbs: TranscriptionStartSite,
            BiomarkerDataset.BiomarkerEnum.rppa: Antibody,
            BiomarkerDataset.BiomarkerEnum.proteomics: Protein,
            BiomarkerDataset.BiomarkerEnum.sanger_proteomics: Protein,
        }

        if not direct and biom_enum in gene_related_with_multiple_entities:
            entity_class = gene_related_with_multiple_entities[
                biom_enum
            ]  # TSS, or antibody
            pre_filter = entity_class.query.join(Gene, entity_class.gene)
            if by_label:
                pre_filter = pre_filter.filter(Gene.label == entity)
            else:
                pre_filter = pre_filter.filter(Gene.entity_id == entity)

            # We deliberately call .all() here to force retrieval of entity ids
            # This is because sqlite does a bad job if we provide it a nested query/one longer query containing everything
            # We would want this query to first filter on the gene table. However, sqlite instead filters on biomarker, then joins all row matrix indices. This causes performance issues, specifically on the gene page
            entity_ids_with_gene = [
                x[0] for x in pre_filter.with_entities(entity_class.entity_id).all()
            ]
            row_matrix_index = row_index.filter(
                RowMatrixIndex.entity_id.in_(entity_ids_with_gene)
            )

        else:
            if by_label:
                row_matrix_index = row_index.join(Entity, RowMatrixIndex.entity).filter(
                    Entity.label == entity
                )
            else:
                row_matrix_index = row_index.filter_by(entity_id=entity)

        return db.session.query(row_matrix_index.exists()).scalar()


class TabularDataset(Model):
    __tablename__ = "tabular_dataset"

    TabularEnum = enums.TabularEnum

    tabular_dataset_id = Column(Integer, primary_key=True, autoincrement=True)
    name: "Column[enums.TabularEnum]" = Column(
        db.Enum(enums.TabularEnum, name="TabularEnum"), nullable=False, unique=True
    )
    taiga_id = Column(String, nullable=False)

    @staticmethod
    def taiga_id_exists(taiga_id):
        return db.session.query(
            TabularDataset.query.filter_by(taiga_id=taiga_id).exists()
        ).scalar()

    @staticmethod
    def get_by_name(name, must=True):
        q = TabularDataset.query.filter(TabularDataset.name == name)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @property
    def display_name(self):
        return DATASET_METADATA[self.name].display_name

    @property
    def table_class(self):
        return {
            TabularDataset.TabularEnum.depmap_model: DepmapModel,
            TabularDataset.TabularEnum.gene: Gene,
            TabularDataset.TabularEnum.mutation: Mutation,
            TabularDataset.TabularEnum.fusion: Fusion,
            TabularDataset.TabularEnum.translocation: Translocation,
        }[self.name]

    @staticmethod
    def get_all_taiga_ids():
        """
        This is only used by the taiga alias loader, for getting all values in the taiga id column to assert they are loaded
        :return: all values in the taiga id column of this table
        """
        return [
            x[0]
            for x in TabularDataset.query.with_entities(TabularDataset.taiga_id).all()
        ]


class Mutation(Model):
    __tablename__ = "mutation"

    mutation_id = Column(Integer, primary_key=True, autoincrement=True)
    gene_id = Column(Integer, ForeignKey("gene.entity_id"), nullable=False)
    gene = relationship("Gene", foreign_keys="Mutation.gene_id", uselist=False)

    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"), nullable=False)
    cell_line = relationship("CellLine", backref=__tablename__)

    ## New columns 2022 Q4
    chrom = Column(String, nullable=False)
    pos = Column(Integer, nullable=False)  # start position
    ref = Column(String, nullable=False)  # reference allele
    alt = Column(String, nullable=False)  # tumor allele
    af = Column(Float)  # allele frequency
    ref_count = Column(Integer)
    alt_count = Column(Integer)
    gt = Column(String)  # genotype
    ps = Column(Float)  # phasing set
    variant_type = Column(String, nullable=False)
    variant_info = Column(String, nullable=False)
    dna_change = Column(String)
    protein_change = Column(String)
    hgnc_name = Column(String)
    hgnc_family = Column(String)
    uniprot_id = Column(String)
    gc_content = Column(Float)
    civic_id = Column(Float)
    civic_description = Column(String)
    civic_score = Column(Float)
    hess_signature = Column(String)
    likely_lof = Column(String)
    hess_driver = Column(String)
    revel_score = Column(Float)
    gwas_disease = Column(String)
    gwas_pmid = Column(Float)
    entrez_gene_id = Column(Float)
    oncogenic = Column(String)
    mutation_effect = Column(String)

    ## New columns 2023 Q4
    tumor_suppressor_high_impact = Column(Boolean)
    vep_biotype = Column(String)
    gnomade_af = Column(Float)
    vep_swissprot = Column(String)
    dbsnp_rs_id = Column(String)
    polyphen = Column(String)
    vep_pli_gene_value = Column(Float)
    vep_lof_tool = Column(Float)
    gnomadg_af = Column(Float)
    rescue = Column(Boolean)
    vep_clin_sig = Column(String)
    dp = Column(Integer)
    ensembl_feature_id = Column(String)
    transcript_likely_lof = Column(String)
    gtex_gene = Column(String)
    brca1_func_score = Column(Float)
    pharmgkb_id = Column(String)
    molecular_consequence = Column(String)
    vep_hgnc_id = Column(String)
    vep_existing_variation = Column(String)
    vep_mane_select = Column(String)
    sift = Column(String)
    vep_ensp = Column(String)
    ensembl_gene_id = Column(String)
    provean_prediction = Column(String)
    nmd = Column(String)
    vep_somatic = Column(String)
    vep_impact = Column(String)
    oncogene_high_impact = Column(Boolean)

    ## New columns 24Q2
    am_class = Column(String)
    am_pathogenicity = Column(Float)
    hotspot = Column(Boolean)

    ## New columns 25Q2
    intron = Column(String)
    exon = Column(String)
    rescue_reason = Column(String)

    @classmethod
    def has_gene(cls, gene, by_label=False):
        return db.session.query(
            cls.find_by_gene_query(gene, by_label).exists()
        ).scalar()

    @classmethod
    def has_cell_line(cls, depmap_id):
        return db.session.query(
            cls.query.filter_by(depmap_id=depmap_id).exists()
        ).scalar()

    @classmethod
    def get_all_gene_ids(cls):
        return cls.query.with_entities(
            CellLine.cell_line_display_name, *Mutation.__table__.columns
        ).with_entities(Mutation.gene_id)

    @classmethod
    def find_by_genes_and_cell_lines_query(cls, gene_ids, depmap_ids):
        query = (
            cls.query.with_entities(
                CellLine.cell_line_display_name, *Mutation.__table__.columns
            )
            .join(Mutation.cell_line)
            .join(Gene)
            .add_column(Gene.label.label("gene"))
        )

        if depmap_ids and len(depmap_ids) > 0:
            query = query.filter(Mutation.depmap_id.in_(depmap_ids))

        if gene_ids and len(gene_ids) > 0:
            query = query.filter(Mutation.gene_id.in_(gene_ids))

        return query

    @classmethod
    def find_by_gene_query(cls, gene, by_label=False):
        if by_label:
            return cls.query.join(Gene).filter(Gene.label == gene)
        else:
            lin = Lineage.query.filter_by(level=1).subquery()
            lin_subtype = Lineage.query.filter_by(level=2).subquery()
            return (
                cls.query.with_entities(
                    CellLine.cell_line_display_name,
                    PrimaryDisease.name.label("primary_disease"),
                    DiseaseSubtype.name.label("disease_subtype"),
                    lin.c.name.label("lineage"),
                    lin_subtype.c.name.label("lineage_subtype"),
                    *Mutation.__table__.columns,
                )
                .join(Mutation.cell_line)
                .outerjoin(
                    PrimaryDisease,
                    PrimaryDisease.primary_disease_id == CellLine.primary_disease_id,
                )
                .outerjoin(
                    DiseaseSubtype,
                    DiseaseSubtype.disease_subtype_id == CellLine.disease_subtype_id,
                )
                .outerjoin(lin, CellLine.depmap_id == lin.c.depmap_id)
                .outerjoin(lin_subtype, CellLine.depmap_id == lin_subtype.c.depmap_id)
                .filter(Mutation.gene_id == gene)
            )

    @classmethod
    def find_by_cell_line_query(cls, depmap_id):
        return (
            cls.query.with_entities(
                CellLine.cell_line_display_name, *Mutation.__table__.columns
            )
            .join(Mutation.cell_line)
            .filter_by(depmap_id=depmap_id)
            .join(Gene)
            .add_column(Gene.label.label("gene"))
        )

    @classmethod
    def gene_labels_with_non_null_protein_change(cls):
        tuples = (
            cls.query.filter(
                Mutation.protein_change is not None and Mutation.protein_change != ""
            )
            .join(Gene)
            .distinct(Gene.label)
            .order_by(Gene.label)
            .with_entities(Gene.label)
            .all()
        )

        return [x[0] for x in tuples]

    @staticmethod
    def get_variant_classification_cnt_for_gene(gene_id: int):
        """
        Returns tuples of variant class and # of cell lines
        """
        return (
            Mutation.query.join(Mutation.cell_line)
            .with_entities(Mutation.variant_info, CellLine.depmap_id)
            .filter(Mutation.gene_id == gene_id)
            .distinct()
            .from_self()
            .with_entities(Mutation.variant_info, func.count(1))
            .group_by(Mutation.variant_info)
            .all()
        )

    @staticmethod
    def get_cell_line_mutation_protein_change_series_by_gene(gene, by_label=False):
        dictionary = defaultdict(list)

        tuples = (
            Mutation.find_by_gene_query(gene, by_label)
            .order_by(Mutation.protein_change)
            .with_entities(Mutation.depmap_id, Mutation.protein_change)
            .all()
        )

        for depmap_id, protein_change in tuples:
            if protein_change and protein_change != "":
                dictionary[depmap_id].append(protein_change)

        return pd.Series(dictionary)

    @staticmethod
    def get_non_silent_rows(gene_label: str):
        """
        Returns pandas df where rows match gene, and mutation is either not silent or a hotspot
        """
        gene = Gene.get_by_label(gene_label)
        # raise Exception("need to re-implement get_non_silent_rows")
        query = (
            Mutation.query.with_entities(*Mutation.__table__.columns)
            .join(Mutation.cell_line)
            .filter(
                Mutation.gene_id == gene.entity_id, Mutation.variant_info != "SILENT",
            )
        )

        relevant_rows_df = pd.read_sql(query.statement, query.session.connection())
        return relevant_rows_df

    @staticmethod
    def get_mutation_detail_label(entity_label):
        """
        Returns a series of cell lines and mutation labels for a given entity_id
        """
        df = Mutation.get_non_silent_rows(entity_label)
        if df.shape[0] == 0:  # no rows, the apply errors
            return pd.Series()

        def format_label(row):
            label = row["variant_info"] + " (" + row["protein_change"] + ")"
            return label

        df["protein_change"].fillna(df["dna_change"], inplace=True)
        df["description"] = df.apply(format_label, axis=1)

        label_df = df.groupby("depmap_id").agg({"description": lambda x: "|".join(x)})
        label_series = pd.Series(
            label_df["description"].tolist(), label_df.index.tolist()
        )
        return label_series


class Fusion(Model):
    __tablename__ = "fusion"

    fusion_id = Column(Integer, primary_key=True, autoincrement=True)

    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"), nullable=False)
    cell_line = relationship("CellLine", foreign_keys="Fusion.depmap_id", uselist=False)
    fusion_name = Column(String, nullable=False)
    gene_1_id = Column(Integer, ForeignKey("gene.entity_id"), nullable=False)
    gene_1 = relationship("Gene", foreign_keys="Fusion.gene_1_id", uselist=False)
    gene_2_id = Column(Integer, ForeignKey("gene.entity_id"), nullable=False)
    gene_2 = relationship("Gene", foreign_keys="Fusion.gene_2_id", uselist=False)

    # New columns based on the updated schema
    total_reads_supporting_fusion = Column(Integer, nullable=False)
    total_fusion_coverage = Column(Integer, nullable=False)
    ffpm = Column(Float, nullable=False)
    split_reads_1 = Column(Integer, nullable=False)
    split_reads_2 = Column(Integer, nullable=False)
    discordant_mates = Column(Integer, nullable=False)

    @classmethod
    def has_gene(cls, gene_id):
        return db.session.query(cls.find_by_gene_query(gene_id).exists()).scalar()

    @classmethod
    def has_cell_line(cls, depmap_id):
        return db.session.query(
            cls.query.filter_by(depmap_id=depmap_id).exists()
        ).scalar()

    @classmethod
    def find_by_gene_query(cls, gene_id):
        left_alias = sa.orm.aliased(Gene, name="left")
        right_alias = sa.orm.aliased(Gene, name="right")
        lin = Lineage.query.filter_by(level=1).subquery()
        lin_subtype = Lineage.query.filter_by(level=2).subquery()

        query = (
            cls.query.with_entities(
                CellLine.cell_line_display_name,
                PrimaryDisease.name.label("primary_disease"),
                DiseaseSubtype.name.label("disease_subtype"),
                lin.c.name.label("lineage"),
                lin_subtype.c.name.label("lineage_subtype"),
                *Fusion.__table__.columns,
            )
            .join(Fusion.cell_line)
            .filter(sa.or_(cls.gene_1_id == gene_id, cls.gene_2_id == gene_id))
            .join(left_alias, cls.gene_1_id == left_alias.entity_id)
            .join(right_alias, cls.gene_2_id == right_alias.entity_id)
            .outerjoin(
                PrimaryDisease,
                PrimaryDisease.primary_disease_id == CellLine.primary_disease_id,
            )
            .outerjoin(
                DiseaseSubtype,
                DiseaseSubtype.disease_subtype_id == CellLine.disease_subtype_id,
            )
            .outerjoin(lin, CellLine.depmap_id == lin.c.depmap_id)
            .outerjoin(lin_subtype, CellLine.depmap_id == lin_subtype.c.depmap_id)
            .add_columns(
                sa.column('"right".entity_label', is_literal=True).label(
                    "gene_2_label"
                ),
                sa.column('"left".entity_label', is_literal=True).label("gene_1_label"),
            )
        )

        return query

    @classmethod
    def find_by_cell_line_query(cls, depmap_id):
        gene_1_alias = sa.orm.aliased(Gene, name="gene_1")
        gene_2_alias = sa.orm.aliased(Gene, name="gene_2")

        return (
            cls.query.filter_by(depmap_id=depmap_id)
            .join(gene_1_alias, cls.gene_1_id == gene_1_alias.entity_id)
            .join(gene_2_alias, cls.gene_2_id == gene_2_alias.entity_id)
            .add_columns(
                sa.column('"gene_2".entity_label', is_literal=True).label(
                    "gene_2_label"
                ),
                sa.column('"gene_1".entity_label', is_literal=True).label(
                    "gene_1_label"
                ),
            )
        )


class Translocation(Model):
    __tablename__ = "translocation"

    translocation_id = Column(Integer, primary_key=True, autoincrement=True)

    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"), nullable=False)
    cell_line = relationship(
        "CellLine", foreign_keys="Translocation.depmap_id", uselist=False
    )
    map_id = Column(String, nullable=False)
    break_point_1 = Column(String, nullable=False)
    break_point_2 = Column(String, nullable=False)
    trans_class = Column(String, nullable=False)
    gene_1_id = Column(Integer, ForeignKey("gene.entity_id"), nullable=False)
    gene_1 = relationship("Gene", foreign_keys="Translocation.gene_1_id", uselist=False)
    site_1 = Column(String, nullable=False)
    gene_2_id = Column(Integer, ForeignKey("gene.entity_id"), nullable=False)
    gene_2 = relationship("Gene", foreign_keys="Translocation.gene_2_id", uselist=False)
    site_2 = Column(String, nullable=False)
    fusion = Column(String, nullable=False)
    multi_sv_fusion = Column(String, nullable=False)
    cosmic_fus = Column(String, nullable=False)

    @classmethod
    def has_gene(cls, gene_id):
        return db.session.query(cls.find_by_gene_query(gene_id).exists()).scalar()

    @classmethod
    def has_cell_line(cls, depmap_id):
        return db.session.query(cls.find_by_models_query(depmap_id).exists()).scalar()

    @classmethod
    def find_by_gene_query(cls, gene_id):
        g1_alias = sa.orm.aliased(Gene, name="g1")
        g2_alias = sa.orm.aliased(Gene, name="g2")
        query = (
            cls.query.with_entities(
                CellLine.cell_line_display_name, *Translocation.__table__.columns
            )
            .join(Translocation.cell_line)
            .filter(sa.or_(cls.gene_1_id == gene_id, cls.gene_2_id == gene_id))
            .join(g1_alias, cls.gene_1_id == g1_alias.entity_id)
            .join(g2_alias, cls.gene_2_id == g2_alias.entity_id)
            .add_columns(
                sa.column('"g1".entity_label', is_literal=True).label("gene_1_label"),
                sa.column('"g2".entity_label', is_literal=True).label("gene_2_label"),
            )
        )
        return query

    # TODO: Will fully replace find_by_gene_query once the portal is fully dependent on DepmpModel instead of CellLine
    @classmethod
    def find_by_gene_using_model_table_query(cls, gene_id):
        g1_alias = sa.orm.aliased(Gene, name="g1")
        g2_alias = sa.orm.aliased(Gene, name="g2")
        query = (
            cls.query.with_entities(
                DepmapModel.stripped_cell_line_name, *Translocation.__table__.columns
            )
            .join(Translocation.cell_line)
            .filter(sa.or_(cls.gene_1_id == gene_id, cls.gene_2_id == gene_id))
            .join(g1_alias, cls.gene_1_id == g1_alias.entity_id)
            .join(g2_alias, cls.gene_2_id == g2_alias.entity_id)
            .add_columns(
                sa.column('"g1".entity_label', is_literal=True).label("gene_1_label"),
                sa.column('"g2".entity_label', is_literal=True).label("gene_2_label"),
            )
        )
        return query

    @classmethod
    def find_by_models_query(cls, model_id):
        g1_alias = sa.orm.aliased(Gene, name="g1")
        g2_alias = sa.orm.aliased(Gene, name="g2")
        return (
            cls.query.with_entities(
                DepmapModel.stripped_cell_line_name, *Translocation.__table__.columns
            )
            .join(Translocation.cell_line)
            .filter_by(depmap_id=model_id)
            .join(g1_alias, cls.gene_1_id == g1_alias.entity_id)
            .join(g2_alias, cls.gene_2_id == g2_alias.entity_id)
            .add_columns(
                sa.column('"g1".entity_label', is_literal=True).label("gene_1_label"),
                sa.column('"g2".entity_label', is_literal=True).label("gene_2_label"),
            )
        )
