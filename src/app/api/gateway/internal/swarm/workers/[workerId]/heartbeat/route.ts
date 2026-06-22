import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    const resolvedParams = await params;
    const data = await request.json().catch(() => ({}));
    console.log("[Swarm Worker Heartbeat] Worker ID:", resolvedParams.workerId, data);
    
    // Currently, we just accept the request to prevent 404 errors.
    
    return NextResponse.json(
      { success: true, status: "alive" },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[Swarm Worker Heartbeat Error]`, error);
    return NextResponse.json(
      { error: "Failed to process heartbeat" },
      { status: 500 }
    );
  }
}
