const Webhook = require('../models/Webhook');
const Contract = require('../models/Contract');
const crypto = require('crypto');

async function dispatchWebhooks(event, contractId, payload = {}) {
  try {
    const contract = await Contract.findById(contractId).select('userId originalFileName status overallRiskLevel');
    if (!contract) return;

    // Find all active webhooks for this user that subscribe to this event
    const webhooks = await Webhook.find({
      userId: contract.userId,
      isActive: true,
      events: event
    });

    if (webhooks.length === 0) return;

    const eventPayload = {
      event,
      contractId: contract._id,
      fileName: contract.originalFileName,
      status: contract.status,
      overallRiskLevel: contract.overallRiskLevel,
      timestamp: new Date().toISOString(),
      ...payload
    };

    const payloadString = JSON.stringify(eventPayload);

    // Fire off all webhooks concurrently
    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'LexGuard-Webhook-Dispatcher/1.0'
        };

        // Add HMAC signature if secret exists
        if (webhook.secret) {
          const signature = crypto.createHmac('sha256', webhook.secret).update(payloadString).digest('hex');
          headers['X-LexGuard-Signature'] = `sha256=${signature}`;
        }

        try {
          const response = await fetch(webhook.targetUrl, {
            method: 'POST',
            headers,
            body: payloadString
          });

          if (!response.ok) {
            console.error(`⚠️ [Webhook Dispatcher] Failed to deliver ${event} to ${webhook.targetUrl}. Status: ${response.status}`);
          } else {
            console.log(`✅ [Webhook Dispatcher] Delivered ${event} to ${webhook.targetUrl}`);
          }
        } catch (fetchErr) {
          console.error(`❌ [Webhook Dispatcher] Error delivering to ${webhook.targetUrl}:`, fetchErr.message);
        }
      })
    );

  } catch (error) {
    console.error('❌ [Webhook Dispatcher] Critical failure:', error.message);
  }
}

module.exports = { dispatchWebhooks };
