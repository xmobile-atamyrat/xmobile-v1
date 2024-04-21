# Xmobile

## How to setup

- Install `yarn`
- Install `turbo` [link](https://turbo.build/repo/docs/installing)
- Install packages with `yarn` command
- Install docker desktop app and start it
- Run the following commands to start database, server, and client:

  ```bash
  # migrate db schema
  cd apps/api
  yarn db:generate
  yarn db:migrate

  # for mac and linux
  chmod +x start.sh && ./start.sh

  #for windows
  docker-compose up -d # to start the db server, docker app has to be open
  turbo dev
  ```

## Features

- left side menu with categories and products
- top menu
- search functionality
- login for admin users
- saved products for users (cart)
- language feature (tm, ru, en)
- voting system for a product
- new products category
  - ask to add to this category when a new product is added to any other category
  - automatically remove every 1 month (configurable)
- photo/video advertisement adding feature
- sample UI designs:
  - [akyol.comt.tm](https://akyol.com.tm/index.php?route=product/category&path=72_214)
  - [mobile.com.tm](https://mobile.com.tm/products?category=2)
  - [gerekli.tm](https://gerekli.tm)
