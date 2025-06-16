'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface EdgeEvaluationProgressProps {
  jobId: string
  onComplete: (result: any) => void
  onError?: (error: string) => void
  onCancel?: () => void
  autoRefresh?: boolean
}

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'not_found'
  result?: any
  error?: string
  position?: number
  estimatedTime?: number
  queueStats?: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
}

export function EdgeEvaluationProgress({ 
  jobId, 
  onComplete, 
  onError,
  onCancel,
  autoRefresh = true 
}: EdgeEvaluationProgressProps) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [polling, setPolling] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [cancelling, setCancelling] = useState(false)

  // 获取任务状态
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/evaluate-edge/status/${jobId}`)
      const data = await response.json()
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('任务不存在或已过期')
          setPolling(false)
          onError?.('任务不存在或已过期')
          return
        }
        throw new Error(data.error || '获取状态失败')
      }
      
      setStatus(data)
      setError(null)
      
      // 处理完成状态
      if (data.status === 'completed') {
        setPolling(false)
        if (data.error) {
          onError?.(data.error)
        } else {
          onComplete(data.result)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取评测状态失败'
      setError(errorMessage)
      console.error('获取评测状态失败:', err)
    }
  }, [jobId, onComplete, onError])

  // 取消任务
  const cancelJob = async () => {
    setCancelling(true)
    try {
      const response = await fetch(`/api/evaluate-edge/status/${jobId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setPolling(false)
        onCancel?.()
      } else {
        setError(data.error || '取消任务失败')
      }
    } catch (err) {
      setError('取消任务失败')
      console.error('取消任务失败:', err)
    } finally {
      setCancelling(false)
    }
  }

  // 轮询状态
  useEffect(() => {
    if (!polling || !autoRefresh) return

    const interval = setInterval(fetchStatus, 1000)
    fetchStatus() // 立即执行一次

    return () => clearInterval(interval)
  }, [fetchStatus, polling, autoRefresh])

  // 计时器
  useEffect(() => {
    if (!polling) return

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [polling])

  // 手动刷新
  const handleRefresh = () => {
    fetchStatus()
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'processing': return 'bg-yellow-500 animate-pulse'
      case 'pending': return 'bg-blue-500'
      default: return 'bg-gray-400'
    }
  }

  // 获取状态文本
  const getStatusText = (status: JobStatus) => {
    switch (status.status) {
      case 'completed': 
        return status.error ? '评测失败' : '评测完成'
      case 'processing': 
        return '正在评测...'
      case 'pending': 
        return `排队中 (第${status.position || 0}位)`
      default: 
        return '未知状态'
    }
  }

  // 计算进度
  const getProgress = () => {
    if (!status) return 0
    
    switch (status.status) {
      case 'completed': return 100
      case 'processing': return 70
      case 'pending': {
        const position = status.position || 1
        return Math.max(10, 50 - (position * 5))
      }
      default: return 0
    }
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-red-600">评测错误</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-red-600">{error}</p>
          <div className="flex space-x-2">
            <Button onClick={handleRefresh} variant="outline" size="sm">
              重试
            </Button>
            {onCancel && (
              <Button onClick={onCancel} variant="outline" size="sm">
                返回
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-400 rounded-full animate-pulse" />
            <span className="text-sm">正在获取评测状态...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>边缘评测进度</span>
          <Badge variant="outline">{formatTime(elapsedTime)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 状态指示器 */}
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(status.status)}`} />
          <span className="text-sm font-medium">
            {getStatusText(status)}
          </span>
        </div>

        {/* 进度条 */}
        <div className="space-y-2">
          <Progress value={getProgress()} className="w-full" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>任务ID: {jobId.slice(-8)}</span>
            <span>{getProgress()}%</span>
          </div>
        </div>

        {/* 预估时间 */}
        {status.status === 'pending' && status.estimatedTime && (
          <div className="text-xs text-gray-500">
            预计等待时间: {status.estimatedTime} 秒
          </div>
        )}

        {/* 队列统计 */}
        {status.queueStats && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 p-2 rounded">
              <div className="font-medium text-blue-700">排队中</div>
              <div className="text-blue-600">{status.queueStats.pending}</div>
            </div>
            <div className="bg-yellow-50 p-2 rounded">
              <div className="font-medium text-yellow-700">处理中</div>
              <div className="text-yellow-600">{status.queueStats.processing}</div>
            </div>
          </div>
        )}

        {/* 错误信息 */}
        {status.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-600">{status.error}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex space-x-2">
          {!autoRefresh && (
            <Button onClick={handleRefresh} variant="outline" size="sm">
              刷新状态
            </Button>
          )}
          
          {status.status === 'pending' && onCancel && (
            <Button 
              onClick={cancelJob} 
              variant="outline" 
              size="sm"
              disabled={cancelling}
            >
              {cancelling ? '取消中...' : '取消任务'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default EdgeEvaluationProgress