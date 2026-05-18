/**
 * Static Legal Playbook – Tier 2 Fallback for RAG Pipeline
 *
 * Expert-curated legal guidelines keyed by clause_type.
 * When the dynamic MongoDB RAG search (Tier 1) fails or returns
 * zero matches, this playbook is loaded from local Node.js memory
 * with zero latency and zero crash risk.
 *
 * Each entry contains:
 *  - guidelines[]: Array of structured legal contexts identical
 *    in shape to what the dynamic RAG would return, so the LLM
 *    prompt injection code works identically for both tiers.
 */

const LEGAL_PLAYBOOK = {

  // ─── Non-Compete / Restraint of Trade ───────────────────────────
  non_compete: {
    guidelines: [
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 27',
        title: 'Agreement in restraint of trade, void',
        content:
          'Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void. Exception: One who sells the goodwill of a business may agree with the buyer to refrain from carrying on a similar business, within specified local limits, so long as the buyer, or any person deriving title to the goodwill from him, carries on a like business therein.',
        landmark_case:
          'Niranjan Shankar Golikari v. Century Spinning & Mfg. Co. (1967) — Supreme Court held that reasonable restrictions during employment are valid, but post-employment non-competes are void under Section 27.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      },
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 28',
        title: 'Agreements in restraint of legal proceedings, void',
        content:
          'Every agreement, by which any party thereto is restricted absolutely from enforcing his rights under or in respect of any contract, by the usual legal proceedings in the ordinary tribunals, or which limits the time within which he may thus enforce his rights, is void to that extent.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      },
    ],
  },

  // ─── Intellectual Property / IP Ownership ───────────────────────
  ip_ownership: {
    guidelines: [
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 16',
        title: 'Undue influence',
        content:
          'A contract is said to be induced by "undue influence" where the relations subsisting between the parties are such that one of the parties is in a position to dominate the will of the other. Blanket IP assignment clauses with no exceptions for pre-existing work may raise unconscionability concerns.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      },
      {
        actKey: 'PATENTS_ACT',
        actName: 'Patents Act, 1970',
        sectionNumber: 'Section 53 & Chapter XVI',
        title: 'Employee inventions and patent ownership',
        content:
          'Under Indian patent law, the question of ownership of inventions made by employees depends on the terms of employment and whether the invention was made in the course of employment duties. Overly broad assignment clauses may face challenges if they extend beyond the scope of employment.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/1392/1/197039.pdf',
      },
      {
        actKey: 'OTHER',
        actName: 'Indian Copyright Act, 1957',
        sectionNumber: 'Section 57',
        title: 'Author\'s special moral rights',
        content:
          'Independently of the author\'s copyright and even after the assignment of copyright, the author shall have the right to claim authorship and restrain distortion, mutilation or modification of the work. Moral rights are inalienable under Indian law.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/1367/1/195714.pdf',
      },
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 27',
        title: 'Unreasonable restraint of trade (IP life-capture)',
        content:
          'A blanket assignment claiming ownership over personal off-duty inventions and unrelated side-projects created on weekends is considered void as an unreasonable restraint of trade under Section 27.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      }
    ],
  },

  // ─── Confidentiality / Non-Disclosure ───────────────────────────
  confidentiality: {
    guidelines: [
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 27',
        title: 'Confidentiality and restraint of trade overlap',
        content:
          'While confidentiality clauses are generally enforceable, courts scrutinise them if they effectively operate as non-compete clauses in disguise. A confidentiality obligation must be limited in scope and duration to be considered reasonable.',
        landmark_case:
          'Desiccant Rotors International v. Bappaditya Sarkar (2009) — Delhi High Court upheld confidentiality obligations but struck down clauses that amounted to restraint of trade.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      },
      {
        actKey: 'IT_ACT',
        actName: 'Information Technology Act, 2000',
        sectionNumber: 'Section 43A',
        title: 'Compensation for failure to protect data',
        content:
          'Where a body corporate, possessing, dealing or handling any sensitive personal data or information in a computer resource which it owns, controls or operates, is negligent in implementing and maintaining reasonable security practices and procedures and thereby causes wrongful loss or wrongful gain to any person, such body corporate shall be liable to pay damages by way of compensation.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/1999/1/200021.pdf',
      },
    ],
  },

  // ─── Termination / Exit Clauses ─────────────────────────────────
  termination: {
    guidelines: [
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 73',
        title: 'Compensation for loss or damage caused by breach of contract',
        content:
          'When a contract has been broken, the party who suffers by such breach is entitled to receive, as compensation for any loss or damage caused to him thereby, such compensation as would naturally arise in the usual course of things from such breach.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      },
      {
        actKey: 'INDUSTRIAL_DISPUTES_ACT',
        actName: 'Industrial Disputes Act, 1947',
        sectionNumber: 'Section 25F',
        title: 'Conditions precedent to retrenchment of workmen',
        content:
          'No workman employed in any industry who has been in continuous service for not less than one year under an employer shall be retrenched by that employer until the workman has been given one month notice in writing or wages in lieu thereof and compensation equivalent to fifteen days average pay for every completed year of continuous service.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/15336/1/industrial_disputes_act_1947.pdf',
      },
    ],
  },

  // ─── Liability / Indemnification ────────────────────────────────
  liability: {
    guidelines: [
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 124 & 125',
        title: 'Contract of indemnity and rights of indemnity holder',
        content:
          'A contract by which one party promises to save the other from loss caused to him by the conduct of the promisor himself, or by the conduct of any other person, is called a "contract of indemnity". The promisee in a contract of indemnity, acting within the scope thereof, is entitled to recover damages, costs, and sums paid under any compromise.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      },
      {
        actKey: 'CONSUMER_PROTECTION_ACT',
        actName: 'Consumer Protection Act, 2019',
        sectionNumber: 'Section 2(46) & Section 49',
        title: 'Unfair contract terms',
        content:
          'An "unfair contract" means a contract between a manufacturer or trader or service provider on one hand, and a consumer on the other, having such terms which cause significant change in the rights of such consumer, including unilateral termination, imposing disproportionate penalties, or limiting liability for negligence.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/15256/1/consumer_protection_act_2019.pdf',
      },
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 74',
        title: 'Liquidated damages vs penalty clauses',
        content:
          'A party cannot claim contractually specified liquidated damages unless they prove actual injury or financial loss occurred. Automatic compensation penalties (like 200%) without proof of harm are treated as punitive penalty clauses and struck down by courts.',
        landmark_case:
          'Fateh Chand v. Balkishan Dass (1963) — Supreme Court established that the courts will not enforce punitive liquidated damage clauses without proof of actual harm or injury.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      }
    ],
  },

  // ─── Arbitration / Dispute Resolution ───────────────────────────
  arbitration: {
    guidelines: [
      {
        actKey: 'ARBITRATION_ACT',
        actName: 'Arbitration and Conciliation Act, 1996',
        sectionNumber: 'Section 12 & Fifth/Seventh Schedule',
        title: 'Grounds for challenge to arbitrators and ineligibility',
        content:
          'An arbitrator may be challenged if circumstances exist that give rise to justifiable doubts as to his independence or impartiality. The Seventh Schedule lists categories of relationships that make a person ineligible to be appointed as arbitrator, including employees or affiliates of a party.',
        landmark_case:
          'TRF Ltd. v. Energo Engineering Projects Ltd. (2017) — Supreme Court held that a person having an interest in the outcome cannot be permitted to appoint a sole arbitrator, even if the clause permits it.',
        referenceUrl:
          'https://www.advocatekhoj.com/library/bareacts/arbitrationandconciliation/index.php',
      },
      {
        actKey: 'ARBITRATION_ACT',
        actName: 'Arbitration and Conciliation Act, 1996',
        sectionNumber: 'Section 11',
        title: 'Appointment of arbitrators',
        content:
          'A person of any nationality may be an arbitrator, unless otherwise agreed by the parties. The parties are free to agree on a procedure for appointing the arbitrator or arbitrators. Failure to follow a fair appointment procedure allows the Supreme Court or High Court to make the appointment.',
        referenceUrl:
          'https://www.advocatekhoj.com/library/bareacts/arbitrationandconciliation/index.php',
      },
    ],
  },

  // ─── Privacy / Data Protection ──────────────────────────────────
  privacy_data: {
    guidelines: [
      {
        actKey: 'DPDP_ACT',
        actName: 'Digital Personal Data Protection Act, 2023',
        sectionNumber: 'Section 6',
        title: 'Consent requirements',
        content:
          'A person may process the personal data of a Data Principal only in accordance with the provisions of this Act and for a lawful purpose for which the Data Principal has given her consent, or for certain legitimate uses. Consent must be free, specific, informed, unconditional and unambiguous, with a clear affirmative action.',
        referenceUrl:
          'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf',
      },
      {
        actKey: 'DPDP_ACT',
        actName: 'Digital Personal Data Protection Act, 2023',
        sectionNumber: 'Section 11',
        title: 'Additional obligations of significant data fiduciaries',
        content:
          'Every Significant Data Fiduciary shall appoint a Data Protection Officer and an independent data auditor to carry out a Data Protection Impact Assessment. They shall also implement measures to ensure compliance with the provisions of this Act.',
        referenceUrl:
          'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf',
      },
      {
        actKey: 'IT_ACT',
        actName: 'Information Technology Act, 2000',
        sectionNumber: 'Section 72A',
        title: 'Punishment for disclosure of information in breach of lawful contract',
        content:
          'Any person including an intermediary who, while providing services under the terms of lawful contract, has secured access to any material containing personal information about another person, with the intent to cause or knowing that he is likely to cause wrongful loss or wrongful gain discloses, without the consent of the person concerned, or in breach of a lawful contract, such material to any other person, shall be punished with imprisonment for a term which may extend to three years, or with fine which may extend to five lakh rupees, or with both.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/1999/1/200021.pdf',
      },
    ],
  },

  // ─── Payment / Compensation ─────────────────────────────────────
  payment: {
    guidelines: [
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 73 & 74',
        title: 'Compensation for breach and penalty stipulations',
        content:
          'Section 73: The party who suffers by breach is entitled to reasonable compensation. Section 74: When a contract specifies a sum to be paid in case of breach, the party complaining of breach is entitled to receive reasonable compensation not exceeding the amount so named.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      },
      {
        actKey: 'PAYMENT_OF_WAGES_ACT',
        actName: 'Payment of Wages Act, 1936',
        sectionNumber: 'Section 5',
        title: 'Time of payment of wages',
        content:
          'The wages of every person employed shall be paid before the expiry of the seventh day after the last day of the wage period in respect of which the wages are payable. No deductions shall be made from the wages of an employed person except those authorised by the Act.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2154/1/A193604.pdf',
      },
      {
        actKey: 'PAYMENT_OF_WAGES_ACT',
        actName: 'Payment of Wages Act, 1936',
        sectionNumber: 'Section 7 & 9',
        title: 'Permissible deductions and withholding restrictions',
        content:
          'Employers cannot unilaterally defer earned salaries interest-free or deduct compensation from an employee\'s contracted base salary. Wage deferrals or holding reserves are strictly unauthorized and illegal.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2154/1/A193604.pdf',
      },
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 74',
        title: 'Unenforceable training bonds & administrative markup',
        content:
          'Employment bonds or repayment terms are only valid for specialized external training expenses where the employer has spent actual, verifiable money. Arbitrary internal billing rates, onboarding admin fees, or compounding interest on resignation are void as punitive penalties.',
        landmark_case:
          'Sicpa India Pvt. Ltd. v. Shri Manas Pratim Baruah (2012) — Delhi High Court established that arbitrary administrative markups and internal training bonds are void penalties if no actual specialised expenses are proved.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      }
    ],
  },

  // ─── Other / General Contract Issues ────────────────────────────
  other: {
    guidelines: [
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 10, 14, 23',
        title: 'General contract validity, free consent, and lawful object',
        content:
          'Section 10: All agreements are contracts if they are made by the free consent of parties competent to contract, for a lawful consideration and with a lawful object. Section 14: Consent is said to be free when it is not caused by coercion, undue influence, fraud, misrepresentation, or mistake. Section 23: The consideration or object of an agreement is unlawful if it is forbidden by law, or defeats the provisions of any law, or is fraudulent, or involves injury to the person or property of another, or the Court regards it as immoral or opposed to public policy.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      },
      {
        actKey: 'INDIAN_CONTRACT_ACT',
        actName: 'Indian Contract Act, 1872',
        sectionNumber: 'Section 23',
        title: 'Waiver of statutory labour rights opposing public policy',
        content:
          'Statutory worker rights mandated by state Shops and Establishments Acts (e.g. maximum weekly hours, mandatory rest periods, overtime) are based on public welfare. A contractual waiver of these protections is void under Section 23 as opposed to public policy.',
        landmark_case:
          'Shops and Establishments Act (e.g. Karnataka Shops & Establishments Act, 1961 / Maharashtra Act, 2017) strictly forbids working beyond statutory maximum limits or waiving mandatory rest leaves.',
        referenceUrl:
          'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
      }
    ],
  },
};

module.exports = { LEGAL_PLAYBOOK };
