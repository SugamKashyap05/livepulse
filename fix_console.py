import os

replacements = {
    "src/lib/adminAiJobs.ts": [
        ("console.error(`[admin-ai-job] batch failed for ${article.id}:`, error)",
         'console.error("[admin-ai-job] batch failed for", article.id, ":", error)')
    ],
    "src/components/admin/AiManagerClient.tsx": [
        ("console.error(`[manager job] ${action} failed:`, error)",
         'console.error("[manager job]", action, "failed:", error)')
    ],
    "src/app/api/sync/route.ts": [
        ("console.error(`[LivePulse] Error saving article: ${article.title}`, error)",
         'console.error("[LivePulse] Error saving article:", article.title, error)')
    ],
    "src/app/api/gateway/internal/swarm/workers/[workerId]/heartbeat/route.ts": [
        ("console.log(`[Swarm Worker Heartbeat] Worker ID: ${resolvedParams.workerId}`, data);",
         'console.log("[Swarm Worker Heartbeat] Worker ID:", resolvedParams.workerId, data);')
    ],
    "src/lib/autoSync.ts": [
        ("`[LivePulse AutoSync] Error saving article: ${article.title}`,",
         '"[LivePulse AutoSync] Error saving article:", article.title,'),
        ("console.error(`[LivePulse AutoSync] Sync #${syncCount} failed:`, error)",
         'console.error("[LivePulse AutoSync] Sync #", syncCount, "failed:", error)')
    ],
    "src/components/admin/DepartmentRoomClient.tsx": [
        ("console.error(`[department room] ${action} failed:`, error)",
         'console.error("[department room]", action, "failed:", error)')
    ],
    "src/app/api/ai/batch/route.ts": [
        ("console.error(`Failed to process article ${article.id}:`, err)",
         'console.error("Failed to process article", article.id, ":", err)')
    ],
    "src/app/api/admin/sync/route.ts": [
        ("console.error(`[LivePulse] Error saving article: ${article.title}`, error)",
         'console.error("[LivePulse] Error saving article:", article.title, error)')
    ],
    "src/components/admin/rooms/AssignmentDeskModule.tsx": [
        ("console.error(`[assignment desk ${action}]`, error)",
         'console.error("[assignment desk]", action, error)')
    ],
    "src/components/admin/rooms/DigestRoomModule.tsx": [
        ("console.error(`[digest room ${action}]`, error)",
         'console.error("[digest room]", action, error)')
    ],
    "src/components/admin/rooms/PublishingDeskModule.tsx": [
        ("console.error(`[publishing desk ${action}]`, error)",
         'console.error("[publishing desk]", action, error)')
    ],
    "src/components/admin/rooms/ReportingRoomModule.tsx": [
        ("console.error(`[reporting room ${action}]`, error)",
         'console.error("[reporting room]", action, error)')
    ],
    "src/components/admin/rooms/ResearchLibraryModule.tsx": [
        ("console.error(`[research library ${mode}]`, error)",
         'console.error("[research library]", mode, error)')
    ],
    "src/components/admin/rooms/VerificationRoomModule.tsx": [
        ("console.error(`[verification room ${action}]`, error)",
         'console.error("[verification room]", action, error)')
    ]
}

base_dir = r"e:\2026 final projects\news\livepulse"

for filepath, reps in replacements.items():
    full_path = os.path.join(base_dir, filepath)
    if os.path.exists(full_path):
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        for old, new in reps:
            content = content.replace(old, new)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated", filepath)
    else:
        print("Not found:", full_path)
