#!/bin/sh
set -e

echo "Iniciando aplicação..."
exec su-exec nextjs "$@"
