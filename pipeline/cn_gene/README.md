Run the `transform_cngene_to_log2.py` script to generate a log transformed version of the OmicsCNGene file and upload it to taiga named as `PortalOmicsCNGeneLog2`.

To run the script:

1. First activate the poetry environment in portal-backend. `cd portal-backend && poetry shell`
2. Then go back to the pipeline/cn_gene directory. `cd ../pipeline/cn_gene`
3. Now run:
   `python transform_cngene_to_log2.py <release_cn_gene_taiga_id>`

The `release_cn_gene_taiga_id` parameter is the taiga ID of OmicsCNGene data.

For example, to transform the 23q4 internal cn gene data to log2 format, run:
`python transform_cngene_to_log2.py internal-23q4-ac2b.16/OmicsCNGene`

Once run successfully, the output should print a statement with the taiga ID of the dataset that was updated and the new version number.

E.g. Updated dataset: internal-23q4-ac2b to version number: 73
