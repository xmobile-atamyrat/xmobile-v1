#!/bin/bash

CURRENT_DIR=$(dirname "${BASH_SOURCE[0]}")
compressImgs="$CURRENT_DIR/etc/compress-images.mjs"

if [ -f $compressImgs ]; then
    echo "Compressing.."
    node $compressImgs
    echo "Compression finished"
else
    echo "$compressImgs not found"
fi