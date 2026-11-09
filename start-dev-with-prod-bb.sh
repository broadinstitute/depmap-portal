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

nginx_listen_port=8000
nginx_upstream_port=8008

nginx_conf="$(mktemp -t nginx.XXXXXX).conf"
config="$(mktemp -t mprocs.XXXXXX).yaml"
trap 'rm -f "$config" "$nginx_conf"' EXIT

cat > "$nginx_conf" <<EOF
daemon off;
error_log stderr;

events {}

http {
    access_log /dev/stderr;

    server {
        listen $nginx_listen_port;

        # trailing slash on proxy_pass strips the /breadbox/ prefix
        location /breadbox/ {
            proxy_set_header X-Forwarded-User anonymous;
            proxy_pass http://localhost:$nginx_upstream_port/;
        }

        location / {
            proxy_set_header X-Forwarded-User anonymous;
            proxy_pass http://localhost:$nginx_upstream_port;
        }
    }
}
EOF

cat > "$config" <<EOF
procs:
  nginx:
    shell: "nginx -e stderr -c $nginx_conf"
  ssh-tunnel:
    shell: "ssh -L $nginx_upstream_port:127.0.0.1:$nginx_upstream_port dev.cds.team"
  webpack:
    shell: 'cd portal-backend && poetry run \$PWD/flask webpack'
  flask:
    shell: '$web_cmd'
    env:
      # used for dev only
      DEPMAP_SECRET: 'set-secret-when-we-use-sessions-and-start-encrypting-stuff'
EOF

mprocs --config "$config"
