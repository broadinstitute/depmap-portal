# Data Prep Pipeline

The data prep pipeline gets data from **Taiga** and prepares the data to make them ready for the analysis pipeline. At this point, there are two such preparations happen:

1. **Transformed Data**: These datasets are generated from current release or a combination of current release and other relevant data such as hgnc gene table, onocokb annotated data, etc.
2. **Legacy Data**: These datasets are not part of the currrent release anymore. However, they are still used for some analysis. E.g. RNAi data.

## How to run the Data Prep Pipeline locally

First, make sure you have conseq installed from here: https://github.com/broadinstitute/conseq and conseq is executable.

Then, assuming you are in depmap-portal/data-prep-pipeline where this readme is located, install and activate a poetry environment. To do so:

1. Run `poetry shell`. Once inside the poetry environment:
2. Run `data_prep_pipeline/common.conseq` which will run each rule mentioned there and produce the relevant output.

Note that there are two primary configuration files, `release_inputs.conseq` which contains all the taiga ids of the initial inputs for different rules and `common.conseq` which contains all the available rules. There's a `data_prep_pipeline/publish.conseq` file where each upload to taiga is configured and executed. If you would like to modify or skip the upload for a particular rule, then do so in that file.

## Run the Data Prep Pipeline in Jenkins

Go to the Data Prep Pipeline 1.0 jenkins job here: https://datascidev.broadinstitute.org/job/Data%20Prep%20Pipeline%201.0/

Then click on build. Optionally choose one of the parameters if you would like a clean start or start with a specific export or want to automatically rebuild the db once done.

#### Note

Transformed and uploaded data should have samples as the row header/index and feature names as the column headers.

**Example**

```
,SOX10 (6663),NRAS (4893),BRAF (673)
ACH-000001,0,0.5,0.5
ACH-000002,0.6,0.6,0.7
ACH-000003,0.3,0.4,0.4
```
