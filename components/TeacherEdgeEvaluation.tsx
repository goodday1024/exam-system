'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface TeacherEdgeEvaluationProps {
  examId: string
  onComplete?: (results: any) => void
  onError?: (error: string) => void
}

interface StudentSubmission {
  studentId: string
  studentName: string
  code: string
  language: string
  questionId: string
  testCases?: any[]
}

interface EvaluationJob {
  jobId: string
  studentId: string
  studentName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: any
  error?: string
}

export default function TeacherEdgeEvaluation({ examId, onComplete, onError }: TeacherEdgeEvaluationProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([])
  const [evaluationJobs, setEvaluationJobs] = useState<EvaluationJob[]>([])
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [queueStats, setQueueStats] = useState<any>(null)

  // 获取学生提交的编程题答案
  const fetchSubmissions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/teacher/exams/${examId}/programming-submissions`, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('获取学生提交失败')
      }
      
      const data = await response.json()
      setSubmissions(data.submissions || [])
    } catch (error) {
      console.error('获取提交失败:', error)
      onError?.(error instanceof Error ? error.message : '获取学生提交失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 启动批量评测（流式版本）
  const startBatchEvaluation = async () => {
    if (submissions.length === 0) {
      onError?.('没有找到需要评测的编程题提交')
      return
    }

    setIsEvaluating(true)
    setProgress(0)
    
    const jobs: EvaluationJob[] = []
    
    try {
      // 为每个学生提交创建流式评测任务
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i]
        
        // 创建流式评测连接
        const response = await fetch('/api/evaluate-edge/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            examId,
            studentId: submission.studentId,
            code: submission.code,
            language: submission.language,
            testCases: submission.testCases || [],
            priority: true // 教师评测使用高优先级
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '提交评测任务失败')
        }
        
        // 处理流式响应
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        
        if (reader) {
          const job: EvaluationJob = {
            jobId: `stream_${Date.now()}_${i}`,
            studentId: submission.studentId,
            studentName: submission.studentName,
            status: 'pending'
          }
          
          jobs.push(job)
          setEvaluationJobs([...jobs])
          
          // 处理流式数据
          processStreamResponse(reader, decoder, job, jobs)
        }
      }
      
    } catch (error) {
      console.error('启动批量评测失败:', error)
      onError?.(error instanceof Error ? error.message : '启动批量评测失败')
      setIsEvaluating(false)
    }
  }

  // 处理流式响应
  const processStreamResponse = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    job: EvaluationJob,
    allJobs: EvaluationJob[]
  ) => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              // 更新任务状态
              setEvaluationJobs(prevJobs => 
                prevJobs.map(j => 
                  j.studentId === job.studentId 
                    ? { ...j, status: getStatusFromEvent(data), result: data.result, error: data.error }
                    : j
                )
              )
              
              // 更新进度
              updateProgress(allJobs)
              
              // 处理完成事件
              if (data.success !== undefined) {
                console.log(`学生 ${job.studentName} 评测完成:`, data)
              }
              
            } catch (parseError) {
              console.error('解析流式数据失败:', parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error('处理流式响应失败:', error)
      // 标记任务为失败
      setEvaluationJobs(prevJobs => 
        prevJobs.map(j => 
          j.studentId === job.studentId 
            ? { ...j, status: 'failed', error: '流式连接失败' }
            : j
        )
      )
    } finally {
      reader.releaseLock()
    }
  }
  
  // 从事件数据获取状态
  const getStatusFromEvent = (data: any): 'pending' | 'processing' | 'completed' | 'failed' => {
    if (data.success === true) return 'completed'
    if (data.error) return 'failed'
    if (data.message?.includes('评测中')) return 'processing'
    return 'pending'
  }
  
  // 更新总体进度
  const updateProgress = (allJobs: EvaluationJob[]) => {
    setEvaluationJobs(currentJobs => {
      const completedCount = currentJobs.filter(j => 
        j.status === 'completed' || j.status === 'failed'
      ).length
      
      const newProgress = (completedCount / submissions.length) * 100
      setProgress(newProgress)
      
      // 检查是否全部完成
      if (completedCount === submissions.length) {
        setIsEvaluating(false)
        const results = currentJobs.map(j => ({
          studentId: j.studentId,
          studentName: j.studentName,
          result: j.result,
          error: j.error
        }))
        onComplete?.(results)
      }
      
      return currentJobs
    })
  }

  // 获取队列统计信息
  const fetchQueueStats = async () => {
    try {
      const response = await fetch('/api/evaluate-edge/submit', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setQueueStats(data.stats)
      }
    } catch (error) {
      console.error('获取队列统计失败:', error)
    }
  }

  // 取消所有评测（流式版本）
  const cancelAllEvaluations = async () => {
    try {
      // 对于流式请求，我们主要是停止前端的处理
      setIsEvaluating(false)
      setEvaluationJobs([])
      setProgress(0)
      
      // 可以尝试取消正在进行的请求，但流式连接可能已经建立
      console.log('已取消所有评测任务')
    } catch (error) {
      console.error('取消评测失败:', error)
      onError?.(error instanceof Error ? error.message : '取消评测失败')
    }
  }

  // 移除自动获取提交的逻辑，改为手动触发

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">排队中</Badge>
      case 'processing':
        return <Badge variant="outline" className="bg-blue-100 text-blue-700">评测中</Badge>
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-700">已完成</Badge>
      case 'failed':
        return <Badge variant="outline" className="bg-red-100 text-red-700">失败</Badge>
      default:
        return <Badge variant="outline">未知</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>边缘函数代码评测</span>
          {queueStats && (
            <div className="text-sm text-gray-600">
              队列: {queueStats.pending} 排队 | {queueStats.processing} 处理中
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-4">
            <div className="text-gray-600">正在获取学生提交...</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {submissions.length > 0 ? `找到 ${submissions.length} 个编程题提交` : '点击按钮获取学生提交'}
              </div>
              <div className="space-x-2">
                {submissions.length === 0 ? (
                  <Button
                    onClick={fetchSubmissions}
                    disabled={isLoading}
                    size="sm"
                  >
                    {isLoading ? '获取中...' : '获取学生提交'}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={startBatchEvaluation}
                      disabled={isEvaluating}
                      size="sm"
                    >
                      {isEvaluating ? '评测中...' : '开始批量评测'}
                    </Button>
                    {isEvaluating && (
                      <Button
                        onClick={cancelAllEvaluations}
                        variant="outline"
                        size="sm"
                      >
                        取消评测
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setSubmissions([])
                        setEvaluationJobs([])
                        setProgress(0)
                      }}
                      variant="outline"
                      size="sm"
                      disabled={isEvaluating}
                    >
                      重新获取
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isEvaluating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>评测进度</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {evaluationJobs.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">评测状态</div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {evaluationJobs.map((job) => (
                    <div key={job.jobId} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{job.studentName}</div>
                        <div className="text-xs text-gray-600">ID: {job.studentId}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(job.status)}
                        {job.error && (
                          <div className="text-xs text-red-600 max-w-32 truncate" title={job.error}>
                            {job.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {submissions.length === 0 && !isLoading && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-lg mb-2">📝</div>
                <div>点击"获取学生提交"按钮开始</div>
                <div className="text-sm">手动获取学生的编程题提交内容</div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}