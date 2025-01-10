#!/bin/bash

set -ex

openapi-python-client \
  generate \
  --meta=none \
  --output-path ../breadbox-client/breadbox_client \
  --path ../breadbox-client/latest-breadbox-api.json \
  --overwrite
 