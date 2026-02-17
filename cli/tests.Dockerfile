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

# Run isolated tests first (separate process to avoid mock.module contamination),
# then run the rest sequentially (glob avoids recursing into isolated/)
ENTRYPOINT ["sh", "-c", "bun test /app/cli/src/tests/isolated/ && bun test --max-concurrency 1 /app/cli/src/tests/*.test.ts"]
