# Data Prep Pipeline

The data prep pipeline gets data from **Taiga** and prepares the data to make them ready for the analysis pipeline and preprocessing pipeline. At this point, there are two such preparations happen:

1. **Transformed Data**: These datasets are generated from current release or a combination of current release and other relevant data such as hgnc gene table, onocokb annotated data, etc.
2. **Legacy Data**: These datasets are not part of the currrent release anymore. However, they are still used for some analysis. E.g. RNAi data.

## How to run the Data Prep Pipeline locally

First, make sure you have conseq installed from here: https://github.com/broadinstitute/conseq and conseq is executable.
Second, check out the `depmap-deploy` repo if you have not already and put that in the same directory where `depmap-portal` repo is located.
Then, assuming you are in `depmap-portal/pipeline/data-prep-pipeline` where this readme is located:

1. Run `eval $(poetry env activate)` or `poetry shell` if poetry is <2.0. Then install the packages inside the poetry env.
2. Once inside the poetry environment, run `local_run.sh` which will run each rule mentioned there and produce the relevant output.

## How to extend the pipeline to add additional files to the release

Please follow these steps:

1. Write your conseq script and add that to the `data-prep-pipeline/data_prep_pipeline` directory.
2. If it consumes a python script, then please add that to the `data-prep-pipeline/scripts` directory.
3. If you would like the output file to be uploaded to Taiga, then please add that to the `data-prep-pipeline/data_prep_pipeline/publish.conseq` file. There's a `upload_to_taiga.py` script that can be used to upload in a simplified manner.

#### Note

Transformed and uploaded data should have samples as the row header/index and feature names as the column headers.

**Example**

```
,SOX10 (6663),NRAS (4893),BRAF (673)
ACH-000001,0,0.5,0.5
ACH-000002,0.6,0.6,0.7
ACH-000003,0.3,0.4,0.4
```
