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

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodePayload(s: string): any {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return b64url(new Uint8Array(sig))
}

async function verifyAdminToken(req: Request, secret: string): Promise<boolean> {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payload, sig] = parts
  const expected = await hmac(payload, secret)
  if (sig !== expected) return false
  try {
    const { exp } = decodePayload(payload)
    return typeof exp === 'number' && Date.now() < exp
  } catch {
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD')
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD environment variable not set')
    return jsonResponse({ ok: false, error: '服务配置错误' }, 500)
  }

  const isAdmin = await verifyAdminToken(req, ADMIN_PASSWORD)
  if (!isAdmin) return jsonResponse({ ok: false, error: '未授权' }, 401)

  const body = await req.json().catch(() => ({}))
  const { action, username, banned } = body as any

  if (action === 'toggle' && username) {
    const newBanned = banned === true || banned === 'true'
    const { error } = await sb
      .from('user_profiles')
      .update({ banned: newBanned })
      .eq('name', username)
    if (error) {
      console.error('update ban error:', error)
      return jsonResponse({ ok: false, error: error.message }, 500)
    }
    return jsonResponse({ ok: true, username, banned: newBanned })
  }

  return jsonResponse({ ok: false, error: '缺少参数' }, 400)
})