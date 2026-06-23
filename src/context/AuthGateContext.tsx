'use client';

import { createContext, useContext, useState, useCallback } from 'react';

type AuthGateReason =
  | 'chat'
  | 'summarize'
  | 'sentiment'
  | 'tag'
  | 'digest'
  | 'general';

interface AuthGateContextValue {
  isOpen: boolean;
  reason: AuthGateReason;
  hasSession: boolean;
  triggerAuthGate: (reason?: AuthGateReason) => void;
  closeAuthGate: () => void;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({ children, hasSession }: { children: React.ReactNode, hasSession: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<AuthGateReason>('general');

  const triggerAuthGate = useCallback((r: AuthGateReason = 'general') => {
    setReason(r);
    setIsOpen(true);
  }, []);

  const closeAuthGate = useCallback(() => setIsOpen(false), []);

  return (
    <AuthGateContext.Provider value={{ isOpen, reason, hasSession, triggerAuthGate, closeAuthGate }}>
      {children}
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error('useAuthGate must be used inside AuthGateProvider');
  return ctx;
}

export function useSession() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error('useSession must be used inside AuthGateProvider');
  return { hasSession: ctx.hasSession };
}
