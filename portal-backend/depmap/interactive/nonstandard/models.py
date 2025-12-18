import enum
import json
import os
from typing import Dict, List, Optional
from depmap import enums

from flask import current_app
from typing_extensions import TypedDict

from depmap.cell_line.models import CellLine
from depmap.database import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Model,
    String,
    Text,
    db,
    relationship,
)
from depmap.utilities import hdf5_utils
from depmap.utilities.exception import AllRowsOrColsSkipped, CustomDatasetsNotEnabled
from depmap.utilities.models import log_data_issue
from typeguard import typechecked


class NonstandardMatrix(Model):
    """
    Nonstandard/nonstandard should be used as ONE WORD, without a hyphen.
    Matrix that:
    Does not have correlations computed for them
    May not have stable IDs mapped to entities; these allow access by string names
    Runs parallel to the Matrix model; these are not attached to datasets
    Used only in the interactive section    
    """

    __tablename__ = "nonstandard_matrix"
    DataTypeEnum = enums.DataTypeEnum

    nonstandard_matrix_id = Column(Integer, primary_key=True, autoincrement=True)
    file_path = Column(Text, nullable=False)
    nonstandard_dataset_id = Column(String, nullable=False, unique=True, index=True)
    row_index = relationship("RowNonstandardMatrix", lazy="dynamic")
    col_index = relationship("ColNonstandardMatrix", lazy="dynamic")
    owner_id = Column(Integer, nullable=False)
    data_type: "Column[enums.DataTypeEnum]" = Column(
        db.Enum(DataTypeEnum, name="DataTypeEnum"), nullable=False
    )

    @property
    def full_hdf5_path(self):
        """
        Python functions should not be using this. Use an existing function on NonstandardMatrix, or write a new one
        Used for things like external R functions, that need the full path
        """
        return os.path.join(current_app.config["NONSTANDARD_DATA_DIR"], self.file_path)

    @staticmethod
    def get(id, must=True) -> Optional["NonstandardMatrix"]:
        q = NonstandardMatrix.query.filter_by(nonstandard_dataset_id=id)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    def get_subsetted_df(self, row_indices, col_indices, is_transpose=False):
        df = hdf5_utils.get_df_of_values(
            current_app.config["NONSTANDARD_DATA_DIR"],
            self.file_path,
            row_indices,
            col_indices,
            is_transpose,
        )
        return df

    @staticmethod
    def read_file_and_add_dataset_index(
        dataset_id,
        config,
        file_path,
        entity_class,
        use_arxspan_id,
        owner_id,
        load_row_with_entity_func=None,
        register_transpose=False,
    ):
        """
        :param register_transpose: this is a caching mechanism to allow us to delete the dataset when the transpose changes, without having to rebuild the full db.
            this flag stores information in another table. see NonstandardMatrixLoaderMetadata
            it has nothing to do with the transposing or not transposing the actual dataset,
                it is just a flag that says please store some metadata about how this dataset was last loaded
        """
        row_names = hdf5_utils.get_row_index(
            current_app.config["NONSTANDARD_DATA_DIR"], file_path, config["transpose"]
        )
        col_names = hdf5_utils.get_col_index(
            current_app.config["NONSTANDARD_DATA_DIR"], file_path, config["transpose"]
        )
        # datasets must contain data_type
        assert "data_type" in config
        assert config["data_type"] is not None

        if "custom_entity_match" in config:
            rows_skipped, cols_skipped = NonstandardMatrix._add_dataset_index(
                dataset_id,
                row_names,
                col_names,
                entity_class,
                config["data_type"],
                use_arxspan_id,
                file_path,
                owner_id,
                custom_entity_match=config["custom_entity_match"],
                load_row_with_entity_func=load_row_with_entity_func,
            )
        else:
            rows_skipped, cols_skipped = NonstandardMatrix._add_dataset_index(
                dataset_id,
                row_names,
                col_names,
                entity_class,
                config["data_type"],
                use_arxspan_id,
                file_path,
                owner_id,
                load_row_with_entity_func=load_row_with_entity_func,
            )

        if register_transpose:
            db.session.add(
                NonstandardMatrixLoaderMetadata(
                    nonstandard_dataset_id=dataset_id, transpose=config["transpose"]
                )
            )
        db.session.commit()

        if entity_class is not None:
            print(
                "{}: Skipped loading {} rows (out of {}) due to missing entity IDs.".format(
                    dataset_id, len(rows_skipped), len(row_names)
                )
            )
        if use_arxspan_id:
            print(
                "{}: Skipped loading {} cols (out of {}) due to missing arxspan IDs.".format(
                    dataset_id, len(cols_skipped), len(col_names)
                )
            )
        else:
            print(
                "{}: Skipped loading {} cols (out of {}) due to missing cell line names.".format(
                    dataset_id, len(cols_skipped), len(col_names)
                )
            )

        if len(rows_skipped) == len(row_names) or len(cols_skipped) == len(col_names):
            raise AllRowsOrColsSkipped(
                "Skipped all columns or rows, cell_lines:{}, user_arxspan_id:{}".format(
                    col_names, use_arxspan_id
                )
            )

        print("Loaded {}".format(dataset_id))
        return rows_skipped, cols_skipped

    @staticmethod
    def _add_dataset_index(
        dataset_id,
        row_names,
        col_names,
        entity_class,
        data_type,
        use_arxspan_id,
        file_path,
        owner_id,
        enforce_entity_all_rows=False,
        custom_entity_match=None,
        load_row_with_entity_func=None,
    ):
        """
        Creates a NonstandardMatrix and associated RowNonstandardMatrix and ColNonstandardMatrix objects
        Adds these to the db, and commits
        Returns number of skipped rows
        """
        print("Loading {}".format(dataset_id))
        rows_skipped = []
        row_index_objects = []

        for index, row_name in enumerate(row_names):
            if entity_class is not None:
                assert load_row_with_entity_func is not None
                added = load_row_with_entity_func(
                    row_name,
                    index,
                    dataset_id,
                    row_index_objects,
                    entity_class,
                    custom_entity_match,
                    enforce_entity_all_rows,
                )
                if not added:
                    rows_skipped.append(row_name)
            else:
                row_index_objects.append(
                    RowNonstandardMatrix(index=index, row_name=row_name)
                )

        cols_skipped = []
        col_index_objects = []
        for index, col_name in enumerate(col_names):
            if use_arxspan_id:
                cell_line = CellLine.get_by_depmap_id(col_name, must=False)
                if cell_line is None:
                    log_data_issue(
                        "{} nonstandard".format(dataset_id),
                        "Missing cell line",
                        identifier=col_name,
                        id_type="arxspan_id",
                    )
                    cols_skipped.append(col_name)
                else:
                    col_index_objects.append(
                        ColNonstandardMatrix(index=index, depmap_id=cell_line.depmap_id)
                    )
            else:
                # if not arxpan id, match on ccle name.  If no match, don't even load it in to the matrix
                cell_line = CellLine.get_by_name(col_name)
                if cell_line is None:
                    log_data_issue(
                        "{} nonstandard".format(dataset_id),
                        "Missing cell line",
                        identifier=col_name,
                        id_type="cell line names",
                    )
                    cols_skipped.append(col_name)
                else:
                    col_index_objects.append(
                        ColNonstandardMatrix(index=index, depmap_id=cell_line.depmap_id)
                    )

        for o in row_index_objects:
            o.owner_id = owner_id
        for o in col_index_objects:
            o.owner_id = owner_id

        dataset_index = NonstandardMatrix(
            nonstandard_dataset_id=dataset_id,
            file_path=file_path,
            row_index=row_index_objects,
            col_index=col_index_objects,
            owner_id=owner_id,
            data_type=data_type,
        )
        db.session.add(dataset_index)
        db.session.flush()

        return rows_skipped, cols_skipped

    def delete(self):
        self.row_index.delete()
        self.col_index.delete()
        if os.path.exists(self.full_hdf5_path):
            os.remove(self.full_hdf5_path)
        db.session.delete(self)


