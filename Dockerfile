FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
CMD ["sleep", "infinity"]
