CREATE INDEX IF NOT EXISTS "ArticleEmbedding_embedding_hnsw_idx"
ON "ArticleEmbedding"
USING hnsw ("embedding" vector_cosine_ops);
