const { MongoClient } = require('mongodb');

let db = null;
let client = null;

async function connectDB() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/job_scheduler';

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();

    await createIndexes();

    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

async function createIndexes() {
  await db.collection('jobs').createIndex({ nextRunAt: 1 });
  await db.collection('jobs').createIndex({ enabled: 1 });
  await db.collection('jobs').createIndex({ nextRunAt: 1, enabled: 1 });

  await db.collection('job_executions').createIndex({ jobId: 1, startedAt: -1 });
  await db.collection('job_executions').createIndex({ status: 1 });
  await db.collection('job_executions').createIndex({ startedAt: -1 });
}

function getDB() {
  if (!db) {
    throw new Error('Database not connected');
  }
  return db;
}

async function closeDB() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

module.exports = { connectDB, getDB, closeDB };
