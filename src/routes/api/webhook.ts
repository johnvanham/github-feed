import { APIEvent } from "@solidjs/start/server";
import { getDatabase, type FeedItem } from "../../lib/database";
import { createHmac, timingSafeEqual } from "crypto";

// Types for GitHub webhook events
interface GitHubWebhookEvent {
  action?: string;
  issue?: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    html_url: string;
    created_at: string;
    updated_at: string;
    user: {
      login: string;
      avatar_url: string;
    };
  };
  comment?: {
    id: number;
    body: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    user: {
      login: string;
      avatar_url: string;
    };
  };
  repository?: {
    full_name: string;
  };
  sender?: {
    login: string;
    avatar_url: string;
  };
}

// Database instance
const db = getDatabase();

// Validate GitHub webhook signature
function validateGitHubSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  // GitHub sends signature as 'sha256=<signature>'
  const sigHashAlg = 'sha256';
  const sigPrefix = `${sigHashAlg}=`;
  
  if (!signature.startsWith(sigPrefix)) {
    return false;
  }

  const expectedSignature = signature.slice(sigPrefix.length);
  const computedSignature = createHmac(sigHashAlg, secret)
    .update(payload, 'utf8')
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

export async function POST(event: APIEvent) {
  try {
    // Get raw body for signature validation
    const rawBody = await event.request.text();
    const headers = event.request.headers;
    
    // Validate GitHub webhook signature
    const signature = headers.get('x-hub-signature-256');
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const isValid = validateGitHubSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.log('Invalid webhook signature - rejecting request');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else if (webhookSecret) {
      // Secret is configured but no signature provided
      console.log('Webhook secret configured but no signature provided - rejecting request');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      console.log('Warning: No webhook secret configured - accepting unsigned webhook');
    }

    // Parse JSON body
    const body = JSON.parse(rawBody) as GitHubWebhookEvent;
    
    // Get GitHub event type from headers
    const eventType = headers.get('x-github-event');
    const delivery = headers.get('x-github-delivery');
    
    console.log(`[${new Date().toISOString()}] Received GitHub webhook:`, {
      eventType,
      delivery,
      action: body.action,
      repository: body.repository?.full_name
    });

    // Process different event types
    if (eventType === 'issues' && body.issue && body.repository) {
      // Only process specific issue actions, exclude 'edited'
      const allowedActions = ['opened', 'closed', 'reopened'];
      if (!body.action || !allowedActions.includes(body.action)) {
        console.log(`Ignoring issues event with action: ${body.action}`);
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Generate unique ID for event based on issue ID, action, and timestamp
      const timestamp = body.action === 'opened' ? body.issue.created_at : body.issue.updated_at;
      const eventId = parseInt(`${body.issue.id}${body.action === 'opened' ? '1' : body.action === 'closed' ? '2' : '3'}${Math.floor(new Date(timestamp).getTime() / 1000)}`);
      
      const feedItem = {
        id: eventId,
        type: 'event' as const,
        created_at: timestamp,
        user: body.sender || body.issue.user, // Use sender (action performer) if available, fallback to issue user
        repo: body.repository.full_name,
        html_url: body.issue.html_url,
        issue_url: body.issue.html_url,
        issue_number: body.issue.number,
        issue_title: body.issue.title,
        body: body.action === 'opened' ? body.issue.body : undefined,
        event: body.action as 'opened' | 'closed' | 'reopened',
        own_comment: (body.sender || body.issue.user).login === process.env.GITHUB_OWN_USERNAME
      };
      
      // Add to database
      await db.addFeedItem(feedItem);
      const totalCount = await db.getItemCount();
      console.log(`Total events in database: ${totalCount}`);
    }
    
    if (eventType === 'issue_comment' && body.comment && body.issue && body.repository) {
      // Only process comment creation, exclude 'edited' and 'deleted'
      const allowedActions = ['created'];
      if (!body.action || !allowedActions.includes(body.action)) {
        console.log(`Ignoring issue_comment event with action: ${body.action}`);
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const feedItem = {
        id: body.comment.id,
        type: 'comment' as const,
        created_at: body.comment.created_at,
        user: body.comment.user,
        repo: body.repository.full_name,
        html_url: body.comment.html_url,
        issue_url: body.issue.html_url,
        issue_number: body.issue.number,
        issue_title: body.issue.title,
        body: body.comment.body,
        own_comment: body.comment.user.login === process.env.GITHUB_OWN_USERNAME
      };
      
      // Add to database
      await db.addFeedItem(feedItem);
      const totalCount = await db.getItemCount();
      console.log(`Total events in database: ${totalCount}`);
    }

    // Database will handle storage persistence

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

