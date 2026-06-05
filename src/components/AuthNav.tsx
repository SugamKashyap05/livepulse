import Link from "next/link"
import { redirect } from "next/navigation"
import { auth, getCurrentUser, isNeonAuthConfigured } from "@/lib/auth"

async function signOutAction() {
  "use server"

  await auth.signOut()
  redirect("/")
}

const navLinkStyle = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  letterSpacing: "1px",
  color: "var(--muted)",
  textTransform: "uppercase",
  textDecoration: "none",
} as const

export default async function AuthNav() {
  if (!isNeonAuthConfigured()) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/login" style={navLinkStyle}>
          Sign in
        </Link>
        <Link href="/signup" style={{ ...navLinkStyle, color: "var(--accent)" }}>
          Sign up
        </Link>
      </div>
    )
  }

  const user = await getCurrentUser()
  const userLabel = user?.name || user?.email

  if (!userLabel) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/login" style={navLinkStyle}>
          Sign in
        </Link>
        <Link href="/signup" style={{ ...navLinkStyle, color: "var(--accent)" }}>
          Sign up
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href="/profile" style={{ ...navLinkStyle, color: "var(--accent)" }}>
        {userLabel}
      </Link>
      <form action={signOutAction}>
        <button
          type="submit"
          style={{
            ...navLinkStyle,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  )
}
