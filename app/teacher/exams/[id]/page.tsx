'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { toZonedTime, format } from 'date-fns-tz'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import ReactMarkdown from 'react-markdown'
import { createRoot } from 'react-dom/client'


interface Question {
  _id: string
  title: string
  content: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'PROGRAMMING'
  options: string | null
  points: number
  order: number
}

interface Exam {
  _id: string
  title: string
  description: string
  startTime: string
  endTime: string
  duration: number
  maxTabSwitches: number
  isPublished: boolean
  questions: Question[]
  _count: {
    examResults: number
  }
}

export default function ExamDetailPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchExam()
  }, [])

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/teacher/exams/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setExam(data.exam)
      } else {
        toast.error('获取考试详情失败')
        router.push('/teacher/exams')
      }
    } catch (error) {
      toast.error('网络错误')
      router.push('/teacher/exams')
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async () => {
    if (!exam) return
    
    try {
      const response = await fetch(`/api/teacher/exams/${exam._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPublished: !exam.isPublished
        })
      })

      if (response.ok) {
        setExam({ ...exam, isPublished: !exam.isPublished })
        toast.success(exam.isPublished ? '考试已取消发布' : '考试已发布')
      } else {
        toast.error('操作失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const deleteExam = async () => {
    if (!exam) return
    
    if (!confirm('确定要删除这个考试吗？此操作不可恢复。')) {
      return
    }

    try {
      const response = await fetch(`/api/teacher/exams/${exam._id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('考试已删除')
        router.push('/teacher/exams')
      } else {
        toast.error('删除失败')
      }
    } catch (error) {
      toast.error('网络错误')
    }
  }

  const exportToPDF = async () => {
    if (!exam) return
    
    try {
      toast.loading('正在生成PDF...', { id: 'pdf-export' })
      
      // 计算总分
      const totalPoints = exam.questions.reduce((sum, q) => sum + (q.points || 0), 0)
      
      // 生成Markdown内容
      const typeMap = {
        'MULTIPLE_CHOICE': '选择题',
        'TRUE_FALSE': '判断题', 
        'PROGRAMMING': '编程题'
      }
      
      let markdownContent = `# ${exam.title}\n\n`
      
      if (exam.description) {
        markdownContent += `${exam.description}\n\n`
      }
      
      markdownContent += `## 考试信息\n\n`
      markdownContent += `- **开始时间：** ${format(toZonedTime(new Date(exam.startTime), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Shanghai' })}\n`
      markdownContent += `- **结束时间：** ${format(toZonedTime(new Date(exam.endTime), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Shanghai' })}\n`
      markdownContent += `- **考试时长：** ${exam.duration} 分钟\n`
      markdownContent += `- **最大切屏次数：** ${exam.maxTabSwitches} 次\n`
      markdownContent += `- **题目数量：** ${exam.questions.length} 题\n`
      markdownContent += `- **总分：** ${totalPoints} 分\n\n`
      
      markdownContent += `## 试题内容\n\n`
      
      exam.questions.forEach((question, index) => {
        const questionPoints = question.points || 0
        markdownContent += `### ${index + 1}. ${question.title} [${typeMap[question.type] || question.type}] (${questionPoints}分)\n\n`
        
        if (question.content) {
          markdownContent += `${question.content}\n\n`
        }
        
        // 处理选择题选项
        if (question.options && question.type === 'MULTIPLE_CHOICE') {
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
              options.forEach((opt: string, i: number) => {
                markdownContent += `${String.fromCharCode(65 + i)}. ${opt}\n`
              })
              markdownContent += `\n`
            }
          } catch (e) {
            console.error('选项解析错误:', e)
            markdownContent += `*选项解析错误*\n\n`
          }
        }
        
        // 判断题选项
        if (question.type === 'TRUE_FALSE') {
          markdownContent += `A. 正确\n`
          markdownContent += `B. 错误\n\n`
        }
        
        markdownContent += `---\n\n`
      })
      
      markdownContent += `\n*导出时间：${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}*`
      
      // 创建临时容器用于渲染Markdown
      const printContainer = document.createElement('div')
      printContainer.style.position = 'absolute'
      printContainer.style.left = '-9999px'
      printContainer.style.top = '0'
      printContainer.style.width = '210mm'
      printContainer.style.backgroundColor = 'white'
      printContainer.style.padding = '20mm'
      printContainer.style.fontFamily = 'Arial, sans-serif'
      printContainer.style.fontSize = '14px'
      printContainer.style.lineHeight = '1.6'
      document.body.appendChild(printContainer)
      
      // 使用ReactMarkdown渲染Markdown内容
      const root = createRoot(printContainer)
      
      // 等待React渲染完成
      await new Promise<void>((resolve) => {
        root.render(
          <div className="markdown-content" style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.6',
            color: 'black',
            maxWidth: '170mm',
            margin: '0 auto'
          }}>
            <ReactMarkdown
              components={{
                h1: ({children}) => <h1 style={{textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px'}}>{children}</h1>,
                h2: ({children}) => <h2 style={{color: '#333', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginTop: '30px', marginBottom: '15px'}}>{children}</h2>,
                h3: ({children}) => <h3 style={{color: '#333', marginTop: '20px', marginBottom: '10px'}}>{children}</h3>,
                strong: ({children}) => <strong>{children}</strong>,
                em: ({children}) => <em style={{color: '#666'}}>{children}</em>,
                hr: () => <hr style={{border: 'none', borderTop: '1px solid #eee', margin: '20px 0'}} />,
                p: ({children}) => <div style={{margin: '5px 0'}}>{children}</div>,
                ul: ({children}) => <ul style={{paddingLeft: '20px', margin: '8px 0'}}>{children}</ul>,
                li: ({children}) => <li style={{margin: '5px 0'}}>{children}</li>,
                img: ({src, alt, title}) => {
                  const [imageSrc, setImageSrc] = React.useState(src)
                  const [isLoading, setIsLoading] = React.useState(true)
                  const [hasError, setHasError] = React.useState(false)
                  
                  React.useEffect(() => {
                    if (!src) return
                    
                    // 如果是外部链接，转换为 base64
                    if (src.startsWith('http')) {
                      const convertToBase64 = async () => {
                        try {
                          // 使用代理或者直接尝试获取
                          const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`)
                          if (response.ok) {
                            const blob = await response.blob()
                            const reader = new FileReader()
                            reader.onload = () => {
                              setImageSrc(reader.result as string)
                              setIsLoading(false)
                            }
                            reader.readAsDataURL(blob)
                          } else {
                            // 如果代理失败，尝试直接使用原始链接
                            setImageSrc(src)
                            setIsLoading(false)
                          }
                        } catch (error) {
                          console.error('Failed to convert image to base64:', error)
                          // 回退到原始链接
                          setImageSrc(src)
                          setIsLoading(false)
                        }
                      }
                      convertToBase64()
                    } else {
                      // 处理相对路径
                      const processedSrc = src.startsWith('/') ? `${window.location.origin}${src}` : 
                        src.startsWith('./') ? `${window.location.origin}/${src.slice(2)}` :
                        `${window.location.origin}/${src}`
                      setImageSrc(processedSrc)
                      setIsLoading(false)
                    }
                  }, [src])
                  
                  if (hasError) {
                    return (
                      <div style={{
                        padding: '10px',
                        background: '#f5f5f5',
                        border: '1px dashed #ccc',
                        textAlign: 'center',
                        color: '#666',
                        margin: '10px 0'
                      }}>
                        [图片加载失败: {alt || '图片'}]
                      </div>
                    )
                  }
                  
                  return (
                    <img 
                      src={imageSrc} 
                      alt={alt || ''} 
                      title={title || ''}
                      style={{
                        maxWidth: '100%',
                        height: 'auto',
                        margin: '10px 0',
                        display: isLoading ? 'none' : 'block'
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully:', imageSrc)
                        setIsLoading(false)
                      }}
                      onError={() => {
                        console.error('Image failed to load:', imageSrc)
                        setHasError(true)
                        setIsLoading(false)
                      }}
                    />
                  )
                }
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          </div>
        )
        
        // 等待DOM更新和图片加载
        setTimeout(() => {
          // 检查所有图片是否已加载完成
          const images = printContainer.querySelectorAll('img')
          let loadedCount = 0
          const totalImages = images.length
          
          if (totalImages === 0) {
            resolve()
            return
          }
          
          const checkAllLoaded = () => {
            loadedCount++
            if (loadedCount === totalImages) {
              resolve()
            }
          }
          
          images.forEach((img) => {
             if (img.complete && img.naturalHeight !== 0) {
               checkAllLoaded()
             } else {
               img.onload = () => {
                 console.log('Image loaded successfully:', img.src)
                 checkAllLoaded()
               }
               img.onerror = () => {
                 console.error('Image failed to load:', img.src)
                 // 创建占位符文本
                 const placeholder = document.createElement('div')
                 placeholder.textContent = `[图片加载失败: ${img.alt || '图片'}]`
                 placeholder.style.cssText = 'padding: 10px; background: #f5f5f5; border: 1px dashed #ccc; text-align: center; color: #666; margin: 10px 0;'
                 img.parentNode?.replaceChild(placeholder, img)
                 checkAllLoaded()
               }
               // 强制重新加载图片
               const originalSrc = img.src
               img.src = ''
               img.src = originalSrc
             }
           })
          
          // 设置超时，避免无限等待
          setTimeout(() => {
            if (loadedCount < totalImages) {
              console.warn('Some images did not load within timeout')
              resolve()
            }
          }, 5000)
        }, 500)
      })
      
      // 使用html2canvas生成图片
      const canvas = await html2canvas(printContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })
      
      // 清理React根节点和移除临时容器
      root.unmount()
      document.body.removeChild(printContainer)
      
      // 创建PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      
      // 添加第一页
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // 如果内容超过一页，添加更多页面
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      // 下载PDF
      pdf.save(`${exam.title}_试卷.pdf`)
      toast.success('PDF导出成功', { id: 'pdf-export' })
      
    } catch (error) {
      console.error('PDF导出失败:', error)
      toast.error('PDF导出失败，请重试', { id: 'pdf-export' })
    }
  }

  const getExamStatus = () => {
    if (!exam) return { text: '', color: '' }
    
    const now = new Date()
    const startTime = new Date(exam.startTime)
    const endTime = new Date(exam.endTime)

    if (now < startTime) {
      return { text: '未开始', color: 'text-blue-500' }
    }
    if (now >= startTime && now <= endTime) {
      return { text: '进行中', color: 'text-green-500' }
    }
    return { text: '已结束', color: 'text-red-500' }
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
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-4">考试不存在</div>
          <Link
            href="/teacher/exams"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回考试列表
          </Link>
        </div>
      </div>
    )
  }

  const status = getExamStatus()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
            <p className="text-gray-600 mt-2">{exam.description}</p>
          </div>
          <div className="flex space-x-4">
            <Link
              href="/teacher/exams"
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              返回列表
            </Link>
            <button
              onClick={exportToPDF}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              导出PDF
            </button>
            {!exam.isPublished && (
              <Link
                href={`/teacher/exams/${exam._id}/edit`}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                编辑考试
              </Link>
            )}
            <button
              onClick={togglePublish}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                exam.isPublished
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {exam.isPublished ? '取消发布' : '发布考试'}
            </button>
            <Link
              href={`/teacher/exams/${exam._id}/results`}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              查看成绩
            </Link>
          </div>
        </div>

        {/* 考试信息 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">考试信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考试状态</label>
              <span className={`text-lg font-medium ${status.color}`}>{status.text}</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">发布状态</label>
              <span className={`text-lg font-medium ${
                exam.isPublished ? 'text-green-600' : 'text-gray-600'
              }`}>
                {exam.isPublished ? '已发布' : '未发布'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">参与人数</label>
              <span className="text-lg font-medium text-gray-900">{exam._count.examResults} 人</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">题目数量</label>
              <span className="text-lg font-medium text-gray-900">{exam.questions.length} 题</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
              <span className="text-lg text-gray-900">
                {format(toZonedTime(new Date(exam.startTime), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Shanghai' })}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
              <span className="text-lg text-gray-900">
                {format(toZonedTime(new Date(exam.endTime), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Shanghai' })}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考试时长</label>
              <span className="text-lg text-gray-900">{exam.duration} 分钟</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最大切屏次数</label>
              <span className="text-lg text-gray-900">{exam.maxTabSwitches} 次</span>
            </div>
          </div>
        </div>

        {/* 题目列表 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">题目列表</h2>
          {exam.questions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">暂无题目</div>
            </div>
          ) : (
            <div className="space-y-4">
              {exam.questions.map((question, index) => (
                <div key={question._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {index + 1}. {question.title}
                    </h3>
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
                  <div className="text-gray-600 text-sm">
                    {question.content && question.content.length > 100 
                      ? `${question.content.substring(0, 100)}...` 
                      : question.content || '暂无内容'
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 编程题提示 */}
        {exam.questions.some(q => q.type === 'PROGRAMMING') && (
          <div className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-800 mb-2">编程题评测</h3>
              <p className="text-blue-700">
                本考试包含编程题，学生提交的代码将需要使用本地测评程序进行评测。
                请使用专门的本地测评工具来批量评测学生的编程题答案。
              </p>
            </div>
          </div>
        )}

        {/* 危险操作 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">危险操作</h2>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">删除考试</h3>
              <p className="text-gray-600">删除后将无法恢复，请谨慎操作</p>
            </div>
            <button
              onClick={deleteExam}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              删除考试
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}