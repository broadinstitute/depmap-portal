# -*- coding: utf-8 -*-
"""Cell line models."""
import re
from typing import Optional

import pandas as pd
import sqlalchemy

from depmap.database import Column, ForeignKey, Integer, Model, String, db, relationship


# CellLine.all_table_query() within get_cell_line_selector_lines_table for getting
# cell line selector lines table
def add_cell_line_table_columns(query):
    """
    Separated so that Dataset.get_cell_line_table_query can use this as well
    Joins database tables required for cell line table columns
    """
    table_query = (
        query.join(PrimaryDisease, CellLine.primary_disease)
        .join(Lineage, CellLine.lineage)
        .add_columns(
            sqlalchemy.column('"primary_disease".name', is_literal=True).label(
                "primary_disease"
            ),
            sqlalchemy.column('"lineage".name', is_literal=True).label("lineage"),
            sqlalchemy.column('"lineage".level', is_literal=True).label(
                "lineage_level"
            ),
        )
    )
    return table_query


cell_line_with_depmap_id_1 = re.compile("\\S+ \\(([^)]+)\\)")
cell_line_with_depmap_id_2 = re.compile("(ACH-\\d+)(?:-\\d+)?$")


def get_all_entities_and_indices_for_model(category):
    """
    :param category: a class derived from Model (like PrimaryDisease, DiseaseSubtype, etc)
    :return: a list of tuples (entity label, index)
    """
    entities = (
        category.query.distinct(category.name)
        .order_by(category.name)
        .with_entities(category.name)
        .all()
    )
    ids = [
        (entity[0], idx + 1)  # +1 so that we start the first primary_disease_id at one
        for idx, entity in enumerate(entities)
    ]
    return ids


