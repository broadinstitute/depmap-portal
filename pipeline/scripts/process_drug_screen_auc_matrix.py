import taigapy
import argparse
from taigapy.format_utils import write_hdf5

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

tc = taigapy.create_taiga_client_v3()

### Convert the new drug screen format to the old drug screen format so that
### the datasets can be ingested in the pipeline without much additional changes.
assert label in [
    "Prism_oncology_AUC",
    "Prism_oncology_IC50",
    "GDSC1_AUC",
    "GDSC2_AUC",
    "Repurposing_secondary_AUC",
    "CTRP_AUC",
]

data_df = tc.get(dataset_id)

metadata_df = tc.get(conditions_dataset_id)
# make a mapping of compound -> sample ID because the legacy backend is expecting sample IDs so we need to remap these

sample_compound_ids = metadata_df[["SampleID", "CompoundID"]].drop_duplicates()
assert (sum(sample_compound_ids["SampleID"].value_counts() > 1) == 0) and (
    sum(sample_compound_ids["CompoundID"].value_counts() > 1) == 0
), "There isn't a 1 to 1 mapping between Sample and Compound IDs"

sample_by_compound_id = {
    rec["CompoundID"]: rec["SampleID"] for rec in sample_compound_ids.to_records()
}
compound_by_sample_id = {
    rec["SampleID"]: rec["CompoundID"] for rec in sample_compound_ids.to_records()
}


def fixup_sample_id(name):
    # Here's a special case: For some reason oncref has PRC IDs (sample IDs), while all the others have compound IDs. So, check to
    # see which kind of ID we have
    if name in compound_by_sample_id:
        # looks like it's a sample ID
        assert name not in sample_by_compound_id
        sample_id = name
    else:
        # looks like it must be a compound ID
        sample_id = sample_by_compound_id[name]

    # now we need to add the sample prefix to avoid sample ID collisions
    if ":" in sample_id:
        assert sample_id.startswith(
            f"{sample_id_prefix}:"
        ), f"Malformed sample ID: {sample_id}"
        return sample_id
    else:
        return f"{sample_id_prefix}:{sample_id}"


data_df.columns = [fixup_sample_id(x) for x in data_df.columns]
data_df = data_df.transpose()

write_hdf5(data_df, output_filename)
