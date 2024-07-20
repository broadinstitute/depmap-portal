import os
from typing import Union

import pandas as pd
from flask import current_app
from sqlalchemy.orm.exc import NoResultFound

from depmap.database import (
    Column,
    Float,
    ForeignKey,
    Integer,
    Model,
    String,
    Text,
    db,
    relationship,
)
from depmap.gene.models import Gene
from depmap.utilities import hdf5_utils

# Pycharm doesn't infer their usage, but the models are needed for strings in relationship definitions
from depmap.context.models import Context
from depmap.cell_line.models import CellLine, Lineage
from depmap.entity.models import Entity


class GeneSeries(pd.Series):
    @property
    def genes(self):
        index = self.index.values.tolist()
        genes = [Gene.query.get(entity_id) for entity_id in index]
        return genes

    @property
    def zipped_gene_value(self):
        values = self.tolist()
        genes = self.genes
        return zip(genes, values)


class CellLineSeries(pd.Series):
    @property
    def cell_lines(self):
        index = self.index.values.tolist()
        cell_lines = [CellLine.get_by_depmap_id(depmap_id) for depmap_id in index]
        return cell_lines

    @property
    def zipped_cell_line_value(self):
        values = self.tolist()
        cell_lines = self.cell_lines
        return zip(cell_lines, values)


class Matrix(Model):
    """
    file_path corresponds to a hdf5 file
    """

    __tablename__ = "matrix"
    matrix_id = Column(Integer, primary_key=True, autoincrement=True)
    file_path = Column(Text, nullable=False)
    row_index: "RowMatrixIndex" = db.relationship("RowMatrixIndex", lazy="dynamic")
    col_index: "ColMatrixIndex" = db.relationship("ColMatrixIndex", lazy="dynamic")
    min = Column(
        Float
    )  # should be nullable=False, no constraint for easier migration + additional checkpoint
    max = Column(
        Float
    )  # should be nullable=False, no constraint for easier migration + additional checkpoint
    units = Column(String, nullable=False)
    owner_id = Column(Integer, nullable=False)
    # this UUID is randomly generated at creation time. This is used as a cache key that
    # will be unique across DB rebuilds if we want to look up anything about this matrix .
    matrix_uuid = Column(Text, nullable=False)

    @property
    def entity_type(self):
        type = self.dataset.entity_type
        return type

    @property
    def full_hdf5_path(self):
        """
        Python functions should not be using this. Use an existing function on Matrix, or write a new one
        Used for things like external R functions, that need the full path
        """
        return os.path.join(current_app.config["WEBAPP_DATA_DIR"], self.file_path)

    @classmethod
    def get_by_id(self, matrix_id):
        return Matrix.query.get(matrix_id)

    def get_entity_by_label(self, entity_label, must=True):
        q = self.row_index.join(Entity).filter(Entity.label == entity_label)
        if must:
            return q.one().entity
        else:
            row_index = q.one_or_none()
            if row_index is not None:
                return row_index.entity
            else:
                return None

    def get_entity_indices_and_labels(self) -> list[tuple[int, str]]:
        return (
            self.row_index.join(Entity)
            .with_entities(RowMatrixIndex.index, Entity.label)
            .all()
        )

    def get_index_by_entity_id(self, entity_id, must=True):
        q = self.row_index.filter(RowMatrixIndex.entity_id == entity_id)
        if must:
            return q.one().index
        else:
            row_index = q.one_or_none()
            if row_index is not None:
                return row_index.index
            else:
                return None

    def get_entity_by_index(self, index, must=True):
        q = self.row_index.filter(RowMatrixIndex.index == index)
        if must:
            return q.one().entity
        else:
            row_index = q.one_or_none()
            if row_index is not None:
                return row_index.entity
            else:
                return None

    def get_index_by_depmap_id(self, depmap_id, must=True):
        cell_line = CellLine.query.filter_by(depmap_id=depmap_id).one()
        q = self.col_index.filter(ColMatrixIndex.cell_line == cell_line)
        if must:
            return q.one().index
        else:
            col_index = q.one_or_none()
            if col_index is not None:
                return col_index.index
            else:
                return None

    def _get_cell_line_indices_and_depmap_ids(self):
        """
        Assemble a tuple of (col index, depmap id)
        """
        return (
            self.col_index.join(ColMatrixIndex.cell_line)
            .order_by(ColMatrixIndex.index)
            .with_entities(ColMatrixIndex.index, CellLine.depmap_id)
            .all()
        )

    def get_cell_line_values_and_depmap_ids(self, entity, by_label=False):
        """
        Drops cell lines where value is NA
        """
        col_index_name_tuples = self._get_cell_line_indices_and_depmap_ids()
        try:
            series = self._get_series_by_entity(
                entity, col_index_name_tuples, by_label=by_label
            )
        except NoResultFound as e:
            raise NoResultFound(
                "Entity label {} not found in matrix id {}".format(
                    entity, self.matrix_id
                )
            ) from e
        cell_lines = CellLineSeries(series)
        return cell_lines

    def _get_series_by_entity(
        self, entity_label_or_id, col_index_name_tuples, by_label=False
    ):
        """
        Returns series where index is cell line and value is value in the matrix. Drops rows where value is NaN
        """
        values = self.get_values_by_entity(entity_label_or_id, by_label)
        col_names = []
        col_values = []
        for col_index, index_name in col_index_name_tuples:
            col_names.append(index_name)
            # The indexing of values[col_index] is needed because some cols are missing cell lines, so the hdf5 file may have more columns than there are ColMatrixIndex objects
            col_values.append(values[col_index])

        series = pd.Series(col_values, col_names)
        series.dropna(inplace=True)
        return series

    def get_values_by_entity(
        self, entity_label_or_id: Union[str, int], by_label: bool = False
    ):
        if by_label:
            query = self.row_index.join(Entity).filter(
                Entity.label == entity_label_or_id
            )
        else:
            query = self.row_index.filter(
                RowMatrixIndex.entity_id == entity_label_or_id
            )

        obj: RowMatrixIndex = query.one()
        index = obj.index
        values = hdf5_utils.get_row_of_values(
            current_app.config["WEBAPP_DATA_DIR"], self.file_path, index
        )

        return values

    # passing in a list of entities and a depmap id, return a series of values
    def get_values_by_entities_and_depmap_id(self, entities, depmap_id):
        points_list = []

        # a cell line has an assoicated ColMatrixIndex.  Get the index
        col_matrix_index = self.get_index_by_depmap_id(depmap_id, must=False)
        if col_matrix_index is not None:
            for entity in entities:
                # get the value specified in the hdf5 file by index of RowMatrixIndex and ColMatrixIndex
                value = self.get_values_by_entity(entity.entity_id, by_label=False)[
                    col_matrix_index
                ]
                points_list.append(value)

            return points_list
        else:
            return None

    def get_subsetted_df(self, row_indices, col_indices, is_transpose=False):
        df = hdf5_utils.get_df_of_values(
            current_app.config["WEBAPP_DATA_DIR"],
            self.file_path,
            row_indices,
            col_indices,
            is_transpose,
        )
        return df

    def get_row_means(self):
        return hdf5_utils.get_row_means(
            current_app.config["WEBAPP_DATA_DIR"], self.file_path
        )


