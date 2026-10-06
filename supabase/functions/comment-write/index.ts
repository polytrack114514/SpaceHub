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

async function verifyToken(req: Request): Promise<{ userName: string } | null> {
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
  return { userName: data.user_name }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const user = await verifyToken(req)
  if (!user) return jsonResponse({ ok: false, error: '未授权或token已过期' }, 401)
  const { userName } = user
  const body = await req.json().catch(() => ({}))
  const { action, post_id, comment_id, content } = body as any

  switch (action) {
    case 'add': {
      if (!post_id || !content) return jsonResponse({ ok: false, error: '缺少参数' }, 400)
      const comment = {
        id: 'cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        author: userName,
        content,
        time: Date.now(),
      }
      const { data: post, error: fetchErr } = await sb
        .from('posts').select('comments').eq('id', post_id).single()
      if (fetchErr || !post) return jsonResponse({ ok: false, error: '帖子不存在' }, 404)
      const comments = Array.isArray(post.comments) ? post.comments : []
      comments.push(comment)
      const { error: updateErr } = await sb
        .from('posts').update({ comments }).eq('id', post_id)
      if (updateErr) return jsonResponse({ ok: false, error: updateErr.message }, 500)
      return jsonResponse({ ok: true, comment_id: comment.id })
    }
    case 'delete': {
      if (!post_id || !comment_id) return jsonResponse({ ok: false, error: '缺少参数' }, 400)
      const { data: post } = await sb
        .from('posts').select('comments, author').eq('id', post_id).single()
      if (!post) return jsonResponse({ ok: false, error: '帖子不存在' }, 404)
      const comments = Array.isArray(post.comments) ? post.comments : []
      const filtered = comments.filter((c: any) => c.id !== comment_id)
      if (filtered.length === comments.length) return jsonResponse({ ok: false, error: '评论不存在' }, 404)
      const { error } = await sb.from('posts').update({ comments: filtered }).eq('id', post_id)
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true })
    }
    default:
      return jsonResponse({ ok: false, error: '未知 action' }, 400)
  }
})
