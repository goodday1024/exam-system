'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  // 本地代码验证（基本语法检查）
  const validateCode = () => {
    if (!value.trim()) {
      alert('请先输入代码')
      return
    }
    
    // 基本语法检查
    try {
      if (language === 'javascript') {
        // 简单的JavaScript语法检查
        new Function(value)
        alert('代码语法检查通过！')
      } else {
        alert('代码已保存，请确保语法正确')
      }
    } catch (error) {
      alert('代码语法错误：' + (error as Error).message)
    }
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
          onClick={validateCode}
          disabled={disabled || !value.trim()}
          size="sm"
          variant="outline"
        >
          验证语法
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



      {/* 使用提示 */}
      <div className="text-xs text-gray-500">
        💡 提示: 您可以使用"验证语法"按钮检查代码语法，确保代码正确后再提交考试。
      </div>
    </div>
  )
}