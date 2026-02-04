#!/bin/bash
python ../preprocess_taiga_ids.py release_inputs_internal.template release_inputs_internal-DO-NOT-EDIT-ME && conseq run data_prep_pipeline/run_internal.conseq
