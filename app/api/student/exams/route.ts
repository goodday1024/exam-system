import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

// 获取学生可参加的考试列表
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'STUDENT') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    await connectDB()

    // 获取已发布的考试
    const exams = await Exam.find({ isPublished: true })
      .populate('createdBy', 'name email')
      .sort({ startTime: -1 })

    // 获取当前学生的考试结果
    const examResults = await ExamResult.find({
      studentId: decoded.userId,
      examId: { $in: exams.map(exam => exam._id) }
    })

    // 创建考试结果映射
    const resultMap = new Map()
    examResults.forEach(result => {
      resultMap.set(result.examId.toString(), {
        id: result._id,
        isSubmitted: result.isSubmitted,
        score: result.score,
        submittedAt: result.submittedAt
      })
    })

    // 格式化返回数据
    const formattedExams = exams.map(exam => ({
      id: exam._id,
      title: exam.title,
      description: exam.description,
      startTime: exam.startTime,
      endTime: exam.endTime,
      duration: exam.duration,
      isPublished: exam.isPublished,
      resultsPublished: exam.resultsPublished,
      examResult: resultMap.get(exam._id.toString()) || null
    }))

    const response = NextResponse.json({ exams: formattedExams })
    
    // 添加缓存头以配合Cloudflare缓存
    response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=240')
    response.headers.set('CDN-Cache-Control', 'public, max-age=120')
    response.headers.set('Vary', 'Accept-Encoding')
    
    return response
  } catch (error) {
    console.error('Get student exams error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}