const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// We just need a dummy PDF file
fs.writeFileSync('dummy.pdf', 'dummy content');

async function testUpload() {
  try {
    const { extractText } = require('./src/services/parserService');
    const GridFsStorage = require('multer-gridfs-storage').GridFsStorage;
    const { GridFSBucket } = mongoose.mongo;
    
    await mongoose.connect('mongodb://127.0.0.1:27017/lexguard_test');
    
    const gfsBucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    
    // Simulate an upload by writing to GridFS directly
    const writeStream = gfsBucket.openUploadStream('dummy.pdf');
    const fileId = writeStream.id;
    
    await new Promise((resolve, reject) => {
      const readStream = fs.createReadStream('dummy.pdf');
      readStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log('Dummy file uploaded to GridFS with ID:', fileId);
    
    // Override getFileStream temporarily
    const gridFsStorageModule = require('./src/services/gridFsStorage');
    // Ensure gfsBucket is initialized in the module by faking an 'open' event or calling connect
    // Wait, the module hooks into mongoose.connection.once('open'), so it should be initialized now!
    // But since mongoose.connect was called BEFORE requiring gridFsStorage, the 'open' event might have already fired!
    // Let's just require it and test getFileStream
    
    const readStream = gridFsStorageModule.getFileStream(fileId);
    console.log('Stream retrieved successfully!');
    
  } catch (err) {
    console.error('TEST ERROR:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testUpload();
