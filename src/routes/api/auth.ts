import { APIEvent } from "@solidjs/start/server";
import { createToken } from "../../lib/auth.server";

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const { username, password } = body;

    // Get credentials from environment
    const expectedUsername = process.env.AUTH_USERNAME;
    const expectedPassword = process.env.AUTH_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return new Response(JSON.stringify({ 
        error: 'Authentication not configured' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify credentials
    if (username === expectedUsername && password === expectedPassword) {
      const token = createToken(username);
      
      return new Response(JSON.stringify({ 
        success: true, 
        token 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        error: 'Invalid credentials' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}