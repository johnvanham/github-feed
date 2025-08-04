# GitHub Feed Development Notes

## Project Overview
Real-time GitHub activity feed built with SolidJS and SolidStart that receives webhook events from GitHub repositories.

## Database
- Uses **better-sqlite3** (v12.2.0) instead of sqlite3 for ARM64/Raspberry Pi compatibility
- Synchronous API (no callbacks/promises needed)
- Better cross-platform native module support
- Database location: `/data/feed.db` (production) or `./feed.db` (development)

## Docker Configuration
- **Build Stage**: `node:22-slim` (Debian-based for faster ARM64 builds with native module compilation)
- **Runtime Stage**: `denoland/deno:2.4.3` (Official Deno runtime)
- **Multi-stage build**: Optimized build stage + lightweight runtime stage
- **Architecture Support**: AMD64 and ARM64 (Raspberry Pi optimized)
- **Build Tools**: python3, make, g++, node-gyp for native module compilation

## Commands
```bash
# Development
deno install --allow-scripts
deno run dev

# Build
deno run build

# Docker build (ARM64 optimized)
podman build --platform linux/arm64 -t github-feed:latest .

# Run container
podman run -d --name github-feed -p 3000:3000 -v /data/github-feed:/data github-feed:latest
```

## Key Files
- `src/lib/database.ts` - Database operations using better-sqlite3 synchronous API
- `src/routes/api/webhook.ts` - GitHub webhook handler with HMAC validation
- `Dockerfile` - Multi-stage build: Node.js build stage + Deno runtime stage
- `package.json` - Dependencies including better-sqlite3 v12.2.0
- `.dockerignore` - Comprehensive Docker ignore rules for optimized builds

## Environment Variables
- `GITHUB_WEBHOOK_SECRET` - HMAC secret for webhook validation
- `GITHUB_OWN_USERNAME` - Username for highlighting own comments
- `NODE_ENV` - Environment (production/development)

## Recent Changes (v1.1.0)
1. **Multi-stage Docker build**: Build stage (Node.js + build tools) + Runtime stage (Deno 2.4.3)
2. **better-sqlite3 upgrade**: Updated from v11.3.0 to v12.2.0 for improved ARM64 compatibility
3. **Synchronous database API**: Migrated database operations to use better-sqlite3 synchronous API
4. **Enhanced build process**: Added comprehensive build tools (python3, make, g++, node-gyp)
5. **Docker optimization**: Added .dockerignore file for smaller, faster builds
6. **Development tooling**: Updated Deno install command to include --allow-scripts flag