import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Exam from '@/lib/models/Exam'
import ExamResult from '@/lib/models/ExamResult'
import User from '@/lib/models/User'
import { verifyToken } from '@/lib/jwt'

// 导入编程成绩
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

    const examId = params.id
    
    // 验证考试是否存在
    const exam = await Exam.findById(examId)
    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在' },
        { status: 404 }
      )
    }

    // 检查是否已经导入过编程成绩
    const existingImport = await ExamResult.findOne({
      examId: examId,
      programmingScoreImported: true
    })
    
    if (existingImport) {
      return NextResponse.json(
        { error: '编程成绩已经导入过，如需重新导入请先进行自动判分' },
        { status: 400 }
      )
    }

    // 获取上传的文件数据
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: '请选择要上传的文件' },
        { status: 400 }
      )
    }

    // 读取CSV文件内容
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV文件格式错误，至少需要包含表头和一行数据' },
        { status: 400 }
      )
    }

    // 解析CSV表头
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    
    // 验证必需的列
    const requiredColumns = ['学生', '得分']
    const missingColumns = requiredColumns.filter(col => !headers.includes(col))
    
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `CSV文件缺少必需的列: ${missingColumns.join(', ')}` },
        { status: 400 }
      )
    }

    // 获取列索引
    const studentIndex = headers.indexOf('学生')
    const scoreIndex = headers.indexOf('得分')
    
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // 处理每一行数据
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        
        if (values.length < headers.length) {
          errors.push(`第${i + 1}行数据不完整`)
          errorCount++
          continue
        }

        const studentName = values[studentIndex]
        const programmingScore = parseFloat(values[scoreIndex])

        if (!studentName) {
          errors.push(`第${i + 1}行学生姓名为空`)
          errorCount++
          continue
        }

        if (isNaN(programmingScore)) {
          errors.push(`第${i + 1}行编程得分格式错误: ${values[scoreIndex]}`)
          errorCount++
          continue
        }

        // 查找学生
        const student = await User.findOne({ name: studentName, role: 'STUDENT' })
        if (!student) {
          errors.push(`第${i + 1}行找不到学生: ${studentName}`)
          errorCount++
          continue
        }

        // 查找考试结果
        const examResult = await ExamResult.findOne({
          examId: examId,
          studentId: student._id
        })

        if (!examResult) {
          errors.push(`第${i + 1}行学生 ${studentName} 未参加此考试`)
          errorCount++
          continue
        }

        // 计算总分（原有分数 + 编程分数）
        const originalScore = examResult.score || 0
        const newTotalScore = originalScore + programmingScore

        // 更新考试结果
        await ExamResult.findByIdAndUpdate(examResult._id, {
          score: newTotalScore,
          isGraded: true,
          gradedAt: new Date(),
          // 保存编程分数到自定义字段
          programmingScore: programmingScore,
          // 标记编程成绩已导入
          programmingScoreImported: true,
          programmingScoreImportedAt: new Date()
        })

        successCount++
      } catch (error) {
        console.error(`处理第${i + 1}行时出错:`, error)
        errors.push(`第${i + 1}行处理失败: ${error}`)
        errorCount++
      }
    }

    return NextResponse.json({
      message: '编程成绩导入完成',
      successCount,
      errorCount,
      errors: errors.slice(0, 10) // 只返回前10个错误
    })

  } catch (error) {
    console.error('Import programming scores error:', error)
    return NextResponse.json(
      { error: '导入编程成绩失败' },
      { status: 500 }
    )
  }
}