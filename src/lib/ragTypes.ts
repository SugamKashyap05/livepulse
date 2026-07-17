export interface SemanticResult {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  sourceQualityScore: number | null;
  publishedAt: Date;
  ingestedAt: Date;
  link: string | null;
  semanticScore: number;
}

export interface BM25Result {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  sourceQualityScore: number | null;
  publishedAt: Date;
  ingestedAt: Date;
  link: string | null;
  bm25Score: number;
}

export interface HybridResult extends Omit<SemanticResult, 'semanticScore'> {
  rrfScore: number;
  semanticScore?: number;
  bm25Score?: number;
}

export interface ChunkConfidence {
  trustScore: number;
  freshnessScore: number;
  sourceQualityScore: number;
  retrievalConsistencyScore: number;
  compositeScore: number;
  passesThreshold: boolean;
}

export interface ScoredChunk extends HybridResult {
  confidence: ChunkConfidence;
}

export interface Citation {
  index: number;
  articleId: string;
  title: string;
  publishedAt: Date;
  sourceQualityScore: number;
  url: string | null;
}

export interface ConstrainedResponse {
  answer: { text: string; citations: Citation[] } | null;
  insufficientEvidence: boolean;
  reason?: string;
  chunks: ScoredChunk[];
  avgConfidence?: number;
}
