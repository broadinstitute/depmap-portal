# Data Prep Pipeline

The data prep pipeline gets data from **Taiga** and prepares the data to make them ready for the analysis pipeline. At this point, there are two such preparations happen:

1. **Transformed Data**: These datasets are generated from current release or a combination of current release and other relevant data such as hgnc gene table, onocokb annotated data, etc.
2. **Legacy Data**: These datasets are not part of the currrent release anymore. However, they are still used for some analysis. E.g. RNAi data.

## How to run the data prep pipeline

First, make sure you have conseq installed from here: https://github.com/broadinstitute/conseq and conseq is executable.

Then, assuming you are in depmap-portal/data-prep-pipeline where this readme is located, install and activate a poetry environment. To do so, you can run `poetry shell`. Once inside the poetry environment:

1. Run `gcloud secrets versions access latest --secret="depmap-gumbo-data-dictionary-pull-sa-json" --project depmap-gumbo > depmap-gumbo-pull-sa.json` to get the key that is used to pull the data dictionary.
2. Now, run `python3 assemble_data_dictionary.py`. This will generate a downloadable version of data dictionary and upload that to taiga, specifically to `predictability-76d5.132` right now as a test. Once done, get the taiga ID of the newly updated data and update that to the `# Data Dictionary` section of `release_inputs.conseq` file.
3. Finally, run `conseq run common.conseq` which will run each rule mentioned there and produce the relevant output.

Note that there are two primary configuration files, `release_inputs.conseq` which contains all the taiga ids of the initial inputs for different rules and `common.conseq` which contains all the available rules. Each rule has a line at the end that uploads the output to taiga. If you would like to skip the upload for a particular rule, comment the line out and run conseq.

#### Note

Transformed and uploaded data should have samples as the row header/index and feature names as the column headers.

**Example**

```
,SOX10 (6663),NRAS (4893),BRAF (673)
ACH-000001,0,0.5,0.5
ACH-000002,0.6,0.6,0.7
ACH-000003,0.3,0.4,0.4
```
