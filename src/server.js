const express = require('express');
const { connectDB, closeDB } = require('./config/database');
const Scheduler = require('./scheduler/Scheduler');
const jobRoutes = require('./routes/jobRoutes');
const observabilityRoutes = require('./routes/observabilityRoutes');
const cors=require('cors')


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use('/api/jobs', jobRoutes);
app.use('/api/observability', observabilityRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'Job Scheduler',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      jobs: '/api/jobs',
      health: '/api/observability/health',
      stats: '/api/observability/stats',
      failures: '/api/observability/failures'
    }
  });
});

let scheduler;

async function start() {
  try {
    await connectDB();

    scheduler = new Scheduler({
      pollInterval: parseInt(process.env.SCHEDULER_POLL_INTERVAL) || 1000,
      maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 10
    });

    app.set('scheduler', scheduler);

    await scheduler.start();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('\nShutting down gracefully...');

  if (scheduler) {
    await scheduler.stop();
  }

  await closeDB();

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
