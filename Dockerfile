# Multi-stage build for GitHub Feed app  
FROM node:22-slim AS build

# Install build tools for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    node-gyp \
    && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN npm install -g deno@latest

# Set working directory
WORKDIR /app

# Copy package files and source code
COPY package.json ./
COPY src/ ./src/
COPY app.config.ts ./

# Install dependencies
RUN deno install --allow-scripts

# Build the application
RUN deno run build

# Production stage  
FROM denoland/deno:2.4.3 AS runtime

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /data && chmod 777 /data

# Copy built application from build stage
COPY --from=build /app/.output ./.output

# Copy package.json for reference
COPY --from=build /app/package.json ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/feed || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["deno", "run", "--allow-all", ".output/server/index.mjs"]