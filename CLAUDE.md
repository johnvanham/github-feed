# GitHub Feed Development Notes

## Project Overview
Real-time GitHub activity feed built with SolidJS and SolidStart that receives webhook events from GitHub repositories.

## Runtime & Technology Stack
- **Runtime**: Node.js (v22+)
- **Framework**: SolidJS with SolidStart (ES modules)
- **Build Tool**: vinxi with `node-server` preset
- **Package Manager**: npm

## Database
- Uses **better-sqlite3** (v12.2.0) for optimal ARM64/Raspberry Pi compatibility
- Native Node.js module with synchronous API (no callbacks/promises needed)
- Database location: `/data/feed.db` (production) or `./feed.db` (development)

## Docker Configuration
- **Build Stage**: `node:22-slim` (Debian-based with native module compilation tools)
- **Runtime Stage**: `node:22-slim` (Consistent Node.js runtime)
- **Multi-stage build**: Optimized build stage + lightweight runtime stage
- **Architecture Support**: AMD64 and ARM64 (Raspberry Pi optimized)
- **Build Tools**: python3, make, g++, node-gyp for native module compilation

## Commands
```bash
# Development
npm install
npm run dev

# Build
npm run build

# Production (built app)
node .output/server/index.mjs

# Docker build (ARM64 optimized)
podman build --platform linux/arm64 -t github-feed:latest .

# Run container
podman run -d --name github-feed -p 3000:3000 -v /data/github-feed:/data github-feed:latest

# Data population script
node populate-github-data.cjs
```

## Key Files
- `src/lib/database.ts` - Database operations using better-sqlite3 synchronous API
- `src/routes/api/webhook.ts` - GitHub webhook handler with HMAC validation
- `app.config.ts` - SolidStart configuration with `node-server` preset
- `Dockerfile` - Multi-stage build: build stage + runtime stage
- `package.json` - Dependencies including better-sqlite3 v12.2.0
- `populate-github-data.cjs` - GitHub API data population script
- `.dockerignore` - Comprehensive Docker ignore rules for optimized builds

## Environment Variables
- `GITHUB_TOKEN` - GitHub personal access token for API access
- `GITHUB_WEBHOOK_SECRET` - HMAC secret for webhook validation
- `GITHUB_OWN_USERNAME` - Username for highlighting own comments
- `GITHUB_REPOSITORIES` - Comma-separated list of repositories to monitor
- `GITHUB_ORG_NAME` - Organization name
- `NODE_ENV` - Environment (production/development)
- `AUTH_USERNAME` - Single username for application authentication (v1.6.0+)
- `AUTH_PASSWORD` - Single password for application authentication (v1.6.0+)
- `AUTH_SECRET` - Secret key for JWT-like token signing (v1.6.0+)

## Data Population
The project includes a script to populate the database with historical GitHub data:

```bash
# Populate database with last 14 days of issues/comments from configured repos
node populate-github-data.cjs
```

Features:
- Fetches issue comments and events (open/close/reopen) from last 14 days
- Uses GitHub repository events API (same approach as github-comments app)
- Smart pagination with date-based termination for efficiency
- Rate limiting and error handling with comprehensive logging
- Works with private repositories (requires GITHUB_TOKEN)
- Can run inside Docker containers
- Captures all issue events including opened events

## UI Features (v1.3.0)
### Enhanced User Experience
- **Auto-refresh**: Automatically refreshes feed every 5 minutes
- **Date picker**: Fully clickable date input with compact styling
- **Loading states**: Smart loading indicators that prevent layout shifts
- **Responsive design**: Optimized for desktop and mobile viewing

### Content Rendering
- **Markdown support**: Full markdown rendering using `marked` library
- **Comment truncation**: Shows first 3 paragraphs with expandable "..." indicator
- **Image handling**: Converts images to clickable [IMAGE] links (opens in new tab)
- **Issue pills**: Displays unique issues at bottom of each day for easy navigation
- **Timestamp display**: Shows both UK and India times with proper spacing

### Visual Design
- **GitHub-style theme**: Matches github-comments app styling
- **Syntax highlighting**: Proper code block and inline code styling
- **Interactive elements**: Hover effects on comments and issue pills
- **Typography**: Optimized font sizing and spacing throughout

## Recent Changes (v1.3.0)
1. **Data Collection**: Updated to use repository events API (fixed missing open events)
2. **Time Period**: Changed from 30 days to 14 days for better performance
3. **UI Enhancements**: Added markdown rendering, comment truncation, and issue pills
4. **Auto-refresh**: Implemented 5-minute background refresh cycle
5. **Image Processing**: Convert images to clickable [IMAGE] links
6. **Date Picker**: Improved UX with protected clearing and compact styling
7. **Performance**: Smart loading states prevent height jumping during refreshes
8. **Styling**: Complete visual overhaul to match github-comments design