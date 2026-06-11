import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import {
  createDepartmentEvent,
  normalizeDepartmentSlug,
} from "@/lib/adminDepartments"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ department: string }> }
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { department: slug } = await params
    const department = normalizeDepartmentSlug(slug)
    if (!department) {
      return NextResponse.json({ error: "Invalid department" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const id = (body as { id?: unknown }).id
    const note = typeof (body as { note?: unknown }).note === "string"
      ? String((body as { note?: unknown }).note).slice(0, 500)
      : ""

    if (typeof id === "string" && id) {
      const event = await prisma.adminDepartmentEvent.update({
        where: { id },
        data: {
          needsEditorReview: true,
          status: "unread",
          metadata: note ? { escalationNote: note } : undefined,
        },
      })
      await prisma.adminNotification.create({
        data: {
          type: "editor_escalation",
          title: `Main Editor review: ${event.title}`,
          body: note || event.body,
          status: "unread",
          jobId: event.jobId,
          department,
          severity: "warning",
          departmentEventId: event.id,
        },
      })
      return NextResponse.json({ success: true, event })
    }

    const title =
      typeof (body as { title?: unknown }).title === "string"
        ? String((body as { title?: unknown }).title).slice(0, 160)
        : "Main Editor review requested"
    const bodyText =
      typeof (body as { body?: unknown }).body === "string"
        ? String((body as { body?: unknown }).body).slice(0, 1000)
        : note || "Department requested Main Editor review."

    const event = await createDepartmentEvent({
      department,
      type: "editor_escalation",
      title,
      body: bodyText,
      severity: "warning",
      needsEditorReview: true,
      sourceType: "manual",
      metadata: note ? { escalationNote: note } : undefined,
      notify: true,
    })

    return NextResponse.json({ success: true, event })
  } catch (error) {
    console.error("[api/admin/ai/departments/events/escalate] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
