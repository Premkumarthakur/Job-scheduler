const express = require('express');
const router = express.Router();
const JobService = require('../services/JobService');

// Basic health check for scheduler
router.get('/health', (req, res) => {
  const scheduler = req.app.get('scheduler');
  const status = scheduler ? scheduler.getStatus() : null;

  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    scheduler: status
  });
});

// System stats (executions + scheduler state)
router.get('/stats', async (req, res) => {
  try {
    const stats = await JobService.getStats();
    const scheduler = req.app.get('scheduler');
    const schedulerStatus = scheduler ? scheduler.getStatus() : null;

    res.json({
      success: true,
      data: {
        executions: stats,
        scheduler: schedulerStatus
      }
    });
  } catch (error) {
    // Internal failure while collecting stats
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Recent job failures (for debugging)
router.get('/failures', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const failures = await JobService.getRecentFailures(limit);

    res.json({
      success: true,
      data: failures
    });
  } catch (error) {
    // Failed to fetch failure data
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
