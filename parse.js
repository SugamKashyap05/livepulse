// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
const text = fs.readFileSync('output3.txt', 'utf16le');
let fullText = '';
for (const line of text.split('\n')) {
  if (line.startsWith('data: {"type":"token"')) {
    try {
      const parsed = JSON.parse(line.substring(6));
      if (parsed.content) {
        fullText += parsed.content;
      }
    } catch (e) {}
  }
}
console.log("LLM Output:", fullText);
