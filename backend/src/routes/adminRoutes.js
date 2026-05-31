const express = require('express');
const router = express.Router();
const SystemMetric = require('../models/SystemMetric');
const { protect, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/admin/metrics/summary
 * @desc    Get top-line metrics summary (last 7 days)
 * @access  Private/Admin
 */
router.get('/metrics/summary', protect, isAdmin, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const tokenStats = await SystemMetric.aggregate([
      { $match: { metricType: 'API_TOKEN_USAGE', createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$provider', totalTokens: { $sum: '$value' } } }
    ]);

    const latencyStats = await SystemMetric.aggregate([
      { $match: { metricType: 'LLM_LATENCY', createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$provider', averageLatency: { $avg: '$value' } } }
    ]);

    res.json({ success: true, data: { tokenStats, latencyStats } });
  } catch (error) {
    console.error('Error fetching admin metrics summary:', error);
    res.status(500).json({ success: false, message: 'Server error fetching metrics summary' });
  }
});

/**
 * @route   GET /api/admin/metrics/timeseries
 * @desc    Get daily time-series metrics
 * @access  Private/Admin
 */
router.get('/metrics/timeseries', protect, isAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const tokenTrends = await SystemMetric.aggregate([
      { $match: { metricType: 'API_TOKEN_USAGE', createdAt: { $gte: thirtyDaysAgo } } },
      { 
        $group: { 
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            provider: '$provider'
          },
          totalTokens: { $sum: '$value' } 
        } 
      },
      { $sort: { '_id.date': 1 } }
    ]);

    const latencyTrends = await SystemMetric.aggregate([
      { $match: { metricType: 'LLM_LATENCY', createdAt: { $gte: thirtyDaysAgo } } },
      { 
        $group: { 
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            provider: '$provider'
          },
          averageLatency: { $avg: '$value' } 
        } 
      },
      { $sort: { '_id.date': 1 } }
    ]);

    res.json({ success: true, data: { tokenTrends, latencyTrends } });
  } catch (error) {
    console.error('Error fetching admin metrics timeseries:', error);
    res.status(500).json({ success: false, message: 'Server error fetching timeseries' });
  }
});

module.exports = router;
