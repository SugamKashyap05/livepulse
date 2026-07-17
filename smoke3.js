const http = require('http');

const data = JSON.stringify({
  articleId: "f58c3e726694b3315c2caf215d392d38",
  messages: [
    { role: "user", content: "Who won the superbowl in 2040?" }
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/article-chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'X-Smoke-Test': 'true'
  }
};

const req = http.request(options, (res) => {
  let output = '';
  res.on('data', (chunk) => {
    output += chunk.toString();
  });
  res.on('end', () => {
    console.log(output);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
