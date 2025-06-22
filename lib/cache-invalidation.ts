// Cloudflare Workers 缓存清理工具
// 用于在数据更新后清理相关缓存

/**
 * 清理 Cloudflare Workers 缓存
 * @param paths - 需要清理的路径数组
 */
export async function invalidateCloudflareCache(paths: string[]) {
  // 如果没有配置 Cloudflare Worker URL，则跳过缓存清理
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL
  if (!workerUrl) {
    console.log('未配置 CLOUDFLARE_WORKER_URL，跳过缓存清理')
    return
  }

  try {
    // 构造缓存清理请求
    const purgeUrl = `${workerUrl}/__purge_cache`
    
    const response = await fetch(purgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CACHE_PURGE_TOKEN || 'default-token'}`
      },
      body: JSON.stringify({ paths })
    })

    if (response.ok) {
      console.log(`缓存清理成功: ${paths.join(', ')}`)
    } else {
      console.warn(`缓存清理失败: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.error('缓存清理请求失败:', error)
  }
}

/**
 * 考试相关缓存清理
 * @param examId - 考试ID（可选）
 * @param teacherId - 教师ID（可选）
 */
export async function invalidateExamCache(examId?: string, teacherId?: string) {
  const paths = [
    '/api/marketplace/exams',
    '/api/marketplace/categories',
    '/api/student/exams'
  ]

  if (teacherId) {
    paths.push('/api/teacher/dashboard')
    paths.push('/api/teacher/analytics')
  }

  if (examId) {
    paths.push(`/api/marketplace/exams/${examId}`)
    paths.push(`/api/student/exam/${examId}`)
  }

  await invalidateCloudflareCache(paths)
}

/**
 * 题目相关缓存清理
 * @param questionId - 题目ID（可选）
 * @param teacherId - 教师ID（可选）
 */
export async function invalidateQuestionCache(questionId?: string, teacherId?: string) {
  const paths = [
    '/api/teacher/questions'
  ]

  if (teacherId) {
    paths.push('/api/teacher/dashboard')
  }

  if (questionId) {
    paths.push(`/api/teacher/questions/${questionId}`)
  }

  await invalidateCloudflareCache(paths)
}

/**
 * 学生相关缓存清理
 * @param studentId - 学生ID（可选）
 */
export async function invalidateStudentCache(studentId?: string) {
  const paths = [
    '/api/student/exams',
    '/api/student/profile'
  ]

  if (studentId) {
    paths.push(`/api/student/profile/${studentId}`)
  }

  await invalidateCloudflareCache(paths)
}

/**
 * 市场相关缓存清理
 */
export async function invalidateMarketplaceCache() {
  const paths = [
    '/api/marketplace/exams',
    '/api/marketplace/categories'
  ]

  await invalidateCloudflareCache(paths)
}