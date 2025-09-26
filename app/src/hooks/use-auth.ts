
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserSession, type UserSession } from '@/lib/db';

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [highlightColor, setHighlightColor] = useState('highlight-yellow');
  const [highlightStyle, setHighlightStyle] = useState<'background' | 'underline'>('background');
  const router = useRouter();

  const fetchSession = useCallback(async () => {
    const sessionData = await getUserSession();
    setSession(sessionData);
    if (sessionData) {
        setHighlightColor(sessionData.highlightColor || 'highlight-yellow');
        setHighlightStyle(sessionData.highlightStyle || 'background');
    }
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    session,
    fetchSession,
    handleLogout,
    highlightColor,
    highlightStyle,
  };
}
