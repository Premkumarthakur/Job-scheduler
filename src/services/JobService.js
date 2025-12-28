const Job = require('../models/Job');
const JobExecution = require('../models/JobExecution');
const { validateCronExpression, getNextRunTime } = require('../utils/cronParser');

class JobService {

  // Create and schedule a new job
  async createJob(jobData) {
    // Basic cron validation
    if (!validateCronExpression(jobData.schedule)) {
      throw new Error('Invalid cron expression. Format: second minute hour day month dayOfWeek');
    }

    // Ensure endpoint looks like a real URL
    if (!jobData.endpoint || !jobData.endpoint.startsWith('http')) {
      throw new Error('Invalid endpoint. Must be a valid HTTP/HTTPS URL');
    }

    const job = await Job.create(jobData);

    // Pre-calculate next run time for scheduler
    const nextRun = getNextRunTime(job.schedule);
    if (nextRun) {
      await Job.updateNextRunAt(job._id, nextRun);
    }

    return job;
  }

  // Update job config (schedule / endpoint)
  async updateJob(jobId, updates) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Validate updated schedule if present
    if (updates.schedule && !validateCronExpression(updates.schedule)) {
      throw new Error('Invalid cron expression');
    }

    // Validate updated endpoint if present
    if (updates.endpoint && !updates.endpoint.startsWith('http')) {
      throw new Error('Invalid endpoint');
    }

    const success = await Job.update(jobId, updates);

    // Recompute next run if schedule changed
    if (updates.schedule) {
      const nextRun = getNextRunTime(updates.schedule);
      if (nextRun) {
        await Job.updateNextRunAt(jobId, nextRun);
      }
    }

    return success;
  }

  // Fetch single job
  async getJob(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  }

  // List jobs with pagination
  async listJobs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return await Job.list({}, skip, limit);
  }

  // Delete job by id
  async deleteJob(jobId) {
    const success = await Job.delete(jobId);
    if (!success) {
      throw new Error('Job not found');
    }
    return success;
  }

  // Get recent executions for a job
  async getJobExecutions(jobId, limit = 5) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    return await JobExecution.findByJobId(jobId, limit);
  }

  // Aggregate execution stats
  async getStats() {
    const executionStats = await JobExecution.getStats();
    return executionStats;
  }

  // Fetch recent failed executions
  async getRecentFailures(limit = 10) {
    return await JobExecution.getRecentFailures(limit);
  }
}

module.exports = new JobService();
