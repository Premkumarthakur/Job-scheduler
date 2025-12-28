# API Usage Examples

Complete examples for all API endpoints.

## Job Management

### Create a Job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 */5 * * * *",
    "endpoint": "https://api.example.com/webhook",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN",
      "Content-Type": "application/json"
    },
    "body": {
      "event": "scheduled_task"
    },
    "retryAttempts": 3,
    "retryDelay": 5000
  }'
```

### List All Jobs

```bash
curl http://localhost:3000/api/jobs
```

With pagination:
```bash
curl "http://localhost:3000/api/jobs?page=2&limit=10"
```

### Get Single Job

```bash
curl http://localhost:3000/api/jobs/507f1f77bcf86cd799439011
```

### Update a Job

Change schedule:
```bash
curl -X PUT http://localhost:3000/api/jobs/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 */10 * * * *"
  }'
```

Disable a job:
```bash
curl -X PUT http://localhost:3000/api/jobs/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'
```

Update endpoint and headers:
```bash
curl -X PUT http://localhost:3000/api/jobs/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://new-api.example.com/webhook",
    "headers": {
      "Authorization": "Bearer NEW_TOKEN"
    }
  }'
```

### Delete a Job

```bash
curl -X DELETE http://localhost:3000/api/jobs/507f1f77bcf86cd799439011
```

### Get Job Execution History

Last 5 executions:
```bash
curl http://localhost:3000/api/jobs/507f1f77bcf86cd799439011/executions
```

Last 10 executions:
```bash
curl "http://localhost:3000/api/jobs/507f1f77bcf86cd799439011/executions?limit=10"
```

## Observability

### Health Check

```bash
curl http://localhost:3000/api/observability/health
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

### System Statistics

```bash
curl http://localhost:3000/api/observability/stats
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

Last 10 failures:
```bash
curl http://localhost:3000/api/observability/failures
```

Last 20 failures:
```bash
curl "http://localhost:3000/api/observability/failures?limit=20"
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "jobId": "507f1f77bcf86cd799439011",
      "status": "failure",
      "startedAt": "2024-01-01T12:00:00.000Z",
      "completedAt": "2024-01-01T12:00:05.000Z",
      "duration": 5000,
      "responseCode": 500,
      "errorMessage": "Request failed with status code 500",
      "attempt": 3
    }
  ]
}
```

## Real-World Examples

### Slack Notification Every Hour

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 0 * * * *",
    "endpoint": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "method": "POST",
    "body": {
      "text": "Hourly health check completed"
    }
  }'
```

### Database Backup Every Night at 2 AM

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 0 2 * * *",
    "endpoint": "https://backup-service.example.com/trigger",
    "method": "POST",
    "headers": {
      "X-API-Key": "YOUR_BACKUP_API_KEY"
    },
    "body": {
      "backup_type": "full",
      "retention_days": 30
    },
    "retryAttempts": 5,
    "retryDelay": 60000
  }'
```

### API Health Check Every 30 Seconds

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "*/30 * * * * *",
    "endpoint": "https://status-monitor.example.com/ping",
    "method": "POST",
    "body": {
      "service": "api",
      "timestamp": "{{now}}"
    }
  }'
```

### Weekly Report Every Monday at 9 AM

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 0 9 * * 1",
    "endpoint": "https://reports.example.com/generate",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer YOUR_REPORT_TOKEN"
    },
    "body": {
      "report_type": "weekly_summary",
      "format": "pdf"
    }
  }'
```

## Testing with httpbin.org

Use httpbin.org to test without setting up a real endpoint:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "*/30 * * * * *",
    "endpoint": "https://httpbin.org/post",
    "method": "POST",
    "body": {
      "test": "This is a test job"
    }
  }'
```

Then view the execution history to see the responses from httpbin.org.

## Error Responses

### Invalid Cron Expression

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "invalid",
    "endpoint": "https://api.example.com"
  }'
```

Response:
```json
{
  "success": false,
  "error": "Invalid cron expression. Format: second minute hour day month dayOfWeek"
}
```

### Job Not Found

```bash
curl http://localhost:3000/api/jobs/invalid_id
```

Response:
```json
{
  "success": false,
  "error": "Job not found"
}
```

### Invalid Endpoint

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 */5 * * * *",
    "endpoint": "not-a-url"
  }'
```

Response:
```json
{
  "success": false,
  "error": "Invalid endpoint. Must be a valid HTTP/HTTPS URL"
}
```
