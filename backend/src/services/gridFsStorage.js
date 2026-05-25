const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const crypto = require('crypto');
const path = require('path');
const { GridFsStorage } = require('multer-gridfs-storage');

// Initialize GridFS storage engine for multer
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dummy_lexguard_db',
  options: { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads' // Using default bucket 'fs' or custom 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});

let gfsBucket;

// Initialize GridFSBucket stream reader
mongoose.connection.once('open', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

/**
 * Returns a readable stream for a given GridFS file id or filename
 * @param {string} filename 
 * @returns {ReadableStream}
 */
const getFileStream = (filename) => {
  if (!gfsBucket) {
    throw new Error('GridFSBucket is not initialized yet.');
  }
  return gfsBucket.openDownloadStreamByName(filename);
};

module.exports = {
  storage,
  getFileStream
};
