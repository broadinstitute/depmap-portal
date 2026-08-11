#!/bin/bash

set -ex

uvx openapi-python-client==0.21.1 \
  generate \
  --meta=none \
  --output-path ../breadbox-client/breadbox_client \
  --path ../breadbox-client/latest-breadbox-api.json \
  --overwrite
 