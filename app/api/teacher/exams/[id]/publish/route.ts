import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult } from '@/lib/models'

// 发布成绩
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    const examId = params.id

    // 检查考试是否存在且属于当前教师
    const exam = await Exam.findOne({
      _id: examId,
      createdBy: decoded.userId
    })

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限' },
        { status: 404 }
      )
    }

    // 检查是否有未判分的答卷
    const ungradedResults = await ExamResult.find({
      examId: examId,
      isSubmitted: true,
      isGraded: false
    })

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限' },
        { status: 404 }
      )
    }

    if (ungradedResults.length > 0) {
      return NextResponse.json(
        { error: '还有未判分的答卷，请先完成判分' },
        { status: 400 }
      )
    }

    // 发布成绩
    await Exam.findByIdAndUpdate(examId, {
      resultsPublished: true,
      updatedAt: new Date()
    })

    return NextResponse.json({
      message: '成绩发布成功'
    })
  } catch (error) {
    console.error('Publish results error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}