# Architecture Deep Dive

Technical details for developers extending or maintaining the job scheduler.

## Core Components

### 1. Database Layer (src/config/database.js)

**Responsibilities:**
- MongoDB connection management
- Index creation for performance
- Connection pooling via native MongoDB driver

**Key Indexes:**
```javascript
// Critical for scheduler performance
jobs: { nextRunAt: 1, enabled: 1 }
jobs: { nextRunAt: 1 }

// For execution history queries
job_executions: { jobId: 1, startedAt: -1 }
job_executions: { status: 1 }
```

**Why these indexes?**
- `nextRunAt + enabled` allows the scheduler to efficiently query due jobs
- `jobId + startedAt` enables fast execution history retrieval
- MongoDB query planner uses these for sub-millisecond lookups even with millions of records

### 2. Cron Parser (src/utils/cronParser.js)

**Implementation Details:**

Custom parser supporting 6-field format (with seconds). Does NOT use node-cron for parsing because:
1. Need second-level precision
2. Need predictable nextRunAt calculation
3. Avoid dependency on external cron libraries

**Algorithm:**
```javascript
1. Parse expression into 6 fields
2. Start from current time + 1 second
3. Check if time matches all cron fields
4. Iterate forward until match found
5. Return next execution time
```

**Limitations:**
- Simple pattern matching (no complex expressions like "last Friday")
- Max iteration: ~1 year of seconds (performance cutoff)
- No timezone support (uses system time)

**Future Enhancements:**
- Add timezone support
- Support "L" (last day of month)
- Support "W" (nearest weekday)

### 3. Job Executor (src/scheduler/JobExecutor.js)

**Concurrency Model:**

```javascript
runningJobs = Map<jobId, executionId>
```

- Prevents duplicate executions of same job
- In-memory tracking (lost on restart)
- No distributed locking (single instance only)

**Retry Logic:**

```javascript
attempt 1 → fail → wait 5s → attempt 2 → fail → wait 5s → attempt 3 → fail → stop
```

- Linear backoff (not exponential)
- Each attempt creates separate execution record
- Final attempt marked as failure

**HTTP Request Handling:**
- 30-second timeout per request
- Axios library for HTTP client
- Response body truncated to 1000 chars for storage

**Error Handling:**
- Network errors caught and logged
- HTTP 4xx/5xx treated as failures
- Timeout errors trigger retry

### 4. Scheduler (src/scheduler/Scheduler.js)

**Poll Loop Design:**

```javascript
while (isRunning) {
  1. Count currently running jobs
  2. Calculate available slots
  3. Query MongoDB for due jobs (limit = available slots)
  4. Update each job's nextRunAt
  5. Spawn executor for each job (non-blocking)
  6. Sleep for pollInterval
}
```

**Why setTimeout vs setInterval?**
- `setTimeout` ensures poll completes before next one starts
- Prevents overlapping polls if MongoDB query is slow
- More predictable behavior under load

**Race Conditions:**

**Scenario 1: Job picked up twice**
- Prevented by `runningJobs` Map check
- If job already running, skip execution

**Scenario 2: nextRunAt updated after execution starts**
- Update happens BEFORE execution
- If crash occurs, job will run again (at-least-once guarantee)

**Scenario 3: Multiple scheduler instances**
- NOT handled (single instance assumption)
- Would require distributed locking (Redis, MongoDB transactions)

### 5. Models (src/models/)

**Job Model:**
- Static methods for CRUD operations
- No ORM (direct MongoDB driver usage)
- Validation in service layer, not model

**JobExecution Model:**
- Write-heavy (every execution logged)
- No updates after creation (except status change)
- Consider TTL index for old executions

**Schema Design Choices:**

```javascript
// Why store nextRunAt instead of calculating on-the-fly?
nextRunAt: Date  // Pre-calculated for fast queries

// Why store both startedAt and completedAt?
startedAt: Date   // For duration calculation
completedAt: Date // For status tracking

// Why truncate responseBody?
responseBody: String(1000)  // Prevent large document storage
```

