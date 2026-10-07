import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY') || ''
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

async function verifyTurnstile(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY || !token) return false
  try {
    const form = new FormData()
    form.append('secret', TURNSTILE_SECRET_KEY)
    form.append('response', token)
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const data = await resp.json()
    return !!data.success
  } catch (e) {
    console.error('turnstile verify error:', e)
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const body = await req.json().catch(() => ({}))
  const { name, password, confirm_password, token } = body as any

  // Turnstile 人机验证（有 secret key 时才强制校验）
  if (TURNSTILE_SECRET_KEY) {
    const valid = await verifyTurnstile(token)
    if (!valid) return jsonResponse({ success: false, error: '请完成人机验证' }, 400)
  }

  if (!name || !password) {
    return jsonResponse({ success: false, error: '用户名和密码不能为空' }, 400)
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 20) {
    return jsonResponse({ success: false, error: '用户名需2-20个字符' }, 400)
  }
  if (password.length < 6) {
    return jsonResponse({ success: false, error: '密码至少6位' }, 400)
  }
  if (password !== confirm_password) {
    return jsonResponse({ success: false, error: '两次密码不一致' }, 400)
  }

  const userName = name.trim()

  // 检查用户名是否已存在
  const { data: existing } = await sb
    .from('users')
    .select('id')
    .eq('name', userName)
    .single()

  if (existing) {
    return jsonResponse({ success: false, error: '用户名已被注册' }, 409)
  }

  // 明文存储密码
  const { error: insertErr } = await sb
    .from('users')
    .insert({
      name: userName,
      password: password,
      role: 'user',
      banned: false,
      avatar: '',
    })

  if (insertErr) {
    console.error('register insert error:', insertErr)
    return jsonResponse({ success: false, error: '注册失败，请重试' }, 500)
  }

  return jsonResponse({ success: true })
})
