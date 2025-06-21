import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { ExamMarketplace } from '@/lib/models'
import connectDB from '@/lib/mongodb'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    
    // 验证用户身份
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    const examId = params.id
    
    // 获取考试详情
    const exam = await ExamMarketplace.findById(examId)
      .populate('publishedBy', 'name email')
    
    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      exam: {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        category: exam.category,
        difficulty: exam.difficulty,
        duration: exam.duration,
        questionCount: exam.questionCount,
        tags: exam.tags,
        publishedBy: exam.publishedBy,
        publishedByName: exam.publishedByName,
        publishedAt: exam.publishedAt,
        createdAt: exam.createdAt,
        downloadCount: exam.downloadCount,
        averageRating: exam.averageRating,
        ratingCount: exam.ratingCount,
        previewData: exam.previewQuestions ? JSON.parse(exam.previewQuestions) : [],
        examData: exam.examData
      }
    })
  } catch (error) {
    console.error('Get marketplace exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}