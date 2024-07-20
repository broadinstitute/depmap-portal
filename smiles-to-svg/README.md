This poetry package generates SVGs from SMILE strings and uploads them to a Google Cloud Bucket.

To run:

1. Make sure you have poetry installed(e.g. `brew install poetry`) and have access to the depmap-compound-images cloud bucket.
2. Run `poetry install` to set up the environment with the right dependencies.
3. Run `poetry run smiles2svg` to generate and upload new images to Google Cloud. The default taiga id is `compound-metadata-de37.17/compound_metadata_expanded`.
   However, if you want to use a new dataset then run `poetry run smile2svg --taiga_id=<id of new dataset>`. For example, if you want to use a dataset with taiga id, `compound-metadata-de40.18/compound_metadata_expanded`, then run `poetry run smile2svg --taiga_id="compound-metadata-de37.17/compound_metadata_expanded"`
