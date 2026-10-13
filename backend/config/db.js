const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('MONGODB_URI is not set. The app will run without a persistent MongoDB connection.');
    global.isMongoConnected = false;
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
    global.isMongoConnected = true;
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    global.isMongoConnected = false;
    return false;
  }
}

module.exports = connectDB;
