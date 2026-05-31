require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');

// Canonical Title Case mapping: lowercased DB name → correct normalized name
const CANONICAL_ACT_NAMES = {
  'the companies act, 2013': 'The Companies Act, 2013',
  'the consumer protection act, 2019': 'The Consumer Protection Act, 2019',
  'the consumer protection act, 2019 (2)': 'The Consumer Protection Act, 2019',
  'the code on wages, 2019': 'The Code on Wages, 2019',
  'the code on wages, 2019 (2)': 'The Code on Wages, 2019',
  'the insolvency and bankruptcy code, 2016': 'The Insolvency and Bankruptcy Code, 2016',
  'the indian contract act, 1872': 'Indian Contract Act, 1872',
  'indian contract act, 1872': 'Indian Contract Act, 1872',
  'the digital personal data protection act  2023': 'Digital Personal Data Protection Act, 2023',
  'digital personal data protection act, 2023': 'Digital Personal Data Protection Act, 2023',
  'the hindu succession act, 1956': 'The Hindu Succession Act, 1956',
  'the central goods and services tax act, 2017': 'The Central Goods and Services Tax Act, 2017',
  'the sale of goods act, 1930': 'The Sale of Goods Act, 1930',
  'the securitisation and reconstruction of financial assets and enforcement of security interest act, 2002': 'The SARFAESI Act, 2002',
  'the sexual harassment of women at workplace': 'The Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013',
  'the telecommunications act, 2023': 'The Telecommunications Act, 2023',
  'the transfer of property act, 1882': 'The Transfer of Property Act, 1882',
  'the motor vehicles act, 1988': 'The Motor Vehicles Act, 1988',
  'the real estate (regulation and development) act, 2016': 'The Real Estate (Regulation and Development) Act, 2016',
  'real estate (regulation and development) act, 2016': 'The Real Estate (Regulation and Development) Act, 2016',
  'the maternity benefit act, 1961': 'The Maternity Benefit Act, 1961',
  'the trade marks act, 1999': 'The Trade Marks Act, 1999',
  'the copyright act, 1957': 'The Copyright Act, 1957',
  'the industrial disputes act': 'The Industrial Disputes Act, 1947',
  'the industrial relations code, 2020': 'The Industrial Relations Code, 2020',
  'indian partnership act 1932': 'Indian Partnership Act, 1932',
  'negotiable instruments act, 1881': 'Negotiable Instruments Act, 1881',
  'the specific relief act, 1963': 'The Specific Relief Act, 1963',
  'the patents act, 1970': 'The Patents Act, 1970',
  'it act 2000 updated': 'Information Technology Act, 2000',
  'moneylaunderingact2002': 'Prevention of Money-Laundering Act, 2002',
  'prevention of money-laundering act, 2002': 'Prevention of Money-Laundering Act, 2002',
  'msmed2006': 'Micro, Small and Medium Enterprises Development Act, 2006',
  'meity ai advisory 1 march': 'MeitY AI Advisory, 2024',
  'code of criminal procedure': 'Code of Criminal Procedure, 1973',
  'indian penal code': 'Indian Penal Code, 1860',
  'indian evidence act': 'Indian Evidence Act, 1872',
  'income tax act, 1961': 'Income Tax Act, 1961',
  'payment of wages act, 1936': 'Payment of Wages Act, 1936',
  'foreign exchange management act, 1999 (fema)': 'Foreign Exchange Management Act, 1999',
  'competition act 2002': 'Competition Act, 2002',
  'rti-act english': 'Right to Information Act, 2005',
  'indianspacepolicy2023': 'Indian Space Policy, 2023',
  'epfscheme': 'Employees\' Provident Funds and Miscellaneous Provisions Act, 1952',
  'finance act 2022 crypto tax': 'Finance Act, 2022 (Crypto Tax Provisions)',
  'rbi-guidelines-on-digital-lending-02-09-22': 'RBI Guidelines on Digital Lending, 2022',
  'guidelines-for-influencer-advertising-in-digital-media': 'ASCI Guidelines for Influencer Advertising in Digital Media',
  'indian computer emergency response team (cert-in)': 'CERT-In Directions, 2022',
  'it rules deepfake amendment 2023': 'IT Rules (Deepfake Amendment), 2023',
  'digital media ethics code rules  2021': 'Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021',
  'the information technology (intermediary guidelines and digital media ethics code) rules, 2021': 'Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021',
  'the drone rules, 2021': 'The Drone Rules, 2021',
  'sebi (prohibition of insider trading) regulations, 2015': 'SEBI (Prohibition of Insider Trading) Regulations, 2015',
  'karnataka industrial employment (standing orders) rules, 1961': 'Karnataka Industrial Employment (Standing Orders) Rules, 1961',
  'maharera (maharashtra real estate regulatory authority) rules, 2017': 'MahaRERA Rules, 2017',
  'prohibition of advertisement and regulation of trade and commerce, production, supply and distribution act of 2003': 'Cigarettes and Other Tobacco Products Act, 2003',
};

