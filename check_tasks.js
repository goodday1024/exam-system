const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/exam-system';

async function checkTasks() {
  try {
    await mongoose.connect(uri);
    
    console.log('正在查询所有评测任务...');
    const tasks = await mongoose.connection.db.collection('evaluationtasks').find({}).toArray();
    
    console.log(`\n找到 ${tasks.length} 个评测任务:`);
    tasks.forEach(task => {
      console.log(`ID: ${task._id}`);
      console.log(`状态: ${task.status}`);
      console.log(`考试ID: ${task.examId}`);
      console.log(`教师ID: ${task.teacherId}`);
      console.log(`创建时间: ${task.createdAt}`);
      console.log(`更新时间: ${task.updatedAt}`);
      if (task.progress) {
        console.log(`进度: ${task.progress.completed}/${task.progress.total}`);
      }
      console.log('---');
    });
    
    // 特别查询pending和processing状态的任务
    const pendingTasks = await mongoose.connection.db.collection('evaluationtasks').find({
      status: { $in: ['pending', 'processing'] }
    }).toArray();
    
    console.log(`\n待处理任务数量: ${pendingTasks.length}`);
    pendingTasks.forEach(task => {
      console.log(`待处理任务 - ID: ${task._id}, 状态: ${task.status}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('查询失败:', error);
  }
}

checkTasks();