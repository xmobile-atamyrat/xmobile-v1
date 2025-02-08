#!/bin/bash

compressImgs="etc/compress-images.js"
rootDir=$(pwd)
if [[ $rootDir == *"/home/ubuntu"* ]]; then
    # change directory, bcoz there is no /etc folder in server
    compressImgs="./compress-images.js"
fi

if [ -f $compressImgs ]; then
    echo "Compressing.."
    node $compressImgs
    echo "Compression finished"
else
    echo "$compressImgs not found"
fi