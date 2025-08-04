# GitHub Feed - Real-time Webhook App

A real-time GitHub activity feed built with SolidJS and SolidStart that receives webhook events from GitHub repositories to display issues and comments as they happen.

## Features

- **Real-time updates** via GitHub webhooks (no API polling delays)
- **Issue lifecycle tracking** - see when issues are opened, closed, reopened
- **Comment notifications** - get notified of new comments immediately
- **SQLite persistence** - all events stored locally in database (better-sqlite3 v12.2.0 for ARM64 compatibility)
- **Security** - HMAC-SHA256 webhook signature validation
- **User highlighting** - your own comments/issues are visually distinct
- **Date filtering** - view activity for specific days
- **Responsive design** - works on desktop and mobile

## Environment Variables

Create a `.env` file in the project root with:

```bash
GITHUB_WEBHOOK_SECRET='your-webhook-secret-here'
GITHUB_OWN_USERNAME='your-github-username'
```

## Docker Deployment

### Build Image
```bash
# Build for Raspberry Pi (ARM64) - multi-stage Deno build optimized for ARM64
podman build --platform linux/arm64 -t github-feed:latest .

# Build for Intel/AMD (AMD64)
podman build --platform linux/amd64 -t github-feed:latest .

# Multi-platform build
podman build --platform linux/amd64,linux/arm64 -t github-feed:latest .
```

### Run Container
```bash
podman run -d \
  --name github-feed \
  -p 3000:3000 \
  -v /data/github-feed:/data \
  -e GITHUB_WEBHOOK_SECRET='your-webhook-secret-here' \
  -e GITHUB_OWN_USERNAME='your-username' \
  -e NODE_ENV=production \
  github-feed:latest
```

The app will be available at `http://localhost:3000`

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

## Development

```bash
# Install dependencies
deno install --allow-scripts

# Start development server
deno run dev

# Environment variables for development
export GITHUB_WEBHOOK_SECRET='your-secret'
export GITHUB_OWN_USERNAME='your-username'
```

Access at `http://localhost:3000`
