import Link from "next/link"
import { redirect } from "next/navigation"
import { auth, isNeonAuthConfigured } from "@/lib/auth"
import { safeLocalRedirect } from "@/lib/redirects"

type SignupPageProps = {
  searchParams?: Promise<{
    error?: string
    next?: string
  }>
}

async function signUpAction(formData: FormData) {
  "use server"

  if (!isNeonAuthConfigured()) {
    redirect("/signup?error=auth_not_configured")
  }

  const name = String(formData.get("name") || "")
  const email = String(formData.get("email") || "")
  const password = String(formData.get("password") || "")
  const next = safeLocalRedirect(formData.get("next"), "/")

  if (password.length < 8) {
    redirect(`/signup?error=password_length&next=${encodeURIComponent(next)}`)
  }

  const { error } = await auth.signUp.email({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) {
    const code = getSignupErrorCode(error)
    redirect(`/signup?error=${code}&next=${encodeURIComponent(next)}`)
  }

  redirect(`/onboarding?next=${encodeURIComponent(next)}`)
}

function getSignupErrorCode(error: unknown) {
  const details = getAuthErrorDetails(error)
  console.warn("[LivePulse Auth] Signup failed", details)

  if (details.code === "INVALID_ORIGIN" || details.message.includes("invalid origin")) {
    return "invalid_origin"
  }

  if (
    details.status === 409 ||
    details.code === "USER_ALREADY_EXISTS" ||
    details.message.includes("already") ||
    details.message.includes("exists")
  ) {
    return "email_exists"
  }

  if (
    details.status === 502 ||
    details.code.startsWith("NETWORK_") ||
    details.message.includes("network") ||
    details.message.includes("fetch")
  ) {
    return "auth_unreachable"
  }

  return "signup_failed"
}

function getAuthErrorDetails(error: unknown) {
  const value = error as {
    code?: unknown
    message?: unknown
    status?: unknown
    statusText?: unknown
  }

  return {
    code: typeof value?.code === "string" ? value.code : "",
    message: typeof value?.message === "string" ? value.message.toLowerCase() : "",
    status: typeof value?.status === "number" ? value.status : null,
    statusText: typeof value?.statusText === "string" ? value.statusText : "",
  }
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = searchParams ? await searchParams : {}
  const next = safeLocalRedirect(params.next, "/")
  const errorMessage =
    params.error === "auth_not_configured"
      ? "Neon Auth is not configured yet. Add NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET."
      : params.error === "password_length"
        ? "Password must be at least 8 characters."
        : params.error === "invalid_origin"
          ? "This domain is not allowed in Neon Auth. Add your localhost, ngrok, or Vercel URL to Neon Auth allowed origins."
          : params.error === "email_exists"
            ? "That email is already registered. Sign in instead."
            : params.error === "auth_unreachable"
              ? "Unable to reach Neon Auth right now. Check your network and Neon Auth URL."
              : params.error
                ? "Unable to create that account."
                : null

  return (
    <main className="auth-shell" style={authShellStyle}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" style={wordmarkStyle}>
          LivePulse
        </Link>
        <p style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: 40,
        }}>
          Create Your Account
        </p>

        <form action={signUpAction} className="auth-card" style={formCardStyle}>
          <input name="next" type="hidden" value={next} />
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name</label>
            <input
              name="name"
              type="text"
              autoComplete="name"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password</label>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              style={inputStyle}
            />
          </div>

          {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

          <button type="submit" style={buttonStyle}>
            Create account
          </button>
        </form>
        <p style={{
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 20,
        }}>
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            style={{ color: "var(--accent)" }}
          >
            Sign in →
          </Link>
        </p>
      </div>
    </main>
  )
}

const authShellStyle = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `
    var(--bg)
    radial-gradient(ellipse 80% 50% at 50% 0%,
      rgba(108,143,255,0.05) 0%,
      transparent 60%)
  `,
  padding: "32px 16px",
} as const

const wordmarkStyle = {
  display: "block",
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 900,
  fontStyle: "italic",
  color: "var(--text)",
  textAlign: "center",
  marginBottom: 8,
} as const

const formCardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "32px 28px",
  boxShadow: "var(--shadow-lg)",
} as const

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 6,
} as const

const inputStyle = {
  width: "100%",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: 5,
  color: "var(--text)",
  padding: "10px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  outline: "none",
  transition: "border-color 0.15s",
} as const

const buttonStyle = {
  width: "100%",
  background: "var(--accent)",
  border: "none",
  borderRadius: 5,
  color: "#000",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "1.5px",
  padding: 12,
  marginTop: 8,
  textTransform: "uppercase",
} as const

const errorStyle = {
  marginTop: 12,
  marginBottom: 12,
  padding: "10px 14px",
  background: "rgba(245,101,101,0.06)",
  border: "1px solid rgba(245,101,101,0.2)",
  borderRadius: 4,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--negative)",
} as const
