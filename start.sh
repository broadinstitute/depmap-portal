#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

web_cmd='cd portal-backend && poetry run $PWD/flask run'

for arg in "$@"; do
  case "$arg" in
    --gunicorn)
      web_cmd='cd portal-backend && poetry run gunicorn -b 127.0.0.1:5000 -w 4 autoapp:app --access-logfile -'
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--gunicorn]" >&2
      exit 1
      ;;
  esac
done

config="$(mktemp -t mprocs.XXXXXX).yaml"
trap 'rm -f "$config"' EXIT

cat > "$config" <<EOF
procs:
  nginx:
    shell: "nginx -e stderr -c $PWD/breadbox/nginx.conf"
  ssh-tunnel:
    shell: "ssh -L 8008:127.0.0.1:8008 dev.cds.team"
  webpack:
    shell: 'cd portal-backend && poetry run \$PWD/flask webpack'
  flask:
    shell: '$web_cmd'
    env:
      # used for dev only
      DEPMAP_SECRET: 'set-secret-when-we-use-sessions-and-start-encrypting-stuff'
EOF

mprocs --config "$config"
