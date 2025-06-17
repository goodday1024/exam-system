import { NextRequest } from 'next/server'
import { edgeQueue } from '@/lib/edge-queue'
import { verifyToken } from '@/lib/jwt'

// 启用边缘运行时
export const runtime = 'edge'

// 流式评测接口
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const token = request.cookies.get('token')?.value
    if (!token) {
      return new Response(
        JSON.stringify({ error: '未登录' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return new Response(
        JSON.stringify({ error: '无效token' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const body = await request.json()
    const { examId, studentId, code, language, testCases, priority = false } = body

    // 验证必要参数
    if (!examId || !code || !language || !testCases) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // 验证代码长度
    if (code.length > 10000) {
      return new Response(
        JSON.stringify({ error: '代码长度超过限制（最大10000字符）' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // 验证测试用例数量
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return new Response(
        JSON.stringify({ error: '测试用例不能为空' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (testCases.length > 20) {
      return new Response(
        JSON.stringify({ error: '测试用例数量超过限制（最大20个）' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // 验证语言支持
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp']
    if (!supportedLanguages.includes(language)) {
      return new Response(
        JSON.stringify({ error: `不支持的编程语言: ${language}` }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        // 发送初始状态
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        try {
          // 发送开始事件
          sendEvent('start', {
            message: '开始提交评测任务',
            timestamp: Date.now()
          })

          // 添加到边缘队列
          const jobId = priority 
            ? await edgeQueue.addHighPriorityJob({
                examId,
                studentId: studentId || decoded.userId,
                code,
                language: language.toLowerCase(),
                testCases
              })
            : await edgeQueue.addJob({
                examId,
                studentId: studentId || decoded.userId,
                code,
                language: language.toLowerCase(),
                testCases
              })

          // 发送任务提交成功事件
          sendEvent('submitted', {
            jobId,
            message: '评测任务已提交到队列',
            queueStats: edgeQueue.getQueueStats(),
            timestamp: Date.now()
          })

          // 轮询任务状态
          const pollInterval = setInterval(async () => {
            try {
              const status = edgeQueue.getJobStatus(jobId)
              
              if (status.status === 'processing') {
                sendEvent('processing', {
                  jobId,
                  message: '正在评测中...',
                  progress: 0,
                  timestamp: Date.now()
                })
              } else if (status.status === 'completed') {
                clearInterval(pollInterval)
                sendEvent('completed', {
                  jobId,
                  success: status.result ? true : false,
                  result: status.result,
                  error: status.error,
                  timestamp: Date.now()
                })
                
                // 关闭流
                controller.close()
              } else if (status.status === 'failed') {
                clearInterval(pollInterval)
                sendEvent('error', {
                  jobId,
                  error: status.error || '评测失败',
                  timestamp: Date.now()
                })
                controller.close()
              } else if (status.status === 'queued') {
                sendEvent('queued', {
                  jobId,
                  message: '任务在队列中等待',
                  position: status.position || 0,
                  estimatedTime: status.estimatedTime || 0,
                  timestamp: Date.now()
                })
              }
            } catch (error) {
              clearInterval(pollInterval)
              sendEvent('error', {
                jobId,
                error: '状态查询失败',
                details: error instanceof Error ? error.message : '未知错误',
                timestamp: Date.now()
              })
              controller.close()
            }
          }, 1000) // 每秒查询一次

          // 设置超时
          setTimeout(() => {
            clearInterval(pollInterval)
            sendEvent('timeout', {
              jobId,
              error: '评测超时',
              timestamp: Date.now()
            })
            controller.close()
          }, 5 * 60 * 1000) // 5分钟超时

        } catch (error) {
          sendEvent('error', {
            error: '提交评测任务失败',
            details: error instanceof Error ? error.message : '未知错误',
            timestamp: Date.now()
          })
          controller.close()
        }
      },
      
      cancel() {
        // 流被取消时的清理工作
        console.log('评测流被取消')
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })

  } catch (error) {
    console.error('流式评测失败:', error)
    return new Response(
      JSON.stringify({
        error: '流式评测失败',
        details: error instanceof Error ? error.message : '未知错误'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}