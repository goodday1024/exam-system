'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface Question {
  id: string
  title: string
  content: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'PROGRAMMING'
  options: string | null
  points: number
  order: number
}

interface Exam {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string
  duration: number
  maxTabSwitches: number
  questions: Question[]
}

interface ExamResult {
  id: string
  answers: Record<string, string>
  tabSwitches: number
  isSubmitted: boolean
}

const questionTypes = {
  MULTIPLE_CHOICE: '选择题',
  TRUE_FALSE: '判断题',
  PROGRAMMING: '编程题'
}

export default function ExamPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  
  const [exam, setExam] = useState<Exam | null>(null)
  const [examResult, setExamResult] = useState<ExamResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [examStarted, setExamStarted] = useState(false)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const visibilityRef = useRef(true)
  const startTimeRef = useRef<Date | null>(null)

  useEffect(() => {
    fetchExam()
    setupVisibilityListener()
    setupBeforeUnloadListener()
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      // 移除事件监听器时使用setupVisibilityListener中定义的同一个处理函数
      document.removeEventListener('visibilitychange', () => {
        if (document.hidden && examStarted && !examResult?.isSubmitted) {
          if (visibilityRef.current) {
            visibilityRef.current = false
            handleTabSwitch()
          }
        } else if (!document.hidden) {
          visibilityRef.current = true
        }
      })
      window.onbeforeunload = null
    }
  }, [])

  useEffect(() => {
    if (examStarted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [examStarted, timeLeft])

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/student/exam/${examId}`)
      if (response.ok) {
        const data = await response.json()
        setExam(data.exam)
        setExamResult(data.examResult)
        
        if (data.examResult) {
          setAnswers(data.examResult.answers || {})
          setTabSwitches(data.examResult.tabSwitches || 0)
          
          if (!data.examResult.isSubmitted) {
            // 计算剩余时间
            const now = new Date()
            const endTime = new Date(data.exam.endTime)
            const examDuration = data.exam.duration * 60 * 1000 // 转换为毫秒
            
            // 如果有开始时间记录，使用开始时间+考试时长，否则使用考试结束时间
            let examEndTime = endTime
            if (data.examResult.createdAt) {
              const resultStartTime = new Date(data.examResult.createdAt)
              const durationEndTime = new Date(resultStartTime.getTime() + examDuration)
              examEndTime = durationEndTime < endTime ? durationEndTime : endTime
            }
            
            const remaining = Math.max(0, Math.floor((examEndTime.getTime() - now.getTime()) / 1000))
            setTimeLeft(remaining)
            setExamStarted(true)
          }
        }
      } else {
        toast.error('获取考试信息失败')
        router.push('/student')
      }
    } catch (error) {
      toast.error('网络错误')
      router.push('/student')
    } finally {
      setLoading(false)
    }
  }

  const startExam = async () => {
    try {
      const response = await fetch(`/api/student/exam/${examId}/start`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        setExamResult(data)
        setTimeLeft(exam!.duration * 60) // 转换为秒
        setExamStarted(true)
        startTimeRef.current = new Date()
        toast.success('考试已开始')
      } else {
        const data = await response.json()
        toast.error(data.error || '开始考试失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const setupVisibilityListener = () => {
    const handleVisibilityChange = () => {
      if (document.hidden && examStarted && !examResult?.isSubmitted) {
        // 页面被隐藏（切换标签页）
        if (visibilityRef.current) {
          visibilityRef.current = false
          handleTabSwitch()
        }
      } else if (!document.hidden) {
        // 页面重新可见
        visibilityRef.current = true
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  const setupBeforeUnloadListener = () => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (examStarted && !examResult?.isSubmitted) {
        e.preventDefault()
        e.returnValue = '考试正在进行中，确定要离开吗？'
        return '考试正在进行中，确定要离开吗？'
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

  const handleTabSwitch = async () => {
    const newTabSwitches = tabSwitches + 1
    setTabSwitches(newTabSwitches)
    setShowWarning(true)
    
    // 3秒后隐藏警告
    setTimeout(() => setShowWarning(false), 3000)
    
    // 更新服务器端的切换次数
    try {
      await fetch(`/api/student/exam/${examId}/tab-switch`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('更新切换次数失败:', error)
    }
    
    // 检查是否超过最大切换次数
    if (newTabSwitches >= exam!.maxTabSwitches) {
      toast.error(`切换标签页次数已达上限（${exam!.maxTabSwitches}次），考试将自动提交`)
      setTimeout(() => {
        handleAutoSubmit()
      }, 2000)
    } else {
      toast.error(`警告：您已切换标签页 ${newTabSwitches} 次，最多允许 ${exam!.maxTabSwitches} 次`)
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    const newAnswers = { ...answers, [questionId]: answer }
    setAnswers(newAnswers)
    
    // 自动保存答案
    saveAnswers(newAnswers)
  }

  const saveAnswers = async (answersToSave: Record<string, string>) => {
    try {
      console.log('正在保存答案:', answersToSave)
      const response = await fetch(`/api/student/exam/${examId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: answersToSave }),
      })
      
      const result = await response.json()
      console.log('保存答案响应:', { status: response.status, result })
      
      if (!response.ok) {
        console.error('保存答案失败:', result.error)
        toast.error(`保存失败: ${result.error}`)
      } else {
        console.log('答案保存成功')
      }
    } catch (error) {
      console.error('保存答案失败:', error)
      toast.error('保存答案时发生网络错误')
    }
  }

  const handleSubmit = async () => {
    if (!confirm('确定要提交考试吗？提交后将无法修改答案。')) {
      return
    }
    
    await submitExam()
  }

  const handleAutoSubmit = async () => {
    toast.error('时间到或违规，考试自动提交')
    await submitExam()
  }

  const submitExam = async () => {
    setSubmitting(true)
    
    try {
      const response = await fetch(`/api/student/exam/${examId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      })
      
      if (response.ok) {
        toast.success('考试提交成功')
        
        // 检查是否有编程题，如果有则触发代码评测
        const hasProgrammingQuestions = exam!.questions.some(q => q.type === 'PROGRAMMING')
        if (hasProgrammingQuestions) {
          try {
            await fetch(`/api/teacher/exams/${examId}/evaluate`, {
              method: 'POST'
            })
            toast.success('代码评测已自动开始')
          } catch (error) {
            console.log('代码评测触发失败，但不影响考试提交')
          }
        }
        
        router.push('/student')
      } else {
        const data = await response.json()
        toast.error(data.error || '提交失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const canStartExam = () => {
    if (!exam) return false
    
    const now = new Date()
    const startTime = new Date(exam.startTime)
    const endTime = new Date(exam.endTime)
    
    return now >= startTime && now <= endTime && !examResult?.isSubmitted
  }

  const isExamEnded = () => {
    if (!exam) return false
    
    const now = new Date()
    const endTime = new Date(exam.endTime)
    
    return now > endTime
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
        <div className="text-lg text-red-600">考试不存在</div>
      </div>
    )
  }

  if (examResult?.isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">考试已提交</h2>
          <p className="text-gray-600 mb-4">您已成功提交考试，请等待成绩发布</p>
          <button
            onClick={() => router.push('/student')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  if (!examStarted && !canStartExam()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isExamEnded() ? '考试已结束' : '考试尚未开始'}
          </h2>
          <p className="text-gray-600 mb-4">
            {isExamEnded() 
              ? '很抱歉，考试时间已过，无法参加考试' 
              : '请在考试开始时间后再来参加考试'
            }
          </p>
          <button
            onClick={() => router.push('/student')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{exam.title}</h2>
          {exam.description && (
            <p className="text-gray-600 mb-4">{exam.description}</p>
          )}
          <div className="text-sm text-gray-500 mb-6 space-y-2">
            <div>考试时长: {exam.duration} 分钟</div>
            <div>题目数量: {exam.questions.length} 道</div>
            <div>最大切换标签页次数: {exam.maxTabSwitches} 次</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">考试须知：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>考试开始后不能刷新页面或关闭浏览器</li>
                  <li>切换标签页将被记录，超过限制次数将自动提交</li>
                  <li>题目内容禁止复制（输入输出样例除外）</li>
                  <li>时间到将自动提交考试</li>
                </ul>
              </div>
            </div>
          </div>
          <button
            onClick={startExam}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
          >
            开始考试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 exam-container">
      {/* 防作弊警告 */}
      {showWarning && (
        <div className="cheat-warning">
          <ExclamationTriangleIcon className="inline h-5 w-5 mr-2" />
          检测到切换标签页行为！当前次数: {tabSwitches}/{exam.maxTabSwitches}
        </div>
      )}

      {/* 顶部状态栏 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{exam.title}</h1>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center text-sm text-gray-600">
                <span>切换次数: {tabSwitches}/{exam.maxTabSwitches}</span>
              </div>
              <div className={`flex items-center text-sm font-medium ${
                timeLeft <= 300 ? 'text-red-600' : 'text-gray-900'
              }`}>
                <ClockIcon className="h-4 w-4 mr-1" />
                <span>剩余时间: {formatTime(timeLeft)}</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '提交考试'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 题目列表 */}
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {exam.questions.map((question, index) => (
            <div key={question.id} className="question-card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-medium text-gray-900">第 {index + 1} 题</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {questionTypes[question.type]}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {question.points}分
                  </span>
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-3">{question.title}</h3>
              
              <div className="prose prose-sm max-w-none mb-4 no-select text-black">
                <ReactMarkdown
                  components={{
                    code({node, className, children, ...props}: {
                      node?: any;
                      className?: string;
                      children?: React.ReactNode;
                      [key: string]: any;
                    }) {
                      const match = /language-(\w+)/.exec(className || '')
                      return match && !props.inline ? (
                        <div className="allow-select">
                          <SyntaxHighlighter
                            style={tomorrow}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className={`${className} allow-select`} {...props}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {question.content}
                </ReactMarkdown>
              </div>
              
              {/* 答题区域 */}
              <div className="mt-4">
                {question.type === 'MULTIPLE_CHOICE' && question.options && (
                  <div className="space-y-2">
                    {(() => {
                      try {
                        let options = question.options;
                        // 处理双重转义的JSON字符串
                        if (typeof options === 'string') {
                          options = JSON.parse(options);
                          // 如果解析后仍然是字符串，再次解析
                          if (typeof options === 'string') {
                            options = JSON.parse(options);
                          }
                        }
                        return Array.isArray(options) ? options.map((option: string, optionIndex: number) => (
                          <label key={`${question.id}-option-${optionIndex}`} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={String.fromCharCode(65 + optionIndex)}
                              checked={answers[question.id] === String.fromCharCode(65 + optionIndex)}
                              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span className="text-sm text-black">
                              {String.fromCharCode(65 + optionIndex)}. {option}
                            </span>
                          </label>
                        )) : null;
                      } catch (error) {
                        console.error('Error parsing options:', error);
                        return null;
                      }
                    })()}
                   </div>
                 )}
                
                {question.type === 'TRUE_FALSE' && (
                  <div className="space-y-2">
                    <label key={`${question.id}-true`} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value="true"
                        checked={answers[question.id] === 'true'}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-900">正确</span>
                    </label>
                    <label key={`${question.id}-false`} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value="false"
                        checked={answers[question.id] === 'false'}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-900">错误</span>
                    </label>
                  </div>
                )}
                
                {question.type === 'PROGRAMMING' && (
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="w-full h-40 p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm text-black"
                    placeholder="请在此处输入您的代码..."
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* 底部提交按钮 */}
        <div className="mt-8 text-center">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
          >
            {submitting ? '提交中...' : '提交考试'}
          </button>
        </div>
      </div>
    </div>
  )
}