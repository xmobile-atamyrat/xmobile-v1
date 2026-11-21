cd /home/ubuntu/xmobile-staging
# Pages fetch from staging's own https address, whose certificate is self-signed.
NODE_EXTRA_CA_CERTS=/home/ubuntu/certificates/2026-certs/dev.xmobile.com.tm.crt yarn start:staging &> /home/ubuntu/xmobile-staging/logs/next-server.log &
yarn start:ws &> /home/ubuntu/xmobile-staging/logs/websocket-server.log &
