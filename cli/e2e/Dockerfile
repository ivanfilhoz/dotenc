FROM oven/bun:1-slim

# Install openssh-client for ssh-keygen
RUN apt-get update && apt-get install -y openssh-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config for layer caching
COPY package.json bun.lockb ./
COPY cli/package.json cli/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source and e2e tests
COPY cli/ cli/

ENTRYPOINT ["bash", "/app/cli/e2e/run-tests.sh"]
