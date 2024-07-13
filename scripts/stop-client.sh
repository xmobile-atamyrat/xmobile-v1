#!/bin/bash

source .env

logs=$(lsof -i tcp:$NEXT_PUBLIC_PORT)
pid=$(echo "$logs" | grep 'LISTEN' | awk '{print $2}')

if [[ -z "$pid" ]]; then
    echo "No process found on port $NEXT_PUBLIC_PORT"
else
    echo "Killing process $pid on port $NEXT_PUBLIC_PORT"
    kill $pid
fi

nginx_logs=$(lsof -i tcp:4040)
nginx_pid=$(echo "$nginx_logs" | grep 'LISTEN' | awk '{print $2}')

if [[ -z "$nginx_pid" ]]; then
    echo "No process found on port 4040"
else
    echo "Killing process $nginx_pid on port 4040"
    kill $nginx_pid
fi