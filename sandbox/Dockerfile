# Sandbox test: simulates a fresh Linux user installing claw-insights
FROM node:22-slim

# Install test utilities
RUN apt-get update && apt-get install -y curl python3 && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash testuser
USER testuser
WORKDIR /home/testuser

# Set up npm global prefix for non-root user
ENV NPM_CONFIG_PREFIX=/home/testuser/.npm-global
ENV PATH=/home/testuser/.npm-global/bin:$PATH

# Copy the release tarball
COPY --chown=testuser dist/claw-insights-*.tgz ./

# Install globally (simulates real user install)
RUN npm install -g ./claw-insights-*.tgz

# Copy mock CLI + fixtures
COPY --chown=testuser sandbox/mock-openclaw/ .mock-openclaw/
RUN chmod +x .mock-openclaw/bin/openclaw

# Copy verify script
COPY --chown=testuser sandbox/sandbox-verify.sh ./

# Default: run verification with healthy scenario
ENV CLAW_INSIGHTS_CLI=/home/testuser/.mock-openclaw/bin/openclaw
ENV MOCK_SCENARIO=healthy
CMD ["bash", "sandbox-verify.sh"]
