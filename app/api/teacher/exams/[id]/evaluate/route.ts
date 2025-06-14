import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'
import { Exam } from '@/lib/models'
import { ExamResult } from '@/lib/models'
import { Question } from '@/lib/models'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

interface TestCase {
  input: string
  expectedOutput: string
  description?: string
}

interface CodeExecutionResult {
  success: boolean
  output?: string
  error?: string
  executionTime?: number
}

// 执行代码的函数
async function executeCode(code: string, input: string, language: string = 'javascript'): Promise<CodeExecutionResult> {
  const tempDir = path.join(process.cwd(), 'temp')
  let fileName: string
  let filePath: string
  let executablePath: string | null = null

  // 根据语言设置文件扩展名
  if (language === 'cpp' || language === 'c++') {
    fileName = `${uuidv4()}.cpp`
    filePath = path.join(tempDir, fileName)
    executablePath = path.join(tempDir, `${uuidv4()}_exec`)
  } else {
    fileName = `${uuidv4()}.js`
    filePath = path.join(tempDir, fileName)
  }

  try {
    // 确保临时目录存在
    await fs.mkdir(tempDir, { recursive: true })

    // 写入代码文件
    await fs.writeFile(filePath, code)

    const startTime = Date.now()

    if (language === 'cpp' || language === 'c++') {
      // C++ 编译和执行
      return new Promise((resolve) => {
        // 先编译
        const compileChild = spawn('g++', ['-o', executablePath!, filePath], {
          timeout: 10000, // 10秒编译超时
          stdio: ['pipe', 'pipe', 'pipe']
        })

        let compileError = ''

        compileChild.stderr.on('data', (data) => {
          compileError += data.toString()
        })

        compileChild.on('close', async (code) => {
          if (code !== 0) {
            // 编译失败，清理源文件
            try {
              await fs.unlink(filePath)
            } catch (err) {
              console.error('清理源文件失败:', err)
            }
            resolve({
              success: false,
              error: `编译错误: ${compileError}`,
              executionTime: Date.now() - startTime
            })
            return
          }

          // 编译成功，执行程序
          const execChild = spawn(executablePath!, [], {
            timeout: 5000, // 5秒执行超时
            stdio: ['pipe', 'pipe', 'pipe']
          })

          let output = ''
          let execError = ''

          execChild.stdout.on('data', (data) => {
            output += data.toString()
          })

          execChild.stderr.on('data', (data) => {
            execError += data.toString()
          })

          execChild.on('close', (execCode) => {
            const executionTime = Date.now() - startTime
            
            console.log('=== C++ 代码执行结果 ===')
            console.log('输出内容:', output)
            console.log('错误信息:', execError)
            console.log('退出码:', execCode)
            console.log('执行时间:', executionTime, 'ms')
            console.log('========================')

            if (execCode === 0 && !execError) {
              resolve({
                success: true,
                output: output.trim(),
                executionTime
              })
            } else {
              resolve({
                success: false,
                error: execError || `程序退出码: ${execCode}`,
                executionTime
              })
            }
          })

          execChild.on('error', async (err) => {
            // 执行错误，清理临时文件
            try {
              await fs.unlink(filePath)
              await fs.unlink(executablePath!)
            } catch (cleanupErr) {
              console.error('清理临时文件失败:', cleanupErr)
            }
            resolve({
              success: false,
              error: `执行错误: ${err.message}`,
              executionTime: Date.now() - startTime
            })
          })

          // 发送输入数据
          if (input) {
            execChild.stdin.write(input)
          }
          execChild.stdin.end()
        })

        compileChild.on('error', async (err) => {
          // 编译进程错误，清理源文件
          try {
            await fs.unlink(filePath)
          } catch (cleanupErr) {
            console.error('清理源文件失败:', cleanupErr)
          }
          resolve({
            success: false,
            error: `编译进程错误: ${err.message}`,
            executionTime: Date.now() - startTime
          })
        })
      })
    } else {
      // JavaScript 执行（原有逻辑）
      return new Promise((resolve) => {
        const child = spawn('node', [filePath], {
          timeout: 5000, // 5秒超时
          stdio: ['pipe', 'pipe', 'pipe']
        })

        let output = ''
        let error = ''

        child.stdout.on('data', (data) => {
          output += data.toString()
        })

        child.stderr.on('data', (data) => {
          error += data.toString()
        })

        child.on('close', async (code) => {
          const executionTime = Date.now() - startTime
          
          console.log('=== JavaScript 代码执行结果 ===')
          console.log('输出内容:', output)
          console.log('错误信息:', error)
          console.log('退出码:', code)
          console.log('执行时间:', executionTime, 'ms')
          console.log('===============================')

          // 清理临时文件
          try {
            await fs.unlink(filePath)
          } catch (err) {
            console.error('清理JavaScript临时文件失败:', err)
          }

          if (code === 0 && !error) {
            resolve({
              success: true,
              output: output.trim(),
              executionTime
            })
          } else {
            resolve({
              success: false,
              error: error || `进程退出码: ${code}`,
              executionTime
            })
          }
        })

        child.on('error', async (err) => {
          // 进程错误，清理临时文件
          try {
            await fs.unlink(filePath)
          } catch (cleanupErr) {
            console.error('清理JavaScript临时文件失败:', cleanupErr)
          }
          resolve({
            success: false,
            error: `进程错误: ${err.message}`,
            executionTime: Date.now() - startTime
          })
        })

        // 发送输入数据
        if (input) {
          child.stdin.write(input)
        }
        child.stdin.end()
      })
    }
  } catch (error) {
    // 异常情况下清理临时文件
    try {
      await fs.unlink(filePath)
      if (executablePath) {
        await fs.unlink(executablePath)
      }
    } catch (cleanupErr) {
      console.error('异常情况下清理临时文件失败:', cleanupErr)
    }
    return {
      success: false,
      error: `执行失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// 运行测试样例
async function runTestCases(code: string, testCases: TestCase[], language: string = 'javascript'): Promise<{
  totalTests: number
  passedTests: number
  results: Array<{
    testCase: TestCase
    passed: boolean
    actualOutput?: string
    error?: string
  }>
}> {
  const results = []
  let passedTests = 0

  console.log(`\n开始运行 ${testCases.length} 个测试用例...`)
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.log(`\n--- 测试用例 ${i + 1} ---`)
    console.log('输入:', JSON.stringify(testCase.input))
    console.log('期望输出:', JSON.stringify(testCase.expectedOutput))
    
    const result = await executeCode(code, testCase.input, language)

    if (result.success) {
      const actualOutput = result.output || ''
      const expectedOutput = testCase.expectedOutput.trim()
      const passed = actualOutput === expectedOutput
      
      console.log('实际输出:', JSON.stringify(actualOutput))
      console.log('测试结果:', passed ? '✅ 通过' : '❌ 失败')
      
      if (!passed) {
        console.log('输出对比:')
        console.log('  期望:', expectedOutput)
        console.log('  实际:', actualOutput)
        console.log('  长度对比: 期望', expectedOutput.length, '实际', actualOutput.length)
      }

      if (passed) {
        passedTests++
      }

      results.push({
        testCase,
        passed,
        actualOutput
      })
    } else {
      console.log('执行失败:', result.error)
      console.log('测试结果: ❌ 失败')
      
      results.push({
        testCase,
        passed: false,
        error: result.error
      })
    }
  }
  
  console.log(`\n测试完成: ${passedTests}/${testCases.length} 个测试用例通过\n`)

  return {
    totalTests: testCases.length,
    passedTests,
    results
  }
}

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
      model: 'Question'
    })

    if (!exam) {
      return NextResponse.json(
        { error: '考试不存在或无权限' },
        { status: 404 }
      )
    }

    // 获取所有考试结果
    const examResults = await ExamResult.find({ examId })

    if (examResults.length === 0) {
      return NextResponse.json(
        { error: '暂无考试结果' },
        { status: 404 }
      )
    }

    // 检查是否已完成评分
    const ungradedResults = examResults.filter(result => !result.isGraded)
    if (ungradedResults.length > 0) {
      return NextResponse.json(
        { error: `还有 ${ungradedResults.length} 份答卷未评分，请先完成评分再进行代码评测` },
        { status: 400 }
      )
    }

    const evaluationResults = []

    // 遍历每个学生的考试结果
    for (const examResult of examResults) {
      console.log('处理学生考试结果:', examResult.studentId)
      
      // 解析学生答案JSON字符串
      const studentAnswers = examResult.answers ? JSON.parse(examResult.answers) : {}
      console.log('学生答案结构:', studentAnswers)
      
      let totalScore = 0
      const questionResults = []

      // 遍历每道题目
      console.log('开始遍历题目，总数:', exam.questions.length)
      for (const questionItem of exam.questions) {
        console.log('处理题目项:', questionItem)
        const question = questionItem.questionId
        if (!question) {
          console.error('Question data is missing:', questionItem)
          continue
        }

        // 安全获取题目ID
        const questionId = question._id?.toString() || question.id?.toString() || ''
        console.log('题目ID:', questionId)
        if (!questionId) {
          console.error('Question ID is missing:', question)
          continue
        }

        // 尝试多种方式获取学生答案
        let studentAnswer = studentAnswers[questionId]
        if (!studentAnswer) {
          // 如果直接匹配失败，尝试使用原始 ObjectId 字符串
          const rawId = question._id?.toString()
          studentAnswer = studentAnswers[rawId]
        }
        if (!studentAnswer) {
          // 尝试遍历所有答案键，找到匹配的
          const answerKeys = Object.keys(studentAnswers)
          for (const key of answerKeys) {
            if (key === questionId || key === question._id?.toString()) {
              studentAnswer = studentAnswers[key]
              break
            }
          }
        }
        console.log('学生答案:', studentAnswer)
        console.log('答案键值对比:', { questionId, rawId: question._id?.toString(), availableKeys: Object.keys(studentAnswers) })

        // 如果仍然没有找到学生答案，跳过这道题
        if (!studentAnswer) {
          console.log('未找到学生答案，跳过题目:', questionId)
          continue
        }

        if (question.type === 'PROGRAMMING') {
          // 处理编程题
          try {
            const testCases = question.testCases ? JSON.parse(question.testCases) : []
            // 获取编程语言，默认为 javascript，支持 cpp
            const programmingLanguage = question.language || 'javascript'

            console.log(`\n=== 开始评测编程题 ===`)
            console.log(`题目: ${question.title}`)
            console.log(`语言: ${programmingLanguage}`)
            console.log(`测试用例数: ${testCases.length}`)
            console.log(`学生代码:`)
            console.log('--- 代码开始 ---')
            console.log(studentAnswer)
            console.log('--- 代码结束 ---')
            console.log('=====================\n')

            if (testCases.length > 0) {
              // 使用测试用例进行评测
              const testResult = await runTestCases(studentAnswer, testCases, programmingLanguage)
              const passRate = testResult.passedTests / testResult.totalTests

              console.log(`测试结果: 通过 ${testResult.passedTests}/${testResult.totalTests} 个测试用例，通过率: ${(passRate * 100).toFixed(1)}%`)

              // 根据通过率给分
              let score = 0
              if (passRate >= 0.9) {
                score = question.points // 90%以上通过率：满分
              } else if (passRate >= 0.7) {
                score = Math.floor(question.points * 0.8) // 70-89%：80%分数
              } else if (passRate >= 0.5) {
                score = Math.floor(question.points * 0.6) // 50-69%：60%分数
              } else if (passRate >= 0.3) {
                score = Math.floor(question.points * 0.4) // 30-49%：40%分数
              } else {
                score = 0 // 30%以下：0分
              }

              totalScore += score

              questionResults.push({
                questionId: questionId,
                questionTitle: question.title,
                questionType: question.type,
                studentAnswer,
                score,
                maxScore: question.points,
                testResult: {
                  ...testResult,
                  passRate: passRate,
                  message: `通过 ${testResult.passedTests}/${testResult.totalTests} 个测试用例`
                }
              })
            } else {
              // 没有测试用例，给予提示但不评分
              console.log('编程题缺少测试用例，无法自动评测')
              const score = 0
              totalScore += score
              
              questionResults.push({
                questionId: questionId,
                questionTitle: question.title,
                questionType: question.type,
                studentAnswer,
                score,
                maxScore: question.points,
                testResult: {
                  totalTests: 0,
                  passedTests: 0,
                  results: [],
                  message: '该题目缺少测试用例，无法自动评测'
                }
              })
            }
          } catch (error) {
            console.error('编程题评测错误:', error)
            const score = 0
            totalScore += score
            
            questionResults.push({
              questionId: questionId,
              questionTitle: question.title,
              questionType: question.type,
              studentAnswer,
              score,
              maxScore: question.points,
              error: error instanceof Error ? error.message : '评测过程中发生错误'
            })
          }
        } else {
          // 处理其他类型题目（选择题、判断题）
          let score = 0
          if (studentAnswer) {
            if (question.type === 'MULTIPLE_CHOICE') {
              if ((studentAnswer || '').toString().toUpperCase() === question.correctAnswer.toUpperCase()) {
                score = question.points
              }
            } else if (question.type === 'TRUE_FALSE') {
              if ((studentAnswer || '').toString().toLowerCase() === question.correctAnswer.toLowerCase()) {
                score = question.points
              }
            }
          }

          totalScore += score

          questionResults.push({
            questionId: questionId,
            questionTitle: question.title,
            questionType: question.type,
            studentAnswer,
            correctAnswer: question.correctAnswer,
            score,
            maxScore: question.points
          })
        }
      }

      // 更新考试结果
      await ExamResult.findByIdAndUpdate(examResult._id, {
        score: totalScore,
        graded: true
      })

      evaluationResults.push({
        studentId: examResult.studentId,
        totalScore,
        questionResults
      })
    }

    return NextResponse.json({
      message: '代码评测完成',
      evaluationResults
    })

  } catch (error) {
    console.error('代码评测错误:', error)
    return NextResponse.json(
      { error: '评测失败' },
      { status: 500 }
    )
  }
}