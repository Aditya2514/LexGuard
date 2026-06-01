const { pipeline } = require('@xenova/transformers');

async function test() {
  const reranker = await pipeline('text-classification', 'Xenova/bge-reranker-base');
  
  const text1 = "The agreement is void.";
  const text2 = "This contract is illegal.";
  
  try {
    const res1 = await reranker(text1, { text_pair: text2 });
    console.log("Res1:", res1);
  } catch(e) {
    console.log("Method 1 failed:", e.message);
  }

  try {
    const res2 = await reranker([[text1, text2]]);
    console.log("Res2:", res2);
  } catch(e) {
    console.log("Method 2 failed:", e.message);
  }
}
test();
