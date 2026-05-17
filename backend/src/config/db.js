const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in .env — database will not be available.');
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // fail fast if Atlas is unreachable
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Log but do NOT call process.exit — let the server stay up so health checks
    // and non-DB routes remain available. A process manager (PM2 etc.) handles restarts.
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.error('   Server will continue running. DB-dependent routes will return 500.');
  }
};

module.exports = connectDB;
