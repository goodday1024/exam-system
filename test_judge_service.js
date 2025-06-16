const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testJudgeService() {
  try {
    // 测试健康检查
    console.log('测试健康检查...');
    const healthData = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET'
    });
    console.log('健康检查结果:', healthData);
    
    // 测试代码执行
    console.log('\n测试代码执行...');
    const postData = JSON.stringify({
      language: 'python',
      source_code: 'print("Hello World")',
      stdin: '',
      cpu_time_limit: 5,
      memory_limit: 128
    });
    
    const executeData = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/execute',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    
    console.log('代码执行结果:', executeData);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testJudgeService();