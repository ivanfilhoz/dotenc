FROM oven/bun:1-slim

# Install openssh-client for ssh-keygen
RUN apt-get update && apt-get install -y openssh-client git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config for layer caching
COPY package.json bun.lockb ./
COPY cli/package.json cli/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source and e2e tests
COPY cli/ cli/

ENTRYPOINT ["bun", "test", "/app/cli/e2e/tests/"]
