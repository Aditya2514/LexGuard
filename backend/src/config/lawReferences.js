/**
 * Static config for Indian law references used by Agent 2 & Agent 4.
 * These act_keys are referenced by agents and mapped to human-readable
 * names, descriptions, and official source URLs at response time.
 *
 * V2: Expanded from 11 → 48 act keys to cover all 57 ingested statutes.
 */
const LAW_REFERENCES = {
  // ═══════════════════════════════════════════════════════════════════
  // NEW CRIMINAL CODES (July 2024+)
  // ═══════════════════════════════════════════════════════════════════
  BNS: {
    act_key: 'BNS',
    act_name: 'Bharatiya Nyaya Sanhita, 2023',
    description: 'Replaced the Indian Penal Code, 1860. Governs criminal offences from July 2024.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/22026/1/bharatiya_nyaya_sanhita_2023.pdf',
  },
  BNSS: {
    act_key: 'BNSS',
    act_name: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    description: 'Replaced the Code of Criminal Procedure, 1973.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/22027/1/bharatiya_nagarik_suraksha_sanhita_2023.pdf',
  },
  BSA: {
    act_key: 'BSA',
    act_name: 'Bharatiya Sakshya Adhiniyam, 2023',
    description: 'Replaced the Indian Evidence Act, 1872.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/22025/1/bharatiya_sakshya_adhiniyam_2023.pdf',
  },

  // ═══════════════════════════════════════════════════════════════════
  // CORE CONTRACT & CIVIL LAW
  // ═══════════════════════════════════════════════════════════════════
  INDIAN_CONTRACT_ACT: {
    act_key: 'INDIAN_CONTRACT_ACT',
    act_name: 'Indian Contract Act, 1872',
    description: 'General principles of contracts, including fairness, restraint of trade, and unconscionable terms.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
  },
  SPECIFIC_RELIEF_ACT: {
    act_key: 'SPECIFIC_RELIEF_ACT',
    act_name: 'The Specific Relief Act, 1963',
    description: 'Governs specific performance of contracts, injunctions, and declaratory suits.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1560/1/196347.pdf',
  },
  TRANSFER_OF_PROPERTY_ACT: {
    act_key: 'TRANSFER_OF_PROPERTY_ACT',
    act_name: 'The Transfer of Property Act, 1882',
    description: 'Governs transfer of immovable property, leases, mortgages, and easements.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2338/1/188204.pdf',
  },
  SALE_OF_GOODS_ACT: {
    act_key: 'SALE_OF_GOODS_ACT',
    act_name: 'The Sale of Goods Act, 1930',
    description: 'Governs contracts for sale of goods, implied conditions and warranties, transfer of title.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2390/1/193003.pdf',
  },
  NEGOTIABLE_INSTRUMENTS_ACT: {
    act_key: 'NEGOTIABLE_INSTRUMENTS_ACT',
    act_name: 'Negotiable Instruments Act, 1881',
    description: 'Governs promissory notes, bills of exchange, and cheques including dishonour penalties.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A188126.pdf',
  },
  PARTNERSHIP_ACT: {
    act_key: 'PARTNERSHIP_ACT',
    act_name: 'Indian Partnership Act, 1932',
    description: 'Governs formation, rights, duties, and dissolution of partnership firms.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A193209.pdf',
  },
  HINDU_SUCCESSION_ACT: {
    act_key: 'HINDU_SUCCESSION_ACT',
    act_name: 'The Hindu Succession Act, 1956',
    description: 'Governs succession and inheritance of property among Hindus.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1929/1/195630.pdf',
  },

  // ═══════════════════════════════════════════════════════════════════
  // CRIMINAL LAW & EVIDENCE
  // ═══════════════════════════════════════════════════════════════════
  IPC: {
    act_key: 'IPC',
    act_name: 'Indian Penal Code, 1860',
    description: 'Substantive criminal law covering offences including cheating, breach of trust, and criminal intimidation.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/4219/1/THE-INDIAN-PENAL-CODE-1860.pdf',
  },
  CrPC: {
    act_key: 'CrPC',
    act_name: 'Code of Criminal Procedure, 1973',
    description: 'Procedural law governing investigation, trial, and sentencing in criminal matters.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1517/1/197302.pdf',
  },
  EVIDENCE_ACT: {
    act_key: 'EVIDENCE_ACT',
    act_name: 'Indian Evidence Act, 1872',
    description: 'Governs admissibility, relevance, and burden of proof in Indian courts.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187201.pdf',
  },

  // ═══════════════════════════════════════════════════════════════════
  // CORPORATE, FINANCE & INSOLVENCY
  // ═══════════════════════════════════════════════════════════════════
  COMPANIES_ACT: {
    act_key: 'COMPANIES_ACT',
    act_name: 'The Companies Act, 2013',
    description: 'Governs incorporation, management, mergers, and winding up of companies.',
    reference_url: 'https://www.mca.gov.in/Ministry/pdf/CompaniesAct2013.pdf',
  },
  INSOLVENCY_CODE: {
    act_key: 'INSOLVENCY_CODE',
    act_name: 'The Insolvency and Bankruptcy Code, 2016',
    description: 'Framework for insolvency resolution and liquidation of corporate debtors and individuals.',
    reference_url: 'https://www.ibbi.gov.in/uploads/legalframwork/IBCAmended.pdf',
  },
  SARFAESI_ACT: {
    act_key: 'SARFAESI_ACT',
    act_name: 'The SARFAESI Act, 2002',
    description: 'Enables secured creditors to recover debts by taking possession and sale of secured assets.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2022/1/200254.pdf',
  },
  COMPETITION_ACT: {
    act_key: 'COMPETITION_ACT',
    act_name: 'Competition Act, 2002',
    description: 'Regulates anti-competitive agreements, abuse of dominant position, and mergers/combinations.',
    reference_url: 'https://www.cci.gov.in/images/legalframwork/en/the-competition-act-20021651578653.pdf',
  },
  FEMA_ACT: {
    act_key: 'FEMA_ACT',
    act_name: 'Foreign Exchange Management Act, 1999',
    description: 'Regulates foreign exchange transactions, FDI, overseas remittances, and cross-border investments.',
    reference_url: 'https://www.rbi.org.in/scripts/Fema.aspx',
  },
  SEBI_INSIDER_TRADING: {
    act_key: 'SEBI_INSIDER_TRADING',
    act_name: 'SEBI (Prohibition of Insider Trading) Regulations, 2015',
    description: 'Prohibits insider trading and mandates disclosure of unpublished price-sensitive information.',
    reference_url: 'https://www.sebi.gov.in/legal/regulations/jan-2015/sebi-prohibition-of-insider-trading-regulations-2015_28940.html',
  },
  INCOME_TAX_ACT: {
    act_key: 'INCOME_TAX_ACT',
    act_name: 'Income Tax Act, 1961',
    description: 'Governs taxation of income including salaries, capital gains, and business profits.',
    reference_url: 'https://www.incometaxindia.gov.in/pages/acts/income-tax-act.aspx',
  },
  GST_ACT: {
    act_key: 'GST_ACT',
    act_name: 'The Central Goods and Services Tax Act, 2017',
    description: 'Governs levy, collection, and administration of central GST on supply of goods and services.',
    reference_url: 'https://www.cbic.gov.in/resources/htdocs-cbec/gst/cgst-act.pdf',
  },
  FINANCE_ACT_CRYPTO: {
    act_key: 'FINANCE_ACT_CRYPTO',
    act_name: 'Finance Act, 2022 (Crypto Tax Provisions)',
    description: 'Introduced 30% tax on income from virtual digital assets (Section 115BBH) and 1% TDS (Section 194S).',
    reference_url: 'https://www.incometaxindia.gov.in/pages/acts/finance-act.aspx',
  },
  MONEY_LAUNDERING_ACT: {
    act_key: 'MONEY_LAUNDERING_ACT',
    act_name: 'Prevention of Money-Laundering Act, 2002',
    description: 'Criminalizes money laundering, mandates KYC/AML compliance, and empowers ED for enforcement.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2022/1/A200215.pdf',
  },

  // ═══════════════════════════════════════════════════════════════════
  // LABOUR & EMPLOYMENT
  // ═══════════════════════════════════════════════════════════════════
  INDUSTRIAL_DISPUTES_ACT: {
    act_key: 'INDUSTRIAL_DISPUTES_ACT',
    act_name: 'The Industrial Disputes Act, 1947',
    description: 'Governs dispute resolutions, lay-offs, retrenchment, and severance terms for Indian workers.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/15336/1/industrial_disputes_act_1947.pdf',
  },
  INDUSTRIAL_RELATIONS_CODE: {
    act_key: 'INDUSTRIAL_RELATIONS_CODE',
    act_name: 'The Industrial Relations Code, 2020',
    description: 'Consolidates and replaces Industrial Disputes Act, Trade Unions Act, and Industrial Employment (Standing Orders) Act.',
    reference_url: 'https://labour.gov.in/sites/default/files/IR_Code_Gazette.pdf',
  },
  CODE_ON_WAGES: {
    act_key: 'CODE_ON_WAGES',
    act_name: 'The Code on Wages, 2019',
    description: 'Consolidates Payment of Wages, Minimum Wages, Payment of Bonus, and Equal Remuneration Acts.',
    reference_url: 'https://labour.gov.in/sites/default/files/code_on_wages_gazette.pdf',
  },
  PAYMENT_OF_WAGES_ACT: {
    act_key: 'PAYMENT_OF_WAGES_ACT',
    act_name: 'Payment of Wages Act, 1936',
    description: 'Governs timely wage payouts and regulates permissible wage deductions for employee cohorts.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2154/1/A193604.pdf',
  },
  EPF_ACT: {
    act_key: 'EPF_ACT',
    act_name: 'Employees\' Provident Funds and Miscellaneous Provisions Act, 1952',
    description: 'Mandates provident fund, pension, and insurance contributions for employees.',
    reference_url: 'https://www.epfindia.gov.in/site_docs/PDFs/Downloads_PDFs/EPFAct1952.pdf',
  },
  MATERNITY_BENEFIT_ACT: {
    act_key: 'MATERNITY_BENEFIT_ACT',
    act_name: 'The Maternity Benefit Act, 1961',
    description: 'Mandates 26 weeks of paid maternity leave, crèche facilities, and protects against dismissal during pregnancy.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1605/1/196153.pdf',
  },
  POSH_ACT: {
    act_key: 'POSH_ACT',
    act_name: 'The Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013',
    description: 'Mandates Internal Complaints Committee (ICC) and redressal mechanisms for workplace sexual harassment.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/2104/1/201314.pdf',
  },
  KARNATAKA_STANDING_ORDERS: {
    act_key: 'KARNATAKA_STANDING_ORDERS',
    act_name: 'Karnataka Industrial Employment (Standing Orders) Rules, 1961',
    description: 'State-specific standing orders governing terms and conditions of employment in Karnataka.',
    reference_url: 'https://labour.karnataka.gov.in/',
  },

  // ═══════════════════════════════════════════════════════════════════
  // TECHNOLOGY, DATA PRIVACY & CYBER
  // ═══════════════════════════════════════════════════════════════════
  DPDP_ACT: {
    act_key: 'DPDP_ACT',
    act_name: 'Digital Personal Data Protection Act, 2023',
    description: 'Regulates processing of personal data, consent mechanisms, and data principal rights in India.',
    reference_url: 'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf',
  },
  IT_ACT: {
    act_key: 'IT_ACT',
    act_name: 'Information Technology Act, 2000',
    description: 'Governs cybercrime, data protection obligations, electronic signatures, and intermediary liability.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1999/1/200021.pdf',
  },
  IT_INTERMEDIARY_RULES: {
    act_key: 'IT_INTERMEDIARY_RULES',
    act_name: 'Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021',
    description: 'Regulates social media intermediaries, digital media ethics, and content moderation obligations.',
    reference_url: 'https://www.meity.gov.in/writereaddata/files/Gazette_Notification_25022021.pdf',
  },
  IT_DEEPFAKE_AMENDMENT: {
    act_key: 'IT_DEEPFAKE_AMENDMENT',
    act_name: 'IT Rules (Deepfake Amendment), 2023',
    description: 'Mandates platforms to identify and label AI-generated deepfake content.',
    reference_url: 'https://www.meity.gov.in/',
  },
  CERT_IN_RULES: {
    act_key: 'CERT_IN_RULES',
    act_name: 'CERT-In Directions, 2022',
    description: 'Mandates 6-hour cyber incident reporting, log retention, and synchronised system clocks.',
    reference_url: 'https://www.cert-in.org.in/',
  },
  AI_ADVISORY: {
    act_key: 'AI_ADVISORY',
    act_name: 'MeitY AI Advisory, 2024',
    description: 'Government advisory on responsible AI deployment and labeling requirements in India.',
    reference_url: 'https://www.meity.gov.in/',
  },
  TELECOM_ACT: {
    act_key: 'TELECOM_ACT',
    act_name: 'The Telecommunications Act, 2023',
    description: 'Modernizes telecom regulation, licensing, spectrum allocation, and interception powers.',
    reference_url: 'https://dot.gov.in/telecommunication-act-2023',
  },

  // ═══════════════════════════════════════════════════════════════════
  // INTELLECTUAL PROPERTY
  // ═══════════════════════════════════════════════════════════════════
  PATENTS_ACT: {
    act_key: 'PATENTS_ACT',
    act_name: 'The Patents Act, 1970',
    description: 'Governs employee inventions, patent filing, compulsory licensing, and patent infringement.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/197039.pdf',
  },
  COPYRIGHT_ACT: {
    act_key: 'COPYRIGHT_ACT',
    act_name: 'The Copyright Act, 1957',
    description: 'Governs author rights, assignments, moral rights (Section 57), and statutory reversion of IP.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1367/1/195714.pdf',
  },
  TRADE_MARKS_ACT: {
    act_key: 'TRADE_MARKS_ACT',
    act_name: 'The Trade Marks Act, 1999',
    description: 'Governs registration, infringement, passing off, and licensing of trademarks.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1993/1/199947.pdf',
  },

  // ═══════════════════════════════════════════════════════════════════
  // REAL ESTATE
  // ═══════════════════════════════════════════════════════════════════
  RERA_ACT: {
    act_key: 'RERA_ACT',
    act_name: 'The Real Estate (Regulation and Development) Act, 2016',
    description: 'Regulates real estate projects, mandates RERA registration, and caps advance payments.',
    reference_url: 'https://mohua.gov.in/cms/rera.php',
  },
  MAHARERA_RULES: {
    act_key: 'MAHARERA_RULES',
    act_name: 'MahaRERA Rules, 2017',
    description: 'Maharashtra-specific RERA implementation rules capping advance payments at 10% and mandating project registration.',
    reference_url: 'https://maharera.mahaonline.gov.in/',
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONSUMER PROTECTION
  // ═══════════════════════════════════════════════════════════════════
  CONSUMER_PROTECTION_ACT: {
    act_key: 'CONSUMER_PROTECTION_ACT',
    act_name: 'Consumer Protection Act, 2019',
    description: 'Protects consumers against unfair contract terms, defective goods/services, and unconscionable conditions.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/15256/1/consumer_protection_act_2019.pdf',
  },
  MOTOR_VEHICLES_ACT: {
    act_key: 'MOTOR_VEHICLES_ACT',
    act_name: 'The Motor Vehicles Act, 1988',
    description: 'Governs motor vehicle registration, insurance, accident claims, and traffic offences.',
    reference_url: 'https://www.indiacode.nic.in/bitstream/123456789/1798/1/198859.pdf',
  },

  // ═══════════════════════════════════════════════════════════════════
  // DISPUTE RESOLUTION
  // ═══════════════════════════════════════════════════════════════════
  ARBITRATION_ACT: {
    act_key: 'ARBITRATION_ACT',
    act_name: 'Arbitration and Conciliation Act, 1996',
    description: 'Framework for arbitration agreements, seat of arbitration, and dispute resolution procedures.',
    reference_url: 'https://www.advocatekhoj.com/library/bareacts/arbitrationandconciliation/index.php',
  },

  // ═══════════════════════════════════════════════════════════════════
  // MSME, SPACE, DRONES & SECTOR-SPECIFIC
  // ═══════════════════════════════════════════════════════════════════
  MSMED_ACT: {
    act_key: 'MSMED_ACT',
    act_name: 'Micro, Small and Medium Enterprises Development Act, 2006',
    description: 'Mandates timely payment to MSME suppliers (within 45 days) and provides facilitation councils for disputes.',
    reference_url: 'https://msme.gov.in/acts-rules',
  },
  DRONE_RULES: {
    act_key: 'DRONE_RULES',
    act_name: 'The Drone Rules, 2021',
    description: 'Governs registration, operation, and airspace restrictions for unmanned aircraft systems.',
    reference_url: 'https://www.civilaviation.gov.in/',
  },
  SPACE_POLICY: {
    act_key: 'SPACE_POLICY',
    act_name: 'Indian Space Policy, 2023',
    description: 'Opens the space sector to private participation and establishes IN-SPACe as the regulatory body.',
    reference_url: 'https://www.isro.gov.in/IndianSpacePolicy2023.html',
  },
  RTI_ACT: {
    act_key: 'RTI_ACT',
    act_name: 'Right to Information Act, 2005',
    description: 'Grants citizens the right to access government records and mandates proactive disclosure.',
    reference_url: 'https://rti.gov.in/',
  },
  TOBACCO_ACT: {
    act_key: 'TOBACCO_ACT',
    act_name: 'Cigarettes and Other Tobacco Products Act, 2003',
    description: 'Prohibits advertising of tobacco products and regulates packaging and labeling.',
    reference_url: 'https://www.indiacode.nic.in/',
  },

  // ═══════════════════════════════════════════════════════════════════
  // RBI & ADVERTISING GUIDELINES
  // ═══════════════════════════════════════════════════════════════════
  RBI_DIGITAL_LENDING: {
    act_key: 'RBI_DIGITAL_LENDING',
    act_name: 'RBI Guidelines on Digital Lending, 2022',
    description: 'Regulates digital lending by mandating KYC, disclosure of all-inclusive APR, and borrower rights.',
    reference_url: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12382',
  },
  INFLUENCER_GUIDELINES: {
    act_key: 'INFLUENCER_GUIDELINES',
    act_name: 'ASCI Guidelines for Influencer Advertising in Digital Media',
    description: 'Mandates disclosure labels for paid promotions, affiliate links, and gifted products.',
    reference_url: 'https://www.ascionline.in/',
  },

  // ═══════════════════════════════════════════════════════════════════
  // CASE LAW & GENERIC
  // ═══════════════════════════════════════════════════════════════════
  CASE_LAW: {
    act_key: 'CASE_LAW',
    act_name: 'Judicial Precedent (Supreme Court / High Court)',
    description: 'Legally binding decisions set by superior courts governing interpretation and application of statutory law.',
    reference_url: 'https://main.sci.gov.in/judgments/',
  },
  OTHER: {
    act_key: 'OTHER',
    act_name: 'General Indian Contract & Civic Laws',
    description: 'Other relevant civic provisions governing legal contracts and agreements.',
    reference_url: 'https://www.indiacode.nic.in/',
  },
};

module.exports = { LAW_REFERENCES };
