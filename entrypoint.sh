#!/bin/sh
set -e

rm -f /etc/nginx/sites-enabled/default
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

nginx -g 'daemon off;' &

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
