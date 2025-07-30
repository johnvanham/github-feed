import { APIEvent } from "@solidjs/start/server";
import { getDatabase, type FeedItem } from "../../lib/database";

// Database instance
const db = getDatabase();

export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const dateParam = url.searchParams.get('date');
    
    // Get events from database (already sorted by created_at DESC)
    const sortedEvents = await db.getFeedItems(dateParam || undefined);
    console.log(`Feed API: Total events available: ${sortedEvents.length}`);

    console.log(`[${new Date().toISOString()}] Feed API: returning ${sortedEvents.length} items${dateParam ? ` for date ${dateParam}` : ''}`);

    return new Response(JSON.stringify(sortedEvents), {
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