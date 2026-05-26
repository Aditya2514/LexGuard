const express = require('express');
const router = express.Router();
const RewriteFeedback = require('../models/RewriteFeedback');

// POST /api/feedback/rewrite
// Stores user feedback (thumbs up/down) on Agent 8's redline rewrites
router.post('/rewrite', async (req, res) => {
    try {
        const { clauseId, contractId, approved, userComment, originalText, rewrittenText } = req.body;

        if (!clauseId || !contractId || approved === undefined || !originalText || !rewrittenText) {
            return res.status(400).json({ error: 'Missing required fields for rewrite feedback' });
        }

        const feedback = new RewriteFeedback({
            clauseId,
            contractId,
            approved,
            userComment,
            originalText,
            rewrittenText
        });

        await feedback.save();
        res.status(201).json({ message: 'Feedback saved successfully', feedbackId: feedback._id });
    } catch (err) {
        console.error('Error saving rewrite feedback:', err);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

module.exports = router;
