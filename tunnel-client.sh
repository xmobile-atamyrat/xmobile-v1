#!/bin/bash

source .env

PORT=${NEXT_PUBLIC_PORT:-"3000"}
CMD="ngrok http $PORT"

if [[ -n $BG ]]; then
    CMD="$CMD &"
fi

eval $CMD >> output_ngrok.log 2>&1