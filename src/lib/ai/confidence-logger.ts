interface ConfidenceLog {
  articleId: string | null;
  question: string;
  intent: "meta" | "factual" | "ambiguous";
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