class RowNonstandardMatrix(Model):
    __tablename__ = "row_nonstandard_matrix_index"
    row_nonstandard_matrix_index_id = Column(
        Integer, primary_key=True, autoincrement=True
    )
    index = Column(Integer, nullable=False)
    entity_id = Column(
        Integer, ForeignKey("entity.entity_id"), index=True
    )  # can be nullable, is entity_id or row_name. fixme how to enforce that one must be non-null?
    entity = relationship(
        "Entity", foreign_keys="RowNonstandardMatrix.entity_id", uselist=False
    )
    row_name = Column(String, index=True)
    nonstandard_matrix_id = Column(
        Integer, ForeignKey("nonstandard_matrix.nonstandard_matrix_id"), nullable=False,
    )
    owner_id = Column(Integer, nullable=False)


class ColNonstandardMatrix(Model):
    __tablename__ = "col_nonstandard_matrix_index"
    col_nonstandard_matrix_index_id = Column(
        Integer, primary_key=True, autoincrement=True
    )
    index = Column(Integer, nullable=False)
    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"), nullable=False)
    cell_line = relationship("CellLine", backref=__tablename__)
    nonstandard_matrix_id = Column(
        Integer,
        ForeignKey("nonstandard_matrix.nonstandard_matrix_id"),
        nullable=False,
        index=True,
    )
    owner_id = Column(Integer, nullable=False)


