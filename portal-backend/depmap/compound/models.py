from typing import List
import sqlalchemy
from sqlalchemy import and_, func
from depmap.database import (
    Column,
    Float,
    ForeignKey,
    Integer,
    Model,
    String,
    db,
    relationship,
)
from depmap.entity.models import Entity, EntityAlias
from depmap.cell_line.models import CellLine
from depmap.gene.models import Gene
import pandas as pd
import re

gene_compound_target_association = db.Table(
    "gene_compound_target_association",
    Column("gene_entity_id", Integer, ForeignKey("gene.entity_id"), nullable=False),
    Column(
        "compound_entity_id", Integer, ForeignKey("compound.entity_id"), nullable=False,
    ),
    db.UniqueConstraint(
        "gene_entity_id", "compound_entity_id", name="uc_gene_compound_entity_id"
    ),
)


class Compound(Entity):
    __tablename__ = "compound"
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)
    compound_id = Column(String(10), nullable=False, unique=True)
    target_or_mechanism = Column(String)
    target_gene: List[Gene] = relationship(
        "Gene",
        secondary=gene_compound_target_association,
        backref="targetting_compound",
    )  # m2m
    release = Column(
        String
    )  # Name of data release data screen containing this compound was released within.
    synonyms = Column(String)
    prism_screen = Column(String)
    sample_id = Column(String)
    chembl_id = Column(String)
    smiles = Column(String)
    inchikey = Column(String)
    units = Column(String)

    __mapper_args__ = {"polymorphic_identity": "compound"}

    @property
    def broad_id(self):
        compound_experiments = CompoundExperiment.get_all_by_compound_id(self.entity_id)
        compound_experiments = [
            ce for ce in compound_experiments if ce.xref_type == "BRD"
        ]
        if len(compound_experiments) == 0:
            return None
        broad_xref = compound_experiments[0].xref
        xref_parts = broad_xref.split("-")
        if len(xref_parts) < 2:
            return broad_xref
        return xref_parts[0] + "-" + xref_parts[1]

    @staticmethod
    def get_by_label(label, must=True) -> "Compound":
        q = Compound.query.filter(Compound.label == label)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def find_by_name_prefix(prefix, limit):
        compounds = (
            Compound.query.filter(Compound.label.startswith(prefix))
            .order_by(Compound.label)
            .limit(limit)
            .all()
        )
        return compounds

    @staticmethod
    def get_aliases_by_entity_id(entity_id) -> List[str]:
        aliases = (
            Compound.query.filter(Compound.entity_id == entity_id)
            .join(EntityAlias, EntityAlias.entity_id == Compound.entity_id)
            .with_entities(EntityAlias.alias)
        )

        compound_aliases = [a[0] for a in aliases]

        return compound_aliases


