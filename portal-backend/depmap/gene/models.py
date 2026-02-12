import itertools
import re
from typing import List, Optional

import flask
import pandas as pd
from flask import current_app
from sqlalchemy.orm.exc import NoResultFound

from depmap.database import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    Model,
    String,
    Text,
    db,
)
from depmap.entity.models import Entity, EntityAlias
from depmap.enums import DependencyEnum
from depmap.utilities import hdf5_utils


class Gene(Entity):
    __tablename__ = "gene"
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    entrez_id = Column(Integer, nullable=True, unique=True, index=True)
    ensembl_id = Column(String, nullable=True, unique=True, index=True)
    hgnc_id = Column(String(80), nullable=False, unique=True, index=True)
    locus_type = Column(String(80), nullable=False)
    # multiple uniprot IDs encoded as a ";" delimited string. use gene.get_uniprot_ids to get version as a list
    # I did it this way because most common case was just a single ID and seemed like a lot of extra typing to create
    # one-to-many joined table. However, if we ever want to look up genes by uniprot, expect to create that table.
    uniprot_ids_str = Column(String(255), nullable=True)

    @property
    def symbol(self):
        return self.label

    __mapper_args__ = {"polymorphic_identity": "gene"}

    def get_uniprot_ids(self):
        if self.uniprot_ids_str == None:
            return []
        else:
            return self.uniprot_ids_str.split(";")

    @staticmethod
    def get_gene_from_rowname(symbol_with_stable_id, must=True) -> Optional["Gene"]:
        """
        :param symbol_with_stable_id: String with entrez or ensembl id in brackets. E.g. "NRAS (4893)", or "NRAS (ENSG00000213281)". Just "(4893)" is technically allowed
        :return: the entity object
        """
        assert isinstance(symbol_with_stable_id, str), "symbol_with_stable_id=" + repr(
            symbol_with_stable_id
        )
        pattern = re.compile(".*\\(([^)]+)\\)")
        match = pattern.match(symbol_with_stable_id)

        if must:
            assert match is not None, (
                'Could not find stable id in "' + symbol_with_stable_id + '"'
            )
        else:
            if match is None:
                return None

        stable_id = match.group(1)

        # Some ensembl ID's have an extra .<number> in them (e.g. XRCC4 (ENSG00000152422.15)). As of the time of writing this comment, this has
        # only been discovered in the Fusion table. This causes the initial pattern to return an invalid ID "ENSG00000152422.15".
        # We need to remove the dot and anything after.
        if "." in match.group(1):
            pattern = re.compile(".*(?=\.)")
            match = pattern.match(match.group(1))
            stable_id = match.group(0)

        try:
            gene_model_property = get_stable_id_type(stable_id)
        except ValueError as e:
            if must:
                raise ValueError(
                    "Unknown stable ID format from " + symbol_with_stable_id
                ) from e
            return None
        try:
            entity = Gene.query.filter_by(**{gene_model_property: stable_id}).one()
        except NoResultFound:
            if must:
                raise NoResultFound(
                    "No entity found with "
                    + gene_model_property
                    + " of "
                    + stable_id
                    + ".  Row was: "
                    + symbol_with_stable_id
                )
            return None

        return entity

    @staticmethod
    def get_by_label(label, must=True) -> "Gene":
        q = Gene.query.filter(Gene.label == label)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_gene_by_entrez(entrez_id: int, must=True) -> Optional["Gene"]:
        q = Gene.query.filter(Gene.entrez_id == entrez_id)
        if must:
            try:
                return q.one()
            except NoResultFound:
                raise NoResultFound(
                    "No entity found with entrez id {}".format(entrez_id)
                )
        else:
            return q.one_or_none()


def get_stable_id_type(stable_id):
    """
    :param stable_id:
    :return: Gene model property appropriate for the given stable_id
    """
    if stable_id.startswith("ENSG"):
        return "ensembl_id"
    elif stable_id.isnumeric():
        return "entrez_id"
    else:
        raise ValueError("Unknown stable ID format", stable_id)


class GeneExecutiveInfo(Model):
    """
    Stores additional meta information for use in executive summary cards
    Presence of GeneExecutiveInfo does not indicate that there is data in the dataset for this gene
        Specifically, crispr dataset genes with is_dropped_by_chronos True are not in the crispr dataset
        They were deliberately removed, but are recorded here because we want to convey this to users
    """

    __tablename__ = "gene_executive_info"

    __table_args__ = (
        db.UniqueConstraint("gene_id", "dataset", name="uc_gene_id_dataset"),
    )

    gene_executive_info_id = Column(Integer, primary_key=True, autoincrement=True)
    gene_id = Column(Integer, ForeignKey("gene.entity_id"), nullable=False, index=True)
    gene = db.relationship(
        "Gene", foreign_keys="GeneExecutiveInfo.gene_id", uselist=False
    )
    dataset: "Column[DependencyEnum]" = Column(
        db.Enum(DependencyEnum, name="DependencyEnum"), nullable=False
    )
    num_dependent_cell_lines = Column(Integer)
    num_lines_with_data = Column(Integer)
    is_strongly_selective = Column(Boolean)
    is_common_essential = Column(Boolean)
    is_dropped_by_chronos = Column(
        Boolean
    )  # this should only be true for crispr. the avana chronos (and by extension the combined chronos) drops some genes relative to the old ceres dataset

    @staticmethod
    def get(
        gene_id, dataset_name: DependencyEnum, must=True
    ) -> Optional["GeneExecutiveInfo"]:
        query = GeneExecutiveInfo.query.filter_by(gene_id=gene_id, dataset=dataset_name)
        if must:
            return query.one()
        else:
            return query.one_or_none()

    @staticmethod
    def get_gene_selectivity_series():
        dictionary = {}

        rows = (
            GeneExecutiveInfo.query.join(Gene)
            .filter(GeneExecutiveInfo.dataset == DependencyEnum.Chronos_Combined)
            .add_columns(Gene.label)
            .with_entities(Gene.label, GeneExecutiveInfo.is_strongly_selective)
            .all()
        )

        for label, is_strongly_selective in rows:
            # These are encoded as 1/NULL in the database
            if is_strongly_selective == 1:
                dictionary[label] = "strongly selective"
            else:
                dictionary[label] = "not strongly selective"

        return pd.Series(dictionary)

    @staticmethod
    def get_gene_essentiality_series():
        dictionary = {}

        rows = (
            GeneExecutiveInfo.query.join(Gene)
            .filter(GeneExecutiveInfo.dataset == DependencyEnum.Chronos_Combined)
            .add_columns(Gene.label)
            .with_entities(Gene.label, GeneExecutiveInfo.is_common_essential)
            .all()
        )

        for label, is_common_essential in rows:
            # These are encoded as 1/0/NULL in the database
            if is_common_essential == 1:
                dictionary[label] = "common essential"
            elif is_common_essential == 0:
                dictionary[label] = "not common essential"
            else:
                dictionary[label] = "unknown"

        return pd.Series(dictionary)
