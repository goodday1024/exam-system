import connectDB from './mongodb'
import ExamModel from './models/Exam'
import ExamResultModel from './models/ExamResult'
import { EvaluationTask, IEvaluationTask } from './models/EvaluationTask'
import mongoose from 'mongoose'

class EvaluationQueue {
  private static instance: EvaluationQueue
  private isProcessing = false
  private processingInterval: NodeJS.Timeout | null = null

  private constructor() {
    // 启动时检查是否有待处理的任务，如果有则启动队列处理器
    this.initializeQueue()
  }

  // 初始化队列，检查是否有待处理任务
  private async initializeQueue() {
    try {
      await connectDB()
      const pendingTasks = await EvaluationTask.find({
        status: { $in: ['pending', 'processing'] }
      }).limit(1)
      
      if (pendingTasks.length > 0) {
        console.log('发现待处理的评测任务，启动队列处理器')
        this.startQueueProcessor()
      }
    } catch (error) {
      console.error('初始化评测队列失败:', error)
    }
  }

  static getInstance(): EvaluationQueue {
    if (!EvaluationQueue.instance) {
      EvaluationQueue.instance = new EvaluationQueue()
    }
    return EvaluationQueue.instance
  }

  // 添加评测任务到队列
  async addTask(examId: string, teacherId: string, force: boolean = false): Promise<string> {
    await connectDB()
    
    // 确保队列处理器已启动
    if (!this.processingInterval) {
      this.startQueueProcessor()
    }
    
    // 检查是否已有进行中的任务
    const existingTask = await EvaluationTask.findOne({
      examId,
      teacherId,
      status: { $in: ['pending', 'processing'] }
    }).sort({ createdAt: -1 })

    if (existingTask && !force) {
      return existingTask._id.toString()
    }

    // 如果是强制重新评测且存在进行中的任务，先将其标记为失败
    if (force && existingTask) {
      await EvaluationTask.updateOne(
        { _id: existingTask._id },
        { 
          status: 'failed',
          error: '被新的评测任务替代',
          updatedAt: new Date()
        }
      )
    }

    // 创建新任务
    const task = new EvaluationTask({
      examId,
      teacherId,
      status: 'pending',
      progress: {
        total: 0,
        completed: 0
      }
    })

    await task.save()
    return task._id.toString()
  }

  // 获取任务状态
  async getTaskStatus(taskId: string): Promise<IEvaluationTask | null> {
    await connectDB()
    return await EvaluationTask.findById(taskId)
  }

