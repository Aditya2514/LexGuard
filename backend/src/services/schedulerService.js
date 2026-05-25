const mongoose = require('mongoose');
const Contract = require('../models/Contract');
const { dispatchWebhooks } = require('./webhookDispatcher');

let schedulerInterval = null;

/**
 * Runs a frequent, lightweight check for any upcoming lifecycle events
 * (e.g., < 30 days away) that have not been notified yet.
 * Uses atomic Mongoose array updates to ensure horizontal scaling safety.
 */
async function checkUpcomingEvents() {
    try {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        // Find contracts that have at least one unnotified event <= 30 days from now.
        // We use $elemMatch to find the specific subdocument.
        const targetContracts = await Contract.find({
            lifecycle_events: {
                $elemMatch: {
                    notified: false,
                    date: { $lte: thirtyDaysFromNow, $gte: new Date() } // Within next 30 days
                }
            }
        });

        for (const contract of targetContracts) {
            // Because a contract can have multiple events, we need to atomically flag 
            // the specific one that is triggering today, to avoid race conditions 
            // if multiple cluster instances run this exact loop.

            // Find the specific event inside the array
            const eventIndex = contract.lifecycle_events.findIndex(e => 
                !e.notified && 
                e.date <= thirtyDaysFromNow && 
                e.date >= new Date()
            );

            if (eventIndex !== -1) {
                const event = contract.lifecycle_events[eventIndex];

                // Atomically update just that array element so another worker doesn't double-fire
                const updateQuery = {};
                updateQuery[`lifecycle_events.${eventIndex}.notified`] = true;

                const result = await Contract.updateOne(
                    { 
                        _id: contract._id, 
                        [`lifecycle_events.${eventIndex}.notified`]: false // Optimistic lock
                    },
                    { $set: updateQuery }
                );

                // If modifiedCount is 1, we successfully claimed the lock
                if (result.modifiedCount === 1) {
                    console.log(`⏰ [Scheduler] Triggering alert for Contract ${contract._id}: ${event.event_type} on ${event.date.toISOString().split('T')[0]}`);
                    
                    // Fire the webhook to the enterprise system
                    await dispatchWebhooks('contract.expiring', contract._id, {
                        event_type: event.event_type,
                        date: event.date,
                        description: event.description,
                        days_remaining: Math.ceil((event.date - new Date()) / (1000 * 60 * 60 * 24))
                    });
                }
            }
        }
    } catch (err) {
        console.error(`🚨 [Scheduler] Failed to check upcoming events:`, err.message);
    }
}

/**
 * Starts the native setInterval scheduler loop.
 */
function startScheduler() {
    if (schedulerInterval) return;
    
    console.log('⏰ [Scheduler] Native Lifecycle Scheduler started (Checking every 15 minutes)');
    
    // Check immediately on boot
    checkUpcomingEvents();

    // Run every 15 minutes (900,000 ms)
    schedulerInterval = setInterval(checkUpcomingEvents, 15 * 60 * 1000);
}

function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('🔌 [Scheduler] Stopped.');
    }
}

module.exports = {
    startScheduler,
    stopScheduler,
    checkUpcomingEvents // Exported for manual testing
};
