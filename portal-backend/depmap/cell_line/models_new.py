# -*- coding: utf-8 -*-
"""Cell line models."""
import enum
import re
from typing import Dict, List, Optional, Sequence
from depmap.cell_line.models import Lineage
import numpy as np
from collections import Counter


import pandas as pd
import sqlalchemy
from sqlalchemy import and_, or_

from depmap.database import Column, ForeignKey, Integer, Model, String, db, relationship

Table = db.Table


# TODO: Not used yet. Need to update Cell Line Selector to depend on new DepmapModel table instead of CellLine
def add_depmap_model_table_columns(query):
    """
    Separated so that Dataset.get_cell_line_table_query can use this as well
    Joins database tables required for cell line table columns
    """
    table_query = query.join(Lineage, DepmapModel.oncotree_lineage).add_columns(
        sqlalchemy.column(
            '"depmap_model".oncotree_primary_disease', is_literal=True
        ).label("primary_disease"),
        sqlalchemy.column('"lineage".name', is_literal=True).label("lineage"),
        sqlalchemy.column('"lineage".level', is_literal=True).label("lineage_level"),
    )
    return table_query


model_with_depmap_id_1 = re.compile("\\S+ \\(([^)]+)\\)")
model_with_depmap_id_2 = re.compile("(ACH-\\d+)(?:-\\d+)?$")


# Used by Context Explorer
class LineageType(enum.Enum):
    Heme = "heme"
    Solid = "solid"


