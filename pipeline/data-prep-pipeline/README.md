# Data Prep Pipeline

The data prep pipeline gets data from **Taiga** and prepares the data to make them ready for the analysis pipeline and preprocessing pipeline. At this point, there are two such preparations happen:

1. **Transformed Data**: These datasets are generated from current release or a combination of current release and other relevant data such as hgnc gene table, onocokb annotated data, etc.
2. **Legacy Data**: These datasets are not part of the currrent release anymore. However, they are still used for some analysis. E.g. RNAi data.

## How to run the Data Prep Pipeline locally

First, make sure you have conseq installed from here: https://github.com/broadinstitute/conseq and conseq is executable.
Second, check out the `depmap-deploy` repo if you have not already and put that in the same directory where `depmap-portal` repo is located.
Then, assuming you are in `depmap-portal/pipeline/data-prep-pipeline` where this readme is located:

1. Run `eval $(poetry env activate)` or `poetry shell` if poetry is <2.0. Then install the packages inside the poetry env.
2. Once inside the poetry environment, run `conseq`:

For all the internal deployments:

```
conseq run data_prep_pipeline/run_internal.conseq
```

For the public deployment:

```
conseq run data_prep_pipeline/run_external.conseq
```

## How to locally run the taiga update process

When run from jenkins, this pipeline updates the release dataset that it is configured to read from. If you need to test the "publish" process (ie: writing back to taiga) then:

1. Create a copy of the release, and update `<env>`.template with the permaname of the copy. We do not want to update the official release dataset in the course of development/debugging
2. Run the following command which will force publishing to occur. (The default is to _not_ publish back to taiga which is conveninent for testing the rest of the pipeline without alterning anything)

```
conseq run --define publish_data_prep=True --define is_dev=False data_prep_pipeline/run_<env>.conseq 
```

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
