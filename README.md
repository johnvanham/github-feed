# GitHub Feed

Real-time GitHub activity feed built with SolidJS and SolidStart. Monitor issue comments and events across multiple repositories with webhook integration and historical data population.

## Features

- 📡 **Real-time webhooks** - Receive GitHub events as they happen
- 💬 **Issue comments** - Track all comments across your repositories
- 📝 **Issue events** - Monitor when issues are opened, closed, or reopened
- 🔍 **Multi-repository** - Monitor multiple repositories from a single feed
- 🐳 **Docker ready** - Optimized for container deployment on Raspberry Pi
- 📊 **Historical data** - Populate database with last 30 days of activity
- 🔐 **Private repos** - Works with private repositories using GitHub tokens
- 🔒 **Authentication** - Built-in JWT-like authentication with configurable credentials
- ⚡ **Node.js runtime** - Fast and reliable server-side execution
- 🗄️ **SQLite database** - better-sqlite3 v12.2.0 optimized for ARM64

## Quick Start

### Prerequisites

- Node.js v22+
- GitHub personal access token (for private repos and data population)

### Development

```bash
# Clone and install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your GitHub configuration

# Start development server
npm run dev
```

### Production Deployment

```bash
# Build the application
npm run build

# Run production server
node .output/server/index.mjs
```

### Data Population

Populate your database with historical GitHub activity:

```bash
# Fetch last 30 days of issues and comments
node populate-github-data.cjs
```

## Configuration

Create a `.env` file with your GitHub configuration:

```env
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_OWN_USERNAME=your_github_username
GITHUB_REPOSITORIES=owner/repo1,owner/repo2,owner/repo3
GITHUB_ORG_NAME=your_organization
AUTH_USERNAME=admin
AUTH_PASSWORD=your_secure_password
AUTH_SECRET=your_generated_secret_key
NODE_ENV=production
```

## Docker Deployment

### Build Container

```bash
# Build container with Node.js runtime
podman build -t github-feed:latest .

# Build for Raspberry Pi (ARM64)
podman build --platform linux/arm64 -t github-feed:latest .
```

### Run Container

```bash
podman run -d \
  --name github-feed \
  -p 3000:3000 \
  -v /data/github-feed:/data \
  --env-file .env \
  github-feed:latest
```

The app will be available at `http://localhost:3000`

## Architecture

- **Frontend**: SolidJS with reactive UI
- **Backend**: SolidStart with API routes  
- **Database**: SQLite with better-sqlite3 (ARM64 optimized)
- **Runtime**: Node.js v22+
- **Container**: Multi-stage Docker build optimized for Raspberry Pi

## API Endpoints

- `GET /api/feed` - Get all feed items
- `GET /api/feed?date=YYYY-MM-DD` - Get feed items for specific date
- `POST /api/webhook` - GitHub webhook endpoint (with HMAC validation)

## Authentication Setup

The application includes built-in authentication to replace unreliable browser basic auth, especially useful for mobile access.

### Generate Authentication Secret

Create a secure random secret for token signing:

**Using Node.js crypto:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Using OpenSSL:**
```bash
openssl rand -hex 32
```

**Using Python:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Environment Variables

Add these authentication variables to your `.env` file:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=your_secure_password  
AUTH_SECRET=your_generated_secret_key
```

### Docker Deployment with Authentication

```bash
podman run -d \
  --name github-feed \
  -p 3000:3000 \
  -v /data/github-feed:/data \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your_secure_password \
  -e AUTH_SECRET=your_generated_secret_key \
  --env-file .env \
  github-feed:latest
```

### How Authentication Works

- **JWT-like tokens**: Uses HMAC-SHA256 signed tokens with 7-day expiration
- **Session management**: Tokens stored in browser localStorage
- **API protection**: All feed endpoints require valid authentication
- **Webhook access**: GitHub webhook endpoint remains public for external access
- **Mobile friendly**: Persistent login without constant re-authentication prompts

Access the app at `http://localhost:3000` - you'll be redirected to `/login` if not authenticated.

## Setting Up GitHub Webhooks

### 1. Generate Webhook Secret

Generate a secure random secret for webhook validation:

