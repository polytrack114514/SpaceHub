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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const body = await req.json().catch(() => ({}))
  const { name, password, confirm_password } = body as any

  if (!name || !password) {
    return jsonResponse({ ok: false, error: '用户名和密码不能为空' }, 400)
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 20) {
    return jsonResponse({ ok: false, error: '用户名需2-20个字符' }, 400)
  }
  if (password.length < 6) {
    return jsonResponse({ ok: false, error: '密码至少6位' }, 400)
  }
  if (password !== confirm_password) {
    return jsonResponse({ ok: false, error: '两次密码不一致' }, 400)
  }

  const userName = name.trim()

  // 检查用户名是否已存在
  const { data: existing } = await sb
    .from('users')
    .select('id')
    .eq('name', userName)
    .single()

  if (existing) {
    return jsonResponse({ ok: false, error: '用户名已被注册' }, 409)
  }

  // 计算 SHA-256 哈希
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  // 插入新用户（使用 service_role 绕过 RLS）
  const { error: insertErr } = await sb
    .from('users')
    .insert({
      name: userName,
      password: passwordHash,
      role: 'user',
      banned: false,
      avatar: '',
    })

  if (insertErr) {
    console.error('register insert error:', insertErr)
    return jsonResponse({ ok: false, error: '注册失败，请重试' }, 500)
  }

  return jsonResponse({ ok: true })
})
