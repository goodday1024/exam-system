'use client'

import { useState, useEffect } from 'react'
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

const questionTypes = {
  MULTIPLE_CHOICE: '选择题',
  TRUE_FALSE: '判断题',
  PROGRAMMING: '编程题'
}

export default function CreateExamPage() {
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
    fetchQuestions()
    
    // 设置默认时间（当前时间+1小时作为开始时间，+2小时作为结束时间）
    const now = new Date()
    const startTime = new Date(now.getTime() + 60 * 60 * 1000) // +1小时
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // +2小时
    
    setFormData(prev => ({
      ...prev,
      startTime: format(startTime, "yyyy-MM-dd'T'HH:mm"),
      endTime: format(endTime, "yyyy-MM-dd'T'HH:mm")
    }))
  }, [])

  const fetchQuestions = async () => {
    try {
      const response = await fetch('/api/teacher/questions')
      if (response.ok) {
        const data = await response.json()
        console.log('Raw questions data:', data.questions)
        
        if (!data.questions || !Array.isArray(data.questions)) {
          console.error('Questions data is not an array:', data.questions)
          setQuestions([])
          return
        }
        
        // 确保 _id 字段被正确处理
        const processedQuestions = data.questions.map((question: any, index: number) => {
          console.log(`Processing question ${index}:`, question)
          
          let questionId = ''
          if (question._id) {
            questionId = typeof question._id === 'string' ? question._id : question._id.toString()
          } else if (question.id) {
            questionId = typeof question.id === 'string' ? question.id : question.id.toString()
          } else {
            console.error(`Question at index ${index} has no valid ID:`, question)
            questionId = `temp_id_${index}_${Date.now()}`
          }
          
          return {
            ...question,
            _id: questionId
          }
        })
        
        console.log('Processed questions:', processedQuestions)
        setQuestions(processedQuestions)
      } else {
        toast.error('获取题目列表失败')
      }
    } catch (error) {
      console.error('Fetch questions error:', error)
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleQuestionToggle = (questionId: string) => {
    console.log('=== handleQuestionToggle called ===')
    console.log('questionId:', questionId, 'type:', typeof questionId)
    console.log('Current selectedQuestions:', selectedQuestions)
    
    if (!questionId) {
      console.error('questionId is undefined or empty!')
      return
    }
    
    setSelectedQuestions(prev => {
      const isSelected = prev.includes(questionId)
      const newSelection = isSelected
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
      
      console.log('New selection:', newSelection)
      return newSelection
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

    if (startTime <= new Date()) {
      toast.error('开始时间必须晚于当前时间')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/teacher/exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          questionIds: selectedQuestions
        }),
      })

      if (response.ok) {
        toast.success('考试创建成功')
        router.push('/teacher/exams')
      } else {
        const data = await response.json()
        toast.error(data.error || '创建失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  const getTotalPoints = () => {
    return selectedQuestions.reduce((total, questionId) => {
      const question = questions.find(q => q._id === questionId)
      return total + (question?.points || 0)
    }, 0)
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
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => router.push('/teacher')}
              className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-500"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">创建考试</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">基本信息</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">考试标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  placeholder="请输入考试标题"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">考试描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  rows={3}
                  placeholder="请输入考试描述（可选）"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">开始时间</label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">结束时间</label>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">考试时长（分钟）</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  min="1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">最大切换标签页次数</label>
                <input
                  type="number"
                  value={formData.maxTabSwitches}
                  onChange={(e) => setFormData({ ...formData, maxTabSwitches: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  min="0"
                  required
                />
              </div>
            </div>
          </div>

          {/* 选择题目 */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">选择题目</h2>
              <div className="text-sm text-gray-500">
                已选择 {selectedQuestions.length} 道题目，总分 {getTotalPoints()} 分
              </div>
            </div>
            
            {questions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">暂无题目，请先创建题目</p>
                <button
                  type="button"
                  onClick={() => router.push('/teacher/questions')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  创建题目
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question) => (
                  <div
                    key={question._id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedQuestions.includes(question._id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('=== Click event triggered ===')
                      console.log('question object:', question)
                      console.log('question._id:', question._id)
                      handleQuestionToggle(question._id)
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedQuestions.includes(question._id)}
                            readOnly
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded pointer-events-none"
                          />
                          <h4 className="text-sm font-medium text-gray-900">{question.title}</h4>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {questionTypes[question.type]}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {question.points}分
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {question.content.substring(0, 100)}{question.content.length > 100 ? '...' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.push('/teacher')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || selectedQuestions.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '创建中...' : '创建考试'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}