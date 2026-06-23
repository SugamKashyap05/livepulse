'use client';

import { useAuthGate } from '@/context/AuthGateContext';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const REASON_COPY: Record<string, { headline: string; detail: string; icon: string }> = {
  chat:      { icon: '💬', headline: 'Sign in to chat with LivePulse AI', detail: 'Ask questions about any article. Get instant context, background, and analysis.' },
  summarize: { icon: '📋', headline: 'Sign in to summarize articles',     detail: 'Get AI-powered TL;DRs for any story in seconds.' },
  sentiment: { icon: '📊', headline: 'Sign in to see sentiment analysis', detail: 'Understand the tone and bias of any article at a glance.' },
  tag:       { icon: '🏷️', headline: 'Sign in to use smart tagging',      detail: 'Auto-tag articles by topic, entity, and category.' },
  digest:    { icon: '📰', headline: 'Sign in for your AI digest',        detail: 'Get a personalized daily briefing built around what matters to you.' },
  general:   { icon: '⚡', headline: 'Sign in to use LivePulse AI',       detail: 'Unlock AI-powered features across the platform.' },
};

export function AuthGateModal() {
  const { isOpen, reason, closeAuthGate } = useAuthGate();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeAuthGate();
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAuthGate(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closeAuthGate]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const copy = REASON_COPY[reason] ?? REASON_COPY.general;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-headline"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close button */}
        <button
          onClick={closeAuthGate}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Icon + headline */}
        <div className="flex flex-col items-center text-center gap-3">
          <span className="text-5xl">{copy.icon}</span>
          <h2
            id="auth-gate-headline"
            className="text-xl font-semibold text-zinc-900 dark:text-white leading-tight"
          >
            {copy.headline}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {copy.detail}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-100 dark:border-zinc-800" />

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => { closeAuthGate(); router.push('/auth/signin'); }}
            className="w-full py-3 px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Sign in
          </button>
          <button
            onClick={() => { closeAuthGate(); router.push('/auth/signup'); }}
            className="w-full py-3 px-4 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Create a free account
          </button>
        </div>

        {/* Fine print */}
        <p className="text-center text-xs text-zinc-400">
          Free accounts include access to AI chat, summaries, and your daily digest.
        </p>
      </div>
    </div>
  );
}
