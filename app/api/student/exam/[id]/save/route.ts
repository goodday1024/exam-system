import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult } from '@/lib/models'

// 保存答案
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
    if (!decoded || decoded.role !== 'STUDENT') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const examId = params.id

    // 支持两种格式：单个答案保存和批量答案保存
    let answersToUpdate: Record<string, string> = {}
    
    if (body.questionId && body.answer !== undefined) {
      // 单个答案保存格式
      answersToUpdate[body.questionId] = body.answer
    } else if (body.answers && typeof body.answers === 'object') {
      // 批量答案保存格式
      answersToUpdate = body.answers
    } else {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 获取考试信息
    const exam = await Exam.findById(examId)

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在' },
        { status: 404 }
      )
    }

    // 检查考试是否已结束
    const now = new Date()
    const endTime = new Date(exam.endTime)

    if (now > endTime) {
      return NextResponse.json(
        { error: '考试已结束' },
        { status: 403 }
      )
    }

    // 获取答题记录
    const examResult = await ExamResult.findOne({
      examId: examId,
      studentId: decoded.userId
    })

    if (!examResult) {
      return NextResponse.json(
        { error: '请先开始考试' },
        { status: 400 }
      )
    }

    if (examResult.isSubmitted) {
      return NextResponse.json(
        { error: '考试已提交，无法修改答案' },
        { status: 400 }
      )
    }

    // 更新答案
    const currentAnswers = examResult.answers ? JSON.parse(examResult.answers) : {}
    
    // 批量更新答案
    Object.keys(answersToUpdate).forEach(questionId => {
      currentAnswers[questionId] = answersToUpdate[questionId]
    })

    await ExamResult.findByIdAndUpdate(examResult._id, {
      answers: JSON.stringify(currentAnswers),
      updatedAt: new Date()
    })

    return NextResponse.json({
      message: '答案保存成功'
    })
  } catch (error) {
    console.error('Save answer error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}