const fs = require('fs'); 
const lines = fs.readFileSync('output3.txt', 'utf16le').split('\n'); 
let out=''; 
for(const l of lines){ 
  if(l.includes('"type":"token"')) { 
    try{ 
      out += JSON.parse(l.replace('data: ', '')).content; 
    }catch(e){} 
  } 
} 
console.log("LLM Output:", out);
