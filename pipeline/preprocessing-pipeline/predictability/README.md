This directory contains the files related to the predictability pipeline the
portal uses.

The conseq rules live in predictability.conseq with supporting scripts under
"scripts".

One can do a small test run on the prism onoclogy AUC data and the
RNAi_merged dataset by running:

```
conseq run test.conseq
```

You can then find the paths to the final output tables by asking for
artifacts of type 'pred-models-csv':

```
$ conseq ls type=pred-models-csv
For type=pred-models-csv:
  Properties shared by all 3 rows:
    type
    ---------------
    pred-models-csv
  dataset             filename
  ------------------  ---------------------------------------
  Rep_all_single_pt   {'$filename': 'state/r65/ensemble.csv'}
  Prism_oncology_AUC  {'$filename': 'state/r66/ensemble.csv'}
  RNAi_merged         {'$filename': 'state/r67/ensemble.csv'}
```
