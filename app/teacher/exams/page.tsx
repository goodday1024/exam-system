'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { toZonedTime, format } from 'date-fns-tz'

interface Exam {
  _id: string
  title: string
  description: string
  startTime: string
  endTime: string
  duration: number
  maxTabSwitches: number
  isPublished: boolean
  createdAt: string
  _count: {
    examResults: number
  }
}

export default function TeacherExamsPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      const response = await fetch('/api/teacher/exams')
      if (response.ok) {
        const data = await response.json()
        setExams(data.exams)
      } else {
        toast.error('获取考试列表失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async (examId: string, isPublished: boolean) => {
    try {
      const response = await fetch(`/api/teacher/exams/${examId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPublished: !isPublished })
      })

      if (response.ok) {
        toast.success(isPublished ? '考试已取消发布' : '考试已发布')
        fetchExams()
      } else {
        const data = await response.json()
        toast.error(data.error || '操作失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const deleteExam = async (examId: string) => {
    if (!confirm('确定要删除这个考试吗？此操作不可恢复。')) {
      return
    }

    try {
      const response = await fetch(`/api/teacher/exams/${examId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('考试删除成功')
        fetchExams()
      } else {
        const data = await response.json()
        toast.error(data.error || '删除失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const getExamStatus = (exam: Exam) => {
    const now = new Date()
    const startTime = new Date(exam.startTime)
    const endTime = new Date(exam.endTime)

    if (!exam.isPublished) {
      return { text: '未发布', color: 'text-gray-500' }
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">考试管理</h1>
            <p className="text-gray-600 mt-2">管理您创建的所有考试</p>
          </div>
          <div className="flex space-x-4">
            <Link
              href="/teacher"
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              返回首页
            </Link>
            <Link
              href="/teacher/exams/create"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              创建考试
            </Link>
          </div>
        </div>

        {exams.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">还没有创建任何考试</div>
            <Link
              href="/teacher/exams/create"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              创建第一个考试
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {exams.map((exam) => {
              const status = getExamStatus(exam)
              return (
                <div key={exam._id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {exam.title}
                      </h3>
                      <p className="text-gray-600 mb-3">{exam.description}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                        <div>
                          <span className="font-medium">开始时间：</span>
                          <br />
                          {format(toZonedTime(new Date(exam.startTime), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Shanghai' })}
                        </div>
                        <div>
                          <span className="font-medium">结束时间：</span>
                          <br />
                          {format(toZonedTime(new Date(exam.endTime), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Shanghai' })}
                        </div>
                        <div>
                          <span className="font-medium">考试时长：</span>
                          <br />
                          {exam.duration} 分钟
                        </div>
                        <div>
                          <span className="font-medium">参与人数：</span>
                          <br />
                          {exam._count.examResults} 人
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color} bg-gray-100`}>
                        {status.text}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => togglePublish(exam._id, exam.isPublished)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            exam.isPublished
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          } transition-colors`}
                        >
                          {exam.isPublished ? '取消发布' : '发布'}
                        </button>
                        <Link
                          href={`/teacher/exams/${exam._id}/results`}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                        >
                          查看成绩
                        </Link>
                        <button
                          onClick={() => deleteExam(exam._id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}