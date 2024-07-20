## Preprocessing Pipeline Overview

We have a preprocessing pipeline runs via conseq. It takes in taiga
datasets specified as xrefs, cleans, transforms, and unifies these
datasets, and publishes the output to an GCS bucket. Conseq is available
here
<https://github.com/broadinstitute/conseq>.

See the conseq repo for instructions using conseq.

This process is now run in a production setting via jenkins jobs. If you
want to make changes, its often easiest to download the latest artifacts
from a given environment as your starting point.

# Common conventions

## xrefs

All inputs to the pipeline should be registered into taiga and accessed by taiga datafile ID. These IDs should be specified properties on artifacts (our convention, is typically to use `dataset_id`).

Taiga IDs used by all environments should go into `xrefs_common.conseq`. Those data which are only released to the DMC or internally should go into `xrefs-shared-internal-dmc.conseq`. Those which change every release should go into `xrefs-ENVIRONMENT.template`

## Executing rules on the cloud

If you have a task which requires a large amount of memory or CPU, it's best to push it to the cloud. If it's an array job (ie: you want hundreds of jobs to run in parallel) you should have your rule run sparkles to submit the job. Always submit the job with a name that contains a hash of the inputs so that we can gracefully continue if the process is interrupted. (See the predictive pipeline for examples)

If you have individual tasks which should run in the cloud, you can mark then as using the `dsub` executor and specify the memory required and the image to use. For example: 

```
rule process_celligner_inputs:
    executor: dsub {
       "docker_image": "us.gcr.io/broad-achilles/celligner@sha256:6442129dfc136d0d603e8fbd5b1d469a0bf91cc63286132e45975101edbaffa8",
       "min_ram": "50",
       "boot_disk_size": "70",
       "helper_path": "/opt/conseq/bin/conseq-helper" }
    inputs:
       ...
```

Also, note always specify the image SHA so that we can track which version of the image was used.


