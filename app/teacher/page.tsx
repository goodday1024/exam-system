'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  ChartBarIcon,
  UsersIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

interface User {
  id: string
  name: string
  email: string
  role: string
  campus: string
}

interface Exam {
  _id: string
  title: string
  description: string
  startTime: string
  endTime: string
  duration: number
  isPublished: boolean
  resultsPublished: boolean
  _count: {
    examResults: number
    gradedResults: number
    ungradedResults: number
  }
}

export default function TeacherDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchExams()
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
      router.push('/')
    }
  }

  const fetchExams = async () => {
    try {
      const response = await fetch('/api/teacher/exams')
      if (response.ok) {
        const data = await response.json()
        setExams(data.exams || [])
      }
    } catch (error) {
      toast.error('获取考试列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
    } catch (error) {
      toast.error('登出失败')
    }
  }

  const handleAutoGrade = async (examId: string) => {
    try {
      const response = await fetch(`/api/teacher/exams/${examId}/grade`, {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`判分完成，已判分 ${data.gradedCount} 份答卷`)
        // 重新获取考试列表以更新判分状态
        fetchExams()
      } else {
        const data = await response.json()
        toast.error(data.error || '自动判分失败')
      }
    } catch (error) {
      toast.error('自动判分失败')
    }
  }



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部导航 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">教师控制台</h1>
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
        {/* 快捷操作卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div
            onClick={() => router.push('/teacher/questions')}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">题库管理</dt>
                    <dd className="text-lg font-medium text-gray-900">创建题目</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => router.push('/teacher/exams/create')}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <PlusIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">考试管理</dt>
                    <dd className="text-lg font-medium text-gray-900">创建考试</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => router.push('/teacher/students')}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UsersIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">学生管理</dt>
                    <dd className="text-lg font-medium text-gray-900">管理学生</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => router.push('/teacher/analytics')}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">数据分析</dt>
                    <dd className="text-lg font-medium text-gray-900">统计报告</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 最近的考试 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">最近的考试</h3>
              <button
                onClick={() => router.push('/teacher/exams')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                查看全部
              </button>
            </div>
            
            {exams.length === 0 ? (
              <div className="text-center py-8">
                <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无考试</h3>
                <p className="mt-1 text-sm text-gray-500">开始创建您的第一个考试吧</p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/teacher/exams/create')}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                    创建考试
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {exams.slice(0, 5).map((exam) => (
                  <div
                    key={exam._id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/teacher/exams/${exam._id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{exam.title}</h4>
                        <p className="text-sm text-gray-500 mt-1">{exam.description}</p>
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <span>时长: {exam.duration}分钟</span>
                          <span className="mx-2">•</span>
                          <span>参与人数: {exam._count.examResults}</span>
                          {exam._count.examResults > 0 && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="text-green-600">已判分: {exam._count.gradedResults}</span>
                              {exam._count.ungradedResults > 0 && (
                                <>
                                  <span className="mx-1">/</span>
                                  <span className="text-orange-600">待判分: {exam._count.ungradedResults}</span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          exam.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {exam.isPublished ? '已发布' : '草稿'}
                        </span>
                        {exam.resultsPublished && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                            成绩已发布
                          </span>
                        )}
                        {new Date() > new Date(exam.endTime) && (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoGrade(exam._id);
                              }}
                              className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                              disabled={exam._count.examResults === 0}
                            >
                              自动判分
                            </button>

                            {exam._count.examResults > 0 && exam._count.ungradedResults === 0 && (
                              <span className="text-xs text-green-600">全部已判分</span>
                            )}
                            {exam._count.ungradedResults > 0 && (
                              <span className="text-xs text-orange-600">{exam._count.ungradedResults}份待判分</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}