'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Question {
  id: string
  title: string
  content: string
  type: string
  options: string[] | null
  points: number
  correctAnswer: string
}

interface ExamResult {
  id: string
  answers: Record<string, string>
  score: number
  isGraded: boolean
  tabSwitches: number
  submittedAt: string
}

interface Exam {
  id: string
  title: string
  description: string
  resultsPublished: boolean
  questions: Question[]
  examResult: ExamResult
}

export default function ExamResultPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchExamResult()
  }, [])

  const fetchExamResult = async () => {
    try {
      const response = await fetch(`/api/student/exam/${params.id}/result`)
      if (response.ok) {
        const data = await response.json()
        setExam(data.exam)
      } else {
        const data = await response.json()
        toast.error(data.error || '获取考试结果失败')
        router.push('/student')
      }
    } catch (error) {
      toast.error('网络错误')
      router.push('/student')
    } finally {
      setLoading(false)
    }
  }

  const getAnswerStatus = (question: Question, studentAnswer: string) => {
    if (!studentAnswer) {
      return { status: 'unanswered', color: 'text-gray-500', text: '未作答' }
    }

    if (question.type === 'PROGRAMMING') {
      // 编程题不显示对错，只显示已作答
      return { status: 'answered', color: 'text-blue-600', text: '已作答' }
    }

    const isCorrect = studentAnswer.toLowerCase() === question.correctAnswer.toLowerCase()
    return {
      status: isCorrect ? 'correct' : 'incorrect',
      color: isCorrect ? 'text-green-600' : 'text-red-600',
      text: isCorrect ? '正确' : '错误'
    }
  }

  const formatAnswer = (question: Question, answer: string) => {
    if (!answer) return '未作答'

    if (question.type === 'MULTIPLE_CHOICE' && question.options) {
      const optionIndex = parseInt(answer)
      return question.options[optionIndex] || answer
    }

    if (question.type === 'TRUE_FALSE') {
      return answer === 'true' ? '正确' : '错误'
    }

    return answer
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
        <div className="text-lg text-red-600">考试结果不存在</div>
      </div>
    )
  }

  if (!exam.resultsPublished) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-orange-600 mb-4">成绩尚未发布</div>
          <Link
            href="/student"
            className="text-blue-600 hover:text-blue-800"
          >
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0)
  const score = exam.examResult.score || 0
  const percentage = totalPoints > 0 ? (score / totalPoints * 100).toFixed(1) : '0'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{exam.title} - 考试结果</h1>
            <p className="text-gray-600 mt-2">{exam.description}</p>
          </div>
          <Link
            href="/student"
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            返回首页
          </Link>
        </div>

        {/* 成绩概览 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">成绩概览</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{score}</div>
              <div className="text-sm text-gray-500">得分</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{totalPoints}</div>
              <div className="text-sm text-gray-500">总分</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{percentage}%</div>
              <div className="text-sm text-gray-500">得分率</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                exam.examResult.tabSwitches > 5 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {exam.examResult.tabSwitches}
              </div>
              <div className="text-sm text-gray-500">切换标签次数</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            提交时间：{new Date(exam.examResult.submittedAt).toLocaleString()}
          </div>
        </div>

        {/* 答题详情 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">答题详情</h2>
          <div className="space-y-8">
            {exam.questions.map((question, index) => {
              const studentAnswer = exam.examResult.answers[question.id] || ''
              const answerStatus = getAnswerStatus(question, studentAnswer)
              
              return (
                <div key={question.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      第 {index + 1} 题 ({question.points} 分)
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${answerStatus.color} bg-gray-100`}>
                      {answerStatus.text}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">{question.title}</h4>
                    <div 
                      className="prose prose-sm max-w-none text-black"
                      dangerouslySetInnerHTML={{ __html: question.content }}
                    />
                  </div>

                  {question.type === 'MULTIPLE_CHOICE' && question.options && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">选项：</div>
                      <div className="space-y-1">
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
                          return Array.isArray(options) ? options.map((option, optionIndex) => {
                            const isSelected = studentAnswer === optionIndex.toString()
                            const isCorrect = question.correctAnswer === optionIndex.toString()
                            return (
                              <div
                                key={`${question.id}-result-option-${optionIndex}`}
                                className={`p-2 rounded text-sm ${
                                  isSelected && isCorrect
                                    ? 'bg-green-100 text-green-800'
                                    : isSelected && !isCorrect
                                    ? 'bg-red-100 text-red-800'
                                    : isCorrect
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-50 text-black'
                                }`}
                              >
                                {String.fromCharCode(65 + optionIndex)}. {option}
                                {isSelected && ' (您的答案)'}
                                {isCorrect && ' (正确答案)'}
                              </div>
                            )
                          }) : null;
                        } catch (error) {
                          console.error('Error parsing options:', error);
                          return null;
                        }
                      })()}
                      </div>
                    </div>
                  )}

                  {question.type === 'TRUE_FALSE' && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">您的答案：</div>
                      <div className={`inline-block px-3 py-1 rounded text-sm ${
                        answerStatus.status === 'correct'
                          ? 'bg-green-100 text-green-800'
                          : answerStatus.status === 'incorrect'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {formatAnswer(question, studentAnswer)}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        正确答案：{question.correctAnswer === 'true' ? '正确' : '错误'}
                      </div>
                    </div>
                  )}

                  {question.type === 'PROGRAMMING' && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">您的答案：</div>
                      <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
                        <code>{studentAnswer || '未作答'}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}