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
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--overlay)',
        backdropFilter: 'blur(4px)',
        padding: '20px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-headline"
    >
      <div
        ref={dialogRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg)',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Close button */}
        <button
          onClick={closeAuthGate}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'var(--muted)',
            background: 'none',
            border: 'none',
            fontSize: 16,
            cursor: 'pointer',
          }}
          aria-label="Close"
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
        >
          ✕
        </button>

        {/* Icon + headline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <span style={{ fontSize: 40 }}>{copy.icon}</span>
          <h2
            id="auth-gate-headline"
            style={{
              fontSize: 18,
              fontWeight: 500,
              fontFamily: 'var(--font-display)',
              color: 'var(--text)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {copy.headline}
          </h2>
          <p style={{
            fontSize: 13,
            color: 'var(--muted)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {copy.detail}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => { closeAuthGate(); router.push('/login'); }}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Sign in
          </button>
          <button
            onClick={() => { closeAuthGate(); router.push('/signup'); }}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Create a free account
          </button>
        </div>

        {/* Fine print */}
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--muted)',
          margin: '4px 0 0',
        }}>
          Free accounts include access to AI chat, summaries, and your daily digest.
        </p>
      </div>
    </div>
  );
}