### 6. Service Layer (src/services/JobService.js)

**Separation of Concerns:**
- Routes handle HTTP (request/response)
- Services handle business logic
- Models handle data access

**Validation Strategy:**
- Cron expression validated before save
- Endpoint validated (must be HTTP/HTTPS)
- MongoDB ObjectId validation in models

## Data Flow Diagrams

### Job Creation Flow

```
Client → POST /api/jobs
       ↓
   jobRoutes.js
       ↓
   JobService.createJob()
       ↓
   Validate cron expression
       ↓
   Job.create() → MongoDB
       ↓
   Calculate nextRunAt
       ↓
   Job.updateNextRunAt() → MongoDB
       ↓
   Return jobId to client
```

### Execution Flow

```
Scheduler poll loop (every 1s)
       ↓
Query jobs WHERE nextRunAt <= NOW AND enabled = true
       ↓
Update nextRunAt to next occurrence
       ↓
For each job:
       ↓
   JobExecutor.execute()
       ↓
   Check if already running (skip if yes)
       ↓
   JobExecution.create() → MongoDB (status: running)
       ↓
   Make HTTP request
       ↓
   Success? → JobExecution.updateSuccess()
   Failure? → JobExecution.updateFailure() + retry
```

## Performance Characteristics

### Throughput Calculations

**Variables:**
- P = Poll interval (default 1000ms)
- C = Max concurrent jobs (default 10)
- D = Average job duration

**Theoretical max throughput:**
```
Jobs/second = C / D (if D < P)
Jobs/second = C * (1000 / P) (if D > P)
```

**Example:**
- P = 1000ms, C = 10, D = 500ms
- Throughput = 10 / 0.5 = 20 jobs/second

**Bottlenecks:**
1. MongoDB query time (should be <10ms with proper indexes)
2. HTTP request duration (external API response time)
3. Poll interval (minimum schedule precision)

### Memory Usage

**Per Job:**
- Job document: ~500 bytes
- Running job tracking: 64 bytes (Map entry)

**Per Execution:**
- Execution document: ~300 bytes

**Example:**
- 1000 jobs, 10 running = ~500KB + 640 bytes ≈ 500KB
- 1M executions = ~300MB in MongoDB

### Database Load

**Queries per second:**
- Scheduler poll: 1 query/second
- NextRunAt updates: N queries (N = jobs executed)
- Execution creates: N queries
- Execution updates: N queries

**With 10 jobs/second:**
- Reads: 1/second (poll)
- Writes: 30/second (nextRunAt + create + update)

## Scaling Strategies

### Vertical Scaling

**Increase MAX_CONCURRENT_JOBS:**
- Pro: Simple, no code changes
- Con: Limited by single server resources
- Recommended: 10-50 concurrent jobs per instance

**Decrease SCHEDULER_POLL_INTERVAL:**
- Pro: Better schedule precision
- Con: More database queries
- Recommended: 500ms-1000ms

### Horizontal Scaling (Future)

**Challenges:**
1. Need distributed locking
2. Job ownership assignment
3. Coordination between instances

**Solution 1: Partition by Job ID**
```javascript
instance1 handles jobId % 3 === 0
instance2 handles jobId % 3 === 1
instance3 handles jobId % 3 === 2
```

**Solution 2: Lease-based locking**
```javascript
// Add to job document
{
  lockedBy: "instance-1",
  lockedUntil: ISODate("...")
}

// Query in scheduler
{
  nextRunAt: { $lte: now },
  $or: [
    { lockedBy: null },
    { lockedUntil: { $lt: now } }
  ]
}
```

## Security Considerations

### API Authentication

**Current:** None (add middleware)

**Recommendation:**
```javascript
// src/middleware/auth.js
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Apply to routes
app.use('/api/jobs', authenticate, jobRoutes);
```

### Job Endpoint Security

**Current:** Jobs can POST to any endpoint

**Risks:**
- Server-Side Request Forgery (SSRF)
- Internal network access
- Credentials exposure in job definitions

