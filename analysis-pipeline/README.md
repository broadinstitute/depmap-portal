This is the very first draft of predictability as part of conseq in the new analysis pipeline.

You just need conseq installed since everything else that is required is installed inside the us-central1-docker.pkg.dev/depmap-consortium/depmap-docker-images:v4 image where predicability is run.

Note that there is a model-config.yaml file which has the config of all the models.
Once conseq is installed, you can run `conseq run fit.conseq` to start.

The `fit.conseq` works as follows:

1. It first creates model input json files based on the `model-config.yaml` file.
2. Once the input json file is created, daintree is run to produce the output for predictability. There are 3 different files that are uploaded to taiga for each model, predictions.csv, ensemble.csv, feature_metadata.csv.Running daintree also creates a `output_config.json` file which has the input config as well as the taiga ids of the 3 uploaded files.
3. The `output_config.json` file is then combined into a single `combined_daintree_output_config.json` where the screen is the key and the value is the list of the output config for each model.
