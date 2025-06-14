'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ClockIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface User {
  id: string
  name: string
  email: string
  role: string
  campus: string
}

interface Exam {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string
  duration: number
  isPublished: boolean
  resultsPublished: boolean
  examResult?: {
    id: string
    isSubmitted: boolean
    score: number | null
    submittedAt: string | null
  }
}

export default function StudentDashboard() {
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
        if (userData.role !== 'STUDENT') {
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
      const response = await fetch('/api/student/exams')
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

  const getExamStatus = (exam: Exam) => {
    const now = new Date()
    const startTime = new Date(exam.startTime)
    const endTime = new Date(exam.endTime)

    if (exam.examResult?.isSubmitted) {
      return { status: 'submitted', text: '已提交', color: 'bg-green-100 text-green-800' }
    }

    if (now < startTime) {
      return { status: 'upcoming', text: '未开始', color: 'bg-gray-100 text-gray-800' }
    }

    if (now > endTime) {
      return { status: 'ended', text: '已结束', color: 'bg-red-100 text-red-800' }
    }

    return { status: 'ongoing', text: '进行中', color: 'bg-blue-100 text-blue-800' }
  }

  const canTakeExam = (exam: Exam) => {
    const now = new Date()
    const startTime = new Date(exam.startTime)
    const endTime = new Date(exam.endTime)
    
    return exam.isPublished && 
           now >= startTime && 
           now <= endTime && 
           !exam.examResult?.isSubmitted
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
              <h1 className="text-xl font-semibold text-gray-900">学生控制台</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">欢迎，{user?.name}</span>
              <span className="text-xs text-gray-500">校区：{user?.campus}</span>
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
        {/* 考试列表 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">我的考试</h3>
            
            {exams.length === 0 ? (
              <div className="text-center py-8">
                <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无考试</h3>
                <p className="mt-1 text-sm text-gray-500">目前没有可参加的考试</p>
              </div>
            ) : (
              <div className="space-y-4">
                {exams.map((exam) => {
                  const status = getExamStatus(exam)
                  const canTake = canTakeExam(exam)
                  
                  return (
                    <div
                      key={exam.id}
                      className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-lg font-medium text-gray-900">{exam.title}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                              {status.text}
                            </span>
                          </div>
                          
                          {exam.description && (
                            <p className="text-sm text-gray-600 mt-2">{exam.description}</p>
                          )}
                          
                          <div className="flex items-center mt-3 text-sm text-gray-500 space-x-4">
                            <div className="flex items-center">
                              <ClockIcon className="h-4 w-4 mr-1" />
                              <span>时长: {exam.duration}分钟</span>
                            </div>
                            <div>
                              开始时间: {format(new Date(exam.startTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                            </div>
                            <div>
                              结束时间: {format(new Date(exam.endTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                            </div>
                          </div>
                          
                          {exam.examResult?.isSubmitted && exam.resultsPublished && exam.examResult.score !== null && (
                            <div className="mt-3 flex items-center text-sm">
                              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
                              <span className="text-green-700">成绩: {exam.examResult.score}分</span>
                            </div>
                          )}
                          
                          {exam.examResult?.isSubmitted && !exam.resultsPublished && (
                            <div className="mt-3 flex items-center text-sm">
                              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-1" />
                              <span className="text-yellow-700">已提交，等待成绩发布</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-6 flex flex-col space-y-2">
                          {canTake && (
                            <button
                              onClick={() => router.push(`/student/exam/${exam.id}`)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              开始考试
                            </button>
                          )}
                          
                          {exam.examResult?.isSubmitted && exam.resultsPublished && (
                            <button
                              onClick={() => router.push(`/student/result/${exam.id}`)}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              查看成绩
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}