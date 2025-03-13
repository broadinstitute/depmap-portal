from flask import url_for

from depmap.database import Column, ForeignKey, Integer, Model, String, db, relationship

# Pycharm doesn't infer their usage, but the models are needed for strings in relationship definitions
from depmap.gene.models import Gene
from depmap.entity.models import EntityAlias
from depmap.cell_line.models import CellLine
from depmap.context.models import Context
from depmap.context.models_new import SubtypeContext
from depmap.download.models import DownloadFileGlobalSearch


class GlobalSearchIndex(Model):
    __tablename__ = "global_search_index"
    global_search_index_id = Column(Integer, primary_key=True, autoincrement=True)
    label = Column(String(80), nullable=False, index=True)

    # if these are changed, remember to change the categories in global_search/dropdown.js
    type = Column(
        db.Enum(
            "gene",
            "gene_alias",
            "compound",
            "compound_alias",
            "compound_target_or_mechanism",
            "cell_line",
            "cell_line_alias",
            "context",
            "download_file",
            "compound_target",
            "subtype_context",
            name="SearchIndexType",
        ),
        nullable=False,
    )
    # we had stubs for compound alias (to load through data explorer), but don't remember why we hit a stopping point. Code was commented out in 95b81cd and was eventually removed in pivotal task https://www.pivotaltracker.com/story/show/157159115

    entity_id = Column(
        Integer
    )  # this column is only used by data explorer to search by aliases, and in this usage we manually tell sqlalchemy what to join on (hence no foreign key specification). Global search does not use this column.
    compound_id = Column(Integer, ForeignKey("compound.entity_id"))
    gene_id = Column(Integer, ForeignKey("gene.entity_id"))
    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"))
    file_id = Column(Integer, ForeignKey("download_file.file_id"))
    subtype_code = Column(Integer, ForeignKey("subtype_context.subtype_code"))

    # TODO: Remove when context_explorer goes public
    context_name = Column(String, ForeignKey("context.name"))

    compound = relationship(
        "Compound", foreign_keys="GlobalSearchIndex.compound_id", uselist=False
    )

    gene = relationship("Gene", foreign_keys="GlobalSearchIndex.gene_id", uselist=False)
    cell_line = relationship(
        "CellLine", foreign_keys="GlobalSearchIndex.depmap_id", uselist=False
    )

    # TODO: Remove when context_explorer goes public
    context = relationship(
        "Context", foreign_keys="GlobalSearchIndex.context_name", uselist=False
    )

    download_file = relationship(
        "DownloadFileGlobalSearch",
        foreign_keys="GlobalSearchIndex.file_id",
        uselist=False,
    )

    subtype_context = relationship(
        "SubtypeContext", foreign_keys="GlobalSearchIndex.subtype_code", uselist=False,
    )

    __mapper_args__ = {
        "polymorphic_identity": "global_search_index",
        "polymorphic_on": type,
    }

    def get_label(self):
        raise NotImplementedError

    def get_description(self):
        raise NotImplementedError

    def get_url(self):
        raise NotImplementedError

    def format_for_dropdown(self, include_entity_id=False):
        description = self.get_description()
        record = {
            "label": self.label,
            "description": description,
            "type": self.type,
            "value": f"{self.type}:{self.label}:{description}",
            "url": self.get_url(),
        }
        if include_entity_id:
            record["entity_id"] = self.entity_id
        return record


class _Compound:
    def get_label(self):
        return self.compound.label

    def get_description(self):
        return ""

    def get_url(self):
        return url_for("compound.view_compound", name=self.compound.label)


class CompoundSearchIndex(_Compound, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "compound"}


class CompoundAliasSearchIndex(_Compound, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "compound_alias"}

    def get_description(self):
        return "({})".format(self.compound.label)


class CompoundTargetSearchIndex(_Compound, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "compound_target"}

    def get_description(self):
        return "({} is a target of {})".format(self.label, self.compound.label)


class CompoundTargetOrMechanismSearchIndex(_Compound, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "compound_target_or_mechanism"}

    def get_description(self):
        return f"({self.compound.label})"


class _Gene:
    def get_label(self):
        return self.gene.label

    def get_description(self):
        return self.gene.name

    def get_url(self):
        return url_for("gene.view_gene", gene_symbol=self.gene.label)


class GeneSearchIndex(_Gene, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "gene"}


class GeneAliasSearchIndex(_Gene, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "gene_alias"}

    def get_description(self):
        return "({}) {}".format(self.gene.label, self.gene.name)


def _get_name_if_not_none(value, default_name):
    if value is None:
        return default_name
    else:
        return value.name


class _File:
    def get_label(self):
        return self.download_file.name

    def get_description(self):
        return "({})".format(self.download_file.release_name)

    def get_url(self):
        return url_for(
            "download.view_all",
            releasename=self.download_file.release_name,
            filename=self.download_file.name,
        )


class FileSearchIndex(_File, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "download_file"}


class _CellLine:
    def get_label(self):
        return self.cell_line.cell_line_display_name

    def get_url(self):
        return url_for(
            "cell_line.view_cell_line", cell_line_name=self.cell_line.depmap_id
        )


class CellLineSearchIndex(_CellLine, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "cell_line"}

    def get_description(self):
        return "{}".format(
            _get_name_if_not_none(self.cell_line.primary_disease, "Unknown disease")
        )


class CellLineAliasSearchIndex(_CellLine, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "cell_line_alias"}

    def get_description(self):
        return "({}) {}".format(
            self.cell_line.cell_line_display_name,
            _get_name_if_not_none(self.cell_line.primary_disease, "Unknown disease"),
        )


# TODO: Remove when context_explorer goes public
class ContextSearchIndex(GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "context"}

    def get_label(self):
        return Context.get_display_name(self.context.name)

    def get_description(self):
        return "Find cell lines which are members of {} context".format(
            self.get_label()
        )

    def get_url(self):
        return url_for("context.view_context", context_name=self.context.name)


class _ContextExp:
    def get_label(self):
        context = SubtypeContext.get_by_code(self.subtype_context.subtype_code)
        assert context is not None
        return f"{context.subtype_code}"

    def get_description(self):
        return "Find cell lines which are members of {} context".format(
            self.get_label()
        )

    def get_url(self):
        return url_for(
            "context_explorer.view_context_explorer",
            context=self.subtype_context.subtype_code,
        )


class ContextExplorerSearchIndex(_ContextExp, GlobalSearchIndex):
    __mapper_args__ = {"polymorphic_identity": "subtype_context"}
