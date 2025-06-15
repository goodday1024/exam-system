'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'

// 动态导入Markdown编辑器，避免SSR问题
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
)

interface Question {
  id: string
  title: string
  content: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'PROGRAMMING'
  options: string | null
  correctAnswer: string
  points: number
  createdAt: string
  testCases?: TestCase[]
  language?: string
  timeLimit?: number
  memoryLimit?: number
}

interface TestCase {
  input: string
  expectedOutput: string
  description?: string
}

const questionTypes = {
  MULTIPLE_CHOICE: '选择题',
  TRUE_FALSE: '判断题',
  PROGRAMMING: '编程题'
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // 表单状态
  const [formData, setFormData] = useState<{
    title: string
    content: string
    type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'PROGRAMMING'
    options: string[]
    correctAnswer: string
    points: number
    testCases: TestCase[]
    language: string
    timeLimit: number
    memoryLimit: number
  }>({
    title: '',
    content: '',
    type: 'MULTIPLE_CHOICE',
    options: ['', '', '', ''],
    correctAnswer: '',
    points: 10,
    testCases: [{ input: '', expectedOutput: '', description: '' }],
    language: 'javascript',
    timeLimit: 1,
    memoryLimit: 512
  })

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      const response = await fetch('/api/teacher/questions')
      if (response.ok) {
        const data = await response.json()
        // 将 _id 映射为 id，确保前端接口一致性
        const questionsWithId = (data.questions || []).map((question: any) => ({
          ...question,
          id: question._id
        }))
        setQuestions(questionsWithId)
      } else {
        toast.error('获取题目列表失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.content || !formData.correctAnswer) {
      toast.error('请填写所有必填字段')
      return
    }

    try {
      const submitData = {
        ...formData,
        options: formData.type === 'MULTIPLE_CHOICE' ? JSON.stringify(formData.options.filter(opt => opt.trim())) : null,
        testCases: formData.type === 'PROGRAMMING' ? JSON.stringify(formData.testCases) : null,
        language: formData.type === 'PROGRAMMING' ? formData.language : null,
        timeLimit: formData.type === 'PROGRAMMING' ? formData.timeLimit : null,
        memoryLimit: formData.type === 'PROGRAMMING' ? formData.memoryLimit : null
      }

      const url = editingQuestion ? `/api/teacher/questions/${editingQuestion.id}` : '/api/teacher/questions'
      const method = editingQuestion ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        toast.success(editingQuestion ? '题目更新成功' : '题目创建成功')
        resetForm()
        fetchQuestions()
      } else {
        const data = await response.json()
        toast.error(data.error || '操作失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const handleEdit = (question: Question) => {
    setEditingQuestion(question)
    
    // 安全解析 options，确保始终是数组
    let parsedOptions = ['', '', '', '']
    if (question.options) {
      try {
        let options = question.options
        // 处理双重转义的JSON字符串
        if (typeof options === 'string') {
          options = JSON.parse(options)
          // 如果解析后仍然是字符串，再次解析
          if (typeof options === 'string') {
            options = JSON.parse(options)
          }
        }
        if (Array.isArray(options)) {
          parsedOptions = options
        }
      } catch (error) {
        console.error('Failed to parse options:', error)
      }
    }
    
    setFormData({
      title: question.title,
      content: question.content,
      type: question.type,
      options: parsedOptions,
      correctAnswer: question.correctAnswer,
      points: question.points,
      testCases: question.testCases ? (typeof question.testCases === 'string' ? JSON.parse(question.testCases) : question.testCases) : [{ input: '', expectedOutput: '', description: '' }],
      language: (question as any).language || 'javascript',
      timeLimit: (question as any).timeLimit || 1,
      memoryLimit: (question as any).memoryLimit || 512
    })
    setShowCreateForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个题目吗？')) return

    try {
      const response = await fetch(`/api/teacher/questions/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('题目删除成功')
        fetchQuestions()
      } else {
        toast.error('删除失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      type: 'MULTIPLE_CHOICE',
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 10,
      testCases: [{ input: '', expectedOutput: '', description: '' }],
      language: 'javascript',
      timeLimit: 1,
      memoryLimit: 512
    })
    setEditingQuestion(null)
    setShowCreateForm(false)
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData({ ...formData, options: newOptions })
  }

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: string) => {
    const newTestCases = [...formData.testCases]
    newTestCases[index] = { ...newTestCases[index], [field]: value }
    setFormData({ ...formData, testCases: newTestCases })
  }

  const addTestCase = () => {
    setFormData({
      ...formData,
      testCases: [...formData.testCases, { input: '', expectedOutput: '', description: '' }]
    })
  }

  const removeTestCase = (index: number) => {
    if (formData.testCases.length > 1) {
      const newTestCases = formData.testCases.filter((_, i) => i !== index)
      setFormData({ ...formData, testCases: newTestCases })
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
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/teacher')}
                className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-500"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">题库管理</h1>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              创建题目
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {showCreateForm ? (
          /* 创建/编辑表单 */
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">
                {editingQuestion ? '编辑题目' : '创建题目'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">题目标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  placeholder="请输入题目标题"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">题目类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                >
                  <option value="MULTIPLE_CHOICE">选择题</option>
                  <option value="TRUE_FALSE">判断题</option>
                  <option value="PROGRAMMING">编程题</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">题目内容 (支持Markdown)</label>
                <div data-color-mode="light">
                  <MDEditor
                    value={formData.content}
                    onChange={(val) => setFormData({ ...formData, content: val || '' })}
                    preview="edit"
                    height={300}
                  />
                </div>
              </div>

              {formData.type === 'MULTIPLE_CHOICE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选项</label>
                  <div className="space-y-2">
                    {(Array.isArray(formData.options) ? formData.options : ['', '', '', '']).map((option, index) => (
                      <div key={`option-input-${index}`} className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-500 w-8">{String.fromCharCode(65 + index)}.</span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                          placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">正确答案</label>
                {formData.type === 'MULTIPLE_CHOICE' ? (
                  <select
                    value={formData.correctAnswer}
                    onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                    required
                  >
                    <option value="">请选择正确答案</option>
                    {(Array.isArray(formData.options) ? formData.options : ['', '', '', '']).map((option, index) => (
                      option.trim() && (
                        <option key={`answer-option-${index}`} value={String.fromCharCode(65 + index)}>
                          {String.fromCharCode(65 + index)}. {option}
                        </option>
                      )
                    ))}
                  </select>
                ) : formData.type === 'TRUE_FALSE' ? (
                  <select
                    value={formData.correctAnswer}
                    onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                    required
                  >
                    <option value="">请选择正确答案</option>
                    <option value="true">正确</option>
                    <option value="false">错误</option>
                  </select>
                ) : (
                  <textarea
                    value={formData.correctAnswer}
                    onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                    rows={4}
                    placeholder="请输入参考答案或评分标准"
                    required
                  />
                )}
              </div>

              {formData.type === 'PROGRAMMING' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">编程语言</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="cpp">C++</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">运行时间限制 (秒)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.timeLimit}
                        onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) || 1 })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                        placeholder="默认 1 秒"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">内存限制 (MB)</label>
                      <input
                        type="number"
                        min="64"
                        max="1024"
                        value={formData.memoryLimit}
                        onChange={(e) => setFormData({ ...formData, memoryLimit: parseInt(e.target.value) || 512 })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                        placeholder="默认 512 MB"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">测试用例</label>
                      <button
                        type="button"
                        onClick={addTestCase}
                        className="text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        + 添加测试用例
                      </button>
                    </div>
                    {formData.testCases.map((testCase, index) => (
                      <div key={`testcase-${index}`} className="border border-gray-200 rounded-md p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">测试用例 {index + 1}</span>
                          {formData.testCases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTestCase(index)}
                              className="text-sm text-red-600 hover:text-red-500"
                            >
                              删除
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">输入</label>
                          <textarea
                            value={testCase.input}
                            onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black text-sm"
                            rows={3}
                            placeholder="输入数据"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">期望输出</label>
                          <textarea
                            value={testCase.expectedOutput}
                            onChange={(e) => handleTestCaseChange(index, 'expectedOutput', e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black text-sm"
                            rows={3}
                            placeholder="期望输出"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">描述 (可选)</label>
                          <input
                            type="text"
                            value={testCase.description || ''}
                            onChange={(e) => handleTestCaseChange(index, 'description', e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black text-sm"
                            placeholder="测试用例描述"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">分值</label>
                <input
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  min="1"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {editingQuestion ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* 题目列表 */
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">题目列表</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {questions.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  暂无题目，点击上方按钮创建第一个题目
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {questions.map((question) => (
                    <div key={question.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-sm font-medium text-gray-900">{question.title}</h3>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {questionTypes[question.type]}
                            </span>
                            <span className="text-sm text-gray-500">{question.points}分</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            {question.content.substring(0, 200)}{question.content.length > 200 ? '...' : ''}
                          </p>
                          {question.type === 'MULTIPLE_CHOICE' && question.options && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">选项：</p>
                              <div className="text-xs text-gray-600">
                                {(() => {
                                  try {
                                    let options = question.options
                                    // 处理双重转义的JSON字符串
                                    if (typeof options === 'string') {
                                      options = JSON.parse(options)
                                      // 如果解析后仍然是字符串，再次解析
                                      if (typeof options === 'string') {
                                        options = JSON.parse(options)
                                      }
                                    }
                                    if (Array.isArray(options)) {
                                      return options.map((opt: string, i: number) => (
                                        <span key={i} className="inline-block mr-4">
                                          {String.fromCharCode(65 + i)}. {opt.substring(0, 30)}{opt.length > 30 ? '...' : ''}
                                        </span>
                                      ))
                                    }
                                    return <span className="text-red-500">选项格式错误</span>
                                  } catch (error) {
                                    return <span className="text-red-500">选项解析错误</span>
                                  }
                                })()}
                              </div>
                            </div>
                          )}
                          {question.type === 'TRUE_FALSE' && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">选项：</p>
                              <div className="text-xs text-gray-600">
                                <span className="inline-block mr-4">A. 正确</span>
                                <span className="inline-block mr-4">B. 错误</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(question)}
                            className="p-2 text-gray-400 hover:text-gray-500"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(question.id)}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}