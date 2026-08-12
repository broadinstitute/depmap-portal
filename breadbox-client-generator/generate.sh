#!/bin/bash

set -ex

uvx --from openapi-python-client==0.21.1 --with "click<8.2.0" openapi-python-client \
  generate \
  --meta=none \
  --output-path ../breadbox-client/breadbox_client \
  --path ../breadbox-client/latest-breadbox-api.json \
  --overwrite
 