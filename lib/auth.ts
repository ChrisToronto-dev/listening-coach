import { cookies, headers } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  DEFAULT_USER_ID,
  verifySessionToken,
  createSessionToken,
  getAppPassword,
  getAppSecret,
  type SessionPayload,
} from './auth-token';

export {
  SESSION_COOKIE_NAME,
  DEFAULT_USER_ID,
  verifySessionToken,
  createSessionToken,
  getAppPassword,
  getAppSecret,
  type SessionPayload,
};

export type AuthUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  // 1. Check Session Cookie
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const session = await verifySessionToken(sessionCookie);
      if (session) {
        return {
          userId: session.userId,
          displayName: session.name,
          email: session.email,
          fullName: session.name,
        };
      }
    }
  } catch {
    // In contexts where cookies() is unavailable
  }

  // 2. Check OpenAI ChatGPT Headers (for backward compatibility)
  try {
    const requestHeaders = await headers();
    const oaiUserId = requestHeaders.get('oai-authenticated-user-id');
    const oaiEmail = requestHeaders.get('oai-authenticated-user-email');
    if (oaiUserId && oaiEmail) {
      const fullName = requestHeaders.get('oai-authenticated-user-full-name');
      return {
        userId: oaiUserId,
        displayName: fullName ? decodeURIComponent(fullName) : oaiEmail,
        email: oaiEmail,
        fullName: fullName ? decodeURIComponent(fullName) : null,
      };
    }
  } catch {
    // In contexts where headers() is unavailable
  }

  // 3. In non-production local development without password set, allow default user
  if (process.env.NODE_ENV !== 'production' && !process.env.APP_PASSWORD) {
    return {
      userId: DEFAULT_USER_ID,
      displayName: 'Learner',
      email: 'me@listening-coach.local',
      fullName: 'Learner',
    };
  }

  return null;
}
