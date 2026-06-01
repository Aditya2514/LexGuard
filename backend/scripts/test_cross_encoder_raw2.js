const { AutoModelForSequenceClassification, AutoTokenizer } = require('@xenova/transformers');

async function test() {
  const modelName = 'Xenova/ms-marco-MiniLM-L-6-v2';
  const tokenizer = await AutoTokenizer.from_pretrained(modelName);
  const model = await AutoModelForSequenceClassification.from_pretrained(modelName);
  
  const archaicText = "Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void. Exception 1: One who sells the goodwill of a business may agree with the buyer to refrain from carrying on a similar business, within specified local limits, so long as the buyer, or any person deriving title to the goodwill from him, carries on a like business therein.";
  
  const modernSummary = "Section 27 states that non-compete clauses are completely illegal and unenforceable under Indian law, unless it involves the sale of a business's goodwill where reasonable geographic restrictions can apply.";

  const hallucinatedSummary = "Section 27 states that non-compete clauses are completely legal as long as the employee is paid a severance of at least 3 months salary.";

  const inputs1 = await tokenizer(modernSummary, { text_pair: archaicText, padding: true, truncation: true });
  const { logits: logits1 } = await model(inputs1);
  console.log("Valid logits:", logits1.data);
  
  const inputs2 = await tokenizer(hallucinatedSummary, { text_pair: archaicText, padding: true, truncation: true });
  const { logits: logits2 } = await model(inputs2);
  console.log("Hallucinated logits:", logits2.data);
}
test();
