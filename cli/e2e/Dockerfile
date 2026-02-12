FROM node:20-slim

# Install openssh-client for ssh-keygen
RUN apt-get update && apt-get install -y openssh-client && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy workspace config for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY cli/package.json cli/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Add tsx to PATH
ENV PATH="/app/cli/node_modules/.bin:$PATH"

# Copy source and e2e tests
COPY cli/ cli/

ENTRYPOINT ["bash", "/app/cli/e2e/run-tests.sh"]
