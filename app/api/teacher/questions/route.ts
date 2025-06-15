import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Question, User } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    await connectDB()

    const questions = await Question.find({ createdBy: decoded.userId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })

    // 确保 _id 字段被正确序列化
    const serializedQuestions = questions.map(question => ({
      ...question.toObject(),
      _id: question._id.toString()
    }))

    return NextResponse.json({ questions: serializedQuestions })
  } catch (error) {
    console.error('获取题目失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { title, content, type, options, correctAnswer, points, testCases, language, timeLimit, memoryLimit } = await request.json()

    if (!title || !content || !type || !correctAnswer) {
      return NextResponse.json(
        { error: '标题、内容、类型和正确答案不能为空' },
        { status: 400 }
      )
    }

    await connectDB()

    const question = await Question.create({
      title,
      content,
      type,
      options: options ? JSON.stringify(options) : undefined,
      correctAnswer,
      points: points || 10,
      testCases: testCases || undefined,
      language: language || undefined,
      timeLimit: timeLimit || 1,
      memoryLimit: memoryLimit || 512,
      createdBy: decoded.userId
    })

    const populatedQuestion = await Question.findById(question._id)
      .populate('createdBy', 'name email')

    return NextResponse.json({
      message: '题目创建成功',
      question: populatedQuestion
    })
  } catch (error) {
    console.error('创建题目失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}