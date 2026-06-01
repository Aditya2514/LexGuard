const { pipeline } = require('@xenova/transformers');

async function test() {
  const reranker = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');
  
  const archaicText = "Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void. Exception 1: One who sells the goodwill of a business may agree with the buyer to refrain from carrying on a similar business, within specified local limits, so long as the buyer, or any person deriving title to the goodwill from him, carries on a like business therein.";
  
  const modernSummary = "Section 27 states that non-compete clauses are completely illegal and unenforceable under Indian law, unless it involves the sale of a business's goodwill where reasonable geographic restrictions can apply.";

  const hallucinatedSummary = "Section 27 states that non-compete clauses are completely legal as long as the employee is paid a severance of at least 3 months salary.";

  const res1 = await reranker(archaicText, { text_pair: modernSummary });
  console.log("Valid:", res1);
  
  const res2 = await reranker(archaicText, { text_pair: hallucinatedSummary });
  console.log("Hallucinated:", res2);
}
test();