# for those cases where a dataset has data for the same compound multiple times
class CompoundExperiment(Entity):
    __tablename__ = "compound_experiment"
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)

    # this is the normalized compound
    compound_id = Column(
        Integer, ForeignKey("compound.entity_id"), nullable=False, index=True
    )
    compound = relationship(
        "Compound", foreign_keys="CompoundExperiment.compound_id", uselist=False
    )

    xref = Column(String, nullable=False)
    xref_type = Column(
        db.Enum("GDSC1", "GDSC2", "CTRP", "BRD", name="CompoundExperimentXrefType",),
        nullable=False,
    )

    __table_args__ = (
        db.Index("uk_compound_experiment_xref_xref_type", "xref_type", "xref"),
    )

    __mapper_args__ = {"polymorphic_identity": "compound_experiment"}

    @property
    def xref_full(self):
        return "{}:{}".format(self.xref_type, self.xref)

    @staticmethod
    def get_by_entity_id(entity_id, must=True) -> "CompoundExperiment":
        q = CompoundExperiment.query.filter(CompoundExperiment.entity_id == entity_id)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_by_label(label, must=True) -> "CompoundExperiment":
        q = CompoundExperiment.query.filter(CompoundExperiment.label == label)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_by_xref(xref, xref_type, must=True):
        q = CompoundExperiment.query.filter_by(xref=xref, xref_type=xref_type)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def split_xref_type_and_xref(xref_full):
        """
        Used by various loaders
        """
        if re.match(r"PRC-\d{9}-\d{3}-\d{2}", xref_full):
            # This is to use as catch all for the Sample IDs(e.g. PRC-000964908-468-05 from PRISMOncRefResponseCurves)
            xref_type, xref = (
                "BRD",
                xref_full,
            )  # Based on the compound_metadata.v26 where xref PRC-008632586-537-09 has xref_type "BRD"
            return xref_type, xref
        else:
            parts = xref_full.split(":")
            assert len(parts) == 2, "Invalid compound ID: {}".format(repr(xref_full))
            return parts[0], parts[1]

    @staticmethod
    def get_by_xref_full(xref_full, must=True):
        """
        :param xref_full: xref_type:xref, e.g. CTRP:606135
        """
        xref_type, xref = CompoundExperiment.split_xref_type_and_xref(xref_full)
        return CompoundExperiment.get_by_xref(xref, xref_type, must=must)

    # For Context Explorer loader
    @staticmethod
    def get_by_xref_full_return_none_if_invalid_id(xref_full, must=True):
        """
        :param xref_full: xref_type:xref, e.g. CTRP:606135
        """
        parts = xref_full.split(":")
        if len(parts) != 2:
            return None

        xref_type, xref = parts[0], parts[1]
        return CompoundExperiment.get_by_xref(xref, xref_type, must=must)

    @staticmethod
    def get_first_with_compound_xref_type(compound_id, xref_type):
        return CompoundExperiment.query.filter_by(
            compound_id=compound_id, xref_type=xref_type
        ).first()

    @classmethod
    def get_all_for_compound_label(
        cls, compound_label: str, must=True
    ) -> List["CompoundExperiment"]:
        compound = Compound.get_by_label(compound_label, must)
        if compound is None:
            return []

        return cls.get_all_by_compound_id(compound.entity_id)

    @staticmethod
    def get_all_by_compound_id(compound_id) -> List["CompoundExperiment"]:
        return CompoundExperiment.query.filter_by(compound_id=compound_id).all()


class CompoundDose(Entity):
    """
    Represents a compound at a particular dose. Any replicates are collapsed into this one representation.

    We are not relating the CompoundDose and CompoundDoseReplicate entities, instead choosing to double load the dose column. This is because we have thus far not needed this relation, instead just relating the datasets
    """

    __tablename__ = "compound_dose"
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)

    # this is the normalized compound
    compound_experiment_id = Column(
        Integer,
        ForeignKey("compound_experiment.entity_id"),
        nullable=False,
        index=True,
    )
    compound_experiment = relationship(
        "CompoundExperiment",
        foreign_keys="CompoundDose.compound_experiment_id",
        uselist=False,
    )

    dose = Column(Float, nullable=False)

    __mapper_args__ = {"polymorphic_identity": "compound_dose"}

    @staticmethod
    def format_label(compound_experiment_label, dose):
        """
        Static because used by the loader
        """
        return "{} {}".format(
            compound_experiment_label, CompoundDose._format_label_suffix(dose)
        )

    @property
    def label_without_compound_name(self):
        return CompoundDose._format_label_suffix(self.dose)

    @staticmethod
    def _format_label_suffix(dose):
        """
        Written so that format_label and label_without_experiment can share this
        """
        return "{}μM".format(dose)

    @staticmethod
    def get_all_with_compound_experiment_id(cpd_exp_id) -> List["CompoundDose"]:
        q = CompoundDose.query.filter_by(compound_experiment_id=cpd_exp_id)
        return q.all()

    @classmethod
    def get_all_for_compound_label(
        cls, compound_label: str, must=True
    ) -> List["CompoundDose"]:
        compound_experiments = CompoundExperiment.get_all_for_compound_label(
            compound_label, must
        )
        return [
            entity
            for compound_experiment in compound_experiments
            for entity in cls.get_all_with_compound_experiment_id(
                compound_experiment.entity_id
            )
        ]

    @staticmethod
    def get_by_compound_experiment_and_dose(xref, xref_type, dose, must=False):
        q = CompoundDose.query.join(
            CompoundExperiment,
            CompoundExperiment.entity_id == CompoundDose.compound_experiment_id,
        ).filter(
            CompoundExperiment.xref == xref,
            CompoundExperiment.xref_type == xref_type,
            CompoundDose.dose == dose,
        )
        if must:
            return q.one()
        else:
            return q.one_or_none()


