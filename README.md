# High Throughput Job Scheduler

A production-ready job scheduler built with Node.js, Express, and MongoDB. Designed for high concurrency with at-least-once execution guarantees.

## Architecture Overview

### System Components

1. **HTTP API Layer** - Express server handling REST endpoints for job management
2. **Scheduler Core** - Poll-based scheduler that fetches due jobs from MongoDB
3. **Job Executor** - Manages concurrent job execution with retry logic
4. **MongoDB Storage** - Stores jobs, schedules, and full execution history

### Data Flow

```
1. Client creates job via POST /api/jobs
2. Job stored in MongoDB with nextRunAt calculated from cron expression
3. Scheduler polls MongoDB every 1 second for due jobs (nextRunAt <= now)
4. Due jobs fetched up to MAX_CONCURRENT_JOBS limit
5. Executor runs jobs concurrently (HTTP POST to external APIs)
6. Execution recorded in job_executions collection
7. On completion, nextRunAt updated for next execution
8. Failed jobs retried with exponential backoff
```

### Key Design Decisions

**Why Poll-Based Instead of Event-Driven?**
- Simpler to reason about and debug
- No complex distributed locking needed
- Works well with MongoDB's atomic operations
- Easy to scale horizontally with proper job locking (future enhancement)

**Why MongoDB Only?**
- Single source of truth for all state
- Strong consistency for job scheduling
- Indexes on nextRunAt + enabled ensure fast queries
- No need for separate message queue infrastructure

**At-Least-Once Guarantee**
- Job's nextRunAt updated BEFORE execution starts
- If server crashes mid-execution, job will be picked up again
- Idempotent endpoints recommended on receiving side
- Execution history preserved for auditing

**Concurrency Control**
- In-memory Map tracks running jobs to prevent duplicates
- MAX_CONCURRENT_JOBS limits parallel executions
- Jobs execute in separate async contexts (non-blocking)

### Trade-offs

**Pros:**
- Simple architecture, easy to understand
- Reliable with full execution history
- Scales vertically well (increase MAX_CONCURRENT_JOBS)
- No external dependencies beyond MongoDB

**Cons:**
- Poll interval creates minimum 1-second schedule precision
- Single instance only (horizontal scaling requires distributed locking)
- At-least-once means possible duplicate executions on crashes
- Long-running jobs block concurrency slots

**Future Enhancements:**
- Add distributed locking for horizontal scaling
- Implement job priorities
- Add job chaining / dependencies
- Support for different execution types (exactly-once, at-most-once)
- Dead letter queue for permanently failed jobs

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/job_scheduler
SCHEDULER_POLL_INTERVAL=1000
MAX_CONCURRENT_JOBS=10
JOB_RETRY_ATTEMPTS=3
JOB_RETRY_DELAY=5000
```

## Running the Server

```bash
npm start
```

## MongoDB Collections

### jobs

Stores job definitions and schedules.

```javascript
{
  _id: ObjectId,
  schedule: "0 */5 * * * *",        // cron with seconds
  endpoint: "https://api.example.com/webhook",
  method: "POST",
  headers: { "Authorization": "Bearer token" },
  body: { "key": "value" },
  executionType: "AT_LEAST_ONCE",
  enabled: true,
  retryAttempts: 3,
  retryDelay: 5000,
  nextRunAt: ISODate("2024-01-01T12:00:00Z"),
  lastRunAt: ISODate("2024-01-01T11:55:00Z"),
  createdAt: ISODate("2024-01-01T10:00:00Z"),
  updatedAt: ISODate("2024-01-01T11:55:00Z")
}
```

**Indexes:**
- `{ nextRunAt: 1, enabled: 1 }` - Critical for scheduler queries
- `{ nextRunAt: 1 }` - Fast due job lookups
- `{ enabled: 1 }` - Filter active jobs

### job_executions

Full history of every job execution.

```javascript
{
  _id: ObjectId,
  jobId: ObjectId,
  status: "success",                // success | failure | running
  startedAt: ISODate("2024-01-01T12:00:00Z"),
  completedAt: ISODate("2024-01-01T12:00:02Z"),
  duration: 2000,                   // milliseconds
  responseCode: 200,
  responseBody: "{\"status\":\"ok\"}",
  errorMessage: null,
  attempt: 1,
  scheduledAt: ISODate("2024-01-01T12:00:00Z")
}
```

**Indexes:**
- `{ jobId: 1, startedAt: -1 }` - Fetch job execution history
- `{ status: 1 }` - Query by success/failure
- `{ startedAt: -1 }` - Recent executions

## API Endpoints

### Create Job

```bash
POST /api/jobs
Content-Type: application/json

