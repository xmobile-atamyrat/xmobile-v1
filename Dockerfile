FROM ubuntu:latest

WORKDIR /app

# Install necessary packages
RUN apt-get update && \
    apt-get install -y curl git openssh-client && \
    curl -sL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g yarn

# Copy the SSH private key and set permissions
COPY ssh_keys/xmobile /root/.ssh/id_rsa
RUN chmod 600 /root/.ssh/id_rsa

# Add GitHub to known hosts to prevent verification prompt
RUN ssh-keyscan github.com >> /root/.ssh/known_hosts

# Define build argument for the passphrase
ARG SSH_PASSPHRASE

# Run ssh-agent and add the private key
RUN eval $(ssh-agent -s) && \
    echo "$SSH_PASSPHRASE" | ssh-add /root/.ssh/id_rsa && \
    ssh-keyscan github.com >> /root/.ssh/known_hosts && \
    mkdir -p /app/xmobile-v1 && \
    git clone git@github.com:xmobile-atamyrat/xmobile-v1.git /app/xmobile-v1 && \
    cd /app/xmobile-v1 && \
    yarn install

RUN tar -czvf /app/xmobile-v1.tar.gz /app/xmobile-v1