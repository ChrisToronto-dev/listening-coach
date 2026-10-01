import { redirect } from 'next/navigation';
import { getCurrentUser, type AuthUser } from '@/lib/auth';

export type ChatGPTUser = AuthUser;

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  return getCurrentUser();
}

export async function requireChatGPTUser(returnTo = '/'): Promise<ChatGPTUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo = '/'): string {
  return `/login?return_to=${encodeURIComponent(returnTo)}`;
}

export function chatGPTSignOutPath(returnTo = '/'): string {
  return `/api/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
}
