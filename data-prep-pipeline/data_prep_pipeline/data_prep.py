import argparse

from cn_gene.transform_cngene_to_log2 import process_and_update_cngene_log2
from predictability.transform_crispr_confounders import (
    process_and_update_crispr_confounders,
)
from predictability.transform_lineage import process_and_update_lineage
from predictability.transform_fusion import process_and_update_fusion
from predictability.transform_driver_events import process_and_update_driver_events
from predictability.transform_genetic_derangement import (
    process_and_update_genetic_derangement,
)


def parse_args() -> tuple[str, str]:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "source_dataset_id", type=str, help="The dataset id of the data to transform."
    )
    parser.add_argument(
        "--new_dataset_id", type=str, help="Target dataset ID to use to update."
    )
    args = parser.parse_args()

    # If a new dataset ID is provided, use it as the target dataset ID. Otherwise, use the source dataset ID.
    if args.new_dataset_id:
        target_dataset_id = args.new_dataset_id
    else:
        target_dataset_id = args.source_dataset_id.split(".")[0]

    return args.source_dataset_id, target_dataset_id


def main():
    source_dataset_id, target_dataset_id = parse_args()

    process_and_update_cngene_log2(source_dataset_id, target_dataset_id)
    process_and_update_crispr_confounders(source_dataset_id, target_dataset_id)
    process_and_update_lineage(source_dataset_id, target_dataset_id)
    process_and_update_fusion(source_dataset_id, target_dataset_id)
    process_and_update_driver_events(source_dataset_id, target_dataset_id)
    process_and_update_genetic_derangement(source_dataset_id, target_dataset_id)


if __name__ == "__main__":
    main()
