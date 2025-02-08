#!/bin/bash

compressImgs="etc/compress-image.js"

if [ -f $compressImgs ]; then
    echo Compressing..
    node $compressImgs
    echo Compression Finished!
else
    echo $compressImgs not found!
fi