'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { toZonedTime, format } from 'date-fns-tz'

interface Question {
  id: string
  title: string
  type: string
  points: number
  correctAnswer: string
}

interface ExamResult {
  id: string
  answers: Record<string, string>
  score: number | null
  isGraded: boolean
  tabSwitches: number
  submittedAt: string
  programmingScoreImported?: boolean
  programmingScoreImportedAt?: string
  student: {
    id: string
    name: string
    email: string
    campus: string
  }
}

interface Exam {
  id: string
  title: string
  description: string
  resultsPublished: boolean
  questions: Question[]
  examResults: ExamResult[]
}

export default function ExamResultsPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(false)
  const [importing, setImporting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchExamResults()
  }, [])

  const fetchExamResults = async () => {
    try {
      const response = await fetch(`/api/teacher/exams/${params.id}/results`)
      if (response.ok) {
        const data = await response.json()
        setExam(data.exam)
      } else {
        toast.error('获取考试成绩失败')
        router.push('/teacher/exams')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const gradeExam = async () => {
    if (!confirm('确定要开始自动判分吗？此操作将覆盖已有的成绩。')) {
      return
    }

    setGrading(true)
    try {
      const response = await fetch(`/api/teacher/exams/${params.id}/grade`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('判分完成')
        fetchExamResults()
      } else {
        const data = await response.json()
        toast.error(data.error || '判分失败')
      }
    } catch (error) {
      toast.error('网络错误')
    } finally {
      setGrading(false)
    }
  }

  const publishResults = async () => {
    if (!confirm('确定要发布成绩吗？发布后学生将能看到自己的成绩。')) {
      return
    }

    try {
      const response = await fetch(`/api/teacher/exams/${params.id}/publish`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('成绩发布成功')
        fetchExamResults()
      } else {
        const data = await response.json()
        toast.error(data.error || '发布失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const importProgrammingScores = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('请选择CSV文件')
      return
    }

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/teacher/exams/${params.id}/import-programming-scores`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`导入成功！成功: ${data.successCount}条，失败: ${data.errorCount}条`)
        if (data.errors && data.errors.length > 0) {
          console.warn('导入错误:', data.errors)
        }
        // 重新获取考试结果
        fetchExamResults()
      } else {
        toast.error(data.error || '导入失败')
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('导入失败')
    } finally {
      setImporting(false)
      // 清空文件输入
      event.target.value = ''
    }
  }

  const exportResults = () => {
    if (!exam) return

    const csvContent = [
      ['姓名', '邮箱', '校区', '客观题得分', '编程题得分', '总分', '满分', '切换标签次数', '提交时间'].join(','),
      ...exam.examResults.map(result => {
        const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0)
        const programmingScore = (result as any).programmingScore || 0
        const objectiveScore = (result.score || 0) - programmingScore
        
        return [
          result.student.name,
          result.student.email,
          result.student.campus,
          objectiveScore,
          programmingScore,
          result.score || 0,
          totalPoints,
          result.tabSwitches,
          format(toZonedTime(new Date(result.submittedAt), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Shanghai' })
        ].join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${exam.title}_成绩.csv`
    link.click()
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

  const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0)
  const gradedCount = exam.examResults.filter(r => r.isGraded).length
  const averageScore = gradedCount > 0 
    ? exam.examResults.filter(r => r.isGraded).reduce((sum, r) => sum + (r.score || 0), 0) / gradedCount
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{exam.title} - 成绩管理</h1>
            <p className="text-gray-600 mt-2">{exam.description}</p>
          </div>
          <Link
            href="/teacher/exams"
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            返回考试列表
          </Link>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">参与人数</h3>
            <p className="text-3xl font-bold text-blue-600">{exam.examResults.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">已判分</h3>
            <p className="text-3xl font-bold text-green-600">{gradedCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">平均分</h3>
            <p className="text-3xl font-bold text-purple-600">
              {averageScore.toFixed(1)} / {totalPoints}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">成绩状态</h3>
            <p className={`text-3xl font-bold ${
              exam.resultsPublished ? 'text-green-600' : 'text-orange-600'
            }`}>
              {exam.resultsPublished ? '已发布' : '未发布'}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={gradeExam}
            disabled={grading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {grading ? '判分中...' : '自动判分'}
          </button>
          
          {/* 导入编程成绩按钮 */}
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={importProgrammingScores}
              disabled={importing || (exam?.examResults?.some(r => r.programmingScoreImported) || false)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              id="programming-scores-upload"
            />
            <label
              htmlFor="programming-scores-upload"
              className={`inline-block px-6 py-2 rounded-lg transition-colors cursor-pointer ${
                exam?.examResults?.some(r => r.programmingScoreImported) 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : importing 
                    ? 'bg-orange-400 text-white cursor-not-allowed' 
                    : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {exam?.examResults?.some(r => r.programmingScoreImported) 
                ? '已导入编程成绩' 
                : importing 
                  ? '导入中...' 
                  : '导入编程成绩'}
            </label>
          </div>
          
          {gradedCount > 0 && (
            <>
              <button
                onClick={publishResults}
                disabled={exam.resultsPublished}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {exam.resultsPublished ? '已发布成绩' : '发布成绩'}
              </button>
              <button
                onClick={exportResults}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                导出成绩
              </button>
            </>
          )}
        </div>
        
        {/* 导入说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium text-blue-800 mb-2">📋 导入编程成绩说明</h4>
          <p className="text-sm text-blue-700 mb-2">
            请上传包含以下列的CSV文件：<code className="bg-blue-100 px-1 rounded">学生</code>、<code className="bg-blue-100 px-1 rounded">得分</code>
          </p>
          <p className="text-sm text-blue-600 mb-2">
            💡 导入后将自动计算总分（原有分数 + 编程分数），并更新学生的最终成绩
          </p>
          <p className="text-sm text-orange-600 mb-2">
            ⚠️ 编程成绩只能导入一次，如需重新导入请先进行自动判分
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-700">📄</span>
            <a 
              href="/programming-scores-template.csv" 
              download
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              下载CSV模板文件
            </a>
          </div>
        </div>

        {/* 成绩列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">学生成绩</h3>
          </div>
          {exam.examResults.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              暂无学生提交答案
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      学生信息
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      客观题得分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      编程题得分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      总分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      切换标签次数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      提交时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {exam.examResults.map((result) => {
                    const programmingScore = (result as any).programmingScore || 0
                    const objectiveScore = (result.score || 0) - programmingScore
                    
                    return (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {result.student.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {result.student.email}
                            </div>
                            <div className="text-sm text-gray-500">
                              {result.student.campus}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {result.isGraded ? objectiveScore : '未判分'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {programmingScore > 0 ? programmingScore : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {result.isGraded ? `${result.score} / ${totalPoints}` : '未判分'}
                          </div>
                          {result.isGraded && totalPoints > 0 && (
                            <div className="text-sm text-gray-500">
                              {((result.score || 0) / totalPoints * 100).toFixed(1)}%
                           </div>
                         )}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`text-sm font-medium ${
                             result.tabSwitches > 5 ? 'text-red-600' : 'text-gray-900'
                           }`}>
                             {result.tabSwitches}
                           </span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {format(toZonedTime(new Date(result.submittedAt), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Shanghai' })}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                             result.isGraded
                               ? 'bg-green-100 text-green-800'
                               : 'bg-yellow-100 text-yellow-800'
                           }`}>
                             {result.isGraded ? '已判分' : '未判分'}
                           </span>
                         </td>
                       </tr>
                     )
                   })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}