# make separate tables for row and col, cos a lot of data to be repeating row/col
class RowMatrixIndex(Model):
    __tablename__ = "row_matrix_index"

    __table_args__ = (db.Index("ix_row_matrix_index_1", "entity_id", "matrix_id"),)

    row_matrix_index_id = Column(Integer, primary_key=True, autoincrement=True)
    index = Column(Integer, nullable=False)
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), nullable=False)
    entity = relationship(
        "Entity", foreign_keys="RowMatrixIndex.entity_id", uselist=False
    )
    matrix_id = Column(Integer, ForeignKey("matrix.matrix_id"), nullable=False)
    matrix = relationship(
        "Matrix",
        foreign_keys="RowMatrixIndex.matrix_id",
        uselist=False,
        overlaps="row_index",
    )
    owner_id = Column(Integer, nullable=False)


class ColMatrixIndex(Model):
    __tablename__ = "col_matrix_index"
    col_matrix_index_id = Column(Integer, primary_key=True, autoincrement=True)
    index = Column(Integer, nullable=False)

    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"), nullable=False)
    cell_line = relationship(
        "CellLine", foreign_keys="ColMatrixIndex.depmap_id", uselist=False
    )
    matrix_id = Column(Integer, ForeignKey("matrix.matrix_id"), nullable=False)
    matrix = relationship(
        "Matrix",
        foreign_keys="ColMatrixIndex.matrix_id",
        uselist=False,
        overlaps="col_index",
    )
    owner_id = Column(Integer, nullable=False)
