// Edge Runtime compatible JWT implementation
// Uses Web Crypto API instead of Node.js crypto module

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Base64 URL encode
function base64UrlEncode(data: string): string {
  return btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Base64 URL decode
function base64UrlDecode(data: string): string {
  // Add padding if needed
  const padding = '='.repeat((4 - (data.length % 4)) % 4)
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/') + padding
  return atob(base64)
}

// Create HMAC signature using Web Crypto API
async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const signatureArray = new Uint8Array(signature)
  const signatureString = String.fromCharCode(...signatureArray)
  
  return base64UrlEncode(signatureString)
}

// Verify HMAC signature
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  try {
    const expectedSignature = await createSignature(data, secret)
    return expectedSignature === signature
  } catch {
    return false
  }
}

// Sign JWT token
export async function signTokenEdge(payload: JWTPayload): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }
  
  const now = Math.floor(Date.now() / 1000)
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + (7 * 24 * 60 * 60) // 7 days
  }
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload))
  const data = `${encodedHeader}.${encodedPayload}`
  
  const signature = await createSignature(data, JWT_SECRET)
  
  return `${data}.${signature}`
}

// Verify JWT token
export async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    
    const [encodedHeader, encodedPayload, signature] = parts
    const data = `${encodedHeader}.${encodedPayload}`
    
    // Verify signature
    const isValid = await verifySignature(data, signature, JWT_SECRET)
    if (!isValid) {
      return null
    }
    
    // Decode and validate payload
    const payloadJson = base64UrlDecode(encodedPayload)
    const payload = JSON.parse(payloadJson)
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null
    }
    
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    }
  } catch {
    return null
  }
}