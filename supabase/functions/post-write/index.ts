import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb = createClient(supabaseUrl, supabaseServiceKey)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, api-key, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

async function verifyToken(req: Request): Promise<{ userName: string; isAdmin: boolean } | null> {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null
  const { data, error } = await sb
    .from('sessions')
    .select('user_name, expires_at')
    .eq('token', token)
    .single()
  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) {
    await sb.from('sessions').delete().eq('token', token)
    return null
  }
  const { data: profile } = await sb
    .from('user_profiles')
    .select('role')
    .eq('name', data.user_name)
    .single()
  return { userName: data.user_name, isAdmin: profile?.role === 'admin' }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const user = await verifyToken(req)
  if (!user) return jsonResponse({ ok: false, error: '未授权或token已过期' }, 401)
  const { userName, isAdmin } = user
  const body = await req.json().catch(() => ({}))
  const {
    action, post_id, id, title, content, image, source_url,
    likes, pinned, comments,
  } = body as any
  const postId = post_id || id

  switch (action) {
    case 'create': {
      if (!title && !content) return jsonResponse({ ok: false, error: '标题或内容不能同时为空' }, 400)
      const newId = id || ('c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6))
      const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="hsl(${(userName.charCodeAt(0) * 137) % 360},70%,35%)"/><text x="20" y="27" text-anchor="middle" fill="#fff" font-size="20" font-family="system-ui">${userName.charAt(0).toUpperCase()}</text></svg>`
      const { error } = await sb.from('posts').insert({
        id: newId,
        title: title || '',
        content: content || '',
        author: userName,
        avatar: 'data:image/svg+xml,' + encodeURIComponent(avatarSvg),
        image: image || '',
        source_url: source_url || '',
        time: Date.now(),
        likes: typeof likes === 'number' ? likes : 0,
        comments: Array.isArray(comments) ? comments : [],
        pinned: pinned === true,
      })
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true, post_id: newId })
    }
    case 'update': {
      if (!postId) return jsonResponse({ ok: false, error: '缺少 post_id' }, 400)
      const { data: existing } = await sb
        .from('posts')
        .select('author, title, content, image, source_url, pinned')
        .eq('id', postId)
        .single()
      if (!existing) return jsonResponse({ ok: false, error: '帖子不存在' }, 404)
      const isAuthor = existing.author === userName

      // 内容字段仅作者（或管理员）可改
      const wantsContent =
        (title !== undefined && title !== existing.title) ||
        (content !== undefined && content !== existing.content) ||
        (image !== undefined && image !== existing.image) ||
        (source_url !== undefined && source_url !== existing.source_url)
      if (wantsContent && !isAuthor && !isAdmin) {
        return jsonResponse({ ok: false, error: '无权修改此帖子内容' }, 403)
      }
      // 置顶仅作者或管理员可改
      if (pinned !== undefined && pinned !== existing.pinned && !isAuthor && !isAdmin) {
        return jsonResponse({ ok: false, error: '无权置顶此帖子' }, 403)
      }

      const updates: Record<string, unknown> = {}
      if (title !== undefined) updates.title = title
      if (content !== undefined) updates.content = content
      if (image !== undefined) updates.image = image
      if (source_url !== undefined) updates.source_url = source_url
      // 点赞数、评论数组为公共元数据，任意登录用户可同步
      if (typeof likes === 'number') updates.likes = likes
      if (Array.isArray(comments)) updates.comments = comments
      if (pinned !== undefined) updates.pinned = pinned

      const { error } = await sb.from('posts').update(updates).eq('id', postId)
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true, post_id: postId })
    }
    case 'delete': {
      if (!postId) return jsonResponse({ ok: false, error: '缺少 post_id' }, 400)
      const { data: existing } = await sb.from('posts').select('author').eq('id', postId).single()
      if (!existing) return jsonResponse({ ok: false, error: '帖子不存在' }, 404)
      if (existing.author !== userName && !isAdmin) {
        return jsonResponse({ ok: false, error: '无权删除此帖子' }, 403)
      }
      const { error } = await sb.from('posts').delete().eq('id', postId)
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true, post_id: postId })
    }
    default:
      return jsonResponse({ ok: false, error: '未知 action' }, 400)
  }
})