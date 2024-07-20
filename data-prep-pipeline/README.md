The `data_prep.py` runs the data-prep-pipeline. It needs at least a taiga dataset id which is used as the source. It is optional to provide a new target dataset id where the output matrices would be uploaded. If no new dataset id is provided, then the script will write the output matrices to the dataset of the source taiga id.

1. To write/upload files at the source dataset, run: `python data_prep.py source_dataset_taiga_id`. For example,
   `python data_prep.py internal-23q4-ac2b.80` will get the required data from the source_dataset_taiga_id, transform them, and upload the transformed versions to the source_dataset_taiga_id.
2. To write at a new dataset, run: `python data_prep.py source_dataset_taiga_id --new_dataset_id=new_dataset_id`. For example, `python data_prep.py internal-23q4-ac2b.80 --new_dataset_id=predictability-76d5` will get the required data from the source_dataset_taiga_id, transform them, and upload the transformed versions to the new_dataset_id.
