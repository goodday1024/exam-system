import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { User, Exam, Question, ExamResult } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'

// 获取分析数据
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

    // 获取基础统计数据
    const [totalExams, totalStudents, totalQuestions, totalExamResults] = await Promise.all([
      Exam.countDocuments({ createdBy: decoded.userId }),
      User.countDocuments({ role: 'STUDENT' }),
      Question.countDocuments({ createdBy: decoded.userId }),
      ExamResult.countDocuments()
    ])

    // 计算平均分数
    const averageScoreResult = await ExamResult.aggregate([
      {
        $lookup: {
          from: 'exams',
          localField: 'examId',
          foreignField: '_id',
          as: 'exam'
        }
      },
      {
        $match: {
          'exam.createdBy': decoded.userId
        }
      },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$score' }
        }
      }
    ])

    const averageScore = averageScoreResult.length > 0 ? averageScoreResult[0].averageScore : 0

    // 获取考试统计
    const examStats = await Exam.aggregate([
      {
        $match: { createdBy: decoded.userId }
      },
      {
        $lookup: {
          from: 'examresults',
          localField: '_id',
          foreignField: 'examId',
          as: 'results'
        }
      },
      {
        $addFields: {
          participantCount: { $size: '$results' },
          averageScore: {
            $cond: {
              if: { $gt: [{ $size: '$results' }, 0] },
              then: { $avg: '$results.score' },
              else: 0
            }
          },
          passCount: {
            $size: {
              $filter: {
                input: '$results',
                cond: { $gte: ['$$this.score', 60] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          passRate: {
            $cond: {
              if: { $gt: ['$participantCount', 0] },
              then: { $multiply: [{ $divide: ['$passCount', '$participantCount'] }, 100] },
              else: 0
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          participantCount: 1,
          averageScore: 1,
          passRate: 1
        }
      },
      {
        $sort: { participantCount: -1 }
      },
      {
        $limit: 10
      }
    ])

    // 转换考试统计数据
    const formattedExamStats = examStats.map(exam => ({
      id: exam._id.toString(),
      title: exam.title,
      participantCount: exam.participantCount,
      averageScore: exam.averageScore || 0,
      passRate: exam.passRate || 0
    }))

    // 获取校区统计
    const campusStats = await User.aggregate([
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
        $lookup: {
          from: 'exams',
          localField: 'examResults.examId',
          foreignField: '_id',
          as: 'exams'
        }
      },
      {
        $match: {
          'exams.createdBy': decoded.userId
        }
      },
      {
        $group: {
          _id: '$campus',
          studentCount: { $sum: 1 },
          averageScore: {
            $avg: {
              $cond: {
                if: { $gt: [{ $size: '$examResults' }, 0] },
                then: { $avg: '$examResults.score' },
                else: 0
              }
            }
          }
        }
      },
      {
        $project: {
          campus: '$_id',
          studentCount: 1,
          averageScore: { $ifNull: ['$averageScore', 0] }
        }
      },
      {
        $sort: { studentCount: -1 }
      }
    ])

    // 获取最近活动（简化版本）
    const recentExams = await Exam.find({ createdBy: decoded.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title createdAt isPublished')

    const recentResults = await ExamResult.find()
      .populate({
        path: 'examId',
        match: { createdBy: decoded.userId },
        select: 'title'
      })
      .populate('studentId', 'name')
      .sort({ submittedAt: -1 })
      .limit(5)

    const recentActivity = [
      ...recentExams.map(exam => ({
        type: 'exam_created',
        description: `创建了考试「${exam.title}」`,
        timestamp: exam.createdAt
      })),
      ...recentResults
        .filter(result => result.examId) // 过滤掉没有匹配考试的结果
        .map(result => ({
          type: 'exam_submitted',
          description: `${result.studentId?.name || '学生'} 提交了「${result.examId?.title || '考试'}」`,
          timestamp: result.submittedAt
        }))
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    const analyticsData = {
      totalExams,
      totalStudents,
      totalQuestions,
      totalExamResults,
      averageScore,
      examStats: formattedExamStats,
      campusStats,
      recentActivity
    }

    return NextResponse.json(analyticsData)
  } catch (error) {
    console.error('Get analytics error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}