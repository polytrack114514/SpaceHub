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

  const body = await req.json().catch(() => ({}))
  const { action, name, password } = body as any

  // action=register: 注册新用户
  if (action === 'register') {
    const { name, password, confirm_password } = body as any
    if (!name || !password) return jsonResponse({ ok: false, error: '用户名和密码不能为空' }, 400)
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 20) {
      return jsonResponse({ ok: false, error: '用户名需2-20个字符' }, 400)
    }
    if (password.length < 6) return jsonResponse({ ok: false, error: '密码至少6位' }, 400)
    if (password !== confirm_password) return jsonResponse({ ok: false, error: '两次密码不一致' }, 400)

    const userName = name.trim()

    // 检查用户名是否已存在
    const { data: existing } = await sb.from('users').select('id').eq('name', userName).single()
    if (existing) return jsonResponse({ ok: false, error: '用户名已被注册' }, 409)

    // 明文存储密码
    const { error: insertErr } = await sb.from('users').insert({
      name: userName,
      password: password,
      role: 'user',
      banned: false,
      avatar: '',
    })
    if (insertErr) {
      console.error('register insert error:', insertErr)
      return jsonResponse({ ok: false, error: '注册失败，请重试' }, 500)
    }
    return jsonResponse({ ok: true })
  }

  // action=issue: 校验用户名密码并签发 session token
  if (action === 'issue') {
    if (!name || !password) return jsonResponse({ ok: false, error: '用户名和密码不能为空' }, 400)

    // 调用 verify_user_login RPC（由数据库定义，校验密码）
    const { data: rawLogin, error: rpcErr } = await sb.rpc('verify_user_login', {
      p_name: name,
      p_password: password,
    })
    let loginData = rawLogin
    if (Array.isArray(loginData)) loginData = loginData[0]
    if (rpcErr || !loginData) return jsonResponse({ ok: false, error: '用户名或密码错误' }, 401)
    if (loginData.banned) return jsonResponse({ ok: false, error: '该账号已被禁言' }, 403)

    // 生成 token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: insertErr } = await sb.from('sessions').insert({
      user_name: loginData.name,
      token,
      expires_at: expiresAt,
    })
    if (insertErr) {
      console.error('insert session error:', insertErr)
      return jsonResponse({ ok: false, error: '签发失败，请重试' }, 500)
    }
    return jsonResponse({ ok: true, token, expires_at: expiresAt })
  }

  // 其他情况：仅验证 token 有效性（返回用户信息）
  const user = await verifyToken(req)
  if (!user) return jsonResponse({ ok: false, error: '未授权' }, 401)
  return jsonResponse({ ok: true, user_name: user.userName })
})