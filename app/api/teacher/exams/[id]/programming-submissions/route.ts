import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'
import { Exam, ExamResult, User } from '@/lib/models'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    await connectDB()
    const examId = params.id

    // 验证考试存在并属于当前教师
    const exam = await Exam.findOne({
      _id: examId,
      createdBy: decoded.userId
    }).populate('questions.questionId')

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限访问' },
        { status: 404 }
      )
    }

    // 获取编程题
    const programmingQuestions = exam.questions.filter((q: any) => 
      q.questionId && q.questionId.type === 'PROGRAMMING'
    )
    
    if (programmingQuestions.length === 0) {
      return NextResponse.json({
        submissions: [],
        message: '该考试没有编程题'
      })
    }

    // 获取所有学生的考试结果
    const examResults = await ExamResult.find({
      examId: examId,
      isSubmitted: true
    }).populate('studentId', 'name email')

    const submissions = []

    // 遍历每个学生的结果
    for (const result of examResults) {
      if (!result.studentId) continue

      // 解析答案和语言信息
      const answers = result.answers ? JSON.parse(result.answers) : {}
      const codeLanguages = result.codeLanguages ? JSON.parse(result.codeLanguages) : {}

      // 遍历编程题
      for (const examQuestion of programmingQuestions) {
        const questionId = examQuestion.questionId._id.toString()
        const answer = answers[questionId]
        const language = codeLanguages[questionId]
        
        if (answer) {
          submissions.push({
            studentId: result.studentId._id.toString(),
            studentName: result.studentId.name,
            studentEmail: result.studentId.email,
            questionId: questionId,
            questionTitle: examQuestion.questionId.title,
            code: answer,
            language: language || 'c++', // 默认语言
            submittedAt: result.submittedAt,
            testCases: examQuestion.questionId.testCases || []
          })
        }
      }
    }

    return NextResponse.json({
      submissions,
      total: submissions.length,
      programmingQuestions: programmingQuestions.length
    })

  } catch (error) {
    console.error('获取编程题提交失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}