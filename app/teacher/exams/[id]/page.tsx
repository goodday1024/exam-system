'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Question {
  _id: string
  title: string
  content: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'PROGRAMMING'
  options: string | null
  points: number
  order: number
}

interface Exam {
  _id: string
  title: string
  description: string
  startTime: string
  endTime: string
  duration: number
  maxTabSwitches: number
  isPublished: boolean
  questions: Question[]
  _count: {
    examResults: number
  }
}

export default function ExamDetailPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchExam()
  }, [])

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/teacher/exams/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setExam(data.exam)
      } else {
        toast.error('获取考试详情失败')
        router.push('/teacher/exams')
      }
    } catch (error) {
      toast.error('网络错误')
      router.push('/teacher/exams')
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async () => {
    if (!exam) return
    
    try {
      const response = await fetch(`/api/teacher/exams/${exam._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPublished: !exam.isPublished
        })
      })

      if (response.ok) {
        setExam({ ...exam, isPublished: !exam.isPublished })
        toast.success(exam.isPublished ? '考试已取消发布' : '考试已发布')
      } else {
        toast.error('操作失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const deleteExam = async () => {
    if (!exam) return
    
    if (!confirm('确定要删除这个考试吗？此操作不可恢复。')) {
      return
    }

    try {
      const response = await fetch(`/api/teacher/exams/${exam._id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('考试已删除')
        router.push('/teacher/exams')
      } else {
        toast.error('删除失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const getExamStatus = () => {
    if (!exam) return { text: '', color: '' }
    
    const now = new Date()
    const startTime = new Date(exam.startTime)
    const endTime = new Date(exam.endTime)

    if (now < startTime) {
      return { text: '未开始', color: 'text-blue-500' }
    }
    if (now >= startTime && now <= endTime) {
      return { text: '进行中', color: 'text-green-500' }
    }
    return { text: '已结束', color: 'text-red-500' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-4">考试不存在</div>
          <Link
            href="/teacher/exams"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回考试列表
          </Link>
        </div>
      </div>
    )
  }

  const status = getExamStatus()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
            <p className="text-gray-600 mt-2">{exam.description}</p>
          </div>
          <div className="flex space-x-4">
            <Link
              href="/teacher/exams"
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              返回列表
            </Link>
            <button
              onClick={togglePublish}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                exam.isPublished
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {exam.isPublished ? '取消发布' : '发布考试'}
            </button>
            <Link
              href={`/teacher/exams/${exam._id}/results`}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              查看成绩
            </Link>
          </div>
        </div>

        {/* 考试信息 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">考试信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考试状态</label>
              <span className={`text-lg font-medium ${status.color}`}>{status.text}</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">发布状态</label>
              <span className={`text-lg font-medium ${
                exam.isPublished ? 'text-green-600' : 'text-gray-600'
              }`}>
                {exam.isPublished ? '已发布' : '未发布'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">参与人数</label>
              <span className="text-lg font-medium text-gray-900">{exam._count.examResults} 人</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">题目数量</label>
              <span className="text-lg font-medium text-gray-900">{exam.questions.length} 题</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
              <span className="text-lg text-gray-900">
                {new Date(exam.startTime).toLocaleString()}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
              <span className="text-lg text-gray-900">
                {new Date(exam.endTime).toLocaleString()}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考试时长</label>
              <span className="text-lg text-gray-900">{exam.duration} 分钟</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最大切屏次数</label>
              <span className="text-lg text-gray-900">{exam.maxTabSwitches} 次</span>
            </div>
          </div>
        </div>

        {/* 题目列表 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">题目列表</h2>
          {exam.questions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">暂无题目</div>
            </div>
          ) : (
            <div className="space-y-4">
              {exam.questions.map((question, index) => (
                <div key={question._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {index + 1}. {question.title}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {question.type === 'MULTIPLE_CHOICE' ? '选择题' : 
                         question.type === 'TRUE_FALSE' ? '判断题' : '编程题'}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        {question.points} 分
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-600 text-sm">
                    {question.content && question.content.length > 100 
                      ? `${question.content.substring(0, 100)}...` 
                      : question.content || '暂无内容'
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 危险操作 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">危险操作</h2>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">删除考试</h3>
              <p className="text-gray-600">删除后将无法恢复，请谨慎操作</p>
            </div>
            <button
              onClick={deleteExam}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              删除考试
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}