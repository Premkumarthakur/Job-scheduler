const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

class Job {
  static collection() {
    return getDB().collection('jobs');
  }

  static async create(jobData) {
    const job = {
      schedule: jobData.schedule,
      endpoint: jobData.endpoint,
      method: jobData.method || 'POST',
      headers: jobData.headers || {},
      body: jobData.body || {},
      executionType: 'AT_LEAST_ONCE',
      enabled: true,
      retryAttempts: jobData.retryAttempts || 3,
      retryDelay: jobData.retryDelay || 5000,
      nextRunAt: null,
      lastRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.collection().insertOne(job);
    return { ...job, _id: result.insertedId };
  }

  static async findById(id) {
    return await this.collection().findOne({ _id: new ObjectId(id) });
  }

  static async update(id, updates) {
    const result = await this.collection().updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  static async findDueJobs(limit = 100) {
    const now = new Date();
    return await this.collection()
      .find({
        enabled: true,
        nextRunAt: { $lte: now }
      })
      .limit(limit)
      .toArray();
  }

  static async updateNextRunAt(id, nextRunAt) {
    await this.collection().updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          nextRunAt,
          lastRunAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }

  static async list(filter = {}, skip = 0, limit = 20) {
    return await this.collection()
      .find(filter)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  static async delete(id) {
    const result = await this.collection().deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}

module.exports = Job;
