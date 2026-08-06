# Proposal for new way of storing/retrieving data for "predictive insights"

## Change 1: Store predictive analysis results into breadbox

I propose we follow the same pattern as "precomputed correlations" and store predictive model results in Breadbox.

Pros:

- This allows us to tightly couple the predictive analysis results to the datasets which are also in Breadbox, instead of relying on the loose coupling that comes from the use of dataset given_id. (when I say "tight couping" I mean, being able to store data for specific dataset_ids and allow the DB to enforce those fk constraints)
- This would be further development in breadbox which we are striving to move as much functionality into as opposed to further investing in our "legacy backend"

Cons:

- This is really pushing the limits of the goal, "Breadbox should be a dumb store of data" These predictive analysis results have more "structure" than other things we've put into Breadbox.
- This will also mean the breadbox loader will become slightly more complicated in order to support this data type.

I'm not too worried about either of those "cons" because of the success of loading precomputed correlations into Breadbox. It seems like that ultimately has worked reasonably well and I found the process of adding that easier than updating the legacy portal backend's db. I appreciate breadbox's ability to partially load the db with test data as well as other development conveniences.

## Change 2: Change how the UI retrieves predictive model results

If we can fully specify the breadbox API contract, then we can build that, test it, and only start making UI updates until after the contract \_and\_ data is fully in place.

I propose the following API:

### GET /predictive_models/feature/{dataset_id}/{feature_given_id}

where

- dataset_id is either a literal dataset's id (uuid) or a dataset given_id.
- feature_given_id is the given ID of the feature that we built a model to predict

For example, to get the predictive models for knockout of BRAF, you'd request /predictive_models/CRISPR_combined/673

**This (and /predictive_models/configs/{dimension_type_name}) are likely the only endpoint that the front end will need to use. The others primarily exist to allow the breadbox loader to query the current state and do an incremental update to load/delete anything it needs to.**

Response:  
404 if no predictive models have been stored for this dataset.  
200 if at least one predictive model has been stored.  
Body as json with the following fields:

| actuals_dataset_id : str  | The dataset ID of the dataset we requested models for                        |
| :------------------------ | :--------------------------------------------------------------------------- |
| actuals_dataset_name: str | The display name of the dataset that we requested models for                 |
| model_fits : ModelFit\[\] | A set of models which were fit to predict the feature in the actuals_dataset |

ModelFit is an object with the following fields:

| predictions_dataset_id : str          | The ID of the dataset holding the predicted values from this specific model config for the feature we're predicting                                                                                                                                                |
| :------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| predictions_dataset_name: str         | The display name for that dataset                                                                                                                                                                                                                                  |
| prediction_actual_correlation : float | The pearson correlation between the two features: (actuals_dataset_id, feature_given_id) and (predictions_dataset_id, feature_given_id)                                                                                                                            |
| model_config_name : str               | A short label that we use to refer to the model configurate                                                                                                                                                                                                        |
| model_config_description: str         | A longer description of the model configuration which can be shown in tool tips. (I'm not sure that the current UI has a place for this, but we really ought to have some description for each model, and this would allow us to avoid hard coding it into the UI) |
| top_features : PredictiveFeature\[\]  | The features which were found to have the most predictive power based on                                                                                                                                                                                           |

PredictiveFeature is an object with the following fields:

| dataset_id : str                | The dataset the predictive feature belongs to                                                                    |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------- |
| given_id : str                  | The feature given_id for the predictive feature                                                                  |
| label : str                     | The label to show for the feature                                                                                |
| importance : float              | The computed feature importance for this feature. (Should be used to sort which features are the "top" features) |
| correlation_with_actual : float | The pearson correlation between (dataset_id, given_id) and (actuals_dataset_id, feature_given_id)                |

### GET /predictive_models/configs/{dimension_type_name}

Retrieve configs for a single dimension_type  
response: An instance of PredictiveModelConfig or 404

**The remaining methods are likely only needed for the Breadbox Loader**

### GET /predictive_models/configs

Retrieve configs for all dimension_types.

Returns a list of PredictiveModelConfig

PredictiveModelConfig is defined with the following fields:

| dimension_type_name             | The type of feature which used these model configurations                    |
| :------------------------------ | :--------------------------------------------------------------------------- |
| model_configs : ModelConfig\[\] | The list of model configurations which were applied for a specific data type |

A ModelConfig is defined as:

| model_config_name : str                   | A short label that we use to refer to the model configurate                                                                                                                                                                                                        |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| model_config_description: str             | A longer description of the model configuration which can be shown in tool tips. (I'm not sure that the current UI has a place for this, but we really ought to have some description for each model, and this would allow us to avoid hard coding it into the UI) |
| datasets_with_results : List\[IDAndName\] | (Only returned from GET methods, ignored on PATCH/POST operations) List of which datasets have results stored for this config                                                                                                                                      |

Where ID and name is defined as:

| dataset_id : str  | The dataset ID of the dataset we requested models for        |
| :---------------- | :----------------------------------------------------------- |
| dataset_name: str | The display name of the dataset that we requested models for |

### POST | PATCH /predictive_models/configs/{dimension_type_name}

body: an instance of PredictiveModelConfig  
response: the instance of PredictiveModelConfig updated or inserted into the DB

### DELETE /predictive_models/configs/{dimension_type_name}

delete the configs for this type

### POST /predictive_models/config/{dimension_type_name}/{config_name}/{dataset_id}

Bulk load of all the predictive results for a specific. The upload will take the form of a chunked upload of a parquet file similar to how we upload datasets. The columns of the parquet file will be as follows:

(note: the "feature_n\_..." columns will start with "feature_1\_..." and have as many as top features were reported by daintree.)

| actuals_feature_given_id      | The given ID of the feature we were predicting                                                                                          |
| :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| prediction_actual_correlation | The pearson correlation between the two features: (actuals_dataset_id, feature_given_id) and (predictions_dataset_id, feature_given_id) |
| feature_n_dataset_id          | The n'th predictive feature's dataset_id                                                                                                |
| feature_n_given_id            | The n'th predictive feature's given_id                                                                                                  |
| feature_n_correlation         | The n'th predictive feature's correlation with the actuals as reported by daintree                                                      |
| feature_n_importance          | The n'th predictive feature's "importance" as reported by daintree                                                                      |

POST Body:

| file_ids: list\[str\] | The IDs of the chunks                                         |
| :-------------------- | :------------------------------------------------------------ |
| file_sha256           | file hash to verify integrity post reconstruction from chunks |

### DELETE /predictive_models/config/{dimension_type_name}/{config_name}/{dataset_id}

Delete results for a given dataset+config
