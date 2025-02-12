#!/bin/bash

compressImgs="etc/compress-images.mjs"

if [ -f $compressImgs ]; then
    echo "Compressing.."
    node $compressImgs
    echo "Compression finished"
else
    echo "$compressImgs not found"
fi