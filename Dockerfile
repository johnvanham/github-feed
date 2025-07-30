# Multi-stage build for GitHub Feed app
FROM registry.fedoraproject.org/fedora:latest AS build

# Install Node.js and npm
RUN dnf install -y nodejs npm && dnf clean all

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json deno.lock ./

# Install Deno (SolidStart uses Deno)
RUN npm install -g deno@latest

# Copy source code
COPY . .

# Install dependencies
RUN deno install --allow-scripts

# Build the application
RUN deno run build

# Production stage  
FROM registry.fedoraproject.org/fedora:latest AS runtime

# Install Node.js and curl for runtime and health checks
RUN dnf install -y nodejs curl && dnf clean all

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
CMD ["node", ".output/server/index.mjs"]