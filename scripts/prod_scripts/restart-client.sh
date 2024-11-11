#!/bin/bash

source .env

logs=$(lsof -i tcp:$NEXT_PUBLIC_PORT)
pid=$(echo "$logs" | grep 'LISTEN' | awk '{print $2}')
kill $pid

nginx_logs=$(lsof -i tcp:4040)
nginx_pid=$(echo "$nginx_logs" | grep 'LISTEN' | awk '{print $2}')
kill $nginx_pid

BG=1 yarn dev
BG=1 yarn tunnel