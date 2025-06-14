import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { User } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 })
    }

    await connectDB()

    // 从数据库获取最新的用户信息
    const user = await User.findById(decoded.userId).select(
      '_id email name role campus createdAt'
    )

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      campus: user.campus,
      createdAt: user.createdAt
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}