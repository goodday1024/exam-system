'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface EvaluationTask {
  _id: string
  examId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: {
    total: number
    completed: number
    current?: string
    percentage: number
  }
  createdAt: string
  updatedAt: string
  completedAt?: string
  error?: string
  results?: any
}

export default function EvaluationTasksPage() {
  const [tasks, setTasks] = useState<EvaluationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/teacher/evaluation-tasks', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('获取任务列表失败')
      }

      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('获取任务列表失败:', error)
      toast.error('获取任务列表失败')
    } finally {
      setLoading(false)
    }
  }

  const refreshTasks = async () => {
    setRefreshing(true)
    await fetchTasks()
    setRefreshing(false)
    toast.success('任务列表已刷新')
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待中'
      case 'processing':
        return '处理中'
      case 'completed':
        return '已完成'
      case 'failed':
        return '失败'
      default:
        return '未知状态'
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">评测任务管理</h1>
            <p className="text-gray-600 mt-2">查看和管理所有异步代码评测任务</p>
          </div>
          <div className="flex space-x-4">
            <Link
              href="/teacher/exams"
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              返回考试列表
            </Link>
            <Button 
              onClick={refreshTasks}
              disabled={refreshing}
              variant="outline"
            >
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  刷新中
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 任务列表 */}
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-gray-500 text-lg">暂无评测任务</div>
              <p className="text-gray-400 mt-2">在考试详情页面启动异步评测后，任务将显示在这里</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {tasks.map((task) => (
              <Card key={task._id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span>评测任务</span>
                        <Badge className={getStatusColor(task.status)}>
                          {getStatusIcon(task.status)}
                          <span className="ml-1">{getStatusText(task.status)}</span>
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        任务ID: {task._id}
                      </p>
                    </div>
                    <Link
                      href={`/teacher/exams/${task.examId}`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      查看考试
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 进度条 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>评测进度</span>
                      <span>{task.progress.completed}/{task.progress.total} ({task.progress.percentage}%)</span>
                    </div>
                    <Progress value={task.progress.percentage} className="w-full" />
                  </div>

                  {/* 当前处理的题目 */}
                  {task.status === 'processing' && task.progress.current && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">当前处理：</span>
                      {task.progress.current}
                    </div>
                  )}

                  {/* 时间信息 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">创建时间：</span>
                      <br />
                      {new Date(task.createdAt).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">更新时间：</span>
                      <br />
                      {new Date(task.updatedAt).toLocaleString()}
                    </div>
                    {task.completedAt && (
                      <div>
                        <span className="font-medium">完成时间：</span>
                        <br />
                        {new Date(task.completedAt).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* 错误信息 */}
                  {task.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-800 text-sm">
                        <strong>错误：</strong>{task.error}
                      </p>
                    </div>
                  )}

                  {/* 结果摘要 */}
                  {task.status === 'completed' && task.results && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-green-800 text-sm">
                        <strong>评测完成！</strong>
                        共处理 {task.results.length} 道编程题
                      </p>
                      <div className="mt-2 text-xs text-green-700">
                        {task.results.map((result: any, index: number) => (
                          <div key={index} className="flex justify-between">
                            <span>{result.questionTitle}</span>
                            <span>{result.totalSubmissions} 份提交</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}