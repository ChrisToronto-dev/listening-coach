import { NextResponse } from 'next/server';
import { getAppPassword, createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { password, rememberMe, returnTo } = body as {
      password?: string;
      rememberMe?: boolean;
      returnTo?: string;
    };

    if (!password) {
      return NextResponse.json({ error: '비밀번호를 입력해 주세요.' }, { status: 400 });
    }

    const expectedPassword = getAppPassword();
    if (password.trim() !== expectedPassword.trim()) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    const maxAge = rememberMe ? 30 * 86400 : 7 * 86400;
    const token = await createSessionToken('learner-main', maxAge);

    const isSecure = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      success: true,
      returnTo: returnTo && returnTo.startsWith('/') ? returnTo : '/',
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
