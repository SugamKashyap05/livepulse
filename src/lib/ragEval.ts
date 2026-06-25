import { prisma } from '@/lib/db';
import { aiClient, MODELS, withRetry } from '@/lib/ollama';
import { constrainedGenerate } from '@/lib/ragGenerate';

/**
 * Automated RAG Evaluation Suite
 * Runs daily to benchmark hallucination rates on recent articles.
 */
export async function runRagEvaluation() {
  const recentArticles = await prisma.newsArticle.findMany({
    where: { 
      published: true, 
      aiProcessed: true,
      pubDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    take: 10,
    orderBy: { pubDate: 'desc' },
  });

  if (recentArticles.length === 0) return;

  let totalEvals = 0;
  let hallucinations = 0;

  for (const article of recentArticles) {
    if (!article.summary) continue;

    // Generate a test query based on the article's topic
    const testQuery = `What are the key details about ${article.title}?`;

    try {
      // Direct function call to RAG generator instead of HTTP fetch
      const result = await constrainedGenerate(testQuery);
      if (!result.answer) continue;

      const body = result.answer.text;
      
      // Run LLM-as-a-judge evaluation
      const evalPrompt = `Evaluate the following RAG response for accuracy and groundedness.
Rate it from 1 to 5, where 5 is excellent and 1 is hallucinated or completely off-topic.
Response: ${body.substring(0, 1000)}

Output ONLY a single digit number between 1 and 5.`;

      try {
        const evalResponse = await withRetry(() => aiClient.chat.completions.create({
          model: MODELS.fast,
          messages: [{ role: 'user', content: evalPrompt }],
          temperature: 0,
          max_tokens: 5,
        }));

        const scoreMatch = evalResponse.choices[0]?.message?.content?.match(/\d/);
        const score = scoreMatch ? parseInt(scoreMatch[0], 10) : 0;
        
        console.log(`[AiEval] Quality Score: ${score}/5`);
        
        if (score <= 2) {
          hallucinations++;
        }
        totalEvals++;
      } catch (err) {
        console.error('Eval scoring error', err);
      }
    } catch (e) {
      console.error('Eval error', e);
    }
  }

  // A better way is to query the AiLogs for hallucination metrics from actual usage
  await benchmarkDailyUsage();
}

/**
 * Benchmarks daily hallucination rates from actual usage logs
 */
export async function benchmarkDailyUsage() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const totalRetrievals = await prisma.aiLog.count({
    where: {
      action: 'RAG_RETRIEVAL',
      createdAt: { gte: yesterday }
    }
  });

  const hallucinations = await prisma.aiLog.count({
    where: {
      action: 'HALLUCINATION_CALLBACK',
      createdAt: { gte: yesterday }
    }
  });

  const rate = totalRetrievals > 0 ? (hallucinations / totalRetrievals) * 100 : 0;

  await prisma.adminDepartmentEvent.create({
    data: {
      department: 'research-library',
      type: 'DAILY_RAG_EVAL',
      title: 'Daily RAG Evaluation Report',
      body: `Total queries: ${totalRetrievals}. Refusals/Hallucinations: ${hallucinations}. Rate: ${rate.toFixed(2)}%`,
      status: 'unread',
      severity: rate > 10 ? 'warning' : 'info',
    }
  });

  return { totalRetrievals, hallucinations, rate };
}
