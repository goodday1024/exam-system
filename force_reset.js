const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.DATABASE_URL;

async function forceReset() {
  try {
    await mongoose.connect(uri);
    
    const result = await mongoose.connection.db.collection('evaluationtasks').updateOne(
      { _id: new mongoose.Types.ObjectId('684f0efbcc233e6ca679afe1') },
      {
        $set: {
          status: 'pending',
          updatedAt: new Date(),
          'progress.current': null
        }
      }
    );
    
    console.log('任务已强制重置为pending状态:', result);
    await mongoose.disconnect();
  } catch (error) {
    console.error('重置失败:', error);
  }
}

forceReset();