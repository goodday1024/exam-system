import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { ExamMarketplace } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

// 获取商城考试列表
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const category = searchParams.get('category')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'publishedAt' // publishedAt, rating, downloadCount
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    // 构建查询条件
    const query: any = { isActive: true }
    
    if (category && category !== 'all') {
      query.category = category
    }
    
    if (difficulty && difficulty !== 'all') {
      query.difficulty = difficulty
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ]
    }
    
    // 构建排序
    const sort: any = {}
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1
    
    const skip = (page - 1) * limit
    
    // 获取考试列表
    const exams = await ExamMarketplace.find(query)
      .select('-examData') // 不返回完整考试数据
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
    
    // 获取总数
    const total = await ExamMarketplace.countDocuments(query)
    
    // 解析预览题目
    const examsWithPreview = exams.map(exam => ({
      ...exam,
      previewQuestions: JSON.parse(exam.previewQuestions)
    }))
    
    // 移除缓存头设置，实现数据实时更新
    return NextResponse.json({
      exams: examsWithPreview,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get marketplace exams error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}