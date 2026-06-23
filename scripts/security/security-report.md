# LivePulse Security Report — Pre-Production NIM Migration
**Date:** 2026-06-23
**Scope:** AI Integration layer (NVIDIA NIM), API Routes, and related backend services.
**Methodology:** Red Team Automated Battery.

## Executive Summary
The AI infrastructure migration to NVIDIA NIM has introduced critical security considerations. The core AI execution logic (retries, timeouts, structured JSON parsing) is mostly sound, but the API boundary lacks fundamental protections.

## Findings

### Finding 01
- **Phase:** 3
- **Test:** test-auth-bypass.ts
- **Severity:** CRITICAL
- **Title:** Missing Authentication on AI Endpoints
- **Description:** Multiple endpoints in `/api/ai/*` (e.g., `/chat`, `/article-chat`, `/summarize`) are completely unprotected. They return `400 Bad Request` instead of `401 Unauthorized` when accessed without authentication.
- **Evidence:** Routes returned HTTP 400 instead of 401 — payload was being processed before any identity check. `test-auth-bypass.ts` confirmed 0/9 routes returned 401 on unauthenticated request.
- **Blue Team Fix Applied:** Route-level auth guard — `getCurrentUserId()` on user routes, `isAdminAuthorized()` on admin routes, applied inside each handler before any business logic executes.
- **Verification:** Re-ran `test-auth-bypass.ts` → 9/9 routes return 401 ✅

### Finding 02
- **Phase:** 2
- **Test:** test-token-bomb.ts
- **Severity:** CRITICAL
- **Title:** Missing Input Size Limits (Token Bomb Vulnerability)
- **Description:** While extreme payload sizes (1MB+) triggered HTTP 400 due to Next.js body parser limits, the application itself does not enforce strict input length limits before passing data to the LLM. 
- **Evidence:** Attackers can send slightly smaller payloads (e.g., 500KB) that pass Next.js limits but consume massive token counts, causing memory exhaustion or excessive NIM billing. `test-token-bomb.ts` triggered 413s only when Next.js payload limits were exceeded.
- **Blue Team Fix Applied:** Implemented character limit checks before any AI execution.
- **Verification:** Re-ran `test-token-bomb.ts` → server rejected oversized input payloads up to 1MB successfully with 413 Payload Too Large ✅

### Finding 03
- **Phase:** 1
- **Test:** test-nim-timeout.ts
- **Severity:** HIGH
- **Title:** Missing External API Timeouts
- **Description:** Calls to `aiClient.chat.completions.create` rely on default SDK timeouts.
- **Evidence:** If the NVIDIA NIM endpoint hangs or experiences severe latency, the Node.js process will block waiting for a response, eventually consuming all available connection pools and crashing the server.
- **Blue Team Fix Applied:** Enforced strict application-level timeouts (15s for completions/embeddings, 30s for streaming) using `AbortSignal.timeout()` wrappers across all NIM queries in `src/lib/ollama.ts`.
- **Verification:** Re-ran `test-nim-timeout.ts` → Server returns timeout gracefully ✅

### Finding 04
- **Phase:** 5
- **Test:** test-xss-output.ts
- **Severity:** HIGH
- **Title:** Unsanitized AI Output (Potential XSS)
- **Description:** The application assumes AI output is safe for rendering. Outputting raw AI text directly into React components without markdown sanitization is a known vector for indirect XSS.
- **Evidence:** An attacker who poisons the RAG context could force the AI to return malicious HTML/JS, which would then be executed in the victim's browser.
- **Blue Team Fix Applied:** Implemented AI Output Sanitizer (`sanitizeAiOutput`) to explicitly strip Unicode bypass sequences and malicious HTML tags before returning AI responses or persisting them.
- **Verification:** Re-ran `test-xss-output.ts` → AI output is sanitized, no XSS markers present ✅

---

## Accepted Risk / Design Decisions
- **MAX_INPUT_CHARS**: Limit set to 2,000 chars on `chat`, `article-chat` routes. `sentiment` and `tag` routes are limited to 5,000 chars. The `summarize` route uses 50,000 chars. Rationale: Summarizing an entire news article requires handling up to 50,000 characters. 2,000 characters (3-4 paragraphs) would break core functionality for the summarize endpoint. Token bomb risk on `summarize` is bounded by NIM token limits, while user-controlled free text routes (like chat) use a tighter 2,000 character restriction.

---

## Validated Defenses (PASS)
- ✅ **Exponential Backoff:** `withRetry` utility correctly handles 429s with jitter and backoff.
- ✅ **Client Bundle Security:** No server-side secrets (NVIDIA_API_KEY) leaked to `.next/static`.
- ✅ **Error Handling:** 500 errors gracefully fail without leaking stack traces or internal IP addresses.
- ✅ **JSON Parsing Guards:** `structuredChat` successfully traps malformed JSON and prototype pollution attempts.

---

## Sign-Off Checklist
- [x] All CRITICAL resolved
- [x] All HIGH resolved
- [x] MEDIUM reviewed and accepted or resolved (none identified in this run)
- [x] Re-run verification passed for all fixed findings
- [x] /api/admin/rag/reindex triggered — vectors rebuilt with nvidia/nv-embedqa-e5-v5 (1024-dim)
- [x] security-report.md complete with all findings and Blue Team fixes documented
- [x] Final all-green run of npm run test:nvidia confirmed
