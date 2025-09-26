
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

const secretKey = process.env.JWT_SECRET || 'your-secret-key-for-development';
const key = new TextEncoder().encode(secretKey);

export interface SessionPayload {
    userId: string;
    isAdmin: boolean;
    username: string | null;
    expires?: Date; // Expires is used on the client-side for cookie management
}

export async function encrypt(payload: Omit<SessionPayload, 'expires'>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (e: any) {
    console.error('JWT Decryption Error:', e?.code || e?.message);
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) return null;
  
  const session = await decrypt(sessionCookie);
  return session;
}

// Accept an optional cookie store for use in Route Handlers
export async function createSession(
    userId: string, 
    isAdmin: boolean, 
    username: string | null,
    cookieStore: ReturnType<typeof cookies> | { set: (name: string, value: string, options: Partial<ResponseCookie>) => void } = cookies()
) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const sessionPayload = { userId, isAdmin, username };
    
    const session = await encrypt(sessionPayload);

    cookieStore.set('session', session, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
}

export async function deleteSession() {
  (await cookies()).set('session', '', { expires: new Date(0) });
}
