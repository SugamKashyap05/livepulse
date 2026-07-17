// CHECK 4: Unauthenticated request to /api/ai/article-chat
async function check4() {
  try {
    const res = await fetch('http://localhost:3000/api/ai/article-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: '68af14fb0eb8458838dd1da23ec92efa',
        messages: [{ role: 'user', content: 'What is this article about?' }]
      })
    });
    console.log('CHECK 4 - Unauthenticated article-chat');
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Body:', body);
    console.log(res.status === 401 ? 'RESULT: PASS' : 'RESULT: FAIL');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

check4();