async function normalizeStatutes() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('--- Statute Normalization Script ---\n');

  // 1. Remove documents with null/undefined actName
  const orphans = await StatuteNode.deleteMany({ actName: { $in: [null, undefined, ''] } });
  console.log(`🗑️  Removed ${orphans.deletedCount} orphaned documents (null actName).`);

  // 2. FIRST: Remove exact duplicates (same actName + sectionNumber, keep the first)
  //    This must happen BEFORE normalization to avoid unique-key collisions when renaming.
  console.log('\n--- Deduplication Pass (case-insensitive) ---');
  const allDocs = await StatuteNode.find().select('_id actName sectionNumber').lean();
  const seen = new Map(); // key: "lowered_actName|||sectionNumber" → first _id
  const idsToDelete = [];
  for (const doc of allDocs) {
    const key = `${(doc.actName || '').toLowerCase().trim()}|||${(doc.sectionNumber || '').toLowerCase().trim()}`;
    if (seen.has(key)) {
      idsToDelete.push(doc._id);
    } else {
      seen.set(key, doc._id);
    }
  }
  if (idsToDelete.length > 0) {
    // Delete in batches of 500
    for (let i = 0; i < idsToDelete.length; i += 500) {
      const batch = idsToDelete.slice(i, i + 500);
      await StatuteNode.deleteMany({ _id: { $in: batch } });
    }
  }
  console.log(`🗑️  Removed ${idsToDelete.length} duplicate documents.`);

  // 3. NOW normalize act names using the canonical mapping
  let totalUpdated = 0;
  for (const [rawLower, canonical] of Object.entries(CANONICAL_ACT_NAMES)) {
    const regex = new RegExp(`^${rawLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    
    // Find docs that match the raw pattern but are NOT already canonical
    const docsToRename = await StatuteNode.find({ actName: regex, actName: { $ne: canonical } }).select('_id actName sectionNumber').lean();
    
    for (const doc of docsToRename) {
      try {
        await StatuteNode.updateOne({ _id: doc._id }, { $set: { actName: canonical } });
        totalUpdated++;
      } catch (err) {
        if (err.code === 11000) {
          // A canonical doc with this sectionNumber already exists → delete this duplicate
          await StatuteNode.deleteOne({ _id: doc._id });
          console.log(`  🗑️ Deleted collision duplicate: "${doc.actName}" / ${doc.sectionNumber}`);
        } else {
          throw err;
        }
      }
    }
    if (docsToRename.length > 0) {
      console.log(`✅ Normalized → "${canonical}" (${docsToRename.length} docs processed)`);
    }
  }
  console.log(`\n📊 Total documents updated: ${totalUpdated}`);

  // 4. Final count
  const finalCount = await StatuteNode.countDocuments();
  const distinctActs = await StatuteNode.distinct('actName');
  console.log(`\n📊 Final state: ${finalCount} documents across ${distinctActs.length} distinct acts.`);
  distinctActs.sort().forEach(a => console.log(`  - ${a}`));
  
  await mongoose.disconnect();
}

normalizeStatutes().catch(err => {
  console.error('❌ Normalization failed:', err);
  mongoose.disconnect();
});