class DepmapModel(Model):
    """
    Any additional properties added to this model that would want to be updated needs to be added to load_cell_lines_metadata in cell_line_loader.
    May need to add column to expected_columns variable in format_cell_lines
    """

    __tablename__ = "depmap_model"

    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"))
    cell_line = relationship("CellLine", backref=__tablename__)

    model_id = Column(String, primary_key=True)

    cell_line_name = Column(String, index=True, unique=True, nullable=True)
    ccle_name = Column(String, index=True, unique=True, nullable=True)
    patient_id = Column(String, index=True, nullable=True)

    # TODO: Update CellLineAlias and dependencies to only use DepmapModel table instead of CellLine
    cell_line_alias = relationship(
        "CellLineAlias",
        backref="depmap_model",
        primaryjoin="CellLineAlias.depmap_id==DepmapModel.depmap_id",
        foreign_keys="CellLineAlias.depmap_id",
    )

    stripped_cell_line_name = Column(String, nullable=False)  # stripped cell line name

    oncotree_lineage = relationship(
        "Lineage",
        backref="depmap_model",
        primaryjoin="Lineage.depmap_id==DepmapModel.depmap_id",
        foreign_keys="Lineage.depmap_id",
        overlaps="cell_line,lineage",
    )

    oncotree_primary_disease = Column(String)
    oncotree_subtype = Column(String)
    oncotree_code = Column(String)
    public_comments = Column(String)
    image_filename = Column(String)
    age_category = Column(String)

    # in json_encoded_metadata, we're storing a json encoded dictionary of column_name -> column_value
    # directly taken from full row taken from the Model.csv table. Those fields which the portal's python code depends
    # on should be explicitly modeled as columns, however, there are many columns which the python
    # code doesn't care about. However, the front end _does_ need them to display in the UI.
    # by storing this unstructured dictionary, we're minimizing the number of boilerplate changes
    # required when a column is added/changed. (We're also making it explicit which columns the portal
    # backend depends on.)
    json_encoded_metadata = Column(String)

    def __eq__(self, other):
        if isinstance(other, DepmapModel):
            return self.model_id == other.model_id
        return False

    def __hash__(self):
        return hash(self.model_id)

    @property
    def level_1_lineage(self):
        """
        All cell lines have a level 1 lineage, even if it may be "unknown"
        """
        # TODO: When the DepmapModel table replaces CellLine, this needs to change to iterate self.oncotree_lineage
        return next(
            lineage for lineage in self.cell_line.lineage.all() if lineage.level == 1
        )

    def lineage_is_unknown(self):
        """
        If level 1 lineage is unknown, there is no level 2 or 3 lineage
        """
        return self.level_1_lineage.name == "unknown"

    @staticmethod
    def exists(cell_line_name):
        return db.session.query(
            DepmapModel.query.filter_by(cell_line_name=cell_line_name).exists()
        ).scalar()

    # formerly CellLine.get_by_depmap_id
    @staticmethod
    def get_by_model_id(model_id, must=False) -> Optional["DepmapModel"]:
        q = db.session.query(DepmapModel).filter(DepmapModel.model_id == model_id)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_lineage_primary_disease_counts(model_ids: List[str]) -> Dict[str, dict]:
        q = (
            db.session.query(DepmapModel)
            .filter(DepmapModel.model_id.in_(model_ids))
            .join(Lineage, DepmapModel.oncotree_lineage)
            .filter(Lineage.level == 1)
            .with_entities(
                DepmapModel.model_id,
                Lineage.name.label("lineage"),
                DepmapModel.oncotree_primary_disease.label("primary_disease"),
            )
            .order_by(Lineage.name)
            .all()
        )

        df = pd.DataFrame(q)

        if df.empty:
            return {}

        df_agg = (
            df.fillna("unknown").groupby(["lineage"]).agg({"primary_disease": list})
        )

        assert isinstance(df_agg, pd.DataFrame)

        def count_primary_disease_occurences(x):
            if isinstance(x, list):
                return {key: str(val) for key, val in dict(Counter(x)).items()}

        df_agg = df_agg[["primary_disease"]].apply(
            np.vectorize(count_primary_disease_occurences)
        )["primary_disease"]

        return dict(df_agg)

    @staticmethod
    def get_valid_cell_line_names_in(cell_line_names):
        """
        Returns (valid) cell line names contained in the provided list/set cell_line_names 
        """
        q = (
            db.session.query(DepmapModel)
            .filter(DepmapModel.cell_line_name.in_(cell_line_names))
            .with_entities(DepmapModel.cell_line_name)
        )

        exists = db.session.query(q.exists()).scalar()

        if exists:
            # unpacking to get a tuple of returned cell line names
            valid_cell_line_names = list(zip(*q.all()))[0]
            return set(valid_cell_line_names)
        else:
            return set()

    @staticmethod
    def get_by_name(cell_line_name, must=False) -> "DepmapModel":
        q = db.session.query(DepmapModel).filter(
            DepmapModel.cell_line_name == cell_line_name
        )
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_by_ccle_name(ccle_name, must=False) -> "DepmapModel":
        q = db.session.query(DepmapModel).filter(DepmapModel.ccle_name == ccle_name)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_cell_line_display_names(model_ids: Sequence[str]) -> pd.Series:
        cell_line_names = (
            DepmapModel.query.filter(DepmapModel.model_id.in_(model_ids))
            .with_entities(
                DepmapModel.model_id,
                DepmapModel.stripped_cell_line_name.label("cell_line_display_name"),
            )
            .all()
        )
        s = pd.DataFrame(cell_line_names).set_index("model_id")[
            "cell_line_display_name"
        ]
        assert len(s) == len(model_ids)
        return s

    @staticmethod
    def get_context_tree_query():
        """
        Joins database tables required for Context Explorer
        """
        query = db.session.query(DepmapModel.model_id)
        table_query = (
            query.outerjoin(Lineage, DepmapModel.oncotree_lineage)
            .add_columns(
                sqlalchemy.column('"lineage".name', is_literal=True).label("lineage"),
                sqlalchemy.column('"lineage".level', is_literal=True).label(
                    "lineage_level"
                ),
            )
            .order_by(Lineage.level)
        )
        return table_query

    @staticmethod
    def get_model_ids_by_lineage(lineage_name) -> Dict[str, str]:
        display_name_by_depmap_id = {}
        cell_lines = (
            db.session.query(DepmapModel)
            .join(Lineage, DepmapModel.oncotree_lineage)
            .filter(and_(Lineage.name == lineage_name, Lineage.level == 1))
            .with_entities(DepmapModel.model_id, DepmapModel.stripped_cell_line_name)
            .all()
        )

        for depmap_id, display_name in cell_lines:
            display_name_by_depmap_id[depmap_id] = display_name

        return display_name_by_depmap_id

    @staticmethod
    def get_model_ids_by_primary_disease(primary_disease_name) -> Dict[str, str]:
        display_name_by_model_id = {}
        cell_lines = (
            db.session.query(DepmapModel)
            .filter(DepmapModel.oncotree_primary_disease == primary_disease_name)
            .with_entities(DepmapModel.model_id, DepmapModel.stripped_cell_line_name)
            .all()
        )

        for depmap_id, display_name in cell_lines:
            display_name_by_model_id[depmap_id] = display_name

        return display_name_by_model_id

    @staticmethod
    def get_model_ids_by_lineage_type_filtering_out_specific_lineage(
        lineage_type: LineageType, lineage_name_to_filter_out: str
    ) -> Dict[str, str]:
        display_name_by_depmap_id = {}
        if lineage_type == LineageType.Heme:
            cell_lines = (
                db.session.query(DepmapModel)
                .join(Lineage, DepmapModel.oncotree_lineage)
                .filter(
                    and_(
                        or_(Lineage.name == "Myeloid", Lineage.name == "Lymphoid"),
                        Lineage.level == 1,
                        Lineage.name != lineage_name_to_filter_out,
                    )
                )
                .with_entities(
                    DepmapModel.model_id, DepmapModel.stripped_cell_line_name,
                )
                .all()
            )
        else:
            cell_lines = (
                db.session.query(DepmapModel)
                .join(Lineage, DepmapModel.oncotree_lineage)
                .filter(
                    and_(
                        Lineage.name != "Myeloid",
                        Lineage.name != "Lymphoid",
                        Lineage.level == 1,
                        Lineage.name != lineage_name_to_filter_out,
                    )
                )
                .with_entities(
                    DepmapModel.model_id, DepmapModel.stripped_cell_line_name
                )
                .all()
            )

        for depmap_id, display_name in cell_lines:
            display_name_by_depmap_id[depmap_id] = display_name

        return display_name_by_depmap_id

    @staticmethod
    def __get_models_age_category_tuples():
        """
        :return: List of (depmap_id, cell_line_display_name) tuples
        """
        tuples = DepmapModel.query.with_entities(
            DepmapModel.model_id, DepmapModel.age_category
        ).all()
        return tuples

    @staticmethod
    def get_models_age_category_series():
        dictionary = {}

        tuples = DepmapModel.__get_models_age_category_tuples()

        for depmap_id, display_name in tuples:
            dictionary[depmap_id] = display_name

        return pd.Series(dictionary)

    @staticmethod
    def get_related_models_by_patient_id(patient_id: str, model_id: str):
        related_models = (
            DepmapModel.query.filter(
                and_(
                    DepmapModel.patient_id == patient_id,
                    DepmapModel.model_id != model_id,
                )
            )
            .with_entities(DepmapModel.model_id, DepmapModel.patient_id)
            .all()
        )

        return related_models
