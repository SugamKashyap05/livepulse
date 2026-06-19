import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json().catch(() => ({}));
    console.log("[Swarm Worker Registration]", data);
    
    // TODO: Implement actual worker registration logic (e.g., save to DB or memory)
    // Currently, we just accept the request to prevent 404 errors.
    
    return NextResponse.json(
      { success: true, message: "Worker registered successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Swarm Worker Registration Error]", error);
    return NextResponse.json(
      { error: "Failed to register worker" },
      { status: 500 }
    );
  }
}
