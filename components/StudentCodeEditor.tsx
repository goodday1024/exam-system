'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EdgeEvaluationProgress from '@/components/EdgeEvaluationProgress'

interface StudentCodeEditorProps {
  questionId: string
  examId: string
  value: string
  onChange: (value: string) => void
  language?: string
  onLanguageChange?: (language: string) => void
  testCases?: any[]
  placeholder?: string
  disabled?: boolean
}

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' }
]

export default function StudentCodeEditor({
  questionId,
  examId,
  value,
  onChange,
  language = 'javascript',
  onLanguageChange,
  testCases = [],
  placeholder = '请在此处输入您的代码...',
  disabled = false
}: StudentCodeEditorProps) {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // 测试代码（流式版本）
  const testCode = async () => {
    if (!value.trim()) {
      setError('请先输入代码')
      return
    }

    if (testCases.length === 0) {
      setError('该题目没有配置测试用例')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setTestResult(null)
    
    try {
      const response = await fetch('/api/evaluate-edge/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          examId,
          code: value,
          language,
          testCases,
          priority: false // 学生测试使用普通优先级
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '提交测试失败')
      }

      // 处理流式响应
      await processStreamResponse(response)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交测试失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理流式响应
  const processStreamResponse = async (response: Response) => {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6))
              
              if (eventData.type === 'job_created') {
                setCurrentJobId(eventData.jobId)
              } else if (eventData.type === 'job_completed') {
                setTestResult(eventData.result)
                setCurrentJobId(null)
              } else if (eventData.type === 'job_failed') {
                setError(eventData.error || '评测失败')
                setCurrentJobId(null)
              }
            } catch (parseError) {
              console.error('解析事件数据失败:', parseError)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // 处理测试完成
  const handleTestComplete = (result: any) => {
    setTestResult(result)
    setCurrentJobId(null)
  }

  // 处理测试错误
  const handleTestError = (errorMessage: string) => {
    setError(errorMessage)
    setCurrentJobId(null)
  }

  // 处理取消测试
  const handleTestCancel = () => {
    setCurrentJobId(null)
  }

  // 重置状态
  const resetState = () => {
    setCurrentJobId(null)
    setTestResult(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* 语言选择和测试按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">编程语言:</label>
          <select
            value={language}
            onChange={(e) => onLanguageChange?.(e.target.value)}
            disabled={disabled}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        
        <Button
          onClick={testCode}
          disabled={disabled || isSubmitting || !!currentJobId || !value.trim()}
          size="sm"
          variant="outline"
        >
          {isSubmitting ? '提交中...' : '测试代码'}
        </Button>
      </div>

      {/* 代码编辑器 */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-40 p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm text-black resize-y"
        placeholder={placeholder}
      />

      {/* 测试进度 */}
      {currentJobId && (
        <EdgeEvaluationProgress
          jobId={currentJobId}
          onComplete={handleTestComplete}
          onError={handleTestError}
          onCancel={handleTestCancel}
        />
      )}

      {/* 错误信息 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-red-600">{error}</div>
              <Button onClick={resetState} size="sm" variant="outline">
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 测试结果 */}
      {testResult && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700">测试结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {testResult.testResults?.map((result: any, index: number) => (
              <div key={index} className="p-2 bg-white border rounded text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">测试用例 {index + 1}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    result.passed 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {result.passed ? '通过' : '失败'}
                  </span>
                </div>
                <div className="space-y-1 text-gray-600">
                  <div>输出: {JSON.stringify(result.output)}</div>
                  <div>执行时间: {result.executionTime}ms</div>
                  {result.error && (
                    <div className="text-red-600">错误: {result.error}</div>
                  )}
                </div>
              </div>
            )) || (
              <div className="text-sm text-gray-600">
                <pre className="whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
              </div>
            )}
            
            <div className="pt-2 border-t">
              <Button onClick={resetState} size="sm" variant="outline">
                重新测试
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 使用提示 */}
      <div className="text-xs text-gray-500">
        💡 提示: 您可以随时测试代码，确保逻辑正确后再提交考试。测试不会影响最终成绩。
      </div>
    </div>
  )
}