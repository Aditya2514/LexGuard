const { AutoModelForSequenceClassification, AutoTokenizer } = require('@xenova/transformers');

class SemanticCitationVerifier {
  constructor() {
    this.modelName = 'Xenova/bge-reranker-base';
    this.tokenizer = null;
    this.model = null;
  }

  async init() {
    if (!this.model) {
      console.log(`[Verifier] Loading Cross-Encoder: ${this.modelName}...`);
      this.tokenizer = await AutoTokenizer.from_pretrained(this.modelName);
      this.model = await AutoModelForSequenceClassification.from_pretrained(this.modelName);
    }
  }

  async verifySemanticEquivalence(archaicStatute, modernSummary) {
    await this.init();
    const inputs = await this.tokenizer(modernSummary, { text_pair: archaicStatute, padding: true, truncation: true });
    const { logits } = await this.model(inputs);
    const logitScore = logits.data[0];
    const normalizedScore = 1 / (1 + Math.exp(-(logitScore + 7.5))); 
    return normalizedScore;
  }
}

async function runAdversarialTest() {
  console.log('🧪 Starting Adversarial Cross-Encoder Test...');

  const archaicText = "Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void. Exception 1: One who sells the goodwill of a business may agree with the buyer to refrain from carrying on a similar business, within specified local limits, so long as the buyer, or any person deriving title to the goodwill from him, carries on a like business therein.";
  
  const modernSummary = "Section 27 states that non-compete clauses are completely illegal and unenforceable under Indian law, unless it involves the sale of a business's goodwill where reasonable geographic restrictions can apply.";

  const hallucinatedSummary = "Section 27 states that non-compete clauses are completely legal as long as the employee is paid a severance of at least 3 months salary.";

  const verifier = new SemanticCitationVerifier();

  console.log('\n--- Test 1: Valid Modern Paraphrase ---');
  const score1 = await verifier.verifySemanticEquivalence(archaicText, modernSummary);
  console.log(`Archaic vs Modern Summary Score: ${score1.toFixed(3)} (Expected > 0.65)`);
  if (score1 >= 0.65) console.log('✅ PASSED: Cross-encoder successfully matched modern paraphrase with archaic text.');
  else console.log('❌ FAILED: Score too low.');

  console.log('\n--- Test 2: Hallucinated Legal Advice ---');
  const score2 = await verifier.verifySemanticEquivalence(archaicText, hallucinatedSummary);
  console.log(`Archaic vs Hallucinated Summary Score: ${score2.toFixed(3)} (Expected < 0.65)`);
  if (score2 < 0.65) console.log('✅ PASSED: Cross-encoder correctly rejected hallucinated reasoning.');
  else console.log('❌ FAILED: Score too high (false positive).');
  
  console.log('\n🏁 Adversarial test complete.');
}

runAdversarialTest();
