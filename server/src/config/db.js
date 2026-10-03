const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers for MongoDB Atlas SRV record resolution on Windows (dev/test only)
if (process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {
    // Ignore if not supported in environment
  }
}

let mongodInstance = null;

const maskMongoUri = (rawUri) => {
  if (!rawUri || typeof rawUri !== 'string') return '';
  // Masks password while preserving username: mongodb+srv://user:****@host/...
  return rawUri.replace(/\/\/(.*?):(.*?)@/, '//$1:****@');
};

const connectDB = async (customUri) => {
  const uri = customUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studymate';

  try {
    console.log(`[Database] Attempting connection to MongoDB: ${maskMongoUri(uri)}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('[Database] MongoDB connected successfully to remote/configured database!');
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[Database] Production MongoDB connection error: ${err.message}`);
      process.exit(1);
    }

    console.warn(`[Database] Could not connect to configured MongoDB (${err.message}). Launching local MongoDB In-Memory Server...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const dbMatch = (uri || '').match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
      const targetDb = dbMatch ? dbMatch[1] : 'studymate';
      mongodInstance = await MongoMemoryServer.create({
        instance: { dbName: targetDb },
      });
      const baseMem = mongodInstance.getUri();
      const memUri = baseMem.endsWith('/') ? `${baseMem}${targetDb}` : `${baseMem}/${targetDb}`;
      await mongoose.connect(memUri);
      console.log(`[Database] In-memory MongoDB started and connected successfully at: ${memUri}`);
    } catch (memErr) {
      console.error('[Database] Failed to initialize in-memory MongoDB:', memErr.message);
      throw memErr;
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};

module.exports = { connectDB, disconnectDB };



