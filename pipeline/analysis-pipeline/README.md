This is the very first draft of predictability as part of conseq in the new analysis pipeline.

This pipeline requires the same dependencies as the other pipeline directories.

The configuration for all models is in model-config.yaml

## To run

When running locally (ie: for development or testing) you can run using:

```
conseq run run_internal.conseq
```

or

```
conseq run run_exteranl.conseq
```


The `fit.conseq` works as follows:

1. It first creates model input json files based on the `model-config.yaml` file.
2. Once the input json file is created, daintree is run to produce the output for predictability. There are 3 different files that are uploaded to taiga for each model, predictions.csv, ensemble.csv, feature_metadata.csv.Running daintree also creates a `output_config.json` file which has the input config as well as the taiga ids of the 3 uploaded files.
3. The `output_config.json` file is then combined into a single `combined_daintree_output_config.json` where the screen is the key and the value is the list of the output config for each model.
