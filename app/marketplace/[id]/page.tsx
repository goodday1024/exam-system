'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

interface MarketplaceExam {
  _id: string
  title: string
  description?: string
  category: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  duration: number
  questionCount: number
  tags: string[]
  publishedByName: string
  publishedAt: string
  downloadCount: number
  rating: number
  ratingCount: number
  previewQuestions: any[]
}

interface Rating {
  _id: string
  userName: string
  rating: number
  comment?: string
  createdAt: string
}

export default function MarketplaceExamDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [exam, setExam] = useState<MarketplaceExam | null>(null)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [showAllQuestions, setShowAllQuestions] = useState(false)
  const [allQuestions, setAllQuestions] = useState<any[]>([])

  useEffect(() => {
    fetchExamDetail()
    fetchRatings()
  }, [])

  const fetchExamDetail = async () => {
    try {
      const response = await fetch(`/api/marketplace/exams/${params.id}`)
      const data = await response.json()
      
      if (response.ok && data.exam) {
        setExam({
          _id: data.exam._id,
          title: data.exam.title,
          description: data.exam.description,
          category: data.exam.category,
          difficulty: data.exam.difficulty,
          duration: data.exam.duration,
          questionCount: data.exam.questionCount,
          tags: data.exam.tags,
          publishedByName: data.exam.publishedBy?.name || data.exam.publishedByName || '未知',
          publishedAt: data.exam.publishedAt,
          downloadCount: data.exam.downloadCount,
          rating: data.exam.averageRating || 0,
          ratingCount: data.exam.ratingCount || 0,
          previewQuestions: data.exam.previewData || []
        })
      } else {
        toast.error('考试不存在')
        router.push('/marketplace')
      }
    } catch (error) {
      toast.error('网络错误')
      router.push('/marketplace')
    } finally {
      setLoading(false)
    }
  }

  const fetchRatings = async () => {
    try {
      const response = await fetch(`/api/marketplace/exams/${params.id}/rate`)
      const data = await response.json()
      
      if (response.ok) {
        setRatings(data.ratings)
      }
    } catch (error) {
      console.error('获取评分失败:', error)
    }
  }

  const fetchAllQuestions = async () => {
    try {
      const response = await fetch(`/api/marketplace/exams/${params.id}`)
      const data = await response.json()
      
      if (response.ok && data.exam) {
        // 解析完整的考试数据来获取所有题目
        const examData = JSON.parse(data.exam.examData || '{}')
        setAllQuestions(examData.questions || [])
      }
    } catch (error) {
      console.error('获取所有题目失败:', error)
      toast.error('获取题目失败')
    }
  }

  const handleToggleQuestions = async () => {
    if (!showAllQuestions && allQuestions.length === 0) {
      await fetchAllQuestions()
    }
    setShowAllQuestions(!showAllQuestions)
  }

  const handleImport = async () => {
    try {
      setImporting(true)
      const response = await fetch(`/api/marketplace/exams/${params.id}/import`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (response.ok) {
        toast.success('考试导入成功！')
        // 刷新页面以更新下载次数
        fetchExamDetail()
      } else {
        toast.error(data.error || '导入失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setImporting(false)
    }
  }

  const handleSubmitRating = async (ratingData: { rating: number; comment: string }) => {
    try {
      setSubmittingRating(true)
      const response = await fetch(`/api/marketplace/exams/${params.id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ratingData)
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('评分成功！')
        setShowRatingModal(false)
        fetchExamDetail()
        fetchRatings()
      } else {
        toast.error(data.error || '评分失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setSubmittingRating(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'text-green-600 bg-green-100'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100'
      case 'HARD': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return '简单'
      case 'MEDIUM': return '中等'
      case 'HARD': return '困难'
      default: return difficulty
    }
  }

  const renderStars = (rating: number, interactive = false, onRate?: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-lg cursor-pointer ${
          i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'
        } ${interactive ? 'hover:text-yellow-400' : ''}`}
        onClick={() => interactive && onRate && onRate(i + 1)}
      >
        ★
      </span>
    ))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">考试不存在</p>
          <button
            onClick={() => router.push('/marketplace')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            返回商城
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 返回按钮 */}
        <div className="mb-6 flex items-center space-x-4">
          <button
            onClick={() => router.push('/marketplace')}
            className="text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← 返回商城
          </button>
          <button
            onClick={() => router.push('/teacher')}
            className="text-green-600 hover:text-green-800 flex items-center"
          >
            🏠 返回教师端首页
          </button>
        </div>

        {/* 考试信息 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{exam.title}</h1>
              <div className="flex items-center space-x-4 mb-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {exam.category}
                </span>
                <span className={`px-3 py-1 text-sm rounded-full ${getDifficultyColor(exam.difficulty)}`}>
                  {getDifficultyText(exam.difficulty)}
                </span>
              </div>
              {exam.description && (
                <p className="text-gray-600 mb-4">{exam.description}</p>
              )}
            </div>
            <div className="ml-6 text-right">
              <div className="flex items-center mb-2">
                {renderStars(exam.rating)}
                <span className="ml-2 text-sm text-gray-600">({exam.ratingCount})</span>
              </div>
              <p className="text-sm text-gray-600">{exam.downloadCount} 次下载</p>
            </div>
          </div>

          {/* 考试详情 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{exam.duration}</div>
              <div className="text-sm text-gray-600">分钟</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{exam.questionCount}</div>
              <div className="text-sm text-gray-600">题目</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{exam.rating.toFixed(1)}</div>
              <div className="text-sm text-gray-600">评分</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{exam.downloadCount}</div>
              <div className="text-sm text-gray-600">下载</div>
            </div>
          </div>

          {/* 标签 */}
          {exam.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">标签</h3>
              <div className="flex flex-wrap gap-2">
                {exam.tags.map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 发布信息 */}
          <div className="text-sm text-gray-500 mb-6">
            <p>发布者: {exam.publishedByName}</p>
            <p>发布时间: {new Date(exam.publishedAt).toLocaleDateString()}</p>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-4">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? '导入中...' : '导入考试'}
            </button>
            <button
              onClick={() => setShowRatingModal(true)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              评分
            </button>
          </div>
        </div>

        {/* 预览题目 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">题目预览</h2>
            <button
              onClick={handleToggleQuestions}
              className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              {showAllQuestions ? '显示部分题目' : '显示所有题目'}
            </button>
          </div>
          <div className="space-y-4">
            {(showAllQuestions ? allQuestions : exam.previewQuestions).map((question, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900">第 {index + 1} 题: {question.title}</h3>
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
                <p className="text-gray-600 text-sm">{question.content}</p>
                {question.options && (
                  <div className="mt-2 text-sm text-gray-500">
                    选项: {(() => {
                      try {
                        const options = JSON.parse(question.options)
                        return Array.isArray(options) ? options.join(', ') : String(options)
                      } catch {
                        return question.options
                      }
                    })()}
                  </div>
                )}
              </div>
            ))}
            {!showAllQuestions && (
              <div className="text-center text-gray-500 text-sm">
                ... 还有 {exam.questionCount - exam.previewQuestions.length} 道题目
              </div>
            )}
          </div>
        </div>

        {/* 评分列表 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">用户评价</h2>
          {ratings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无评价</p>
          ) : (
            <div className="space-y-4">
              {ratings.map((rating) => (
                <div key={rating._id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{rating.userName}</span>
                      <div className="flex">
                        {renderStars(rating.rating)}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(rating.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {rating.comment && (
                    <p className="text-gray-600 text-sm">{rating.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 评分模态框 */}
      {showRatingModal && (
        <RatingModal
          onClose={() => setShowRatingModal(false)}
          onSubmit={handleSubmitRating}
          loading={submittingRating}
        />
      )}
    </div>
  )
}

// 评分模态框组件
function RatingModal({ 
  onClose, 
  onSubmit, 
  loading 
}: { 
  onClose: () => void
  onSubmit: (data: { rating: number; comment: string }) => void
  loading: boolean
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      toast.error('请选择评分')
      return
    }
    onSubmit({ rating, comment })
  }

  const renderStars = (currentRating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-2xl cursor-pointer ${
          i < currentRating ? 'text-yellow-400' : 'text-gray-300'
        } hover:text-yellow-400`}
        onClick={() => setRating(i + 1)}
      >
        ★
      </span>
    ))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">为考试评分</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              评分
            </label>
            <div className="flex space-x-1">
              {renderStars(rating)}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              评价 (可选)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入您的评价..."
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '提交中...' : '提交评分'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}