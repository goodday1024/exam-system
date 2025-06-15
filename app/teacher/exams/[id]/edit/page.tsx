'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'

interface Question {
  _id: string
  title: string
  content: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'PROGRAMMING'
  points: number
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
}

const questionTypes = {
  MULTIPLE_CHOICE: '选择题',
  TRUE_FALSE: '判断题',
  PROGRAMMING: '编程题'
}

export default function EditExamPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    duration: 60,
    maxTabSwitches: 3
  })

  useEffect(() => {
    fetchExam()
    fetchQuestions()
  }, [])

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/teacher/exams/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        const examData = data.exam
        setExam(examData)
        
        // 检查考试是否已发布
        if (examData.isPublished) {
          toast.error('已发布的考试无法编辑')
          router.push(`/teacher/exams/${params.id}`)
          return
        }
        
        // 预填充表单数据
        setFormData({
          title: examData.title,
          description: examData.description,
          startTime: format(new Date(examData.startTime), "yyyy-MM-dd'T'HH:mm"),
          endTime: format(new Date(examData.endTime), "yyyy-MM-dd'T'HH:mm"),
          duration: examData.duration,
          maxTabSwitches: examData.maxTabSwitches
        })
        
        // 设置已选择的题目
        setSelectedQuestions(examData.questions.map((q: Question) => q._id))
      } else {
        toast.error('获取考试信息失败')
        router.push('/teacher/exams')
      }
    } catch (error) {
      toast.error('网络错误')
      router.push('/teacher/exams')
    }
  }

  const fetchQuestions = async () => {
    try {
      const response = await fetch('/api/teacher/questions')
      if (response.ok) {
        const data = await response.json()
        
        if (!data.questions || !Array.isArray(data.questions)) {
          setQuestions([])
          return
        }
        
        // 确保 _id 字段被正确处理
        const processedQuestions = data.questions.map((question: any, index: number) => {
          let questionId = ''
          if (question._id) {
            questionId = typeof question._id === 'string' ? question._id : question._id.toString()
          } else if (question.id) {
            questionId = typeof question.id === 'string' ? question.id : question.id.toString()
          } else {
            questionId = `temp_id_${index}_${Date.now()}`
          }
          
          return {
            ...question,
            _id: questionId
          }
        })
        
        setQuestions(processedQuestions)
      } else {
        toast.error('获取题目列表失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'duration' || name === 'maxTabSwitches' ? parseInt(value) || 0 : value
    }))
  }

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestions(prev => {
      if (prev.includes(questionId)) {
        return prev.filter(id => id !== questionId)
      } else {
        return [...prev, questionId]
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.startTime || !formData.endTime) {
      toast.error('请填写所有必填字段')
      return
    }

    if (selectedQuestions.length === 0) {
      toast.error('请至少选择一道题目')
      return
    }

    const startTime = new Date(formData.startTime)
    const endTime = new Date(formData.endTime)
    
    if (startTime >= endTime) {
      toast.error('结束时间必须晚于开始时间')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/teacher/exams/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          questionIds: selectedQuestions
        })
      })

      if (response.ok) {
        toast.success('考试更新成功')
        router.push(`/teacher/exams/${params.id}`)
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || '更新失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  const getTotalPoints = () => {
    return questions
      .filter(q => selectedQuestions.includes(q._id))
      .reduce((sum, q) => sum + (q.points || 0), 0)
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
          <button
            onClick={() => router.push('/teacher/exams')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回考试列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/teacher/exams/${params.id}`)}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              返回考试详情
            </button>
            <h1 className="text-3xl font-bold text-gray-900">编辑考试</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本信息 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">基本信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  考试标题 *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入考试标题"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  考试时长（分钟）*
                </label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  开始时间 *
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  结束时间 *
                </label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大切屏次数
                </label>
                <input
                  type="number"
                  name="maxTabSwitches"
                  value={formData.maxTabSwitches}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                考试描述
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入考试描述（可选）"
              />
            </div>
          </div>

          {/* 题目选择 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">选择题目</h2>
              <div className="text-sm text-gray-600">
                已选择 {selectedQuestions.length} 题，总分 {getTotalPoints()} 分
              </div>
            </div>
            
            {questions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-4">暂无可用题目</div>
                <button
                  type="button"
                  onClick={() => router.push('/teacher/questions')}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  去创建题目
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question) => (
                  <div
                    key={question._id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedQuestions.includes(question._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleQuestionSelection(question._id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedQuestions.includes(question._id)}
                            onChange={() => toggleQuestionSelection(question._id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <h3 className="text-lg font-medium text-gray-900">
                            {question.title}
                          </h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-2">
                          {question.content && question.content.length > 100
                            ? `${question.content.substring(0, 100)}...`
                            : question.content || '暂无内容'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {questionTypes[question.type]}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          {question.points} 分
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push(`/teacher/exams/${params.id}`)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || selectedQuestions.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '更新中...' : '更新考试'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}