// SpaceHub 注册 Edge Function
//
// 作用：服务端校验 Turnstile + 用 service_role 调 register_user RPC
//       前端只带 anon key，service_role 永不外泄。
//
// 内置环境变量（Supabase 自动注入，无需配置）：
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// 需手动添加的 Secret：
//   TURNSTILE_SECRET   — Turnstile Secret Key

const ALLOWED_ORIGIN = 'https://polytrack114514.github.io';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, accept, apikey, authorization, x-client-info',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method Not Allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET');

  if (!supabaseUrl || !serviceKey) {
    return json({ success: false, error: '服务配置错误，请联系管理员' }, 500, origin);
  }
  if (!turnstileSecret) {
    console.error('[register] 未配置 TURNSTILE_SECRET');
    return json({ success: false, error: '人机验证服务未配置，请联系管理员' }, 500, origin);
  }

  let body: { name?: string; password?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: '无效的 JSON' }, 400, origin);
  }

  const { name, password, token } = body ?? {};

  if (typeof name !== 'string' || name.trim() === '') {
    return json({ success: false, error: '用户名不能为空' }, 400, origin);
  }
  if (typeof password !== 'string' || password === '') {
    return json({ success: false, error: '密码不能为空' }, 400, origin);
  }
  if (typeof token !== 'string' || token === '') {
    return json({ success: false, error: '请完成人机验证' }, 400, origin);
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 20) {
    return json({ success: false, error: '用户名需 2-20 个字符' }, 400, origin);
  }
  if (password.length < 6) {
    return json({ success: false, error: '密码至少 6 位' }, 400, origin);
  }

  // ── Turnstile 服务端校验 ────────────────────────────────────────────────
  try {
    const form = new FormData();
    form.append('secret', turnstileSecret);
    form.append('response', token);
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for');
    if (ip) form.append('remoteip', ip.split(',')[0].trim());

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const verify = await verifyRes.json();
    if (!verify.success) {
      console.warn('[register] Turnstile 校验失败:', JSON.stringify(verify['error-codes'] ?? []));
      return json({ success: false, error: '人机验证失败，请重试' }, 400, origin);
    }
  } catch (e) {
    console.error('[register] Turnstile 请求异常:', (e as Error).message);
    return json({ success: false, error: '人机验证服务暂时不可用，请稍后重试' }, 503, origin);
  }

  // ── service_role 调 RPC 注册 ────────────────────────────────────────────
  try {
    const rpcRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/register_user`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_name: trimmedName, p_password: password, p_avatar: '🚀' }),
    });

    const text = await rpcRes.text();

    if (!rpcRes.ok) {
      let msg = '注册失败，请稍后重试';
      if (rpcRes.status === 404) msg = '注册接口不存在，请先执行数据库 SQL';
      else if (rpcRes.status === 401 || rpcRes.status === 403) msg = '服务密钥无效，请联系管理员';
      try {
        const errJson = JSON.parse(text);
        if (errJson?.message) msg = errJson.message;
      } catch { /* 保持默认文案 */ }
      console.error('[register] RPC 失败:', rpcRes.status, text.slice(0, 300));
      return json({ success: false, error: msg }, 400, origin);
    }

    let data: { error?: string; name?: string } | null = null;
    try {
      data = JSON.parse(text);
    } catch { /* 忽略 */ }

    if (data?.error) {
      const msg = /duplicate|unique/i.test(data.error) ? '用户名已被注册，请换一个' : data.error;
      return json({ success: false, error: msg }, 400, origin);
    }

    return json({ success: true, name: data?.name ?? trimmedName }, 200, origin);
  } catch (e) {
    console.error('[register] RPC 调用异常:', (e as Error).message);
    return json({ success: false, error: '服务暂时不可用，请稍后重试' }, 503, origin);
  }
});