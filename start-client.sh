#!/bin/bash

source .env

HOST=${NEXT_PUBLIC_HOST:-"localhost"}
npx next dev -p $NEXT_PUBLIC_PORT