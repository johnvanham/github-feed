#!/usr/bin/env node

// GitHub data population script - CommonJS version
const Database = require('better-sqlite3');
const fs = require('fs');

// GitHub API client
class GitHubAPIClient {
  constructor() {
    this.baseUrl = 'https://api.github.com';
    this.token = process.env.GITHUB_TOKEN;
    if (!this.token) {
      console.warn('No GITHUB_TOKEN found. API rate limits will be lower.');
    }
  }

  async makeRequest(url) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-feed-populator'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    console.log(`Fetching: ${url}`);
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check for rate limiting
    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetTime = response.headers.get('x-ratelimit-reset');
    
    if (remaining && parseInt(remaining) < 10) {
      const reset = resetTime ? new Date(parseInt(resetTime) * 1000) : new Date();
      console.warn(`Rate limit low: ${remaining} requests remaining. Resets at ${reset}`);
    }

    return data;
  }

  async getAllPages(initialUrl, maxPages = 100) {
    let url = initialUrl;
    const allItems = [];
    let pageCount = 0;

    while (url && pageCount < maxPages) {
      const data = await this.makeRequest(url);
      allItems.push(...data);
      pageCount++;

      // Check for next page in Link header
      const headResponse = await fetch(url, {
        method: 'HEAD',
        headers: this.token ? { 'Authorization': `token ${this.token}` } : {}
      });
      const linkHeader = headResponse.headers.get('link');

      const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : '';
      
      if (pageCount >= maxPages) {
        console.warn(`⚠️ Reached max pages limit (${maxPages}). Some data may be missing.`);
      }
    }

    return allItems;
  }

  async getIssueComments(owner, repo, since) {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/comments?since=${since}&per_page=100`;
    return this.getAllPages(url, 30); // Increased limit for comments
  }

  async getRepositoryEvents(owner, repo, since) {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/events?per_page=100`;
    const sinceDate = new Date(since);
    const relevantEvents = [];
    let page = 1;
    const maxPages = 50;

    while (page <= maxPages) {
      const pageUrl = `${url}&page=${page}`;
      const events = await this.makeRequest(pageUrl);
      
      if (!events || events.length === 0) {
        break; // No more events
      }

      let foundOlderEvent = false;
      
      for (const event of events) {
        const eventDate = new Date(event.created_at);
        
        // If we find an event older than our cutoff, stop processing
        if (eventDate < sinceDate) {
          foundOlderEvent = true;
          break;
        }

        // Only process IssuesEvent with relevant actions
        if (event.type === 'IssuesEvent' && 
            ['opened', 'closed', 'reopened'].includes(event.payload.action)) {
          relevantEvents.push({
            id: event.id,
            created_at: event.created_at,
            actor: event.actor,
            event: event.payload.action,
            issue: event.payload.issue
          });
        }
      }

      // If we found an older event, stop pagination
      if (foundOlderEvent) {
        break;
      }

      page++;
    }

    console.log(`Found ${relevantEvents.length} relevant issue events since ${since}`);
    return relevantEvents;
  }

  async getIssue(owner, repo, issueNumber) {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`;
    return this.makeRequest(url);
  }
}

// Database class similar to the TypeScript version
class FeedDatabase {
  constructor() {
    const dbPath = process.env.NODE_ENV === 'production' ? '/data/feed.db' : './feed.db';
    this.db = new Database(dbPath);
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feed_items (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        user_login TEXT NOT NULL,
        user_avatar_url TEXT NOT NULL,
        repo TEXT NOT NULL,
        html_url TEXT NOT NULL,
        issue_url TEXT NOT NULL,
        issue_number INTEGER NOT NULL,
        own_comment BOOLEAN DEFAULT FALSE,
        body TEXT,
        event TEXT,
        issue_title TEXT,
        github_id INTEGER UNIQUE,
        created_at_date TEXT NOT NULL
      )
    `);

    // Index for faster date queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_created_at_date ON feed_items(created_at_date)
    `);

    this.initialized = true;
    console.log('Database initialized');
  }

  addFeedItem(item) {
    this.initialize();
    
    const createdAtDate = new Date(item.created_at).toISOString().split('T')[0];
    
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO feed_items (
          github_id, type, created_at, user_login, user_avatar_url, repo,
          html_url, issue_url, issue_number, own_comment, body, event,
          issue_title, created_at_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        item.id,
        item.type,
        item.created_at,
        item.user.login,
        item.user.avatar_url,
        item.repo,
        item.html_url,
        item.issue_url,
        item.issue_number,
        item.own_comment ? 1 : 0,
        item.body || null,
        item.event || null,
        item.issue_title || null,
        createdAtDate
      ]);
      
      console.log(`Added ${item.type} to database: ${item.type === 'event' ? item.event : 'comment'} on #${item.issue_number}`);
    } catch (error) {
      console.error('Error adding feed item to database:', error);
      throw error;
    }
  }

  getItemCount() {
    this.initialize();
    
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM feed_items`);
      const result = stmt.get();
      return result.count;
    } catch (error) {
      console.error('Error getting item count:', error);
      return 0;
    }
  }

  close() {
    this.db.close();
  }
}

class GitHubDataPopulator {
  constructor() {
    this.client = new GitHubAPIClient();
    this.db = new FeedDatabase();
    this.ownUsername = process.env.GITHUB_OWN_USERNAME || '';
  }

  get14DaysAgo() {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return date.toISOString();
  }

  extractIssueNumber(issueUrl) {
    const match = issueUrl.match(/\/issues\/(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  }

  async populateCommentsForRepo(owner, repo) {
    console.log(`\n=== Fetching issue comments for ${owner}/${repo} ===`);
    const since = this.get14DaysAgo();
    
    try {
      const comments = await this.client.getIssueComments(owner, repo, since);
      console.log(`Found ${comments.length} comments since ${since}`);

      for (const comment of comments) {
        const issueNumber = this.extractIssueNumber(comment.issue_url);
        
        // Get issue details to get the title
        let issueTitle = '';
        try {
          const issue = await this.client.getIssue(owner, repo, issueNumber);
          issueTitle = issue.title;
        } catch (error) {
          console.warn(`Could not fetch issue ${issueNumber} details:`, error.message);
        }

        const feedItem = {
          id: comment.id,
          type: 'comment',
          created_at: comment.created_at,
          user: comment.user,
          repo: `${owner}/${repo}`,
          html_url: comment.html_url,
          issue_url: comment.issue_url,
          issue_number: issueNumber,
          own_comment: comment.user.login === this.ownUsername,
          body: comment.body,
          issue_title: issueTitle
        };

        this.db.addFeedItem(feedItem);
      }
    } catch (error) {
      console.error(`Error fetching comments for ${owner}/${repo}:`, error.message);
    }
  }

  async populateEventsForRepo(owner, repo) {
    console.log(`\n=== Fetching repository events for ${owner}/${repo} ===`);
    const since = this.get14DaysAgo();
    
    try {
      const events = await this.client.getRepositoryEvents(owner, repo, since);

      for (const event of events) {
        // For opened events, include the issue body
        let body = null;
        if (event.event === 'opened' && event.issue.body) {
          body = event.issue.body;
        }

        const feedItem = {
          id: event.id,
          type: 'event',
          created_at: event.created_at,
          user: event.actor,
          repo: `${owner}/${repo}`,
          html_url: event.issue.html_url,
          issue_url: event.issue.url,
          issue_number: event.issue.number,
          event: event.event,
          issue_title: event.issue.title,
          body: body
        };

        this.db.addFeedItem(feedItem);
      }
    } catch (error) {
      console.error(`Error fetching events for ${owner}/${repo}:`, error.message);
    }
  }

  async populateAllRepos() {
    const repositories = process.env.GITHUB_REPOSITORIES;
    if (!repositories) {
      throw new Error('GITHUB_REPOSITORIES environment variable not found');
    }

    const repos = repositories.split(',').map(repo => repo.trim());
    console.log(`Starting population for ${repos.length} repositories...`);
    console.log(`Looking for data from the last 14 days (since ${this.get14DaysAgo()})`);

    for (const repoFullName of repos) {
      const [owner, repo] = repoFullName.split('/');
      if (!owner || !repo) {
        console.error(`Invalid repository format: ${repoFullName}`);
        continue;
      }

      console.log(`\n🔄 Processing ${owner}/${repo}...`);
      
      // Populate comments and events for this repo
      await this.populateCommentsForRepo(owner, repo);
      await this.populateEventsForRepo(owner, repo);
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Show final stats
    const totalCount = this.db.getItemCount();
    console.log(`\n✅ Population complete! Total items in database: ${totalCount}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting GitHub data population...');
  
  try {
    // Load environment variables from .env file
    if (fs.existsSync('.env')) {
      const envFile = fs.readFileSync('.env', 'utf8');
      const lines = envFile.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');
          process.env[key] = value;
        }
      }
      console.log('✅ Loaded .env file');
    } else {
      console.log('⚠️ No .env file found, using system environment variables');
    }

    const populator = new GitHubDataPopulator();
    await populator.populateAllRepos();
    
  } catch (error) {
    console.error('❌ Population failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}