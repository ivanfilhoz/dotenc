FROM oven/bun:1-slim

# Install tools needed by tests (ssh-keygen, git, nano)
RUN apt-get update && apt-get install -y openssh-client git nano && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config for layer caching
COPY package.json bun.lockb ./
COPY cli/package.json cli/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source and tests
COPY cli/ cli/

# Run unit tests only (e2e has a dedicated Docker image/job)
ENTRYPOINT ["bun", "test", "/app/cli/src/tests"]
