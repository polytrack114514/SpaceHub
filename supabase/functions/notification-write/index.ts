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
  const { action, target_user, from_user, type, post_id, content, id, ids } = body as any

  if (action === 'create') {
    if (!target_user || !from_user || target_user === from_user) {
      return jsonResponse({ ok: false, error: '无效参数' }, 400)
    }
    // 防止伪造来源：from_user 必须与登录用户一致
    if (from_user !== userName) {
      return jsonResponse({ ok: false, error: '无权以他人身份发送通知' }, 403)
    }
    const { error } = await sb.from('notifications').insert({
      target_user, from_user, type, post_id: post_id || null, content,
      is_read: false, created_at: new Date().toISOString(),
    })
    if (error) return jsonResponse({ ok: false, error: error.message }, 500)
    return jsonResponse({ ok: true })
  }

  // 删除单条通知（仅限本人所有）
  if (action === 'delete') {
    if (!id) return jsonResponse({ ok: false, error: '缺少 id' }, 400)
    const { data: existing } = await sb
      .from('notifications')
      .select('target_user')
      .eq('id', id)
      .single()
    if (!existing) return jsonResponse({ ok: false, error: '通知不存在' }, 404)
    if (existing.target_user !== userName) {
      return jsonResponse({ ok: false, error: '无权操作' }, 403)
    }
    const { error } = await sb.from('notifications').delete().eq('id', id)
    if (error) return jsonResponse({ ok: false, error: error.message }, 500)
    return jsonResponse({ ok: true })
  }

  // 批量标记已读（仅限本人所有）
  if (action === 'mark_read') {
    if (!Array.isArray(ids) || ids.length === 0) {
      return jsonResponse({ ok: false, error: '缺少 ids' }, 400)
    }
    const { error } = await sb
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids)
      .eq('target_user', userName)
    if (error) return jsonResponse({ ok: false, error: error.message }, 500)
    return jsonResponse({ ok: true })
  }

  return jsonResponse({ ok: false, error: '未知 action' }, 400)
})
