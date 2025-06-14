import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { User } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

// 获取学生列表
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

    // 获取所有学生，包含考试结果统计
    const students = await User.aggregate([
      {
        $match: { role: 'STUDENT' }
      },
      {
        $lookup: {
          from: 'examresults',
          localField: '_id',
          foreignField: 'studentId',
          as: 'examResults'
        }
      },
      {
        $addFields: {
          _count: {
            examResults: { $size: '$examResults' }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          campus: 1,
          createdAt: 1,
          _count: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ])

    // 转换 _id 为 id
    const formattedStudents = students.map(student => ({
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      campus: student.campus,
      createdAt: student.createdAt,
      _count: student._count
    }))

    return NextResponse.json({ students: formattedStudents })
  } catch (error) {
    console.error('Get students error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}