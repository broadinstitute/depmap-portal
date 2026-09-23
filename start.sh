#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

exec mprocs \
  --names "nginx,ssh-tunnel,webpack,flask" \
  "nginx -e stderr -c $PWD/breadbox/nginx.conf" \
  "ssh -L 8008:127.0.0.1:8008 dev.cds.team" \
  'cd portal-backend && poetry run $PWD/flask webpack' \
  'cd portal-backend && poetry run $PWD/flask run'
