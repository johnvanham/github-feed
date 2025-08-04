import Database from "better-sqlite3";

// Types matching our frontend
interface FeedItem {
  id: number;
  type: 'comment' | 'event';
  created_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  repo: string;
  html_url: string;
  issue_url: string;
  issue_number: number;
  own_comment?: boolean;
  body?: string;
  event?: 'opened' | 'closed' | 'reopened';
  issue_title?: string;
}

class FeedDatabase {
  private db: Database;
  private initialized = false;

  constructor() {
    // Create database in data directory
    const dbPath = process.env.NODE_ENV === 'production' ? '/data/feed.db' : './feed.db';
    this.db = new Database(dbPath);
  }

  async initialize(): Promise<void> {
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

  async addFeedItem(item: FeedItem): Promise<void> {
    await this.initialize();
    
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
        item.own_comment || false,
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

  async getFeedItems(date?: string): Promise<FeedItem[]> {
    await this.initialize();
    
    try {
      let query = `SELECT * FROM feed_items`;
      let stmt;

      if (date) {
        query += ` WHERE created_at_date = ?`;
        stmt = this.db.prepare(query + ` ORDER BY created_at DESC`);
        return stmt.all(date).map(this.mapRowToFeedItem);
      } else {
        stmt = this.db.prepare(query + ` ORDER BY created_at DESC`);
        return stmt.all().map(this.mapRowToFeedItem);
      }
    } catch (error) {
      console.error('Error fetching feed items from database:', error);
      throw error;
    }
  }

  private mapRowToFeedItem = (row: any): FeedItem => ({
    id: row.github_id,
    type: row.type,
    created_at: row.created_at,
    user: {
      login: row.user_login,
      avatar_url: row.user_avatar_url
    },
    repo: row.repo,
    html_url: row.html_url,
    issue_url: row.issue_url,
    issue_number: row.issue_number,
    own_comment: Boolean(row.own_comment),
    body: row.body,
    event: row.event,
    issue_title: row.issue_title
  });

  async getItemCount(): Promise<number> {
    await this.initialize();
    
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM feed_items`);
      const result: any = stmt.get();
      return result.count;
    } catch (error) {
      console.error('Error getting item count:', error);
      return 0;
    }
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: FeedDatabase | null = null;

export function getDatabase(): FeedDatabase {
  if (!dbInstance) {
    dbInstance = new FeedDatabase();
  }
  return dbInstance;
}

export type { FeedItem };