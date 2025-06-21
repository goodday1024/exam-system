import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Exam, ExamMarketplace, Question } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

// 发布考试到商城
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    
    // 验证教师身份
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
    const { category, difficulty, tags, description } = await request.json()
    
    // 验证考试是否存在且属于当前教师
    const exam = await Exam.findOne({
      _id: examId,
      createdBy: decoded.userId
    }).populate({
      path: 'questions.questionId',
      select: 'title type content options correctAnswer points difficulty'
    })

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限' },
        { status: 404 }
      )
    }

    // 检查是否已经发布到商城
    const existingMarketplaceExam = await ExamMarketplace.findOne({
      originalExamId: examId
    })

    if (existingMarketplaceExam) {
      return NextResponse.json(
        { error: '该考试已经发布到商城' },
        { status: 400 }
      )
    }

    // 获取完整的题目信息
    const questionsWithDetails = await Promise.all(
      exam.questions.map(async (examQuestion: { questionId: string; order: number }) => {
        const question = await Question.findById(examQuestion.questionId)
        return {
          ...question.toObject(),
          order: examQuestion.order
        }
      })
    )

    // 准备考试数据
    const examData = {
      title: exam.title,
      description: exam.description,
      duration: exam.duration,
      maxTabSwitches: exam.maxTabSwitches,
      questions: questionsWithDetails
    }

    // 准备预览数据（前3题，隐藏答案）
    const previewQuestions = questionsWithDetails.slice(0, 3).map(q => ({
      title: q.title,
      type: q.type,
      content: q.content,
      options: q.options,
      points: q.points,
      difficulty: q.difficulty
      // 不包含 correctAnswer
    }))

    // 创建商城考试记录
    const marketplaceExam = new ExamMarketplace({
      originalExamId: examId,
      title: exam.title,
      description: description || exam.description,
      category,
      difficulty,
      duration: exam.duration,
      questionCount: exam.questions.length,
      tags: tags || [],
      publishedBy: decoded.userId,
      publishedByName: decoded.name,
      examData: JSON.stringify(examData),
      previewQuestions: JSON.stringify(previewQuestions)
    })

    await marketplaceExam.save()

    return NextResponse.json({
      message: '考试已成功发布到商城',
      marketplaceId: marketplaceExam._id
    })
  } catch (error) {
    console.error('Publish to marketplace error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}