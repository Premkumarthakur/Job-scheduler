const Job = require('../models/Job');
const JobExecutor = require('./JobExecutor');
const { getNextRunTime } = require('../utils/cronParser');

class Scheduler {
  constructor(options = {}) {
    this.pollInterval = options.pollInterval || 1000;
    this.maxConcurrentJobs = options.maxConcurrentJobs || 10;
    this.isRunning = false;
    this.executor = new JobExecutor();
    this.pollTimer = null;
  }

  async start() {
    // Prevent double start
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Scheduler started');

    await this.initializeJobs();
    this.schedulePoll();
  }

  async initializeJobs() {
    try {
      // Load jobs and ensure nextRunAt is set
      const jobs = await Job.list({ enabled: true });

      for (const job of jobs) {
        if (!job.nextRunAt) {
          const nextRun = getNextRunTime(job.schedule);
          if (nextRun) {
            await Job.updateNextRunAt(job._id, nextRun);
          }
        }
      }

      console.log(`Initialized ${jobs.length} jobs`);
    } catch (error) {
      console.error('Error initializing jobs:', error);
    }
  }

  schedulePoll() {
    // Poll using timeout to avoid overlapping cycles
    this.pollTimer = setTimeout(async () => {
      if (this.isRunning) {
        await this.pollAndExecute();
        this.schedulePoll();
      }
    }, this.pollInterval);
  }

  async pollAndExecute() {
    try {
      const runningCount = this.executor.getRunningJobsCount();
      const availableSlots = this.maxConcurrentJobs - runningCount;

      // No capacity to run more jobs
      if (availableSlots <= 0) {
        return;
      }

      const dueJobs = await Job.findDueJobs(availableSlots);

      if (dueJobs.length === 0) {
        return;
      }

      console.log(`Found ${dueJobs.length} due jobs, executing...`);

      for (const job of dueJobs) {
        // Update next run before execution
        const nextRun = getNextRunTime(job.schedule, new Date());
        await Job.updateNextRunAt(job._id, nextRun);

        this.executor.execute(job).catch(error => {
          console.error(`Error executing job ${job._id}:`, error);
        });
      }
    } catch (error) {
      console.error('Error in poll cycle:', error);
    }
  }

  async stop() {
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    console.log('Scheduler stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      runningJobs: this.executor.getRunningJobsCount(),
      maxConcurrentJobs: this.maxConcurrentJobs,
      pollInterval: this.pollInterval
    };
  }
}

module.exports = Scheduler;