class CellLine(Model):
    """
    Any additional properties added to this model that would want to be updated needs to be added to load_cell_lines_metadata in cell_line_loader.
    May need to add column to expected_columns variable in format_cell_lines
    """

    __tablename__ = "cell_line"

    depmap_id = Column(String, primary_key=True)
    cell_line_name = Column(String, index=True, unique=True, nullable=True)
    cell_line_alias = db.relationship("CellLineAlias", lazy="dynamic")
    cell_line_display_name = Column(String, nullable=False)  # stripped cell line name

    wtsi_master_cell_id = Column(Integer, index=True)  # wtsi is wellcome trust sanger
    cell_line_passport_id = Column(
        String, index=True
    )  # Sanger cell line passport is Sanger ID in https://cellmodelpassports.sanger.ac.uk/
    cosmic_id = Column(Integer, index=True)

    lineage = db.relationship("Lineage", lazy="dynamic")

    primary_disease_id = Column(
        Integer, ForeignKey("primary_disease.primary_disease_id")
    )
    primary_disease = relationship("PrimaryDisease", backref=__tablename__)

    disease_subtype_id = Column(
        Integer, ForeignKey("disease_subtype.disease_subtype_id")
    )
    disease_subtype = relationship("DiseaseSubtype", backref=__tablename__)

    tumor_type_id = Column(Integer, ForeignKey("tumor_type.tumor_type_id"))
    tumor_type = relationship(
        "TumorType", backref=__tablename__
    )  # is primary/metastasis

    culture_medium_id = Column(Integer, ForeignKey("culture_medium.culture_medium_id"))
    culture_medium = relationship(
        "CultureMedium", backref=__tablename__
    )  # currently not loaded

    conditions_id = Column(Integer, ForeignKey("conditions.conditions_id"))
    conditions = relationship("Conditions", backref=__tablename__)

    catalog_number = Column(String, nullable=True)
    gender = Column(String)
    growth_pattern = Column(String)
    source = Column(String)
    rrid = Column(String)  # used for cellosaurus
    image_filename = Column(String)
    comments = Column(String)

    def __eq__(self, other):
        if isinstance(other, CellLine):
            return self.depmap_id == other.depmap_id
        return False

    def __hash__(self):
        return hash(self.depmap_id)

    @property
    def level_1_lineage(self):
        """
        All cell lines have a level 1 lineage, even if it may be "unknown"
        """
        return next(lineage for lineage in self.lineage.all() if lineage.level == 1)

    def lineage_is_unknown(self):
        """
        If level 1 lineage is unknown, there is no level 2 or 3 lineage
        """
        return self.level_1_lineage.name == "unknown"

    @staticmethod
    def all():
        all_cell_lines = db.session.query(CellLine).all()
        return all_cell_lines

    @staticmethod
    def all_table_query():
        return add_cell_line_table_columns(db.session.query(CellLine))

    @staticmethod
    def get_cell_line_metadata_query():
        """
        Joins database tables required for cell line metadata table (currently used in Data Slicer)
        """
        query = db.session.query(CellLine)
        table_query = (
            query.outerjoin(PrimaryDisease, CellLine.primary_disease)
            .outerjoin(Lineage, CellLine.lineage)
            .outerjoin(DiseaseSubtype, CellLine.disease_subtype)
            .outerjoin(TumorType, CellLine.tumor_type)
            .add_columns(
                sqlalchemy.column('"primary_disease".name', is_literal=True).label(
                    "primary_disease"
                ),
                sqlalchemy.column('"lineage".name', is_literal=True).label("lineage"),
                sqlalchemy.column('"lineage".level', is_literal=True).label(
                    "lineage_level"
                ),
                sqlalchemy.column('"disease_subtype".name', is_literal=True).label(
                    "disease_subtype"
                ),
                sqlalchemy.column('"tumor_type".name', is_literal=True).label(
                    "tumor_type"
                ),
            )
        )
        return table_query

    @staticmethod
    def get_by_name(cell_line_name, must=False) -> "CellLine":
        q = db.session.query(CellLine).filter(CellLine.cell_line_name == cell_line_name)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_by_name_or_depmap_id_for_loaders(
        cell_line_name, must=False
    ) -> Optional["CellLine"]:
        """
        Convenience method for loaders, to tolerate whether the incoming data has cell line name or depmap id
        We shouldn't be using this in the web portal. In our codebase, we should be clear whether an incomign string is a depmap id, or cell line name
        """
        m = cell_line_with_depmap_id_1.match(cell_line_name)
        if m is None:
            m = cell_line_with_depmap_id_2.match(cell_line_name)
        if m is not None:
            cell_line = CellLine.get_by_depmap_id(m.group(1), must=must)
        else:
            cell_line = CellLine.get_by_name(cell_line_name, must=must)
        return cell_line

    @staticmethod
    def get_by_depmap_id(depmap_id, must=False) -> Optional["CellLine"]:
        q = db.session.query(CellLine).filter(CellLine.depmap_id == depmap_id)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def exists(cell_line_name):
        return db.session.query(
            CellLine.query.filter_by(cell_line_name=cell_line_name).exists()
        ).scalar()

    @staticmethod
    def exists_by_depmap_id(depmap_id):
        return db.session.query(
            CellLine.query.filter_by(depmap_id=depmap_id).exists()
        ).scalar()

    @staticmethod
    def get_valid_cell_line_names_in(cell_line_names):
        """
        Returns (valid) cell line names contained in the provided list/set cell_line_names 
        """
        q = (
            db.session.query(CellLine)
            .filter(CellLine.cell_line_name.in_(cell_line_names))
            .with_entities(CellLine.cell_line_name)
        )

        exists = db.session.query(q.exists()).scalar()

        if exists:
            # unpacking to get a tuple of returned cell line names
            valid_cell_line_names = list(zip(*q.all()))[0]
            return set(valid_cell_line_names)
        else:
            return set()

    @staticmethod
    def get_all_genders():
        genders = (
            CellLine.query.distinct(CellLine.gender)
            .order_by(CellLine.gender)
            .with_entities(CellLine.gender)
            .all()
        )
        gender_ids = [
            (gender[0], idx + 1,)  # +1 so that we start the first at one
            for idx, gender in enumerate(genders)
        ]
        return gender_ids

    @staticmethod
    def get_all_growth_patterns():
        # copied from get_all_genders
        growth_patterns = (
            CellLine.query.distinct(CellLine.growth_pattern)
            .order_by(CellLine.growth_pattern)
            .with_entities(CellLine.growth_pattern)
            .all()
        )
        growth_pattern_ids = [
            (growth_pattern[0], idx + 1,)  # +1 so that we start the first at one
            for idx, growth_pattern in enumerate(growth_patterns)
        ]
        return growth_pattern_ids

    @staticmethod
    def get_cell_line_gender_series(level=1):
        """
        Return series where values are lineage names, index is depmap id
        """
        tuples = CellLine.query.with_entities(CellLine.depmap_id, CellLine.gender).all()
        depmap_ids = []
        gender_names = []
        for cell_line, gender in tuples:
            depmap_ids.append(cell_line)
            gender_names.append(gender)
        srs = pd.Series(data=gender_names, index=depmap_ids)
        return srs

    @staticmethod
    def get_cell_line_growth_pattern_series(level=1):
        """
        Return series where values are growth patterns, index is depmap id
        """
        tuples = CellLine.query.with_entities(
            CellLine.depmap_id, CellLine.growth_pattern
        ).all()
        depmap_ids = []
        growth_patterns = []
        for cell_line, growth_pattern in tuples:
            depmap_ids.append(cell_line)
            growth_patterns.append(growth_pattern)
        srs = pd.Series(data=growth_patterns, index=depmap_ids)
        return srs

    @staticmethod
    def __get_cell_line_lineage_name_tuples(level=1):
        """
        :return: List of (depmap_id, lineage name) tuples
        """
        tuples = (
            CellLine.query.join(Lineage)
            .filter(Lineage.level == level)
            .with_entities(CellLine.depmap_id, Lineage.name)
            .all()
        )
        return tuples

    @staticmethod
    def get_cell_line_lineage_name_series(level=1):
        """
        Return series where values are lineage names, index is depmap id
        """
        tuples = CellLine.__get_cell_line_lineage_name_tuples(level)
        depmap_ids = []
        lineage_names = []
        for cell_line, lineage_name in tuples:
            depmap_ids.append(cell_line)
            lineage_names.append(lineage_name)
        srs = pd.Series(data=lineage_names, index=depmap_ids)
        return srs

    @staticmethod
    def __get_cell_line_primary_disease_name_tuples():
        """
        :return: List of (depmap_id, primary disease name) tuples
        """
        tuples = (
            CellLine.query.join(PrimaryDisease)
            .with_entities(CellLine.depmap_id, PrimaryDisease.name)
            .all()
        )
        return tuples

    @staticmethod
    def get_cell_line_primary_disease_series():
        """
        Return series where values are primary disease names, index is depmap id
        """
        tuples = CellLine.__get_cell_line_primary_disease_name_tuples()
        depmap_ids = []
        primary_disease_names = []
        for cell_line, primary_disease_name in tuples:
            depmap_ids.append(cell_line)
            primary_disease_names.append(primary_disease_name)
        srs = pd.Series(data=primary_disease_names, index=depmap_ids)
        return srs

    @staticmethod
    def __get_cell_line_disease_subtype_name_tuples():
        """
        :return: List of (depmap_id, disease subtype name) tuples
        """
        tuples = (
            CellLine.query.join(DiseaseSubtype)
            .with_entities(CellLine.depmap_id, DiseaseSubtype.name)
            .all()
        )
        return tuples

    @staticmethod
    def get_cell_line_disease_subtype_series():
        """
        Return series where values are disease subtype names, index is depmap id
        """
        tuples = CellLine.__get_cell_line_disease_subtype_name_tuples()
        depmap_ids = []
        disease_subtype_names = []
        for cell_line, disease_subtype_name in tuples:
            depmap_ids.append(cell_line)
            disease_subtype_names.append(disease_subtype_name)
        srs = pd.Series(data=disease_subtype_names, index=depmap_ids)
        return srs

    @staticmethod
    def __get_cell_line_display_name_tuples():
        """
        :return: List of (depmap_id, cell_line_display_name) tuples
        """
        tuples = CellLine.query.with_entities(
            CellLine.depmap_id, CellLine.cell_line_display_name,
        ).all()
        return tuples

    @staticmethod
    def get_cell_line_display_name_series():
        dictionary = {}

        tuples = CellLine.__get_cell_line_display_name_tuples()

        for depmap_id, display_name in tuples:
            dictionary[depmap_id] = display_name

        return pd.Series(dictionary)

    @staticmethod
    def __get_cell_line_tumor_type_name_tuples():
        """
        :return: List of (depmap_id, primary disease name) tuples
        """
        tuples = (
            CellLine.query.join(TumorType)
            .with_entities(CellLine.depmap_id, TumorType.name)
            .all()
        )
        return tuples

    @staticmethod
    def get_cell_line_tumor_type_series():
        """
        Return series where values are lineage names, index is depmap id
        """
        tuples = CellLine.__get_cell_line_tumor_type_name_tuples()
        depmap_ids = []
        tumor_type_names = []
        for cell_line, tumor_type_name in tuples:
            depmap_ids.append(cell_line)
            tumor_type_names.append(tumor_type_name)
        srs = pd.Series(data=tumor_type_names, index=depmap_ids)
        return srs

    @staticmethod
    def get_cell_line_information_df(depmap_ids, levels=[1]):
        """
        Gets metadata for cell lines, often used to show hover information
        """
        if len(depmap_ids) > 0:
            data = (
                CellLine.query.filter(CellLine.depmap_id.in_(depmap_ids))
                .join(PrimaryDisease)
                .join(Lineage, CellLine.lineage)
                .filter(Lineage.level.in_(levels))
                .with_entities(
                    CellLine.depmap_id,
                    CellLine.cell_line_display_name,
                    PrimaryDisease.name.label("primary_disease"),
                    Lineage.name.label("lineage_name"),
                    Lineage.level.label("lineage_level"),
                )
                .all()
            )
            df = pd.DataFrame(data)
        else:
            # df is empty, the sqlalchemy query will not return column information and we need to manually supply it. otherwise sete_index depmap_id will fail because no such column
            df = pd.DataFrame(
                [],
                columns=[
                    "depmap_id",
                    "cell_line_display_name",
                    "primary_disease",
                    "lineage_name",
                    "lineage_level",
                ],
            )

        df = df.set_index("depmap_id")
        df["lineage_display_name"] = df["lineage_name"].apply(
            lambda x: Lineage.get_display_name(x)
        )
        return df


