import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult, Question } from '@/lib/models'
import mongoose from 'mongoose'

// 获取考试成绩
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
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    const examId = params.id

    // 获取考试信息
    const exam = await Exam.findOne({
      _id: new mongoose.Types.ObjectId(examId),
      createdBy: new mongoose.Types.ObjectId(decoded.userId)
    }).populate({
      path: 'questions.questionId',
      select: 'id title type points correctAnswer'
    })

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限' },
        { status: 404 }
      )
    }

    // 获取考试成绩
    const examResults = await ExamResult.find({
      examId: new mongoose.Types.ObjectId(examId),
      isSubmitted: true
    }).populate({
      path: 'studentId',
      select: 'id name email campus'
    }).sort({ submittedAt: -1 })

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限' },
        { status: 404 }
      )
    }

    // 格式化数据
    const formattedExam = {
      id: exam._id,
      title: exam.title,
      description: exam.description,
      resultsPublished: exam.resultsPublished,
      questions: exam.questions.map((examQuestion: any) => {
        const question = examQuestion.questionId
        return {
          id: question._id,
          title: question.title,
          type: question.type,
          points: question.points,
          correctAnswer: question.correctAnswer
        }
      }),
      examResults: examResults.map((result: any) => ({
        id: result._id,
        answers: result.answers ? JSON.parse(result.answers) : {},
        score: result.score,
        isGraded: result.isGraded,
        tabSwitches: result.tabSwitches,
        submittedAt: result.submittedAt,
        student: {
          id: result.studentId._id,
          name: result.studentId.name,
          email: result.studentId.email,
          campus: result.studentId.campus
        }
      }))
    }

    return NextResponse.json({
      exam: formattedExam
    })
  } catch (error) {
    console.error('Get exam results error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}