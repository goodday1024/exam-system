'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

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

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

const categories = [
  { value: 'all', label: '全部分类' },
  { value: '数学', label: '数学' },
  { value: '编程', label: '编程' },
  { value: '语言', label: '语言' },
  { value: '科学', label: '科学' },
  { value: '其他', label: '其他' }
]

const difficulties = [
  { value: 'all', label: '全部难度' },
  { value: 'EASY', label: '简单' },
  { value: 'MEDIUM', label: '中等' },
  { value: 'HARD', label: '困难' }
]

const sortOptions = [
  { value: 'publishedAt', label: '发布时间' },
  { value: 'rating', label: '评分' },
  { value: 'downloadCount', label: '下载量' }
]

export default function MarketplacePage() {
  const router = useRouter()
  const [exams, setExams] = useState<MarketplaceExam[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  })
  
  // 筛选条件
  const [filters, setFilters] = useState({
    category: 'all',
    difficulty: 'all',
    search: '',
    sortBy: 'publishedAt',
    sortOrder: 'desc'
  })

  const fetchExams = async (page = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      })
      
      const response = await fetch(`/api/marketplace/exams?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setExams(data.exams)
        setPagination(data.pagination)
      } else {
        toast.error(data.error || '获取考试列表失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (examId: string) => {
    try {
      setImporting(examId)
      const response = await fetch(`/api/marketplace/exams/${examId}/import`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (response.ok) {
        toast.success('考试导入成功！')
        // 刷新列表以更新下载次数
        fetchExams(pagination.page)
      } else {
        toast.error(data.error || '导入失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setImporting(null)
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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-sm ${
          i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'
        }`}
      >
        ★
      </span>
    ))
  }

  useEffect(() => {
    fetchExams(1)
  }, [filters])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">考试商城</h1>
              <p className="mt-2 text-gray-600">发现和导入优质考试资源</p>
            </div>
            <button
              onClick={() => router.push('/teacher')}
              className="text-green-600 hover:text-green-800 flex items-center px-4 py-2 border border-green-300 rounded-md hover:bg-green-50 transition-colors"
            >
              🏠 返回教师端首页
            </button>
          </div>
        </div>

        {/* 筛选器 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 搜索 */}
            <div className="lg:col-span-2">
              <input
                type="text"
                placeholder="搜索考试标题、描述或标签..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* 分类 */}
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            
            {/* 难度 */}
            <select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {difficulties.map(diff => (
                <option key={diff.value} value={diff.value}>{diff.label}</option>
              ))}
            </select>
            
            {/* 排序 */}
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sortOptions.map(sort => (
                <option key={sort.value} value={sort.value}>{sort.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 考试列表 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">暂无考试</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div key={exam._id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* 考试标题和分类 */}
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {exam.title}
                    </h3>
                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {exam.category}
                    </span>
                  </div>
                  
                  {/* 描述 */}
                  {exam.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {exam.description}
                    </p>
                  )}
                  
                  {/* 考试信息 */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">难度:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(exam.difficulty)}`}>
                        {getDifficultyText(exam.difficulty)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">时长:</span>
                      <span className="text-gray-900">{exam.duration} 分钟</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">题目数:</span>
                      <span className="text-gray-900">{exam.questionCount} 题</span>
                    </div>
                  </div>
                  
                  {/* 评分和下载量 */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-1">
                      {renderStars(exam.rating)}
                      <span className="text-sm text-gray-600 ml-1">
                        ({exam.ratingCount})
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {exam.downloadCount} 次下载
                    </span>
                  </div>
                  
                  {/* 发布者和时间 */}
                  <div className="text-xs text-gray-500 mb-4">
                    <p>发布者: {exam.publishedByName}</p>
                    <p>发布时间: {new Date(exam.publishedAt).toLocaleDateString()}</p>
                  </div>
                  
                  {/* 标签 */}
                  {exam.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {exam.tags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                      {exam.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          +{exam.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* 操作按钮 */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleImport(exam._id)}
                      disabled={importing === exam._id}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {importing === exam._id ? '导入中...' : '导入考试'}
                    </button>
                    <button
                      onClick={() => router.push(`/marketplace/${exam._id}`)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      详情
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {pagination.pages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex space-x-2">
              <button
                onClick={() => fetchExams(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                const page = i + 1
                return (
                  <button
                    key={page}
                    onClick={() => fetchExams(page)}
                    className={`px-3 py-2 border rounded-md ${
                      pagination.page === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
              
              <button
                onClick={() => fetchExams(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}