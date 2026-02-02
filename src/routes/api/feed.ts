import { APIEvent } from "@solidjs/start/server";
import { getDatabase, type FeedItem } from "../../lib/database";
import { checkServerAuth } from "../../lib/auth.server";

// Database instance
const db = getDatabase();

export async function GET(event: APIEvent) {
  try {
    // Check authentication
    const auth = checkServerAuth(event.request);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(event.request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Get events from database (already sorted by created_at DESC)
    const sortedEvents = await db.getFeedItems(startDate || undefined, endDate || undefined);
    console.log(`Feed API: Total events available: ${sortedEvents.length}`);

    const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : 'all dates';
    console.log(`[${new Date().toISOString()}] Feed API: returning ${sortedEvents.length} items for ${dateRange} for user ${auth.username}`);

    return new Response(JSON.stringify({
      items: sortedEvents
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in feed API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}