class CellLineAlias(Model):
    __tablename__ = "cell_line_alias"
    cell_line_alias_id = Column(Integer(), primary_key=True, autoincrement=True)
    alias = Column(String(), nullable=False, index=True)
    depmap_id = Column(Integer(), ForeignKey("cell_line.depmap_id"), nullable=False)
    cell_line = relationship(
        "CellLine",
        foreign_keys="CellLineAlias.depmap_id",
        uselist=False,
        overlaps="cell_line_alias",
    )


class Lineage(Model):
    __tablename__ = "lineage"
    lineage_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    level = Column(Integer, nullable=False, index=True)
    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"), nullable=False)
    cell_line = relationship(
        "CellLine", foreign_keys="Lineage.depmap_id", uselist=False, overlaps="lineage"
    )

    @property
    def display_name(self):
        return Lineage.get_display_name(self.name)

    @staticmethod
    def get_display_name(name):
        """
        See test_lineage_get_display_name for examples

        The space of lineage names is specified here https://docs.google.com/spreadsheets/d/15y8BeNTXsJq6vMg6dIRdR-MKH_qbNuaLn-20ZdTM5IY/edit?usp=sharing
            See the tab "Arxspan Primary Disease/Subtype"

        This function uses the following heuristics
            - if the name is in an exception, use the exception
            - if the name is already all in uppercase, don't replace underscores and just return it
                - this is heuristic for protein fusions like EWS_FLI
            - if it starts with b_cell or t_cell, change that to B-cell or T-cell, then apply normal heuristics for the rest
            - normal heuristics are:
                - split the string by underscore, into parts
                - if the part has any capital letters, do not modify it
                - else, title case the part

        """
        exceptions = {
            "WD_DDPLS": "WD/DDPLS",
            "hbs_antigen_carrier": "HBs Antigen Carrier",
        }
        special_prefixes = {
            "b_cell": "B-cell",
            "B-cell": "B-cell",  # just in case it ever changes back
            "t_cell": "T-cell",
            "T-cell": "T-cell",  # just in case it ever changes back
        }

        def _num_upper(string):
            return sum(1 for c in string if c.isupper())

        def _split_underscores_and_if_no_uppercase_then_title(name):
            """
            Splits the string by underscores
            For each element,
                If it contains any capital letters, do nothing to the element
                Else, return the element title cased
            """
            components = name.split("_")
            components = [x.title() if _num_upper(x) == 0 else x for x in components]
            return " ".join(components)

        if name in exceptions.keys():
            return exceptions[name]
        elif name.upper() == name:
            # if all upper case, don't replace underscores
            # this is for things like protein fusions, which come is an e.g. EWS_FLI
            # a better display name would be EWS-FLI or EWS/FLI. but it's difficult to make that a heuristic
            # keeping it as EWS_FLI is the compromise here
            return name
        else:
            for prefix in special_prefixes:
                if name.startswith(prefix):
                    remainder = name.split(prefix, 1)[1]
                    # no space in between, because there is a beginning underscore after the split
                    return "{}{}".format(
                        special_prefixes[prefix],
                        _split_underscores_and_if_no_uppercase_then_title(remainder),
                    )

            return _split_underscores_and_if_no_uppercase_then_title(name)

    @classmethod
    def get_by_name(cls, name: str) -> Optional["Lineage"]:
        return cls.query.filter_by(name=name).one_or_none()

    @staticmethod
    def get_lineage_lvl_1_ids():
        """
        :return: list of tuples (lineage_name, lineage_id)
        """
        lineage_names = (
            Lineage.query.filter_by(level=1)
            .distinct(Lineage.name)
            .order_by(Lineage.name)
            .with_entities(Lineage.name)
            .all()
        )
        lineage_names_ids = [
            (lineage[0], idx + 1)  # +1 so that we start the first lineage_id at one
            for idx, lineage in enumerate(lineage_names)
        ]

        return lineage_names_ids

    @staticmethod
    def get_lineage_ids_by_level(level):
        """
        :return: list of tuples (lineage_name, lineage_id)
        """
        lineage_names = (
            Lineage.query.filter_by(level=level)
            .distinct(Lineage.name)
            .order_by(Lineage.name)
            .with_entities(Lineage.name)
            .all()
        )
        lineage_names_ids = [
            (lineage[0], idx + 1)  # +1 so that we start the first lineage_id at one
            for idx, lineage in enumerate(lineage_names)
        ]

        return lineage_names_ids


