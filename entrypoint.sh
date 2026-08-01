#!/bin/sh
set -e

: "${PORT:=8080}"
if [ "$PORT" = "8000" ]; then
  UPORT=8001
else
  UPORT=8000
fi

rm -f /etc/nginx/sites-enabled/default
sed "s|__UPORT__|$UPORT|g" /etc/nginx/conf.d/default.conf.template | envsubst '${PORT}' > /etc/nginx/conf.d/default.conf

nginx -g 'daemon off;' &

exec uvicorn app.main:app --host 0.0.0.0 --port "$UPORT"
