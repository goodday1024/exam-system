'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StudentResultRedirect({ params }: { params: { id: string } }) {
  const router = useRouter()

  useEffect(() => {
    // 重定向到正确的路径
    router.replace(`/student/exam/${params.id}/result`)
  }, [params.id, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">正在跳转到成绩页面...</p>
      </div>
    </div>
  )
}