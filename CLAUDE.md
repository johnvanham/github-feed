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
podman build --platform linux/arm64 -t github-feed:v1.8.0 .

# Tag for GitHub Container Registry
podman tag github-feed:v1.8.0 ghcr.io/johnvanham/github-feed:v1.8.0
podman tag github-feed:v1.8.0 ghcr.io/johnvanham/github-feed:latest

# Push to GitHub Container Registry
podman push ghcr.io/johnvanham/github-feed:v1.8.0
podman push ghcr.io/johnvanham/github-feed:latest

# Run container
podman run -d --name github-feed -p 3000:3000 -v /data/github-feed:/data ghcr.io/johnvanham/github-feed:latest

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

## Authentication (v1.6.0+)
### Built-in Authentication System
The app includes a secure, application-level authentication system that replaces external basic auth:

**Features:**
- GitHub-themed login page with clean mobile-friendly design
- JWT-like token-based authentication with 7-day expiration
- Secure server-side token verification using HMAC signatures
- Protected API endpoints (webhook endpoint remains public for GitHub)
- Automatic redirect to login when unauthenticated or token expired
- Session management with localStorage
- Logout functionality with header button

**Required Environment Variables:**
- `AUTH_USERNAME` - Single username for application access
- `AUTH_PASSWORD` - Single password for application access  
- `AUTH_SECRET` - Secret key for token signing (see generation below)

**Generating AUTH_SECRET:**
```bash
# Generate a secure random secret (recommended)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use openssl
openssl rand -hex 32

# Example output: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Security Notes:**
- Tokens are signed with HMAC-SHA256 for integrity verification
- All authentication logic is server-side only (crypto operations not exposed to client)
- Login credentials and secret should be kept secure
- Replace basic auth in reverse proxy (Caddy/nginx) as it's no longer needed
- Webhook endpoint (`/api/webhook`) remains unprotected for GitHub access

## Technology Stack (v1.6.0)
### Frontend & Styling
- **Framework**: SolidJS with SolidStart (file-based routing)
- **Styling**: SCSS with nested syntax and GitHub theme colors
- **Build**: Vite with SASS compilation
- **Notifications**: Browser Notification API with desktop integration

### Backend & Security  
- **Runtime**: Node.js (v22+) with ES modules
- **Authentication**: Custom JWT-like tokens with HMAC-SHA256 signatures
- **Database**: better-sqlite3 (v12.2.0) with synchronous API
- **API**: RESTful endpoints with authentication middleware

### Development & Deployment
- **Build Tool**: vinxi with `node-server` preset
- **Package Manager**: npm
- **Container**: Multi-stage Docker build (Node.js build + runtime)
- **Architecture**: AMD64 and ARM64 support (Raspberry Pi optimized)
- **Registry**: GitHub Container Registry at `ghcr.io/johnvanham/github-feed`

## Version Management
**IMPORTANT**: When building/deploying new versions, ensure package.json version matches Docker tag:
- Update `package.json` version field (e.g., "1.8.0")
- Build Docker image with matching tag (e.g., `github-feed:v1.8.0`)
- App version footer dynamically reads from package.json at runtime
- This prevents version display mismatches in the UI

## Container Registry Deployment
**GitHub Container Registry Details:**
- **Registry URL**: `ghcr.io/johnvanham/github-feed`
- **Username**: `johnvanham`
- **Authentication**: Must be logged in via `podman login ghcr.io`

**Complete Deployment Process:**
```bash
# 1. Build with version tag
podman build --platform linux/arm64 -t github-feed:v1.8.0 .

# 2. Tag for registry (use correct username!)
podman tag github-feed:v1.8.0 ghcr.io/johnvanham/github-feed:v1.8.0
podman tag github-feed:v1.8.0 ghcr.io/johnvanham/github-feed:latest

# 3. Push to GitHub Container Registry
podman push ghcr.io/johnvanham/github-feed:v1.8.0
podman push ghcr.io/johnvanham/github-feed:latest
```

## Recent Changes (v1.8.0)
1. **Motion.dev Animations**: Replaced CSS animations with solid-motionone library for notification-style animations
2. **Enhanced New Item Animations**: New items now slide in with smooth scale and opacity transitions
3. **Layout Animations**: Added automatic layout animations when items are added/removed
4. **Avatar Highlighting**: New items get subtle avatar scaling and background highlighting
5. **Notification-Style Effects**: Animations mimic modern notification list patterns
6. **Performance Optimized**: Uses solid-motionone for hardware-accelerated animations

## Previous Changes (v1.7.5)
1. **Dynamic Version Loading**: App version now reads from package.json at runtime
2. **Refresh Status Footer**: Live countdown timer and last refresh timestamp
3. **Improved Animations**: Dramatic slide-down expansion for new items (Firefox compatible)
4. **Avatar Caching**: Prevents avatar reloads on refresh with per-user cache
5. **Favicon Optimization**: Fixed duplicate loading issues
6. **Short Repo Names**: Display repo names without org prefix for configured organization
7. **Enhanced Notifications**: Better formatting with separated issue info and quoted text

## Previous Changes (v1.6.0)
1. **Authentication System**: Added application-level authentication with JWT-like tokens
2. **SCSS Support**: Converted styling from CSS to SCSS with nested organization
3. **Mobile Compatibility**: Replaced unreliable basic auth with proper login system
4. **Security**: Server-side crypto operations with HMAC token signing
5. **Login UX**: GitHub-themed login page with error handling and auto-redirect
6. **Session Management**: Token-based sessions with localStorage persistence
7. **API Protection**: Protected feed endpoints while keeping webhook public
8. **Build Improvements**: Fixed client/server build compatibility with crypto separation

## Previous Changes (v1.5.0)
1. **Browser Notifications**: Desktop notifications for new GitHub activity with custom emojis
2. **Smart Detection**: Tracks seen items to notify only on truly new entries  
3. **Color-Matched Icons**: Notification emojis match UI state colors (🟢 open, 🟣 closed, 🔄 reopened)
4. **Clickable Notifications**: Click to open GitHub URLs in new tab
5. **Anti-Spam**: Only notifies for current day items (no spam when browsing history)