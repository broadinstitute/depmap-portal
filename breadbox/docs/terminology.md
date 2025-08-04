# Breadbox Terminology
_In the terminology definitions below, we reference the example of one of DepMap’s CRISPR gene dependency datasets. This dataset is a matrix of continuous numeric values. Each row in the dataset represents a DepMap model (cell line), and each column represents a gene. Each value in the matrix contains a “dependency score” describing the effect of the CRISPR knockout of a given gene in the given cell line._

**Datasets**: The concept of a dataset in Breadbox represents a single file of data which may be used interactively in the portal. Most of the datasets in breadbox map onto a downloadable file in the DepMap Portal. 

* **Dataset Given ID**: (also known as dataset.name in the legacy portal codebase) is a human-readable label which refers to a dataset. This is distinct from dataset IDs which are opaque UUIDs. The given IDs are used for datasets which get updated over time, but are always expected to represent the latest version of some "data". Each version will get a distinct dataset_id, but the given_id will always allow the latest version to be retrieved. If you want to make a reference to a dataset which will be stable across releases/updates you should use "given_id" to find the dataset.

There are 2 types of datasets:
1. **Tabular Dataset**: A dataset which generally stores metadata for a given dimension type. Each table of metadata must have at least an “ID” column and a “label” column. Examples of labels would be gene names (for the “gene” entity), or cell line names (for the “depmap_model” entity).
   * For example, the “depmap_model” dimension type has a table of metadata. This metadata includes things like the “depmap_id” (a stable identifier of cell lines in the depmap project), “label” (which is a human readable cell line name), “OncotreeLineage”, “OncotreePrimaryDisease”, etc.
2. **Matrix Dataset**: A dataset which contains a matrix of continuous numeric values. This matrix is indexed by two “dimension types”. The column index is typically referred to as the “feature type” and the row index is referred to as the “sample type”. 

**Identifier type**: Breadbox is able to use multiple types of identifiers - commonly referred to as "IDs" (aka "given IDs") and "labels".
* **Given IDs**: A commonly used identifier which is stable over time and sometimes shared with users. For example, this might include depmap model ids (aka the "ACH ID"), gene entrez ids, etc. . These are sometimes also called "feature ids" or "sample ids" depending on which axis they are being used to index.
* **Labels**: also a unique identifier, but much more human readable (ex. names like SOX10, KRAS, BRAF for genes, names like AFATINIB for drugs, names like MHHCALL2 for cell lines). These are sometimes also called "feature labels" or "sample labels" depending on which axis they are being used to index.
In other words, you as a user have some flexibility to use whichever identifiers you have on-hand. If you know the gene name, but not the entrez ID, then you can just give breadbox the gene name (even though it's not really a long-term stable identifier)

**Dimension type**: A type of entity which is represented in DepMap data (ex. model, gene, compound, etc. ). Each dimension type has its own metadata and can be used to index matrix datasets.
* In our example above, the matrix dataset is indexed by both “gene” and “depmap_model” dimension types. Each of these dimension types has its own metadata which can be joined and used alongside the matrix values. 
* For the “depmap_model” dimension type, we store metadata in a separate table including columns like “OncrotreeLineage”, “OncotreePrimaryDisease”, “CellLineDisplayName”
* For the gene dimension type (for example Sox10), we would store metadata like “symbol”, “full name”, “location”, “alias”, 

**Dimension/Slice**: A single row or column of data from a dataset. We use the terms “dimension” and “slice” largely interchangeably 
* For example in a matrix dataset, this could be the gene dependencies for a single depmap model, or for a single gene
* For a tabular dataset, this could be a column of metadata (ex. a column describing the lineages of all depmap models). 

**Data type**: In the context of DepMap, the general category of what the dataset is describing (the type of experiments that generated the data)
* Examples: CRISPR, Drug Screen (for datasets like Oncref, GDSC1, GDSC2, CTD^2), Expression, etc. 

**Slice Query**: A slice query is a JSON object which includes a few key pieces of information
* `dataset_id` (string): The dataset in which you are querying data
* `identifier` (string): the ID or label of the entity you are querying for
* `identifier_type` (string enum): one of ["feature_id", "feature_label", "sample_id", "sample_label", "column"] 
