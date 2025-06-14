import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult } from '@/lib/models'

// 获取考试结果
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const examId = params.id
    console.log('Student exam result request:', { examId, studentId: decoded.userId })

    // 获取考试信息
    const exam = await Exam.findById(examId).populate({
      path: 'questions.questionId',
      select: 'id title content type options points correctAnswer'
    })

    console.log('Found exam:', exam ? { id: exam._id, title: exam.title, isPublished: exam.isPublished, resultsPublished: exam.resultsPublished } : 'null')

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在' },
        { status: 404 }
      )
    }

    if (!exam.isPublished) {
      return NextResponse.json(
        { error: '考试尚未发布' },
        { status: 403 }
      )
    }

    // 获取学生的答题记录
    const examResult = await ExamResult.findOne({
      examId: examId,
      studentId: decoded.userId
    })

    console.log('Found exam result:', examResult ? { id: examResult._id, isSubmitted: examResult.isSubmitted, isGraded: examResult.isGraded } : 'null')

    if (!examResult) {
      return NextResponse.json(
        { error: '您还没有参加这个考试' },
        { status: 404 }
      )
    }

    if (!examResult.isSubmitted) {
      return NextResponse.json(
        { error: '考试尚未提交' },
        { status: 400 }
      )
    }

    if (!exam.resultsPublished) {
      console.log('Results not published for exam:', examId)
      return NextResponse.json(
        { error: '成绩尚未发布' },
        { status: 403 }
      )
    }

    // 格式化考试数据
    const formattedExam = {
      id: exam._id,
      title: exam.title,
      description: exam.description,
      resultsPublished: exam.resultsPublished,
      questions: exam.questions.map((examQuestion: any, index: number) => {
        const question = examQuestion.questionId
        return {
          id: question._id,
          title: question.title,
          content: question.content,
          type: question.type,
          options: question.options,
          points: question.points,
          correctAnswer: question.correctAnswer,
          order: examQuestion.order || (index + 1)
        }
      }),
      examResult: {
        id: examResult._id,
        answers: examResult.answers ? JSON.parse(examResult.answers) : {},
        score: examResult.score || 0,
        isGraded: examResult.isGraded,
        tabSwitches: examResult.tabSwitches,
        submittedAt: examResult.submittedAt
      }
    }

    console.log('Returning exam result successfully')
    return NextResponse.json({
      exam: formattedExam
    })
  } catch (error) {
    console.error('Get exam result error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}