const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/exam-system';

async function resetProcessingTask() {
  try {
    await mongoose.connect(uri);
    
    console.log('查找processing状态的任务...');
    const processingTasks = await mongoose.connection.db.collection('evaluationtasks').find({
      status: 'processing'
    }).toArray();
    
    console.log(`找到 ${processingTasks.length} 个processing状态的任务`);
    
    for (const task of processingTasks) {
      console.log(`\n任务详情:`);
      console.log(`ID: ${task._id}`);
      console.log(`状态: ${task.status}`);
      console.log(`考试ID: ${task.examId}`);
      console.log(`教师ID: ${task.teacherId}`);
      console.log(`创建时间: ${task.createdAt}`);
      console.log(`更新时间: ${task.updatedAt}`);
      console.log(`进度: ${task.progress?.completed || 0}/${task.progress?.total || 0}`);
      console.log(`当前处理: ${task.progress?.current || '未知'}`);
      
      // 检查任务是否卡住（超过5分钟没有更新）
      const now = new Date();
      const lastUpdate = new Date(task.updatedAt);
      const timeDiff = (now - lastUpdate) / 1000 / 60; // 分钟
      
      console.log(`距离上次更新: ${timeDiff.toFixed(1)} 分钟`);
      
      if (timeDiff > 5) {
        console.log('任务可能已卡住，重置为pending状态...');
        
        await mongoose.connection.db.collection('evaluationtasks').updateOne(
          { _id: task._id },
          {
            $set: {
              status: 'pending',
              updatedAt: new Date(),
              'progress.current': null
            }
          }
        );
        
        console.log('任务已重置为pending状态');
      } else {
        console.log('任务仍在正常处理中');
      }
    }
    
    await mongoose.disconnect();
    console.log('\n操作完成');
  } catch (error) {
    console.error('操作失败:', error);
  }
}

resetProcessingTask();