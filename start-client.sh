#!/bin/bash

source .env

HOST=${HOST_PUBLIC_HOST:-"localhost"}
npx next dev