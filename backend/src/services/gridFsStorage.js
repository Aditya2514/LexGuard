const mongoose = require('mongoose');
const { GridFSBucket } = mongoose.mongo;

let gfsBucket;

// Initialize GridFSBucket stream reader
mongoose.connection.once('open', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

/**
 * Returns a readable stream for a given GridFS file id
 * @param {ObjectId|string} fileId 
 * @returns {ReadableStream}
 */
const getFileStream = (fileId) => {
  if (!gfsBucket) {
    throw new Error('GridFSBucket is not initialized yet.');
  }
  // Reparse the ObjectId using Mongoose's internal BSON to avoid BSONVersionError conflicts
  // between different versions of the mongodb driver.
  const parsedId = new mongoose.Types.ObjectId(fileId.toString());
  return gfsBucket.openDownloadStream(parsedId);
};

module.exports = {
  getFileStream
};
