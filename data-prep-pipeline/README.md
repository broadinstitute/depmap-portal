# Data Prep Pipeline

The data prep pipeline gets data from **Taiga** and prepares the data to make them ready for the analysis pipeline. At this point, there are two such preparations happen:

1. **Transformed Data**: These datasets are generated from current release or a combination of current release and other relevant data such as hgnc gene table, onocokb annotated data, etc.
2. **Legacy Data**: These datasets are not part of the currrent release anymore. However, they are still used for some analysis. E.g. RNAi data.

## How to run the data prep pipeline

First, make sure you have conseq installed from here: https://github.com/broadinstitute/conseq and conseq is executable.

Then, assuming you are in depmap-portal/data-prep-pipeline where this readme is located, install and activate a poetry environment. To do so, you can run `poetry shell`. Once inside the poetry environment, run `conseq run common.conseq` which will run each rule mentioned there and produce the relevant output.

NOTE: There are two primary configuration files, `release_inputs.conseq` which contains all the taiga ids of the initial inputs for different rules and `common.conseq` which contains all the available rules. If you would like to upload the output data, then please use a -u flag in the relevant conseq rule's python execution line. If a specific taiga id is provided after the -u flag as a parameter, then the output data will be uploaded to that particulartaiga id. If no parameter is provided, then the output data will be uploaded to the release dataset mentioned in `release_inputs.conseq`.

## How to add a dataset to the data prep pipeline

#### If source data is from release only

1. Check if the dataset name already exists in [datarelease_taiga_permanames](data_prep_pipeline/datarelease_taiga_permanames.py). If it does, then go to step 2. If not, then add the taiga permaname as a variable there. E.g. For internal-24q2-3719.87/OmicsSomaticMutations the permaname would be _"OmicsSomaticMutations"_.
2. Write a script that imports the source data, does the transformation, and uploads the transformed dataframe to taiga. There's a _update_taiga_ function in [utils.py](data_prep_pipeline/utils.py) that can be used to do so.
3. Import and add that script to the main function of [data prep.py](data_prep_pipeline/data_prep.py).

An example can be found [here](data_prep_pipeline/predictability/transform_crispr_confounders.py).

#### If source data is from release+some other dataset in taiga

In case of the other dataset in taiga, add that to the [config.py](data_prep_pipeline/config.py) as a variable and import that in your transformation script. Everything else is exactly as [If Source Data is from release only](#if-source-data-is-from-release-only).

An example can be found [here](data_prep_pipeline/predictability/transform_fusion.py)

#### If source data is from legacy only

We are not expecting many such datasets to be out there. But if you need to add one, then:

1. Add the legacy taiga id as a variable in [legacy_data_prep.py](data_prep_pipeline/legacy_datasets/legacy_data_prep.py).
2. Add the target_taiga_id.
3. Write a function that processes the data in [this format](#note) and uploads to taiga.
4. Add that function to the main function.
5. Execute the `legacy_data_prep.py` once.

#### Bonus Case: If the source data is generated as part of the data prep pipeline

1. Add the taiga permaname in [datarelease_taiga_permanames](data_prep_pipeline/datarelease_taiga_permanames.py).
2. Import and use that taiga permaname variable in your source data transformation script's update_taiga function's `matrix_name_in_taiga` parameter. E.g. line 33 in cngene transformation.[script](data_prep_pipeline/cn_gene/transform_cngene_to_log2.py)
3. Everything else is exactly as [If Source Data is from release only](#if-source-data-is-from-release-only). Just make sure that this script is executed after the source data transformation script in the main function of [data_prep.py](data_prep_pipeline/data_prep.py)

#### Note

Transformed and uploaded data should have samples as the row header/index and feature names as the column headers.

**Example**

```
,SOX10 (6663),NRAS (4893),BRAF (673)
ACH-000001,0,0.5,0.5
ACH-000002,0.6,0.6,0.7
ACH-000003,0.3,0.4,0.4
```
