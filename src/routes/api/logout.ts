import { APIEvent } from "@solidjs/start/server";

export async function POST(event: APIEvent) {
  return new Response(JSON.stringify({ 
    success: true 
  }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Set-Cookie': `github-feed-auth=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` // Clear cookie
    }
  });
}