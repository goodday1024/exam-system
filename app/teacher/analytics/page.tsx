'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  UsersIcon,
  DocumentTextIcon,
  TrophyIcon
} from '@heroicons/react/24/outline'

interface User {
  id: string
  name: string
  email: string
  role: string
  campus: string
}

interface AnalyticsData {
  totalExams: number
  totalStudents: number
  totalQuestions: number
  totalExamResults: number
  averageScore: number
  examStats: {
    id: string
    title: string
    participantCount: number
    averageScore: number
    passRate: number
  }[]
  campusStats: {
    campus: string
    studentCount: number
    averageScore: number
  }[]
  recentActivity: {
    type: string
    description: string
    timestamp: string
  }[]
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchAnalytics()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const userData = await response.json()
        if (userData.role !== 'TEACHER') {
          router.push('/')
          return
        }
        setUser(userData)
      } else {
        router.push('/')
      }
    } catch (error) {
      console.error('认证检查失败:', error)
      router.push('/')
    }
  }

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/teacher/analytics')
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      } else {
        toast.error('获取分析数据失败')
      }
    } catch (error) {
      console.error('获取分析数据失败:', error)
      toast.error('获取分析数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/teacher')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← 返回控制台
              </button>
              <h1 className="text-xl font-semibold text-gray-900">数据分析</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">欢迎，{user?.name}</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none transition"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
                登出
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">统计报告</h2>
          <p className="text-gray-600">查看考试系统的整体数据分析</p>
        </div>

        {analytics ? (
          <>
            {/* 总览统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AcademicCapIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">总考试数</dt>
                        <dd className="text-lg font-medium text-gray-900">{analytics.totalExams}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <UsersIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">总学生数</dt>
                        <dd className="text-lg font-medium text-gray-900">{analytics.totalStudents}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DocumentTextIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">题库题目</dt>
                        <dd className="text-lg font-medium text-gray-900">{analytics.totalQuestions}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <TrophyIcon className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">平均分数</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {analytics.averageScore ? analytics.averageScore.toFixed(1) : '0.0'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 考试统计 */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">考试统计</h3>
                  {analytics.examStats.length === 0 ? (
                    <div className="text-center py-8">
                      <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">暂无考试数据</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {analytics.examStats.map((exam) => (
                        <div key={exam.id} className="border-l-4 border-blue-400 pl-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{exam.title}</h4>
                              <p className="text-sm text-gray-500">参与人数: {exam.participantCount}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">
                                平均分: {exam.averageScore.toFixed(1)}
                              </div>
                              <div className="text-sm text-gray-500">
                                通过率: {exam.passRate.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 校区统计 */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">校区统计</h3>
                  {analytics.campusStats.length === 0 ? (
                    <div className="text-center py-8">
                      <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">暂无校区数据</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {analytics.campusStats.map((campus) => (
                        <div key={campus.campus} className="border-l-4 border-green-400 pl-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{campus.campus}</h4>
                              <p className="text-sm text-gray-500">学生数: {campus.studentCount}</p>
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              平均分: {campus.averageScore.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 最近活动 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">最近活动</h3>
                {analytics.recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">暂无活动记录</p>
                  </div>
                ) : (
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {analytics.recentActivity.map((activity, index) => (
                        <li key={`activity-${activity.type}-${activity.timestamp}-${index}`}>
                          <div className="relative pb-8">
                            {index !== analytics.recentActivity.length - 1 && (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                            )}
                            <div className="relative flex space-x-3">
                              <div>
                                <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                                  <ChartBarIcon className="h-4 w-4 text-white" />
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm text-gray-500">{activity.description}</p>
                                </div>
                                <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                  {new Date(activity.timestamp).toLocaleString('zh-CN')}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">无法加载数据</h3>
            <p className="mt-1 text-sm text-gray-500">请稍后重试</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              重新加载
            </button>
          </div>
        )}
      </div>
    </div>
  )
}