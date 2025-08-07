import { APIEvent } from "@solidjs/start/server";
import { createHmac } from "crypto";

// Simple JWT-like token creation (without external dependencies)
function createToken(username: string): string {
  const payload = {
    username,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
  
  const secret = process.env.AUTH_SECRET || 'default-secret';
  const data = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(data).digest('hex');
  
  return Buffer.from(`${data}.${signature}`).toString('base64');
}

// Verify token
export function verifyToken(token: string): { username: string } | null {
  try {
    const secret = process.env.AUTH_SECRET || 'default-secret';
    const decoded = Buffer.from(token, 'base64').toString();
    const [data, signature] = decoded.split('.');
    
    // Verify signature
    const expectedSignature = createHmac('sha256', secret).update(data).digest('hex');
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(data);
    
    // Check expiration
    if (Date.now() > payload.exp) {
      return null;
    }
    
    return { username: payload.username };
  } catch {
    return null;
  }
}

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