  // 启动队列处理器
  private startQueueProcessor() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }

    console.log('评测队列处理器已启动，每2秒检查一次队列')
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNextTask()
      }
    }, 2000) // 每2秒检查一次队列
  }

  // 处理下一个任务
  private async processNextTask() {
    if (this.isProcessing) return

    try {
      this.isProcessing = true
      await connectDB()

      // 获取下一个待处理任务
      const task = await EvaluationTask.findOne({
        status: 'pending'
      }).sort({ createdAt: 1 })

      if (!task) {
        console.log('队列检查：没有待处理的评测任务')
        return
      }

      console.log(`开始处理评测任务: ${task._id}`)
      await this.executeTask(task)

    } catch (error) {
      console.error('处理队列任务时出错:', error)
    } finally {
      this.isProcessing = false
    }
  }

  // 执行具体的评测任务
  private async executeTask(task: any) {
    try {
      // 更新任务状态为处理中
      await EvaluationTask.findByIdAndUpdate(task._id, {
        status: 'processing',
        updatedAt: new Date()
      })

      // 获取考试信息
      const exam = await ExamModel.findOne({
        _id: task.examId,
        createdBy: task.teacherId
      }).populate({
        path: 'questions.questionId',
        match: { type: 'PROGRAMMING' }
      })

      if (!exam) {
        throw new Error('考试不存在')
      }

      const programmingQuestions = exam.questions.filter((q: any) => q.questionId && q.questionId.type === 'PROGRAMMING')
      
      if (programmingQuestions.length === 0) {
        throw new Error('没有编程题需要评测')
      }

      // 更新总数
      await EvaluationTask.findByIdAndUpdate(task._id, {
        'progress.total': programmingQuestions.length
      })

      const results: any[] = []

      // 逐个处理编程题
      for (let i = 0; i < programmingQuestions.length; i++) {
        // 检查任务是否被停止
        const currentTask = await EvaluationTask.findById(task._id)
        if (!currentTask || currentTask.status === 'failed') {
          console.log('任务已被停止，中断执行')
          return
        }
        
        const examQuestion = programmingQuestions[i]
        const question = examQuestion.questionId
        
        console.log('处理编程题:', {
          examQuestion,
          question,
          questionId: question?._id,
          questionTitle: question?.title
        })
        
        if (!question) {
          console.error('题目对象为空:', examQuestion)
          results.push({
            questionId: null,
            questionTitle: null,
            error: '题目数据不完整'
          })
          continue
        }
        
        // 更新当前处理的题目
        await EvaluationTask.findByIdAndUpdate(task._id, {
          'progress.current': question.title,
          updatedAt: new Date()
        })

        try {
          const questionResult = await this.evaluateQuestion(question, task.examId, task._id, i, programmingQuestions.length)
          console.log('题目评测结果:', questionResult)
          results.push(questionResult)

          // 更新完成数量
          await EvaluationTask.findByIdAndUpdate(task._id, {
            'progress.completed': i + 1,
            updatedAt: new Date()
          })

        } catch (error) {
          console.error(`评测题目 ${question.title} 时出错:`, error)
          results.push({
            questionId: question._id,
            questionTitle: question.title,
            error: error instanceof Error ? error.message : '评测失败'
          })
        }
      }

      // 任务完成，更新学生分数
      await this.updateStudentScores(results, task.examId)
      
      await EvaluationTask.findByIdAndUpdate(task._id, {
        status: 'completed',
        results,
        completedAt: new Date(),
        updatedAt: new Date()
      })

      console.log(`评测任务完成: ${task._id}`)

    } catch (error) {
      console.error(`执行评测任务失败: ${task._id}`, error)
      
      await EvaluationTask.findByIdAndUpdate(task._id, {
        status: 'failed',
        error: error instanceof Error ? error.message : '未知错误',
        updatedAt: new Date()
      })
    }
  }

  // 评测单个编程题
  private async evaluateQuestion(question: any, examId: string, taskId?: string, questionIndex?: number, totalQuestions?: number) {
    // 获取该题目的所有提交（从ExamResult中获取答案）
    const submissions = await ExamResultModel.find({
      examId
    }).populate('studentId', 'username')

    const submissionResults = []
    const totalSubmissions = submissions.length

    for (let submissionIndex = 0; submissionIndex < submissions.length; submissionIndex++) {
      const submission = submissions[submissionIndex]
      try {
        // 解析答案JSON，获取该题目的代码
        const answers = JSON.parse(submission.answers || '{}')
        const questionAnswer = answers[question._id.toString()]
        
        if (questionAnswer) {
          // 处理两种格式：字符串格式（直接是代码）或对象格式（包含code和language）
          let code, language
          if (typeof questionAnswer === 'string') {
            code = questionAnswer
            language = question.language || 'javascript' // 从题目获取语言
          } else if (questionAnswer.code) {
            code = questionAnswer.code
            language = questionAnswer.language || question.language || 'javascript'
          }
          
          if (code && code.trim()) {
            const result = await this.evaluateSubmission({
              _id: submission._id,
              userId: submission.studentId,
              answer: code,
              language: language
            }, question)
            submissionResults.push(result)
          }
        }
      } catch (error) {
        submissionResults.push({
          submissionId: submission._id,
          userId: submission.studentId,
          error: error instanceof Error ? error.message : '评测失败'
        })
      }

      // 更新细粒度进度
      if (taskId && questionIndex !== undefined && totalQuestions !== undefined) {
        const baseProgress = questionIndex / totalQuestions
        const submissionProgress = (submissionIndex + 1) / totalSubmissions / totalQuestions
        const currentProgress = Math.min(questionIndex + (submissionIndex + 1) / totalSubmissions, totalQuestions)
        
        await EvaluationTask.findByIdAndUpdate(taskId, {
          'progress.completed': currentProgress,
          'progress.current': `${question.title} (${submissionIndex + 1}/${totalSubmissions} 学生)`,
          updatedAt: new Date()
        })
      }
    }

    return {
      questionId: question._id,
      questionTitle: question.title,
      totalSubmissions: submissions.length,
      results: submissionResults
    }
  }

  // 评测单个提交
  private async evaluateSubmission(submission: any, question: any) {
    try {
      const code = submission.code
      const language = submission.language || 'javascript'
      const testCases = question.testCases || []
      
      if (!code || !testCases.length) {
        return {
          submissionId: submission._id,
          userId: submission.userId,
          status: 'failed',
          score: 0,
          error: '代码或测试用例为空'
        }
      }

      // 运行测试用例，传递题目的时间限制
      const timeLimit = question.timeLimit || 1 // 默认1秒
      const testResult = await this.runTestCases(code, testCases, language, timeLimit)
      
      // 计算分数
      const score = testResult.totalTests > 0 
        ? Math.round((testResult.passedTests / testResult.totalTests) * 100)
        : 0

      return {
        submissionId: submission._id,
        userId: submission.userId,
        status: 'completed',
        score,
        details: {
          totalTests: testResult.totalTests,
          passedTests: testResult.passedTests,
          results: testResult.results
        }
      }
    } catch (error) {
      return {
        submissionId: submission._id,
        userId: submission.userId,
        status: 'failed',
        score: 0,
        error: error instanceof Error ? error.message : '评测失败'
      }
    }
  }

  // 代码评测客户端
  private async executeCode(code: string, input: string, language: string, timeLimit: number = 10, memoryLimit: number = 512) {
    try {
      const baseUrl = process.env.SELF_HOSTED_JUDGE_URL || 'http://localhost:3001'
      const timeout = 50000
      
      const response = await fetch(`${baseUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SELF_HOSTED_JUDGE_API_KEY && {
            'Authorization': `Bearer ${process.env.SELF_HOSTED_JUDGE_API_KEY}`
          })
        },
        body: JSON.stringify({
          source_code: code,
          stdin: input || '',
          language,
          cpu_time_limit: timeLimit,
          memory_limit: memoryLimit
        }),
        signal: AbortSignal.timeout(timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: result.status === 'success',
        output: result.output || '',
        error: result.error,
        executionTime: result.executionTime
      }
    } catch (error) {
      return {
        success: false,
        error: `服务调用失败: ${error instanceof Error ? error.message : '未知错误'}`,
        executionTime: 0
      }
    }
  }

  // 运行测试用例
  private async runTestCases(code: string, testCases: any[], language: string, timeLimit?: number) {
    const results = []
    let passedTests = 0

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]
      const result = await this.executeCode(code, testCase.input, language, timeLimit)

      if (result.success) {
        const actualOutput = (result.output || '').trim()
        const expectedOutput = testCase.expectedOutput.trim()
        const outputMatches = actualOutput === expectedOutput
        
        // 检查时间限制
        let timeLimitExceeded = false
        if (timeLimit && result.executionTime) {
          // 将执行时间转换为秒（如果是毫秒）
          const executionTimeInSeconds = result.executionTime > 100 ? result.executionTime / 1000 : result.executionTime
          timeLimitExceeded = executionTimeInSeconds > timeLimit
        }
        
        const passed = outputMatches && !timeLimitExceeded
        
        if (passed) {
          passedTests++
        }

        results.push({
          testCase,
          passed,
          actualOutput,
          executionTime: result.executionTime,
          timeLimitExceeded,
          status: timeLimitExceeded ? 'Time Limit Exceeded' : (outputMatches ? 'Accepted' : 'Wrong Answer')
        })
      } else {
        results.push({
          testCase,
          passed: false,
          error: result.error,
          status: 'Runtime Error'
        })
      }
    }

    return {
      totalTests: testCases.length,
      passedTests,
      results
    }
  }

  // 更新学生分数
  private async updateStudentScores(results: any[], examId: string) {
    try {
      // 收集所有学生的编程题分数
      const studentScores: Record<string, number> = {}
      
      for (const questionResult of results) {
        if (questionResult.results && Array.isArray(questionResult.results)) {
          for (const submissionResult of questionResult.results) {
            if (submissionResult.userId && submissionResult.score !== undefined) {
              const userId = submissionResult.userId._id || submissionResult.userId
              if (!studentScores[userId]) {
                studentScores[userId] = 0
              }
              studentScores[userId] += submissionResult.score
            }
          }
        }
      }
      
      // 更新每个学生的考试结果分数
      for (const [userId, programmingScore] of Object.entries(studentScores)) {
        const examResult = await ExamResultModel.findOne({
          examId,
          studentId: userId
        })
        
        if (examResult) {
          // 获取当前分数，如果没有则为0
          const currentScore = examResult.score || 0
          // 加上编程题分数
          const newScore = currentScore + programmingScore
          
          await ExamResultModel.findByIdAndUpdate(examResult._id, {
            score: newScore,
            isGraded: true,
            gradedAt: new Date(),
            updatedAt: new Date()
          })
          
          console.log(`更新学生 ${userId} 分数: ${currentScore} + ${programmingScore} = ${newScore}`)
        }
      }
      
      console.log('学生分数更新完成')
    } catch (error) {
      console.error('更新学生分数时出错:', error)
    }
  }

  // 停止队列处理器
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
  }
}

export const evaluationQueue = EvaluationQueue.getInstance()