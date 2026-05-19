const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in .env — database will not be available.');
    return;
  }
  try {
    console.log('🔌 Connecting to MONGODB_URI...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000, // fail fast if Atlas is unreachable
      connectTimeoutMS: 3000,
    });
    console.log(`✅ MongoDB Connected (Atlas): ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Primary MongoDB (Atlas) connection error: ${error.message}`);
    console.log('🔌 Attempting auto-fallback to local MongoDB on port 27017...');
    try {
      const fallbackConn = await mongoose.connect('mongodb://127.0.0.1:27017/lexguard', {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      console.log(`✅ MongoDB Connected (Local Fallback): ${fallbackConn.connection.host}`);
    } catch (fallbackError) {
      console.error(`❌ Local MongoDB fallback failed: ${fallbackError.message}`);
      console.error('   Server will continue running. DB-dependent routes will return 500.');
    }
  }
};

module.exports = connectDB;
