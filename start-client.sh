#!/bin/bash

source .env

HOST=${NEXT_PUBLIC_HOST:-"localhost"}
CMD="npx next dev -p $NEXT_PUBLIC_PORT"

if [[ -n $BG ]]; then
    CMD="$CMD &"
fi

eval $CMD >> output.log 2>&1