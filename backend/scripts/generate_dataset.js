const fs = require('fs');

const labels = [
    { label: 1, type: "predatory intellectual property capture", templates: [
        "All intellectual property, including inventions made outside of company time, belongs to the company.",
        "The employee agrees to assign all rights, title, and interest in any intellectual property developed at any time.",
        "Any ideas conceived by the contractor, regardless of relevance to the project, are the exclusive property of the client."
    ]},
    { label: 1, type: "predatory force majeure", templates: [
        "In the event of a force majeure, the company is not liable for any payments, but the contractor must continue providing services.",
        "Force majeure events do not excuse the client's obligation to pay the full subscription fee.",
        "The provider may terminate the agreement immediately upon a force majeure event without offering any refunds."
    ]},
    { label: 1, type: "wage forfeiture", templates: [
        "If the employee resigns before the end of the term, they forfeit all unpaid bonuses and commissions.",
        "The company reserves the right to withhold final paychecks in the event of a breach of contract.",
        "Contractor agrees to forfeit 50% of the milestone payment if the work is deemed unsatisfactory by the client in their sole discretion."
    ]},
    { label: 1, type: "one-sided indemnification", templates: [
        "The user shall indemnify, defend, and hold harmless the company from any and all claims, including those arising from the company's own negligence.",
        "Contractor assumes all liability and agrees to indemnify the client against all losses, damages, or claims.",
        "You agree to indemnify us against any claims brought by third parties, without limitation."
    ]},
    { label: 0, type: "safe_standard_clause", templates: [
        "This agreement shall be governed by the laws of the State of California.",
        "Either party may terminate this agreement with 30 days written notice.",
        "The company will pay the contractor within 30 days of receiving a valid invoice.",
        "Confidential information does not include information that is publicly known."
    ]}
];

function generateDataset(numSamples = 500) {
    const dataset = [];
    // Simple synthetic generation by shuffling and tweaking templates
    for (let i = 0; i < numSamples; i++) {
        const category = labels[Math.floor(Math.random() * labels.length)];
        const template = category.templates[Math.floor(Math.random() * category.templates.length)];
        
        // Add some noise
        const words = template.split(' ');
        if (Math.random() > 0.5 && words.length > 5) {
            words.splice(Math.floor(Math.random() * words.length), 0, "furthermore");
        }
        
        dataset.push({
            text: words.join(' '),
            label: category.label,
            type: category.type
        });
    }
    
    fs.writeFileSync('predatory_clauses_dataset.json', JSON.stringify(dataset, null, 2));
    console.log(`Generated ${numSamples} synthetic samples in predatory_clauses_dataset.json`);
}

generateDataset();
