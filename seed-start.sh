#!/bin/bash

# create volume and copy dummy data
docker create volume xmobile-v1_db
docker run -v xmobile-v1_db:/target --name temp_container -d alpine sleep infinity
docker cp dummy_db_data/data.tar.gz temp_container:/target
docker exec temp_container tar -xzf /target/data.tar.gz -C /target
docker exec temp_container rm /target/data.tar.gz
docker stop temp_container && docker rm temp_container

# start the services
docker-compose up -d
yarn db:migrate
