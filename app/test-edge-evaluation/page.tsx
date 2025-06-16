'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EdgeEvaluationProgress from '@/components/EdgeEvaluationProgress'

const SAMPLE_CODE = {
  javascript: `function solution(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}`,
  python: `def solution(nums, target):
    num_map = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in num_map:
            return [num_map[complement], i]
        num_map[num] = i
    return []`,
  java: `public class Solution {
    public int[] solution(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[]{map.get(complement), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }
}`,
  cpp: `#include <vector>
#include <unordered_map>
using namespace std;

vector<int> solution(vector<int>& nums, int target) {
    unordered_map<int, int> map;
    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (map.find(complement) != map.end()) {
            return {map[complement], i};
        }
        map[nums[i]] = i;
    }
    return {};
}`
}

const SAMPLE_TEST_CASES = [
  {
    input: { nums: [2, 7, 11, 15], target: 9 },
    expected: [0, 1],
    description: "基本测试用例"
  },
  {
    input: { nums: [3, 2, 4], target: 6 },
    expected: [1, 2],
    description: "另一个测试用例"
  },
  {
    input: { nums: [3, 3], target: 6 },
    expected: [0, 1],
    description: "重复元素测试"
  }
]

export default function TestEdgeEvaluationPage() {
  const [selectedLanguage, setSelectedLanguage] = useState('javascript')
  const [code, setCode] = useState(SAMPLE_CODE.javascript)
  const [testCases, setTestCases] = useState(SAMPLE_TEST_CASES)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // 提交评测任务（流式版本）
  const submitEvaluation = async (priority = false) => {
    setIsSubmitting(true)
    setError(null)
    setResult(null)
    
    try {
      const response = await fetch('/api/evaluate-edge/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          examId: 'test-exam-001',
          code,
          language: selectedLanguage,
          testCases,
          priority
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '提交失败')
      }
      
      // 处理流式响应
      await processStreamResponse(response)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交评测失败')
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
                setResult(eventData.result)
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

  // 处理评测完成
  const handleEvaluationComplete = (evaluationResult: any) => {
    setResult(evaluationResult)
    setCurrentJobId(null)
  }

  // 处理评测错误
  const handleEvaluationError = (errorMessage: string) => {
    setError(errorMessage)
    setCurrentJobId(null)
  }

  // 处理取消评测
  const handleEvaluationCancel = () => {
    setCurrentJobId(null)
  }

  // 切换语言
  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language)
    setCode(SAMPLE_CODE[language as keyof typeof SAMPLE_CODE])
  }

  // 重置状态
  const resetState = () => {
    setCurrentJobId(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">边缘函数评测系统测试</h1>
        <p className="text-gray-600">
          这是一个测试页面，用于演示边缘函数 + 轻量级队列的代码评测功能。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：代码编辑区 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>代码编辑器</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 语言选择 */}
              <div>
                <label className="block text-sm font-medium mb-2">编程语言</label>
                <div className="flex space-x-2">
                  {Object.keys(SAMPLE_CODE).map((lang) => (
                    <Button
                      key={lang}
                      variant={selectedLanguage === lang ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleLanguageChange(lang)}
                    >
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 代码输入 */}
              <div>
                <label className="block text-sm font-medium mb-2">代码</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm"
                  placeholder="请输入您的代码..."
                />
              </div>

              {/* 提交按钮 */}
              <div className="flex space-x-2">
                <Button
                  onClick={() => submitEvaluation(false)}
                  disabled={isSubmitting || !!currentJobId}
                  className="flex-1"
                >
                  {isSubmitting ? '提交中...' : '普通评测'}
                </Button>
                <Button
                  onClick={() => submitEvaluation(true)}
                  disabled={isSubmitting || !!currentJobId}
                  variant="outline"
                  className="flex-1"
                >
                  高优先级评测
                </Button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-600">{error}</p>
                  <Button onClick={resetState} size="sm" variant="outline" className="mt-2">
                    重试
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 测试用例 */}
          <Card>
            <CardHeader>
              <CardTitle>测试用例</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testCases.map((testCase, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded">
                    <div className="text-sm font-medium mb-1">{testCase.description}</div>
                    <div className="text-xs text-gray-600">
                      <div>输入: {JSON.stringify(testCase.input)}</div>
                      <div>期望输出: {JSON.stringify(testCase.expected)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：评测状态和结果 */}
        <div className="space-y-4">
          {/* 评测进度 */}
          {currentJobId && (
            <EdgeEvaluationProgress
              jobId={currentJobId}
              onComplete={handleEvaluationComplete}
              onError={handleEvaluationError}
              onCancel={handleEvaluationCancel}
            />
          )}

          {/* 评测结果 */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">评测结果</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.testResults?.map((testResult: any, index: number) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">测试用例 {index + 1}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          testResult.passed 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {testResult.passed ? '通过' : '失败'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>输出: {JSON.stringify(testResult.output)}</div>
                        <div>执行时间: {testResult.executionTime}ms</div>
                        {testResult.error && (
                          <div className="text-red-600">错误: {testResult.error}</div>
                        )}
                      </div>
                    </div>
                  )) || (
                    <div className="text-sm text-gray-600">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>• 选择编程语言并编写代码</p>
              <p>• 点击"普通评测"或"高优先级评测"提交任务</p>
              <p>• 实时查看评测进度和队列状态</p>
              <p>• 支持取消排队中的任务</p>
              <p>• 边缘函数提供低延迟、高可用的评测服务</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}