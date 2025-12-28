const axios = require('axios');
const JobExecution = require('../models/JobExecution');

class JobExecutor {
  constructor() {
    // Track running jobs
    this.runningJobs = new Map();
  }

  async execute(job) {
    const jobId = job._id.toString();

    // Avoid duplicate execution
    if (this.runningJobs.has(jobId)) {
      return;
    }

    this.runningJobs.set(jobId, true);

    try {
      await this.executeWithRetry(job, 1);
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  async executeWithRetry(job, attempt) {
    // Create execution entry
    const execution = await JobExecution.create({
      jobId: job._id.toString(),
      attempt,
      scheduledAt: job.nextRunAt
    });

    const startTime = Date.now();

    try {
      const response = await this.makeHttpRequest(job);
      const duration = Date.now() - startTime;

      await JobExecution.updateSuccess(
        execution._id,
        response.status,
        response.data,
        duration
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      await JobExecution.updateFailure(
        execution._id,
        error.message,
        error.response?.status || null,
        duration
      );

      // Retry if allowed
      if (attempt < job.retryAttempts) {
        await this.delay(job.retryDelay);
        await this.executeWithRetry(job, attempt + 1);
      }
    }
  }

  async makeHttpRequest(job) {
    const config = {
      method: job.method || 'POST',
      url: job.endpoint,
      headers: job.headers || {},
      timeout: 30000
    };

    // Add body for write requests
    if (['POST', 'PUT', 'PATCH'].includes(job.method)) {
      config.data = job.body;
    }

    return axios(config);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRunningJobsCount() {
    return this.runningJobs.size;
  }
}

module.exports = JobExecutor;
