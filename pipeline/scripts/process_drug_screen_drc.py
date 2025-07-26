import taigapy
import argparse

tc = taigapy.create_taiga_client_v3()

parser = argparse.ArgumentParser()
parser.add_argument("label")
parser.add_argument("dataset_id")
parser.add_argument("conditions_dataset_id")
parser.add_argument("sample_id_prefix")
parser.add_argument("output_filename")
args = parser.parse_args()

label = args.label
dataset_id = args.dataset_id
conditions_dataset_id = args.conditions_dataset_id
sample_id_prefix = args.sample_id_prefix
output_filename = args.output_filename

### Convert the new drug screen format to the old drug screen format so that
### the datasets can be ingested in the pipeline without much additional changes.
assert label in [
    "Prism_oncology_per_curve",
    "Repurposing_secondary_per_curve",
    "ctd2_per_curve",
    "GDSC1",
    "GDSC2",
]

curves_df = tc.get(dataset_id)
curves_df = curves_df.rename(
    columns={
        "ModelID": "cell_line_name",
        "SampleID": "compound_name",
        "EC50": "ec50",
        "LowerAsymptote": "lower_asymptote",
        "UpperAsymptote": "upper_asymptote",
        "Slope": "slope",
    }
)
curves_df.to_csv(output_filename, index=False)
