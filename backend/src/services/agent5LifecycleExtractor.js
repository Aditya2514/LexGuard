const mongoose = require('mongoose');
const { callLLM } = require('./aiClient');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');

const SYSTEM_PROMPT = `You are a strict, forensic contract date auditor. Your only job is to extract critical lifecycle dates from the text.
Look for explicitly stated Expiration Dates, Auto-Renewal Dates, or Notice Period deadlines.
You must perform any relative date math (e.g., "30 days before Dec 31, 2026") and convert everything to absolute 'YYYY-MM-DD' dates.
If the contract mentions relative durations from "the Effective Date", try to find the Effective Date and calculate the absolute dates. If the Effective Date is unknown, estimate based on the current year (2026) or skip it if impossible to guess safely.

Output a strictly formatted JSON array of objects. Do not include any conversational text.
Format:
[
  {
    "event_type": "RENEWAL", // Must be RENEWAL, EXPIRATION, or NOTICE_PERIOD
    "date": "2026-12-31",
    "description": "The contract automatically renews on this date for another 12 months."
  }
]

If no lifecycle dates are found, return an empty array: []
`;

/**
 * Extracts lifecycle dates from the contract using Agent 5.
 * Runs as a sidecar process in the queue.
 */
async function runAgent5LifecycleExtractor(contractId) {
  try {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const clauses = await Clause.find({ contractId }).lean();
    if (clauses.length === 0) return;

    const contractText = clauses.map(c => `[ID: ${c._id.toString()}] ${c.rawText}`).join('\n\n');
    const prompt = `Extract absolute lifecycle event dates from the following contract:\n\n${contractText}`;

    // Force JSON output
    let extractedData = await callLLM({
      systemPrompt: SYSTEM_PROMPT,
      userContent: prompt,
      jsonMode: true
    });

    if (!Array.isArray(extractedData)) {
      if (extractedData.lifecycle_events && Array.isArray(extractedData.lifecycle_events)) {
        extractedData = extractedData.lifecycle_events;
      } else if (extractedData.events && Array.isArray(extractedData.events)) {
        extractedData = extractedData.events;
      } else {
        extractedData = [];
      }
    }

    const lifecycle_events = [];
    for (const item of extractedData) {
        if (!item.date || !item.event_type) continue;
        
        // Parse date
        const parsedDate = new Date(item.date);
        if (isNaN(parsedDate.getTime())) continue; // Invalid date
        
        lifecycle_events.push({
            event_type: item.event_type,
            date: parsedDate,
            description: item.description || `Contract ${item.event_type} event`,
            notified: false
        });
    }

    // Save to contract
    if (lifecycle_events.length > 0) {
        await Contract.findByIdAndUpdate(contractId, {
            $push: { lifecycle_events: { $each: lifecycle_events } }
        });
        console.log(`[Agent 5] Lifecycle Extractor found ${lifecycle_events.length} critical dates.`);
    }

  } catch (err) {
    console.error(`[Agent 5] Lifecycle Extractor failed: ${err.message}`);
    // Do not throw, sidecar process
  }
}

module.exports = {
  runAgent5LifecycleExtractor
};
