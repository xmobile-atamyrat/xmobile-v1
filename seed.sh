#!/bin/bash

yarn db:migrate
docker run -v xmobile-v1_db:/target --name temp_container -d alpine sleep infinity
docker cp dummy_db_data/data.tar.gz temp_container:/target
docker exec temp_container tar -xzf /target/data.tar.gz -C /target
docker exec temp_container rm /target/data.tar.gz
docker stop temp_container && docker rm temp_container