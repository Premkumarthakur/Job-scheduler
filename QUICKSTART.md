# Quick Start Guide

Get the job scheduler running in 5 minutes.

## Prerequisites

- Node.js 14+
- MongoDB running locally or remote connection string

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Start MongoDB** (if running locally):
```bash
mongod
```

3. **Start the scheduler:**
```bash
npm start
```

You should see:
```
Connected to MongoDB
Initialized X jobs
Scheduler started
Server running on port 3000
```

## Create Your First Job

Every 30 seconds job:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "*/30 * * * * *",
    "endpoint": "https://httpbin.org/post",
    "method": "POST",
    "body": {"test": "data"}
  }'
```

You'll receive a response with your `jobId`:
```json
{
  "success": true,
  "data": {
    "jobId": "507f1f77bcf86cd799439011",
    "schedule": "*/30 * * * * *",
    "endpoint": "https://httpbin.org/post",
    "nextRunAt": "2024-01-01T12:00:30.000Z"
  }
}
```

## View Execution History

```bash
curl http://localhost:3000/api/jobs/YOUR_JOB_ID/executions
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "status": "success",
      "startedAt": "2024-01-01T12:00:30.000Z",
      "duration": 150,
      "responseCode": 200,
      "attempt": 1
    }
  ]
}
```

## Check System Health

```bash
curl http://localhost:3000/api/observability/health
```

## Common Cron Patterns

| Pattern | Description |
|---------|-------------|
| `*/30 * * * * *` | Every 30 seconds |
| `0 */5 * * * *` | Every 5 minutes |
| `0 0 * * * *` | Every hour |
| `0 0 */6 * * *` | Every 6 hours |
| `0 0 9 * * *` | Daily at 9 AM |
| `0 0 9 * * 1-5` | Weekdays at 9 AM |

## Troubleshooting

**Jobs not running?**
- Check MongoDB connection
- Verify job's `enabled` field is `true`
- Check scheduler status: `GET /api/observability/health`

**Jobs failing?**
- Check failures: `GET /api/observability/failures`
- Verify endpoint URL is accessible
- Check authentication headers

**Need help?**
See the full [README.md](README.md) for detailed documentation.
