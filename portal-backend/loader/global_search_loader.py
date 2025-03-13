from flask import current_app
from depmap.download.models import DownloadFileGlobalSearch
from depmap.extensions import db
from depmap.global_search.models import (
    ContextExplorerSearchIndex,
    FileSearchIndex,
)
from depmap.settings.download_settings import get_download_list
from depmap.compound.models import Compound
import re


def load_global_search_index():
    _execute("delete from global_search_index")
    _execute("delete from download_file")
    __load_gene_search_index()
    __load_cell_line_search_index()
    __load_context_search_index()
    __load_compound_search_index()


def _execute(stmt):
    db.session.connection().execute(stmt)


def __load_compound_search_index():
    stmt = """
    	insert into global_search_index (label, type, compound_id, entity_id)
    	select entity.label, 'compound', compound.entity_id, compound.entity_id
    	from compound
    	join entity on compound.entity_id = entity.entity_id
    """
    _execute(stmt)

    # "gene_compound_target_association",
    # Column("gene_entity_id", Integer, ForeignKey("gene.entity_id"), nullable=False),
    # Column(
    #     "compound_entity_id", Integer, ForeignKey("compound.entity_id"), nullable=False,
    # ),

    stmt = """
    	insert into global_search_index (label, type, compound_id, entity_id)
    	select gene.label, 'compound_target', compound.entity_id, compound.entity_id
    	from compound
    	join gene_compound_target_association gcta on gcta.compound_entity_id = compound.entity_id 
    	join entity gene on gene.entity_id = gcta.gene_entity_id 
    """
    _execute(stmt)

    # slower then the other bulk insertions, but since we need to parse target_or_mechanism, do this in python
    values = []
    for compound in Compound.query.filter(Compound.target_or_mechanism.is_not(None)):
        for target_or_mechanism in re.split("[;]", compound.target_or_mechanism):
            values.append(
                (target_or_mechanism.strip(), compound.entity_id, compound.entity_id)
            )
    if len(values) > 0:
        db.session.connection().execute(
            """
            insert into global_search_index (label, type, compound_id, entity_id)
            values (?, 'compound_target_or_mechanism', ?, ?)
        """,
            values,
        )

    stmt = """
		insert into global_search_index (label, type, compound_id, entity_id)
		select entity_alias.alias, 'compound_alias', entity_alias.entity_id, entity_alias.entity_id
		from compound
		join entity_alias on compound.entity_id = entity_alias.entity_id
	"""
    _execute(stmt)


def __load_gene_search_index():
    stmt = """
		insert into global_search_index (label, type, gene_id, entity_id)
		select entity.label, 'gene', gene.entity_id, gene.entity_id
		from gene
		join entity on gene.entity_id = entity.entity_id
	"""
    _execute(stmt)

    stmt = """
		insert into global_search_index (label, type, gene_id, entity_id)
		select entity_alias.alias, 'gene_alias', entity_alias.entity_id, entity_alias.entity_id
		from gene
		join entity_alias on gene.entity_id = entity_alias.entity_id
	"""
    _execute(stmt)


def __load_cell_line_search_index():
    stmt = """
		insert into global_search_index (label, type, depmap_id)
		select cell_line.cell_line_display_name, 'cell_line', cell_line.depmap_id
		from cell_line
	"""
    _execute(stmt)

    stmt = """
    		insert into global_search_index (label, type, depmap_id)
    		select cell_line.alias, 'cell_line_alias', cell_line.depmap_id
    		from cell_line_alias cell_line
    	"""
    _execute(stmt)

    stmt = """
		insert into global_search_index (label, type, depmap_id)
		select cell_line.depmap_id, 'cell_line_alias', cell_line.depmap_id
		from cell_line where cell_line.depmap_id is not null
	"""
    _execute(stmt)


def load_file_search_index():

    downloads = get_download_list()
    for release in downloads:
        for file in release.all_files:
            downloadfile = DownloadFileGlobalSearch(file.name, release.name)
            db.session.add(
                FileSearchIndex(label=file.name, download_file=downloadfile,)
            )


from depmap.context.models_new import SubtypeContext


def __load_context_search_index():
    if current_app.config["ENABLED_FEATURES"].context_explorer:
        # Use SubtypeContext because SubtypeNode might have codes that don't have depmap models, and
        # therefore should not be searchable.
        for context in SubtypeContext.query.all():
            db.session.add(
                ContextExplorerSearchIndex(
                    label=context.subtype_code, subtype_context=context
                )
            )
