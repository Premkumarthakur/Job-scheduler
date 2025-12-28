const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

class JobExecution {
  static collection() {
    return getDB().collection('job_executions');
  }

  static async create(executionData) {
    const execution = {
      jobId: new ObjectId(executionData.jobId),
      status: 'running',
      startedAt: new Date(),
      completedAt: null,
      duration: null,
      responseCode: null,
      responseBody: null,
      errorMessage: null,
      attempt: executionData.attempt || 1,
      scheduledAt: executionData.scheduledAt || new Date()
    };

    const result = await this.collection().insertOne(execution);
    return { ...execution, _id: result.insertedId };
  }

  static async updateSuccess(id, responseCode, responseBody, duration) {
    await this.collection().updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'success',
          completedAt: new Date(),
          responseCode,
          responseBody: responseBody ? JSON.stringify(responseBody).substring(0, 1000) : null,
          duration
        }
      }
    );
  }

  static async updateFailure(id, errorMessage, responseCode, duration) {
    await this.collection().updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'failure',
          completedAt: new Date(),
          errorMessage: errorMessage ? errorMessage.substring(0, 500) : null,
          responseCode,
          duration
        }
      }
    );
  }

  static async findByJobId(jobId, limit = 5) {
    return await this.collection()
      .find({ jobId: new ObjectId(jobId) })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
  }

  static async getStats() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [total, successful, failed, last24HoursCount] = await Promise.all([
      this.collection().countDocuments(),
      this.collection().countDocuments({ status: 'success' }),
      this.collection().countDocuments({ status: 'failure' }),
      this.collection().countDocuments({ startedAt: { $gte: last24Hours } })
    ]);

    return {
      total,
      successful,
      failed,
      last24Hours: last24HoursCount
    };
  }

  static async getRecentFailures(limit = 10) {
    return await this.collection()
      .find({ status: 'failure' })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
  }
}

module.exports = JobExecution;
