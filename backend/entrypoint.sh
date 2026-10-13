#!/bin/sh
# The data directory is usually a bind mount created by Docker as root; hand it to the
# unprivileged pocketbase user, then drop root before starting.
set -eu
if [ "$(id -u)" = "0" ]; then
  chown pocketbase:pocketbase /pb_data
  exec su-exec pocketbase /bin/sh "$0" "$@"
fi

if [ "${1:-serve}" = "serve" ]; then
  [ "$#" -gt 0 ] && shift
  exec pocketbase serve --http=0.0.0.0:8090 --dir=/pb_data \
    --migrationsDir=/pb_migrations --hooksDir=/pb_hooks "$@"
fi
# Any other command, e.g. `superuser upsert you@example.com <password>`
exec pocketbase --dir=/pb_data --migrationsDir=/pb_migrations --hooksDir=/pb_hooks "$@"
