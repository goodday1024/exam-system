import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { ExamMarketplace, Exam, Question } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

// 从商城导入考试
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

    const marketplaceExamId = params.id
    
    // 获取商城考试
    const marketplaceExam = await ExamMarketplace.findById(marketplaceExamId)
    if (!marketplaceExam || !marketplaceExam.isActive) {
      return NextResponse.json(
        { error: '考试不存在或已下架' },
        { status: 404 }
      )
    }

    // 解析考试数据
    const examData = JSON.parse(marketplaceExam.examData)
    
    // 创建题目
    const questionIds = []
    for (const questionData of examData.questions) {
      const question = new Question({
        title: questionData.title,
        type: questionData.type,
        content: questionData.content,
        options: questionData.options,
        correctAnswer: questionData.correctAnswer,
        points: questionData.points,
        difficulty: questionData.difficulty,
        createdBy: decoded.userId
      })
      
      await question.save()
      questionIds.push({
        questionId: question._id,
        order: questionData.order
      })
    }
    
    // 创建考试
    const now = new Date()
    const defaultEndTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 默认7天后结束
    
    const newExam = new Exam({
      title: `${examData.title} (导入)`,
      description: examData.description,
      startTime: now,
      endTime: defaultEndTime,
      duration: examData.duration,
      maxTabSwitches: examData.maxTabSwitches,
      questions: questionIds,
      createdBy: decoded.userId,
      isPublished: false,
      resultsPublished: false
    })
    
    await newExam.save()
    
    // 更新下载次数
    await ExamMarketplace.findByIdAndUpdate(
      marketplaceExamId,
      { $inc: { downloadCount: 1 } }
    )
    
    return NextResponse.json({
      message: '考试导入成功',
      examId: newExam._id,
      exam: {
        _id: newExam._id,
        title: newExam.title,
        description: newExam.description,
        duration: newExam.duration,
        questionCount: newExam.questions.length
      }
    })
  } catch (error) {
    console.error('Import exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}