class PrimaryDisease(Model):
    """Primary disease characterizing the cell line"""

    __tablename__ = "primary_disease"

    primary_disease_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True)


class DiseaseSubtype(Model):
    """Subtype disease characterizing the cell line"""

    __tablename__ = "disease_subtype"

    disease_subtype_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String)

    primary_disease_id = Column(
        Integer, ForeignKey("primary_disease.primary_disease_id")
    )
    primary_disease = relationship("PrimaryDisease", backref=__tablename__)


class TumorType(Model):
    """Tumor types i.e. primary or metastasis"""

    __tablename__ = "tumor_type"
    tumor_type_id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String)


# Fixme remove, not used because data not available
class Conditions(Model):
    """Culture media of the cancer cell line (?)"""

    __tablename__ = "conditions"

    conditions_id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String)


# Fixme remove, not used because data not available
class CultureMedium(Model):
    """Culture medium of the cell line"""

    __tablename__ = "culture_medium"

    culture_medium_id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String)


class Source(Model):
    """Source of the data (Avana, Gecko, ...)"""

    __tablename__ = "source"

    source_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String)


class STRProfile(Model):
    """Defines table schema for STR fingerprint."""

    __tablename__ = "str_profile"

    str_profile_id = Column(Integer, primary_key=True, autoincrement=True)

    depmap_id = Column(
        String, ForeignKey("cell_line.depmap_id"), nullable=False, unique=True
    )
    cell_line = relationship(
        "CellLine",
        foreign_keys="STRProfile.depmap_id",
        uselist=False,
        backref=sqlalchemy.orm.backref("str_profile", uselist=False),
    )

    notation = Column(String)
    d3s1358 = Column(String)
    th01 = Column(String)
    d21s11 = Column(String)
    d18s51 = Column(String)
    penta_e = Column(String)
    d5s818 = Column(String)
    d13s317 = Column(String)
    d7s820 = Column(String)
    d16s539 = Column(String)
    csf1po = Column(String)
    penta_d = Column(String)
    vwa = Column(String)
    d8s1179 = Column(String)
    tpox = Column(String)
    fga = Column(String)
    amel = Column(String)
    mouse = Column(String)

    def to_dict(self):
        str_profile_dict = {
            "str_profile_id": self.str_profile_id,
            "penta_e": self.penta_e,
            "vwa": self.vwa,
            "depmap_id": self.depmap_id,
            "d5s818": self.d5s818,
            "d8s1179": self.d8s1179,
            "d13s317": self.d13s317,
            "tpox": self.tpox,
            "notation": self.notation,
            "d7s820": self.d7s820,
            "fga": self.fga,
            "d3s1358": self.d3s1358,
            "d16s539": self.d16s539,
            "amel": self.amel,
            "th01": self.th01,
            "csf1po": self.csf1po,
            "mouse": self.mouse,
            "d21s11": self.d21s11,
            "penta_d": self.penta_d,
            "d18s51": self.d18s51,
        }
        return str_profile_dict
