import type { ChatIntent } from "./intent-classifier";

interface ConfidenceLog {
  articleId: string | null;
  question: string;
  intent: ChatIntent;
  avgConf: number;
  threshold: number;
  chunkCount: number;
  refused: boolean;
}

export function logChatConfidence(log: ConfidenceLog) {
  // Fire-and-forget structured log for analytics sink
  console.log(JSON.stringify({
    event: "chat_confidence_gate",
    timestamp: new Date().toISOString(),
    ...log
  }))
}
