import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Storage bucket 名称
export const TASK_MD_BUCKET = 'task-files'

// 上传文件到 Supabase Storage
export async function uploadTaskMd(taskId: string, content: string): Promise<string> {
  const fileName = `${taskId}/task.md`

  const { data, error } = await supabase.storage
    .from(TASK_MD_BUCKET)
    .upload(fileName, content, {
      contentType: 'text/markdown',
      upsert: true,
    })

  if (error) {
    throw new Error(`上传失败: ${error.message}`)
  }

  // 获取公开 URL
  const { data: urlData } = supabase.storage
    .from(TASK_MD_BUCKET)
    .getPublicUrl(fileName)

  return urlData.publicUrl
}

// 获取文件内容
export async function getTaskMd(taskId: string): Promise<string> {
  const fileName = `${taskId}/task.md`

  const { data, error } = await supabase.storage
    .from(TASK_MD_BUCKET)
    .download(fileName)

  if (error) {
    throw new Error(`获取文件失败: ${error.message}`)
  }

  return await data.text()
}