{
  "schedule": "0 */5 * * * *",
  "endpoint": "https://api.example.com/webhook",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN",
    "Content-Type": "application/json"
  },
  "body": {
    "event": "scheduled_task",
    "timestamp": "{{timestamp}}"
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "jobId": "507f1f77bcf86cd799439011",
    "schedule": "0 */5 * * * *",
    "endpoint": "https://api.example.com/webhook",
    "nextRunAt": "2024-01-01T12:05:00.000Z"
  }
}
```

### List Jobs

```bash
GET /api/jobs?page=1&limit=20
```

### Get Job Details

```bash
GET /api/jobs/:jobId
```

### Update Job

```bash
PUT /api/jobs/:jobId
Content-Type: application/json

{
  "schedule": "0 */10 * * * *",
  "enabled": true
}
```

### Delete Job

```bash
DELETE /api/jobs/:jobId
```

### Get Job Executions

```bash
GET /api/jobs/:jobId/executions?limit=5
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "jobId": "507f1f77bcf86cd799439011",
      "status": "success",
      "startedAt": "2024-01-01T12:00:00.000Z",
      "completedAt": "2024-01-01T12:00:02.000Z",
      "duration": 2000,
      "responseCode": 200,
      "attempt": 1
    }
  ]
}
```

### Health Check

```bash
GET /api/observability/health
```

Response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "scheduler": {
    "isRunning": true,
    "runningJobs": 3,
    "maxConcurrentJobs": 10,
    "pollInterval": 1000
  }
}
```

### System Stats

```bash
GET /api/observability/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "executions": {
      "total": 1500,
      "successful": 1450,
      "failed": 50,
      "last24Hours": 288
    },
    "scheduler": {
      "isRunning": true,
      "runningJobs": 3,
      "maxConcurrentJobs": 10
    }
  }
}
```

### Recent Failures

```bash
GET /api/observability/failures?limit=10
```

## Cron Expression Format

Supports 6-field cron expressions with second precision:

```
 ┌───────────── second (0 - 59)
 │ ┌───────────── minute (0 - 59)
 │ │ ┌───────────── hour (0 - 23)
 │ │ │ ┌───────────── day of month (1 - 31)
 │ │ │ │ ┌───────────── month (1 - 12)
 │ │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
 │ │ │ │ │ │
 * * * * * *
```

**Examples:**

- `0 */5 * * * *` - Every 5 minutes at 0 seconds
- `*/30 * * * * *` - Every 30 seconds
- `0 0 */2 * * *` - Every 2 hours
- `0 0 9 * * 1-5` - Every weekday at 9:00 AM
- `0 30 14 1 * *` - 2:30 PM on the 1st of every month

## Project Structure

```
job-scheduler/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection and indexes
│   ├── models/
│   │   ├── Job.js               # Job model with CRUD operations
│   │   └── JobExecution.js      # Execution history model
│   ├── scheduler/
│   │   ├── Scheduler.js         # Main scheduler loop
│   │   └── JobExecutor.js       # Job execution with retry logic
│   ├── services/
│   │   └── JobService.js        # Business logic layer
│   ├── routes/
│   │   ├── jobRoutes.js         # Job management endpoints
│   │   └── observabilityRoutes.js # Health and stats endpoints
│   ├── utils/
│   │   └── cronParser.js        # Cron expression parser
│   └── server.js                # Express app and startup
├── examples/
│   └── sample-job.json          # Example job definition
├── .env.example
├── package.json
└── README.md
```

## Testing Locally

1. Start MongoDB:
```bash
mongod --dbpath ./data
```

2. Start the scheduler:
```bash
npm start
```

3. Create a test job:
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d @examples/sample-job.json
```

4. Check health:
```bash
curl http://localhost:3000/api/observability/health
```

5. View executions:
```bash
curl http://localhost:3000/api/jobs/{jobId}/executions
```

## Error Handling

- Failed jobs automatically retry up to `JOB_RETRY_ATTEMPTS` times
- Retry delay configurable via `JOB_RETRY_DELAY` (default 5 seconds)
- All failures logged with error messages and response codes
- Check `/api/observability/failures` for recent failed executions

## Performance Characteristics

- **Schedule Precision:** ~1 second (configurable via SCHEDULER_POLL_INTERVAL)
- **Max Throughput:** Depends on MAX_CONCURRENT_JOBS and job duration
- **Memory:** O(n) where n = number of currently running jobs
- **Database Load:** One query per poll interval + writes per execution

**Example:** With 1-second poll interval and 10 concurrent jobs:
- Can handle 10 jobs/second if each job takes 1 second
- Can handle 100 jobs/second if each job takes 100ms
- Schedule drift minimal for jobs under 1 second duration

## Production Checklist

- [ ] Set up MongoDB replica set for high availability
- [ ] Configure appropriate MAX_CONCURRENT_JOBS for your workload
- [ ] Set up monitoring on `/api/observability/health`
- [ ] Alert on high failure rates from `/api/observability/failures`
- [ ] Enable MongoDB authentication
- [ ] Use environment variables for sensitive data
- [ ] Set up log aggregation for execution history
- [ ] Consider TTL index on job_executions for old data cleanup
- [ ] Implement rate limiting on API endpoints
- [ ] Add authentication/authorization for API access

## License

MIT
