#!/bin/bash

source .env

PORT=${NEXT_PUBLIC_PORT:-"3000"}

ngrok http $PORT