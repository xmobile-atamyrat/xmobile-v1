cd /home/ubuntu/xmobile-staging
yarn start:staging &> /home/ubuntu/xmobile-staging/logs/next-server.log &
yarn start:ws &> /home/ubuntu/xmobile-staging/logs/websocket-server.log &
