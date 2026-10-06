import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

function encodePayload(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)))
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD')
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD environment variable not set')
    return jsonResponse({ ok: false, error: '服务配置错误' }, 500)
  }

  const body = await req.json().catch(() => ({}))
  const { password } = body as any

  if (!password || password !== ADMIN_PASSWORD) {
    return jsonResponse({ ok: true, valid: false, error: '密码错误' })
  }

  // 签发无状态 HMAC token（1 小时有效）
  const exp = Date.now() + 60 * 60 * 1000
  const payload = encodePayload({ exp, iat: Date.now() })
  const sig = await hmac(payload, ADMIN_PASSWORD)
  const token = payload + '.' + sig

  return jsonResponse({
    ok: true,
    valid: true,
    token,
    expires_at: new Date(exp).toISOString(),
  })
})