import { createHmac } from "node:crypto";

// Simple JWT-like token creation (without external dependencies) - SERVER ONLY
export function createToken(username: string): string {
  const payload = {
    username,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
  
  const secret = process.env.AUTH_SECRET || 'default-secret';
  const data = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(data).digest('hex');
  
  return Buffer.from(`${data}.${signature}`).toString('base64');
}

// Verify token - SERVER ONLY
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

// Server-side auth check for API routes
export function checkServerAuth(request: Request): { username: string } | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return verifyToken(token);
}