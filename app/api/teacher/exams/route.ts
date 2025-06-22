import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Exam, Question } from '@/lib/models'
import { verifyToken } from '@/lib/jwt'
import mongoose from 'mongoose'
import { fromZonedTime } from 'date-fns-tz'
// 移除缓存清理依赖，实现实时数据更新

// 获取考试列表
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

    const exams = await Exam.aggregate([
      {
        $match: { createdBy: new mongoose.Types.ObjectId(decoded.userId) }
      },
      {
        $lookup: {
          from: 'examresults',
          localField: '_id',
          foreignField: 'examId',
          as: 'examResults'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy'
        }
      },
      {
        $lookup: {
          from: 'questions',
          localField: 'questions.questionId',
          foreignField: '_id',
          as: 'questionDetails'
        }
      },
      {
        $addFields: {
          _count: {
            examResults: { $size: '$examResults' },
            gradedResults: {
              $size: {
                $filter: {
                  input: '$examResults',
                  cond: { $eq: ['$$this.isGraded', true] }
                }
              }
            },
            ungradedResults: {
              $size: {
                $filter: {
                  input: '$examResults',
                  cond: { $eq: ['$$this.isGraded', false] }
                }
              }
            }
          },
          createdBy: { $arrayElemAt: ['$createdBy', 0] },
          questions: {
            $map: {
              input: '$questions',
              as: 'q',
              in: {
                questionId: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$questionDetails',
                        cond: { $eq: ['$$this._id', '$$q.questionId'] }
                      }
                    },
                    0
                  ]
                },
                points: '$$q.points'
              }
            }
          }
        }
      },
      {
        $project: {
          examResults: 0,
          questionDetails: 0,
          'createdBy.password': 0
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ])

    // 移除缓存头设置，实现数据实时更新
    return NextResponse.json({ exams })
  } catch (error) {
    console.error('Get exams error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// 创建考试
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { 
      title, 
      description, 
      startTime, 
      endTime, 
      duration, 
      maxTabSwitches, 
      questionIds 
    } = await request.json()

    if (!title || !startTime || !endTime || !duration || !questionIds || questionIds.length === 0) {
      return NextResponse.json(
        { error: '请填写所有必填字段' },
        { status: 400 }
      )
    }

    // 验证时间并转换为 UTC
    const timeZone = 'Asia/Shanghai'
    const start = fromZonedTime(startTime, timeZone)
    const end = fromZonedTime(endTime, timeZone)
    
    if (start >= end) {
      return NextResponse.json(
        { error: '结束时间必须晚于开始时间' },
        { status: 400 }
      )
    }

    await connectDB()

    // 验证题目是否存在且属于当前用户
    console.log('Received questionIds:', questionIds)
    console.log('User ID:', decoded.userId)
    
    const questions = await Question.find({
      _id: { $in: questionIds },
      createdBy: decoded.userId
    })
    
    console.log('Found questions:', questions.length)
    console.log('Expected questions:', questionIds.length)

    if (questions.length !== questionIds.length) {
      return NextResponse.json(
        { error: '部分题目不存在或无权限' },
        { status: 400 }
      )
    }

    // 创建考试
    const exam = await Exam.create({
      title,
      description,
      startTime: start,
      endTime: end,
      duration,
      maxTabSwitches: maxTabSwitches || 3,
      createdBy: decoded.userId,
      questions: questionIds.map((questionId: string, index: number) => ({
        questionId,
        order: index + 1
      }))
    })

    const populatedExam = await Exam.findById(exam._id)
      .populate('createdBy', 'name email')
      .populate('questions.questionId')

    // 已移除缓存清理，数据实时更新

    return NextResponse.json({
      message: '考试创建成功',
      exam: populatedExam
    })
  } catch (error) {
    console.error('Create exam error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}