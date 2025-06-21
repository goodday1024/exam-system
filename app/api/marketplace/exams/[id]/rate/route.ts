import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { ExamMarketplace, ExamRating } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

// 对考试进行评分
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    
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

    const marketplaceExamId = params.id
    const { rating, comment } = await request.json()
    
    // 验证评分
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: '评分必须在1-5之间' },
        { status: 400 }
      )
    }
    
    // 验证考试是否存在
    const marketplaceExam = await ExamMarketplace.findById(marketplaceExamId)
    if (!marketplaceExam || !marketplaceExam.isActive) {
      return NextResponse.json(
        { error: '考试不存在或已下架' },
        { status: 404 }
      )
    }
    
    // 检查用户是否已经评分过
    const existingRating = await ExamRating.findOne({
      examMarketplaceId: marketplaceExamId,
      userId: decoded.userId
    })
    
    if (existingRating) {
      // 更新评分
      const oldRating = existingRating.rating
      existingRating.rating = rating
      existingRating.comment = comment
      await existingRating.save()
      
      // 更新商城考试的平均评分
      const totalRating = marketplaceExam.rating * marketplaceExam.ratingCount
      const newTotalRating = totalRating - oldRating + rating
      marketplaceExam.rating = newTotalRating / marketplaceExam.ratingCount
      await marketplaceExam.save()
      
      return NextResponse.json({
        message: '评分更新成功',
        rating: existingRating
      })
    } else {
      // 创建新评分
      const newRating = new ExamRating({
        examMarketplaceId: marketplaceExamId,
        userId: decoded.userId,
        userName: decoded.name,
        rating,
        comment
      })
      
      await newRating.save()
      
      // 更新商城考试的平均评分
      const totalRating = marketplaceExam.rating * marketplaceExam.ratingCount + rating
      const newRatingCount = marketplaceExam.ratingCount + 1
      marketplaceExam.rating = totalRating / newRatingCount
      marketplaceExam.ratingCount = newRatingCount
      await marketplaceExam.save()
      
      return NextResponse.json({
        message: '评分成功',
        rating: newRating
      })
    }
  } catch (error) {
    console.error('Rate exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// 获取考试评分列表
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    
    const marketplaceExamId = params.id
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const skip = (page - 1) * limit
    
    // 获取评分列表
    const ratings = await ExamRating.find({ examMarketplaceId: marketplaceExamId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    
    // 获取总数
    const total = await ExamRating.countDocuments({ examMarketplaceId: marketplaceExamId })
    
    return NextResponse.json({
      ratings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get ratings error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}