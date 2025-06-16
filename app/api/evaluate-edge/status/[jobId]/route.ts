import { NextRequest, NextResponse } from 'next/server'
import { edgeQueue } from '@/lib/edge-queue'
import { verifyTokenEdge } from '@/lib/jwt-edge'

// 启用边缘运行时
export const runtime = 'edge'

// 获取评测任务状态
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

    const jobId = params.jobId
    if (!jobId) {
      return NextResponse.json(
        { error: '缺少任务ID' },
        { status: 400 }
      )
    }

    // 获取任务状态
    const status = edgeQueue.getJobStatus(jobId)
    
    // 添加时间戳和额外信息
    const response = {
      ...status,
      jobId,
      timestamp: Date.now(),
      queueStats: edgeQueue.getQueueStats()
    }

    // 根据状态返回不同的HTTP状态码
    if (status.status === 'not_found') {
      return NextResponse.json(
        { 
          error: '任务不存在或已过期',
          ...response
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ...response
    })
  } catch (error) {
    console.error('获取任务状态失败:', error)
    return NextResponse.json(
      { 
        error: '获取任务状态失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// 取消评测任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

    const jobId = params.jobId
    if (!jobId) {
      return NextResponse.json(
        { error: '缺少任务ID' },
        { status: 400 }
      )
    }

    // 尝试取消任务
    const cancelled = edgeQueue.cancelJob(jobId)
    
    if (cancelled) {
      return NextResponse.json({
        success: true,
        message: '任务已取消',
        jobId
      })
    } else {
      return NextResponse.json(
        { 
          error: '无法取消任务（任务可能正在处理中或不存在）',
          jobId
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('取消任务失败:', error)
    return NextResponse.json(
      { 
        error: '取消任务失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}