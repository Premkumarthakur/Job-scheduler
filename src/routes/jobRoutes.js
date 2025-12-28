const express = require('express');
const router = express.Router();
const JobService = require('../services/JobService');

// Create a new job
router.post('/', async (req, res) => {
  try {
    const job = await JobService.createJob(req.body);

    res.status(201).json({
      success: true,
      data: {
        jobId: job._id,
        schedule: job.schedule,
        endpoint: job.endpoint,
        nextRunAt: job.nextRunAt
      }
    });
  } catch (error) {
    // Validation / bad input
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// List jobs (paginated)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const jobs = await JobService.listJobs(page, limit);

    res.json({
      success: true,
      data: jobs,
      page,
      limit
    });
  } catch (error) {
    // Unexpected server error
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single job (used for edit)
router.get('/:jobId', async (req, res) => {
  try {
    const job = await JobService.getJob(req.params.jobId);

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    // Job not found
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Update job config
router.put('/:jobId', async (req, res) => {
  try {
    await JobService.updateJob(req.params.jobId, req.body);
    const job = await JobService.getJob(req.params.jobId);

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    // Invalid update
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete job
router.delete('/:jobId', async (req, res) => {
  try {
    await JobService.deleteJob(req.params.jobId);

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    // Job not found
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Get last executions for a job
router.get('/:jobId/executions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const executions = await JobService.getJobExecutions(
      req.params.jobId,
      limit
    );

    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    // Invalid job or no executions
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
