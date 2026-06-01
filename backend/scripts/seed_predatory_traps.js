require('dotenv').config();
const mongoose = require('mongoose');
const PredatoryTrap = require('../src/models/PredatoryTrap');
const { generateEmbedding } = require('../src/services/embeddingService');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lexguard";

const TRAP_DATA = [
  {
    trap_type: 'disguised non-compete',
    severity: 'critical',
    text: "The Employee shall not, for a period of 12 months following their date of separation, directly or indirectly engage in any similar line of business."
  },
  {
    trap_type: 'predatory jurisdiction',
    severity: 'high',
    text: "This Agreement shall be subject to the exclusive jurisdiction of the courts located in Port Blair."
  },
  {
    trap_type: 'predatory force majeure',
    severity: 'critical',
    text: "In the event of a pandemic or act of god, the Company's obligation to deliver shall be suspended, but the User's obligations shall remain absolute and unmodified."
  },
  {
    trap_type: 'predatory intellectual property capture',
    severity: 'critical',
    text: "Any intellectual property conceived by the Employee prior to or outside of company time shall be immediately assigned to and belongs to the Company."
  },
  {
    trap_type: 'one-sided indemnification',
    severity: 'critical',
    text: "The User agrees to indemnify the Company against all claims, including those arising from the Company's own gross negligence or willful misconduct."
  },
  {
    trap_type: 'wage forfeiture',
    severity: 'critical',
    text: "The Company reserves the right to withhold, deduct, or permanently forfeit any compensation, bonus, or salary at its sole discretion."
  },
  {
    trap_type: 'post-employment non-compete',
    severity: 'critical',
    text: "Following termination or upon leaving the company, the Employee is strictly barred from working for any competitor or restricted from any similar industry."
  },
  {
    trap_type: 'termination without payment',
    severity: 'high',
    text: "The Company may terminate this Agreement at any time for convenience, and the Contractor shall not be entitled to payment for any work completed prior to termination."
  },
  {
    trap_type: 'unilateral contract variation',
    severity: 'critical',
    text: "The Company reserves the absolute right to unilaterally modify or alter the salary and benefits at any time, with or without prior notice."
  },
  {
    trap_type: 'illegal harassment arbitration',
    severity: 'critical',
    text: "Any claims of sexual harassment, discrimination, or POSH violations shall be subject exclusively to binding private arbitration."
  },
  {
    trap_type: 'punitive training bond',
    severity: 'critical',
    text: "If the Employee resigns within the training period, they shall pay a fixed penalty of $10,000 as liquidated damages, irrespective of actual costs."
  },
  {
    trap_type: 'unpaid indefinite suspension',
    severity: 'critical',
    text: "The Company may place the Employee on an unpaid disciplinary suspension for an indefinite duration pending any internal investigation."
  },
  {
    trap_type: 'broad non-solicit restraint',
    severity: 'critical',
    text: "The Employee shall not directly or indirectly solicit or accept business from any client, customer, or prospect anywhere in the world."
  },
  {
    trap_type: 'indefinite probation trap',
    severity: 'high',
    text: "The Company may extend this probation period indefinitely, during which the Employee may be terminated without notice or cause."
  },
  {
    trap_type: 'unconscionable surveillance',
    severity: 'critical',
    text: "The Employee completely waives any rights under the Digital Personal Data Protection Act, and grants the Company the absolute right to monitor, record, and store biometric data from personal devices."
  },
  {
    trap_type: 'excessive liquidated damages penalty',
    severity: 'critical',
    text: "For any minor breach, the User shall pay a penalty or liquidated damages irrespective of the actual damages suffered."
  },
  {
    trap_type: 'moral rights waiver',
    severity: 'critical',
    text: "The Creator hereby waives any and all moral rights under Section 57, including the right to object to any derogatory modification."
  },
  {
    trap_type: 'predatory evergreen auto-renewal',
    severity: 'critical',
    text: "This Agreement shall automatically renew for successive 5-year terms unless canceled 365 days in advance."
  },
  {
    trap_type: 'retroactive amendment',
    severity: 'critical',
    text: "The Company may retroactively amend or alter any policies, and the User shall be bound by such modifications."
  },
  {
    trap_type: 'biased arbitration seat',
    severity: 'high',
    text: "The dispute shall be resolved by an arbitral tribunal solely appointed by the directors of the company or its senior executives."
  },
  {
    trap_type: 'obfuscated wage deduction',
    severity: 'critical',
    text: "The Company may reallocate or withhold 100% of the remuneration into an escrow account."
  },
  {
    trap_type: 'wage forfeiture on termination',
    severity: 'critical',
    text: "Upon termination, the Employee shall relinquish and forfeit any payment for work completed or accrued wages."
  },
  {
    trap_type: 'ghost equity clawback',
    severity: 'critical',
    text: "The Company may cancel, revoke, or claw back any vested equity or stock options in its absolute discretion."
  },
  {
    trap_type: 'gag order equity forfeiture',
    severity: 'critical',
    text: "If the Employee makes any disparaging or negative remarks, they shall immediately forfeit all vested equity and unpaid bonuses."
  }
];

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected to DB: ${MONGODB_URI}`);

    // Clear existing traps to avoid duplicates
    await PredatoryTrap.deleteMany({});
    console.log('🧹 Cleared existing PredatoryTraps');

    let successCount = 0;

    for (const trap of TRAP_DATA) {
      console.log(`Processing trap: ${trap.trap_type}...`);
      
      const embedding = await generateEmbedding(trap.text, 'search_document');
      
      if (!embedding || embedding.length === 0) {
        console.error(`❌ Failed to generate embedding for: ${trap.trap_type}`);
        continue;
      }
      
      if (embedding.length !== 1024) {
        console.warn(`⚠️ Warning: Embedding dimension is ${embedding.length}, expected 1024 (BGE-m3).`);
      }

      await PredatoryTrap.create({
        trap_type: trap.trap_type,
        severity: trap.severity,
        text: trap.text,
        embedding: embedding
      });
      
      successCount++;
    }

    console.log(`✅ Seeded ${successCount}/${TRAP_DATA.length} Predatory Traps successfully!`);

  } catch (error) {
    console.error('🚨 Seeding Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from DB.');
  }
}

run();
