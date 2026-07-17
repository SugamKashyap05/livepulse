const articleId = "f58c3e726694b3315c2caf215d392d38";

async function postChat(question) {
  const res = await fetch('http://localhost:3000/api/ai/article-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Smoke-Test': 'true' },
    body: JSON.stringify({
      articleId,
      messages: [{ role: 'user', content: question }]
    })
  });
  
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let citations = null;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    
    // Parse SSE
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'token') fullText += data.content;
          if (data.type === 'done') citations = data.contextStats?.citations;
        } catch (e) {}
      }
    }
  }
  return { fullText, citations };
}

async function runCheck7() {
  const res = await fetch('http://localhost:3000/api/admin/eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.INTERNAL_CRON_SECRET || 'dev-secret'}` },
    body: JSON.stringify({ runEval: false })
  });
  return res.json();
}

async function main() {
  console.log("--- CHECK 1 ---");
  const res1 = await postChat("What is this article about?");
  console.log("Response text:", res1.fullText);
  console.log("Citations found in text:", res1.fullText.includes("[1]"));
  console.log("Citations array length:", res1.citations?.length || 0);
  
  console.log("\n--- CHECK 3 ---");
  const res3 = await postChat("What is the current temperature in Tokyo?");
  console.log("Response text:", res3.fullText);
  console.log("Expected refusal?", res3.fullText.toLowerCase().includes("reliable information") || res3.fullText.toLowerCase().includes("i don't have enough") || res3.fullText.toLowerCase().includes("insufficient evidence") || res3.citations?.length === 0);
  
  console.log("\n--- CHECK 6 ---");
  const start = Date.now();
  await postChat("What is this article about?");
  console.log("Repeated query time (ms):", Date.now() - start);

  console.log("\n--- CHECK 7 ---");
  const res7 = await runCheck7();
  console.log("Eval JSON:", JSON.stringify(res7, null, 2));
}

main().catch(console.error);