class NonstandardMatrixLoaderMetadata(Model):
    """
    Only used by the loader
    Does not have a relationship to NonstandardMatrix because that's really not what we need
    What we need is just something for the loader to check what the transpose was when the dataset was previously updated
    This is decoupled from and really not related to all the other tables in this app
    """

    __tablename__ = "nonstandard_matrix_loader_metadata"
    nonstandard_matrix_loader_metadata_id = Column(
        Integer, primary_key=True, autoincrement=True
    )
    nonstandard_dataset_id = Column(String, nullable=False, unique=True, index=True)
    transpose = Column(
        Boolean, nullable=False
    )  # corresponds to the value of the transpose option in the specification for e.g. internal_nonstandard_datasets at the time of load


class CellLineNameType(enum.Enum):
    depmap_id = "depmap_id"  # aka arxspan id
    ccle_name = "ccle_name"
    display_name = "display_name"  # aka stripped cell line name

    @property
    def db_col_name(self):
        return {
            "depmap_id": "depmap_id",
            "ccle_name": "cell_line_name",
            "display_name": "cell_line_display_name",
        }[self.value]


class CustomDatasetConfig(Model):
    """
    THESE MUST ONLY BE ACCESSED INDIVIDUALLY
        Custom dataset uuids are bearer tokens
        They are restricted access by default, and should only be accessed if the UUID is specifically provided
        We should not list all the uuids. This violates access control.
    WE SHOULD NEVER LISTS THESE
    """

    __tablename__ = "custom_dataset_config"
    uuid = Column(Text, primary_key=True)  # SHOULD NEVER BE LISTED
    config = Column(Text, nullable=False)

    @classmethod
    def add(cls, uuid_str: str, config: Dict):
        """
        Takes in uuid_str (anything that can be forced into a string) and config (dict)
        This is our first user db write method! ヽ(•‿•)ノ There are now more
        """

        # these are the same for all custom datasets. but we just add them, so that we never forget to add these properties when retrieving the config
        # is_custom is sometimes used in asserts that access control worked, so it's particularly important that it is included
        # similarly, is_discoverable is used to assert exclusion from listing .all_datasets
        config[
            "is_custom"
        ] = True  # need to change the test factory if the location of this changes!!
        config["is_discoverable"] = False
        config["is_continuous"] = True

        config_string = json.dumps(config)
        db.session.add(cls(uuid=uuid_str, config=config_string))
        db.session.commit()

    @classmethod
    def exists(cls, uuid_str):
        return db.session.query(cls.query.filter_by(uuid=uuid_str).exists()).scalar()

    @classmethod
    def get(cls, uuid_str):
        row = cls.query.get(uuid_str)
        return json.loads(row.config)

    @staticmethod
    def _CAUTION_EXTRA_DANGEROUS_list_all_uuids():
        """
        THIS SHOULD NOT BE USED WITHOUT EXTRA CAREFUL CONSIDERATION
        This SHOULD NEVER BE USED IN THE WEBAPP
        It retrieves ALL uuids of datasets subitted by ALL USERS

        There is one exception that currently uses this, for loading all taiga aliases
            It wants to load aliases for all taiga ids, including those previously submitted by all users

        If additional use cases for this are found, please list them here
        :return: all custom dataset UUIDS, submitted by all users
        """
        return [
            x[0]
            for x in CustomDatasetConfig.query.with_entities(
                CustomDatasetConfig.uuid
            ).all()
        ]
