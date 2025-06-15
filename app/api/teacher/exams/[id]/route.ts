import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult, Question } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

// 获取考试详情
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const examId = params.id

    await connectDB()

    // 检查考试是否存在且属于当前教师
    const exam = await Exam.findOne({
      _id: examId,
      createdBy: decoded.userId
    }).populate({
      path: 'questions.questionId',
      select: 'title type content options correctAnswer points difficulty'
    }).populate('createdBy', 'name email')

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限' },
        { status: 404 }
      )
    }

    // 获取考试结果数量
    const examResultsCount = await ExamResult.countDocuments({
      examId: examId,
      isSubmitted: true
    })

    // 处理题目数据结构
    const examObj = exam.toObject()
    const processedQuestions = examObj.questions.map((q: any, index: number) => ({
      _id: q.questionId._id,
      title: q.questionId.title,
      content: q.questionId.content,
      type: q.questionId.type,
      options: q.questionId.options,
      points: q.points,
      order: index + 1
    }))

    // 添加_count字段和处理后的题目数据
    const examWithCount = {
      ...examObj,
      questions: processedQuestions,
      _count: {
        examResults: examResultsCount
      }
    }

    return NextResponse.json({
      exam: examWithCount
    })
  } catch (error) {
    console.error('获取考试详情失败:', error)
    return NextResponse.json(
      { error: '获取考试详情失败' },
      { status: 500 }
    )
  }
}

// 更新考试
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

    const examId = params.id
    const requestBody = await request.json()

    await connectDB()

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

    // 如果只是更新发布状态
    if (requestBody.isPublished !== undefined && Object.keys(requestBody).length === 1) {
      const updatedExam = await Exam.findByIdAndUpdate(
        examId,
        {
          isPublished: requestBody.isPublished,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('createdBy', 'name email')

      return NextResponse.json({
        message: '考试更新成功',
        exam: updatedExam
      })
    }

    // 完整的考试编辑
    const {
      title,
      description,
      startTime,
      endTime,
      duration,
      maxTabSwitches,
      questionIds
    } = requestBody

    // 验证必填字段
    if (!title || !startTime || !endTime || !duration) {
      return NextResponse.json(
        { error: '请填写所有必填字段' },
        { status: 400 }
      )
    }

    // 验证时间
    const start = new Date(startTime)
    const end = new Date(endTime)
    if (start >= end) {
      return NextResponse.json(
        { error: '结束时间必须晚于开始时间' },
        { status: 400 }
      )
    }

    // 检查考试是否已发布（已发布的考试不能编辑）
    if (exam.isPublished) {
      return NextResponse.json(
        { error: '已发布的考试无法编辑' },
        { status: 400 }
      )
    }

    // 验证题目ID（如果提供了）
    let validQuestions: { questionId: string; order: number }[] = []
    if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
      const questions = await Question.find({
        _id: { $in: questionIds },
        createdBy: decoded.userId
      })

      if (questions.length !== questionIds.length) {
        return NextResponse.json(
          { error: '部分题目不存在或无权限访问' },
          { status: 400 }
        )
      }

      // 转换为正确的格式
      validQuestions = questionIds.map((questionId: string, index: number) => ({
        questionId,
        order: index + 1
      }))
    }

    // 更新考试
    const updateData: any = {
      title,
      description: description || '',
      startTime: start,
      endTime: end,
      duration: parseInt(duration),
      maxTabSwitches: parseInt(maxTabSwitches) || 3,
      updatedAt: new Date()
    }

    if (validQuestions.length > 0) {
      updateData.questions = validQuestions
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      updateData,
      { new: true }
    ).populate('questions')
     .populate('createdBy', 'name email')

    return NextResponse.json({
      message: '考试更新成功',
      exam: updatedExam
    })
  } catch (error) {
    console.error('Update exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// 删除考试
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

    const examId = params.id

    await connectDB()

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

    // 检查是否有学生已经参与考试
    const examResults = await ExamResult.find({ examId })
    if (examResults.length > 0) {
      return NextResponse.json(
        { error: '已有学生参与的考试无法删除' },
        { status: 400 }
      )
    }

    // 删除考试相关数据
    await Promise.all([
      // 删除考试结果
      ExamResult.deleteMany({ examId }),
      // 删除考试
      Exam.findByIdAndDelete(examId)
    ])

    return NextResponse.json({
      message: '考试删除成功'
    })
  } catch (error) {
    console.error('Delete exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}