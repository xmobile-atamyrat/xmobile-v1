FROM --platform=linux/amd64 ubuntu:latest

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