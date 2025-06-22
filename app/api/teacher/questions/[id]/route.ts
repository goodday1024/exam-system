import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Question, Exam } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'
import { invalidateQuestionCache } from '@/lib/cache-invalidation'

// 更新题目
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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
        { error: '请填写所有必填字段' },
        { status: 400 }
      )
    }

    await connectDB()

    // 检查题目是否存在且属于当前用户
    const existingQuestion = await Question.findOne({
      _id: params.id,
      createdBy: decoded.userId
    })

    if (!existingQuestion) {
      return NextResponse.json(
        { error: '题目不存在或无权限' },
        { status: 404 }
      )
    }

    const question = await Question.findByIdAndUpdate(
      params.id,
      {
        title,
        content,
        type,
        options: options ? JSON.stringify(options) : undefined,
        correctAnswer,
        points: points || 10,
        testCases: testCases || undefined,
        language: language || undefined,
        timeLimit: timeLimit || 1,
        memoryLimit: memoryLimit || 512
      },
      { new: true }
    ).populate('createdBy', 'name email')

    // 异步清理相关缓存
    invalidateQuestionCache(params.id, decoded.userId)

    return NextResponse.json({
      message: '题目更新成功',
      question
    })
  } catch (error) {
    console.error('Update question error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// 删除题目
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // 检查题目是否存在且属于当前用户
    const existingQuestion = await Question.findOne({
      _id: params.id,
      createdBy: decoded.userId
    })

    if (!existingQuestion) {
      return NextResponse.json(
        { error: '题目不存在或无权限' },
        { status: 404 }
      )
    }

    // 检查题目是否被考试使用
    const examsUsingQuestion = await Exam.find({
      'questions.questionId': params.id
    })

    if (examsUsingQuestion.length > 0) {
      return NextResponse.json(
        { error: '该题目已被考试使用，无法删除' },
        { status: 400 }
      )
    }

    await Question.findByIdAndDelete(params.id)

    // 异步清理相关缓存
    invalidateQuestionCache(params.id, decoded.userId)

    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('Delete question error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}