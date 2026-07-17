import { constrainedGenerate } from './src/lib/ragGenerate';

async function test() {
  const result = await constrainedGenerate("Who won the Super Bowl in 2040?");
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
