import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import connectDB from '@/lib/mongodb'
import { Exam, ExamResult, Question } from '@/lib/models'

// 自动判分
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

    // 获取考试信息
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

    // 获取已提交的考试结果
    const examResults = await ExamResult.find({
      examId: examId,
      isSubmitted: true
    })

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限' },
        { status: 404 }
      )
    }

    // 为每个学生判分
    const gradingPromises = examResults.map(async (result: any) => {
      const answers = result.answers ? JSON.parse(result.answers) : {}
      let totalScore = 0

      // 计算得分
      for (const examQuestion of exam.questions) {
        const question = examQuestion.questionId
        if (!question || !question._id) {
          console.log('跳过无效题目:', examQuestion)
          continue
        }
        
        const studentAnswer = answers[question._id.toString()]
        
        if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
          // 根据题目类型判分
          if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
            // 选择题和判断题：完全匹配
            if (studentAnswer.toString().toLowerCase() === question.correctAnswer.toLowerCase()) {
              const points = Number(examQuestion.points) || Number(question.points) || 0
              totalScore += points
            }
          } else if (question.type === 'PROGRAMMING') {
            // 编程题：跳过自动判分，需要使用代码评测API
            // 这里暂时不给分，等待代码评测完成后更新分数
            console.log(`编程题 ${question.title} 需要代码评测，跳过自动判分`)
          }
        }
      }

      // 更新成绩
      const finalScore = isNaN(totalScore) ? 0 : totalScore
      return ExamResult.findByIdAndUpdate(result._id, {
        score: finalScore,
        isGraded: true,
        gradedAt: new Date(),
        updatedAt: new Date(),
        // 重置编程成绩导入状态，允许重新导入
        programmingScoreImported: false,
        programmingScoreImportedAt: null,
        programmingScore: null
      })
    })

    await Promise.all(gradingPromises)

    return NextResponse.json({
      message: '判分完成',
      gradedCount: examResults.length
    })
  } catch (error) {
    console.error('Grade exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}