class CompoundDoseReplicate(Entity):
    """
    Represents a replicate of a compound at a particular dose. There may be more than one replicate per dose.

    We are not relating the CompoundDose and CompoundDoseReplicate entities, instead choosing to double load the dose column. This is because we have thus far not needed this relation, instead just relating the datasets
    """

    __tablename__ = "compound_dose_replicate"
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)

    # this is the normalized compound
    compound_experiment_id = Column(
        Integer,
        ForeignKey("compound_experiment.entity_id"),
        nullable=False,
        index=True,
    )
    compound_experiment = relationship(
        "CompoundExperiment",
        foreign_keys="CompoundDoseReplicate.compound_experiment_id",
        uselist=False,
    )

    dose = Column(Float, nullable=False)
    unit = "μM"
    replicate = Column(Integer, nullable=False)
    is_masked = Column(sqlalchemy.Boolean, unique=False, default=None)

    __mapper_args__ = {"polymorphic_identity": "compound_dose_replicate"}

    @staticmethod
    def format_label(compound_experiment_label, dose, replicate, is_masked):
        """
        Static because used by the loader
        """
        return "{} {}".format(
            compound_experiment_label,
            CompoundDoseReplicate._format_label_suffix(dose, replicate, is_masked),
        )

    @property
    def label_without_compound_name(self):
        return CompoundDoseReplicate._format_label_suffix(
            self.dose, self.replicate, self.is_masked
        )

    @staticmethod
    def _format_label_suffix(dose, replicate, is_masked):
        """
        Written so that format_label and label_without_experiment can share this
        """
        return "{}μM rep{}{}".format(dose, replicate, " masked" if is_masked else "")

    @staticmethod
    def get_all_with_compound_experiment_id(cpd_exp_id):
        q = CompoundDoseReplicate.query.filter_by(compound_experiment_id=cpd_exp_id)
        return q.all()

    @staticmethod
    def get_dose_min_max_of_replicates_with_compound_experiment_id(cpd_exp_id):
        q = CompoundDoseReplicate.query.filter_by(
            compound_experiment_id=cpd_exp_id
        ).with_entities(
            CompoundDoseReplicate.entity_id,
            func.max(CompoundDoseReplicate.dose).label("max_dose"),
            func.min(CompoundDoseReplicate.dose).label("min_dose"),
        )

        return q.all()

    @classmethod
    def get_all_for_compound_label(
        cls, compound_label: str, must=True
    ) -> List["CompoundDoseReplicate"]:
        compound_experiments = CompoundExperiment.get_all_for_compound_label(
            compound_label, must
        )
        return [
            entity
            for compound_experiment in compound_experiments
            for entity in cls.get_all_with_compound_experiment_id(
                compound_experiment.entity_id
            )
        ]


class DoseResponseCurve(Model):
    """
    This model has no notion of a dataset. This works because thus far, a compound experiment only belongs to one dataset. I.e. we do not have multiple dose curve datasets with BRD-0123456 compounds
    """

    __tablename__ = "dose_response_curve"

    dose_response_curve = Column(Integer, primary_key=True, autoincrement=True)

    depmap_id = Column(
        String, ForeignKey("cell_line.depmap_id"), nullable=False, index=True
    )
    cell_line = relationship("CellLine", backref=__tablename__)

    compound_exp_id = Column(Integer, ForeignKey("entity.entity_id"), index=True)
    compound_exp = relationship(
        "CompoundExperiment", foreign_keys="DoseResponseCurve.compound_exp_id"
    )

    ec50 = Column(Float)
    slope = Column(Float)
    upper_asymptote = Column(Float)
    lower_asymptote = Column(Float)

    @staticmethod
    def get_curve_params(compound_experiment: CompoundExperiment, model_ids: List[str]):
        if len(model_ids) == 1:
            return DoseResponseCurve.query.filter(
                DoseResponseCurve.compound_exp == compound_experiment,
                DoseResponseCurve.depmap_id == model_ids[0],
            ).all()

        return (
            DoseResponseCurve.query.filter(
                and_(
                    DoseResponseCurve.compound_exp == compound_experiment,
                    DoseResponseCurve.depmap_id.in_(model_ids),
                )
            )
            .join(
                CompoundDoseReplicate,
                CompoundDoseReplicate.compound_experiment_id
                == DoseResponseCurve.compound_exp_id,
            )
            .all()
        )