**Mitigations:**
1. Whitelist allowed domains
2. Prevent private IP ranges
3. Encrypt sensitive headers in database
4. Rate limit job creation

### MongoDB Security

**Recommendations:**
1. Enable authentication
2. Use role-based access control
3. Encrypt connection (TLS)
4. Regular backups

## Testing Strategy

### Unit Tests

**Models:**
```javascript
describe('Job.create', () => {
  it('should create job with default values')
  it('should validate required fields')
})
```

**Cron Parser:**
```javascript
describe('getNextRunTime', () => {
  it('should calculate next run for simple cron')
  it('should handle edge cases (month boundaries)')
})
```

### Integration Tests

**API Endpoints:**
```javascript
describe('POST /api/jobs', () => {
  it('should create job and return jobId')
  it('should reject invalid cron expression')
})
```

**Scheduler:**
```javascript
describe('Scheduler', () => {
  it('should execute due jobs')
  it('should respect MAX_CONCURRENT_JOBS')
  it('should retry failed jobs')
})
```

### Load Tests

**Tools:** k6, Apache Bench

**Scenarios:**
1. Create 1000 jobs rapidly
2. Execute 100 concurrent jobs
3. Query execution history under load

## Monitoring & Observability

### Key Metrics

**RED Method:**
1. **Rate:** Jobs executed per second
2. **Errors:** Failed jobs per second
3. **Duration:** Average job execution time

**Implementation:**
```javascript
// Add to observability routes
GET /api/observability/metrics

{
  "rate": {
    "1min": 10.5,
    "5min": 12.3,
    "15min": 11.8
  },
  "errors": {
    "1min": 0.5,
    "5min": 0.3
  },
  "duration": {
    "p50": 150,
    "p95": 500,
    "p99": 1000
  }
}
```

### Alerting Rules

1. **High failure rate:** >10% failures in 5 minutes
2. **Scheduler stopped:** No health check response
3. **Database unavailable:** Connection errors
4. **Queue buildup:** >100 due jobs not executing

## Common Issues & Solutions

### Issue: Jobs not executing on time

**Causes:**
- Poll interval too high
- Too many concurrent jobs
- Slow external APIs

**Solutions:**
- Reduce poll interval
- Increase MAX_CONCURRENT_JOBS
- Add timeout to job requests

### Issue: Duplicate executions

**Causes:**
- Multiple scheduler instances
- Server restart during execution

**Solutions:**
- Run single instance only
- Implement distributed locking
- Make external endpoints idempotent

### Issue: Memory leak

**Causes:**
- runningJobs Map not cleaned up
- Event listeners not removed

**Solutions:**
- Ensure Map cleanup on job completion
- Use try/finally blocks

### Issue: Database bloat

**Causes:**
- Unlimited execution history
- Large response bodies

**Solutions:**
- Add TTL index: `db.job_executions.createIndex({ "completedAt": 1 }, { expireAfterSeconds: 2592000 })`
- Truncate response bodies
- Archive old executions

## Extension Points

### Custom Execution Types

```javascript
// Add to Job model
executionType: "EXACTLY_ONCE"

// Implement in JobExecutor
if (job.executionType === "EXACTLY_ONCE") {
  // Use distributed locking
  const lock = await acquireLock(job._id);
  if (!lock) return;
  try {
    await execute(job);
  } finally {
    await releaseLock(lock);
  }
}
```

### Job Priorities

```javascript
// Add to Job model
priority: 1-10

// Update scheduler query
const dueJobs = await Job.collection()
  .find({ nextRunAt: { $lte: now }, enabled: true })
  .sort({ priority: -1, nextRunAt: 1 })
  .limit(availableSlots)
  .toArray();
```

### Webhooks on Job Events

```javascript
// Add to Job model
webhooks: {
  onSuccess: "https://...",
  onFailure: "https://..."
}

// Call in JobExecutor
if (job.webhooks?.onSuccess) {
  await axios.post(job.webhooks.onSuccess, executionData);
}
```

## License

MIT
