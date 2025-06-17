import { stdin } from "process"


// 边缘函数轻量级队列实现
interface EvaluationJob {
  id: string
  examId: string
  studentId: string
  code: string
  language: string
  testCases: any[]
  timestamp: number
  retries: number
  priority: number
}

interface JobResult {
  success: boolean
  result?: any
  error?: string
  timestamp: number
}



class EdgeQueue {
  private static instance: EdgeQueue
  private queue: Map<string, EvaluationJob> = new Map()
  private processing: Set<string> = new Set()
  private results: Map<string, JobResult> = new Map()
  private maxConcurrent = 3
  private maxRetries = 3
  private resultTTL = 5 * 60 * 1000 // 5分钟
  private jobTTL = 10 * 60 * 1000 // 10分钟
  
  private constructor() {
    // 启动定期清理
    this.startCleanupTimer()
  }

  static getInstance(): EdgeQueue {
    if (!EdgeQueue.instance) {
      EdgeQueue.instance = new EdgeQueue()
    }
    return EdgeQueue.instance
  }

  // 添加任务到队列
  async addJob(job: Omit<EvaluationJob, 'id' | 'timestamp' | 'retries' | 'priority'>): Promise<string> {
    const jobId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const evaluationJob: EvaluationJob = {
      ...job,
      id: jobId,
      timestamp: Date.now(),
      retries: 0,
      priority: 1 // 默认优先级
    }
    
    this.queue.set(jobId, evaluationJob)
    
    // 立即尝试处理
    this.processNext()
    
    return jobId
  }

  // 添加高优先级任务
  async addHighPriorityJob(job: Omit<EvaluationJob, 'id' | 'timestamp' | 'retries' | 'priority'>): Promise<string> {
    const jobId = await this.addJob(job)
    const evaluationJob = this.queue.get(jobId)
    if (evaluationJob) {
      evaluationJob.priority = 10 // 高优先级
      this.queue.set(jobId, evaluationJob)
    }
    return jobId
  }

  // 处理下一个任务
  private async processNext() {
    if (this.processing.size >= this.maxConcurrent) return
    
    // 按优先级和时间排序获取下一个任务
    const nextJob = Array.from(this.queue.values())
      .filter(job => !this.processing.has(job.id))
      .sort((a, b) => {
        // 先按优先级排序，再按时间排序
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return a.timestamp - b.timestamp
      })[0]
    
    if (!nextJob) return
    
    this.processing.add(nextJob.id)
    
    try {
      console.log(`开始处理评测任务: ${nextJob.id}`)
      const result = await this.executeEvaluation(nextJob)
      
      this.results.set(nextJob.id, {
        success: true,
        result,
        timestamp: Date.now()
      })
      
      this.queue.delete(nextJob.id)
      console.log(`评测任务完成: ${nextJob.id}`)
    } catch (error) {
      console.error(`评测任务失败: ${nextJob.id}`, error)
      
      nextJob.retries++
      if (nextJob.retries >= this.maxRetries) {
        this.results.set(nextJob.id, {
          success: false,
          error: error instanceof Error ? error.message : '评测失败，已达到最大重试次数',
          timestamp: Date.now()
        })
        this.queue.delete(nextJob.id)
        console.log(`评测任务最终失败: ${nextJob.id}`)
      } else {
        // 重新加入队列，降低优先级
        nextJob.priority = Math.max(1, nextJob.priority - 1)
        this.queue.set(nextJob.id, nextJob)
        console.log(`评测任务重试: ${nextJob.id}, 剩余重试次数: ${this.maxRetries - nextJob.retries}`)
      }
    } finally {
      this.processing.delete(nextJob.id)
      // 继续处理下一个任务
      setTimeout(() => this.processNext(), 100)
    }
  }

  // 执行代码评测
  private async executeEvaluation(job: EvaluationJob): Promise<any> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时，适应Vercel免费版和2核2G服务器性能
    
    try {
      const response = await fetch(process.env.SELF_HOSTED_JUDGE_URL || 'http://localhost:3002/api/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'EdgeQueue/1.0'
        },
        body: JSON.stringify({
          source_code: job.code,
          language: job.language,
          stdin: Array.isArray(job.testCases) ? job.testCases.map(testCase => testCase.input).join('\n') : '',
          expected_output: Array.isArray(job.testCases) ? job.testCases.map(testCase => testCase.output).join('\n') : '',
          cpu_time_limit: 10, // 代码执行超时10秒，适应低性能服务器
          memory_limit: 512, // 内存限制512MB
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`评测服务错误: ${response.status} ${response.statusText}`)
      }
      
      const result = await response.json()
      return result
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('评测超时')
      }
      throw error
    }
  }

  // 获取任务状态
  getJobStatus(jobId: string): { status: string, result?: any, error?: string, position?: number, estimatedTime?: number } {
    // 检查是否已完成
    if (this.results.has(jobId)) {
      const result = this.results.get(jobId)!
      return {
        status: 'completed',
        result: result.success ? result.result : undefined,
        error: result.success ? undefined : result.error
      }
    }
    
    // 检查是否正在处理
    if (this.processing.has(jobId)) {
      return { status: 'processing' }
    }
    
    // 检查是否在队列中
    if (this.queue.has(jobId)) {
      const job = this.queue.get(jobId)!
      const queuedJobs = Array.from(this.queue.values())
        .filter(j => !this.processing.has(j.id))
        .sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority
          }
          return a.timestamp - b.timestamp
        })
      
      const position = queuedJobs.findIndex(j => j.id === jobId) + 1
      const estimatedTime = Math.max(1, position * 2) // 预估每个任务2秒
      
      return { 
        status: 'pending', 
        position,
        estimatedTime
      }
    }
    
    return { status: 'not_found' }
  }

  // 取消任务
  cancelJob(jobId: string): boolean {
    if (this.processing.has(jobId)) {
      // 正在处理的任务无法取消
      return false
    }
    
    if (this.queue.has(jobId)) {
      this.queue.delete(jobId)
      this.results.set(jobId, {
        success: false,
        error: '任务已被取消',
        timestamp: Date.now()
      })
      return true
    }
    
    return false
  }

  // 获取队列统计信息
  getQueueStats(): {
    pending: number
    processing: number
    completed: number
    failed: number
  } {
    const completed = Array.from(this.results.values()).filter(r => r.success).length
    const failed = Array.from(this.results.values()).filter(r => !r.success).length
    
    return {
      pending: this.queue.size,
      processing: this.processing.size,
      completed,
      failed
    }
  }

  // 清理过期数据
  private cleanup() {
    const now = Date.now()
    
    // 清理过期的队列任务
    for (const [jobId, job] of this.queue.entries()) {
      if (now - job.timestamp > this.jobTTL) {
        this.queue.delete(jobId)
        this.results.set(jobId, {
          success: false,
          error: '任务超时被清理',
          timestamp: now
        })
        console.log(`清理过期任务: ${jobId}`)
      }
    }
    
    // 清理过期的结果
    for (const [jobId, result] of this.results.entries()) {
      if (now - result.timestamp > this.resultTTL) {
        this.results.delete(jobId)
        console.log(`清理过期结果: ${jobId}`)
      }
    }
  }

  // 启动清理定时器
  private startCleanupTimer() {
    setInterval(() => {
      this.cleanup()
    }, 60000) // 每分钟清理一次
  }

  // 强制清理所有数据（用于测试或重置）
  reset() {
    this.queue.clear()
    this.processing.clear()
    this.results.clear()
    console.log('队列已重置')
  }
}

// 导出单例实例
export const edgeQueue = EdgeQueue.getInstance()
export type { EvaluationJob, JobResult }