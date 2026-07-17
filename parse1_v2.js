// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
const text = fs.readFileSync('output1_v2.txt', 'utf16le');
let fullText = '';
for (const line of text.split('\n')) {
  if (line.includes('data: {"type":"token"')) {
    try {
      const idx = line.indexOf('data: ');
      const parsed = JSON.parse(line.substring(idx + 6));
      if (parsed.content) {
        fullText += parsed.content;
      }
    } catch (e) {}
  }
}
console.log("LLM Output:", fullText);
