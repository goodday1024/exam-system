const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/exam-system';

async function triggerQueue() {
  try {
    await mongoose.connect(uri);
    console.log('数据库连接成功');
    
    // 导入evaluationQueue
    const { evaluationQueue } = require('./lib/evaluationQueue.ts');
    
    console.log('队列处理器已导入，应该会自动启动...');
    
    // 等待一段时间让队列处理器工作
    setTimeout(() => {
      console.log('等待队列处理器工作...');
    }, 5000);
    
  } catch (error) {
    console.error('触发队列失败:', error);
  }
}

triggerQueue();