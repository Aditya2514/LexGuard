const mongoose = require('mongoose');
const { GridFsStorage } = require('multer-gridfs-storage');

async function run() {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/lexguard_test';
  mongoose.connect(process.env.MONGODB_URI);
  
  const storage = new GridFsStorage({
    db: mongoose.connection.asPromise(),
    file: (req, file) => ({ filename: 'test' })
  });

  storage.on('connection', (db) => {
    console.log('GridFsStorage connected via mongoose promise!');
    process.exit(0);
  });
  
  storage.on('connectionFailed', (err) => {
    console.error('GridFsStorage connection failed!', err);
    process.exit(1);
  });
}
run();
