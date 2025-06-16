import { NextRequest, NextResponse } from 'next/server'
import { edgeQueue } from '@/lib/edge-queue'
import { verifyTokenEdge } from '@/lib/jwt-edge'

// 启用边缘运行时
export const runtime = 'edge'

// 提交评测任务到边缘队列
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    const decoded = await verifyTokenEdge(token)
    if (!decoded) {
      return NextResponse.json(
        { error: '无效token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { examId, studentId, code, language, testCases, priority = false } = body

    // 验证必要参数
    if (!examId || !code || !language || !testCases) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 验证代码长度
    if (code.length > 10000) {
      return NextResponse.json(
        { error: '代码长度超过限制（最大10000字符）' },
        { status: 400 }
      )
    }

    // 验证测试用例数量
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return NextResponse.json(
        { error: '测试用例不能为空' },
        { status: 400 }
      )
    }

    if (testCases.length > 20) {
      return NextResponse.json(
        { error: '测试用例数量超过限制（最大20个）' },
        { status: 400 }
      )
    }

    // 验证语言支持
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp']
    if (!supportedLanguages.includes(language)) {
      return NextResponse.json(
        { error: `不支持的编程语言: ${language}` },
        { status: 400 }
      )
    }

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

    // 获取队列状态
    const queueStats = edgeQueue.getQueueStats()
    const jobStatus = edgeQueue.getJobStatus(jobId)

    return NextResponse.json({
      success: true,
      jobId,
      message: '评测任务已提交到边缘队列',
      queueStats,
      estimatedTime: jobStatus.estimatedTime || 2
    })
  } catch (error) {
    console.error('提交边缘评测任务失败:', error)
    return NextResponse.json(
      { 
        error: '提交评测任务失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// 获取队列统计信息
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    const decoded = await verifyTokenEdge(token)
    if (!decoded) {
      return NextResponse.json(
        { error: '无效token' },
        { status: 401 }
      )
    }

    const queueStats = edgeQueue.getQueueStats()
    
    return NextResponse.json({
      success: true,
      stats: queueStats,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('获取队列统计失败:', error)
    return NextResponse.json(
      { error: '获取队列统计失败' },
      { status: 500 }
    )
  }
}