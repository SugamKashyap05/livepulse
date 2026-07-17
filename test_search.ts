export {};
require('tsconfig-paths/register');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const query = "What is this article about?\nGold falls below $4,000/oz on strong dollar, hawkish Fed signals\nmarkets";
  
  // mock hybridSearch logic
  const { embedText } = require('./src/lib/ollama.ts');
  const embedding = await embedText(query, "query");
  const embeddingString = `[${embedding.join(',')}]`;
  
  const semanticResults = await prisma.$queryRaw`
      SELECT 
        a.id, a.title,
        1 - (e.embedding <=> ${embeddingString}::vector) as "semanticScore"
      FROM "NewsArticle" a
      JOIN "ArticleEmbedding" e ON e."articleId" = a.id
      WHERE e.superseded IS NOT TRUE
        AND a.visible = true
      ORDER BY e.embedding <=> ${embeddingString}::vector
      LIMIT 5
    `;
    
  console.log("Semantic:", semanticResults);
  
  const bm25Results = await prisma.$queryRaw`
      SELECT 
        a.id, a.title,
        ts_rank(a."searchVector", plainto_tsquery('english', ${query})) as "bm25Score"
      FROM "NewsArticle" a
      WHERE a."searchVector" @@ plainto_tsquery('english', ${query})
        AND a.visible = true
      ORDER BY "bm25Score" DESC
      LIMIT 5
    `;
    
  console.log("BM25:", bm25Results);
}
main().catch(console.error).finally(() => prisma.$disconnect());
