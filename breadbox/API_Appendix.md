## Datasets

A dataset in Donut consists of samples, entities, 2D data with samples on one axis and entities on the other, and metadata.

Samples are most commonly `cell_line`s but can be `other` , and entities can be one of `gene`, `transcription_site`, `protein`, `antibody`, `compound`, `compound_experiment`, `compound_dose`, or `other`. The `other` feature type is treated as generic entities, potentially without stable IDs, while the rest require metadata in specific formats described in the [Uploading data](#uploading-data) section, and can be queried based on the metadata.

### Uploading datasets

#### `POST /datasets`

Add a new dataset.

##### Parameters

The request parameters should be sent as `multipart/form-data`

- `name`: Display name for the dataset
- `units`: Units of the data, ex: `log2 fold change`
- `dataFile`: UTF-8 encoded CSV file with stable feature IDs (described with the `featureDataFile` parameter below) as the column headers and sample IDs as the row headers. ex:
  ```
  ,6663,4893
  ACH-000579,,0.3
  ACH-000014,1.6,4.8
  ```
- `sampleType`: One of `cell_line` or `other`
- `sampleDataFile`: CSV file that contains IDs and labels depending on `sampleType`
  - `cell_line`:
    - `id`: DepMap ID, ex `ACH-000579`
    - `label`: Cell line name, ex: `UACC257`
- `FeatureType`: One of `gene`, `transcription_site`, `protein`, `antibody`, `compound`, `compound_experiment`, `compound_dose`, or `other`
- `featureDataFile`: CSV file that contains IDs, labels, and other information about entities in the dataset. If `FeatureType` is `other`, this file is not required, and the column headers from the data file will be used for both the IDs and labels. Otherwise:
  - `gene`:
    - `id`: [Entrez Gene](https://www.ncbi.nlm.nih.gov/gene) ID, ex: `6663`
    - `label`: [HGNC symbol](https://www.genenames.org/), ex: `SOX10`
  - `transcription_site`:
    - `id`:
    - `label`:
    - `chromosome`: Chromosome number
    - `fpos`: 5' position
    - `tpos`: 3' position
    - `gene_id`: Entrez Gene ID
  - `protein`:
    - `id`: [UniProt](https://www.uniprot.org/) ID, ex: `P56693`
    - `label`: Protein name or ID, ex: `Transcription factor SOX-10`
    - `gene_id`: Entrez Gene ID of associated gene, ex: `6663`
  - `antibody`:
    - `id`: [Research Resource Identifier (RRID)](https://scicrunch.org/resources), ex: `AB_2279451`
    - `label`: Antibody name, ex: `GSK-3alpha/beta (0011-A) antibody`
    - `gene_ids`: Entrez Gene IDs for the target genes, separated by spaces, ex: `2931 2932`
    - `protein_ids`: UniProt IDs for the target proteins, separated by spaces, ex: `P49840 P49841`
  - `compound`:
    - `id`: [PubChem](https://pubchem.ncbi.nlm.nih.gov/) Compound ID, ex: `10184653`
    - `label`: compound name, ex: `afatninib`
  - `compound_experiment`
    - `id`: Institute/dataset label + id in dataset, ex: `BRD:BRD-K66175015-001-09-0`
      - Supported institutes/datasets are currently:
        - `BRD`: Broad Institute
    - `label`: compound name, ex: `afatninib`
    - `compound_id`: PubChem Compound ID, ex: `10184653`
  - `compound_dose`
    - `id`: Institute/dataset label + id in dataset + dose, ex: `BRD:BRD-K66175015-001-09-0:2.5`
    - `label`: compound name + dose, ex: `afatninib (2.5μMol)`
    - `compound_id`: PubChem Compound ID, ex: `10184653`
    - `compound_experiment_id`: Compound experiment ID, ex: `BRD:BRD-K66175015-001-09-0`
    - `dose`: Dose in μMol, ex: `2.5`
  - `groupId`: ID of the [group](#authorization-groups) that the dataset should be available to. The user uploading the dataset must have permission to add datasets for the group.
