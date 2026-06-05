import Link from "next/link"
import { redirect } from "next/navigation"
import { auth, isNeonAuthConfigured } from "@/lib/auth"

type SignupPageProps = {
  searchParams?: Promise<{
    error?: string
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

  if (password.length < 8) {
    redirect("/signup?error=password_length")
  }

  const { error } = await auth.signUp.email({
    name,
    email,
    password,
  })

  if (error) {
    redirect("/signup?error=signup_failed")
  }

  redirect("/onboarding")
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = searchParams ? await searchParams : {}
  const errorMessage =
    params.error === "auth_not_configured"
      ? "Neon Auth is not configured yet. Add NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET."
      : params.error === "password_length"
        ? "Password must be at least 8 characters."
        : params.error
          ? "Unable to create that account."
          : null

  return (
    <main style={authShellStyle}>
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

        <form action={signUpAction} style={formCardStyle}>
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
          <Link href="/login" style={{ color: "var(--accent)" }}>
            Sign in →
          </Link>
        </p>
      </div>
    </main>
  )
}

const authShellStyle = {
  minHeight: "100vh",
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