```bash
openssl rand -hex 32
```

Save this secret - you'll need it for both the environment variable and GitHub webhook configuration.

### 2. Set Up Public URL

For webhooks to work, GitHub needs to reach your server. Options:

**Production**: Use your server's public IP/domain
**Development/Testing**: Use ngrok to create a tunnel

```bash
# Using ngrok for testing
podman run --net=host -d \
  -e NGROK_AUTHTOKEN=your-ngrok-token \
  ngrok/ngrok:latest http 7585

# Get the public URL
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url'
```

### 3. Register Webhooks for Your Repositories

For each repository you want to track, register a webhook:

#### Method 1: Using GitHub CLI (Recommended)

```bash
# Authenticate with GitHub CLI
gh auth login

# For each repository, create a webhook (replace with your repository)
gh api repos/your-org/your-repo/hooks -X POST --input - <<< '{
  "name": "web",
  "config": {
    "url": "https://your-domain.com/api/webhook",
    "content_type": "json",
    "secret": "your-webhook-secret-here"
  },
  "events": ["issues", "issue_comment"],
  "active": true
}'
```

#### Method 2: Using GitHub Web Interface

1. Go to each repository's Settings → Webhooks
2. Click "Add webhook"
3. Fill in:
   - **Payload URL**: `https://your-domain.com/api/webhook`
   - **Content type**: `application/json`
   - **Secret**: Your generated webhook secret
   - **Events**: Select "Issues" and "Issue comments"
   - **Active**: ✅ Checked
4. Click "Add webhook"

Repeat for each repository you want to track.

### 4. Test Webhook Setup

1. Create a test issue in one of your repositories
2. Check your GitHub feed app - the issue should appear immediately
3. Add a comment to the issue - it should appear in the feed
4. Check the container logs for webhook events:

```bash
podman logs github-feed
```

You should see log entries like:
```
[2025-07-30T10:18:25.644Z] Received GitHub webhook: {
  eventType: "issues",
  delivery: "12345678-1234-1234-1234-123456789abc",
  action: "opened",
  repository: "your-org/your-repo-1"
}
Added event to database: opened on #123
Total events in database: 1
```

### 5. Verify Security

The app validates webhook signatures using HMAC-SHA256. Invalid requests are rejected with 401 status. Check logs for security validation:

```bash
# Valid webhook
✅ [timestamp] Received GitHub webhook: { eventType: "issues", ... }

# Invalid signature
❌ Invalid webhook signature - rejecting request

# Missing signature
❌ Webhook secret configured but no signature provided - rejecting request
```

## Troubleshooting

### Webhooks Not Receiving Events
1. Check webhook URL is publicly accessible
2. Verify webhook secret matches environment variable
3. Ensure events are configured correctly (issues, issue_comment)
4. Check GitHub webhook delivery logs in repository settings

### Own Comments Not Highlighted
1. Verify `GITHUB_OWN_USERNAME` environment variable is set correctly
2. Check it matches your GitHub username exactly (case-sensitive)
3. Restart container after changing environment variables

### Database Issues
1. Ensure `/data` volume is mounted and writable
2. Check container logs for SQLite errors
3. Database file location: `/data/feed.db` (production) or `./feed.db` (development)
4. **ARM64/Raspberry Pi**: Uses better-sqlite3 v12.2.0 for native module compatibility

### Performance
- SQLite database automatically handles persistence
- Events are indexed by date for fast filtering
- Container uses minimal resources (~50MB RAM)

## API Endpoints

- `GET /api/feed?date=YYYY-MM-DD` - Get feed items for specific date
- `POST /api/webhook` - GitHub webhook endpoint (internal use)

## Security Features

- ✅ HMAC-SHA256 webhook signature validation
- ✅ Timing-safe signature comparison
- ✅ Request origin validation
- ✅ No exposed secrets in logs
- ✅ SQLite injection protection via parameterized queries

## Development Notes

See [CLAUDE.md](./CLAUDE.md) for detailed development notes, configuration details, and recent changes.

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start development server
npm run dev
```

### Technical Details

Built with modern web technologies for optimal performance and reliability on various platforms including Raspberry Pi deployments.
