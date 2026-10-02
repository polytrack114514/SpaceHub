/**
 * SpaceHub Turnstile + 注册 Worker
 *
 * 环境变量（Cloudflare Worker → Settings → Variables and Secrets）：
 *   TURNSTILE_SECRET       — Turnstile Secret Key（不是 Site Key）
 *   SUPABASE_URL           — Supabase 项目 URL
 *   SUPABASE_SERVICE_KEY   — Supabase service_role JWT（保密，不可下发前端）
 *
 * 注意：ES Module 语法下绑定必须通过 fetch(request, env) 的 env 读取，
 *       不能像 Service Worker 语法那样直接用全局变量。
 */

const ALLOWED_ORIGIN = 'https://polytrack114514.github.io';

function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

async function verifyTurnstile(token, request, env) {
  if (!token) return { success: false, 'error-codes': ['missing-input-response'] };
  if (!env.TURNSTILE_SECRET) return { success: false, 'error-codes': ['missing-secret'] };

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);

  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });
  const data = await r.json();
  return { success: !!data.success, 'error-codes': data['error-codes'] || [] };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    // GET /?token=xxx — 纯 Turnstile 校验
    if (request.method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) return json({ success: false, error: '缺少 token' }, 400, origin);
      const v = await verifyTurnstile(token, request, env);
      return json(v, v.success ? 200 : 400, origin);
    }

    // POST /register — Turnstile 服务端校验 + service_role 注册
    if (request.method === 'POST' && url.pathname === '/register') {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return json({ success: false, error: '无效的 JSON' }, 400, origin);
      }

      const { name, password, token } = body || {};

      if (!name || typeof name !== 'string') return json({ success: false, error: '用户名不能为空' }, 400, origin);
      if (!password || typeof password !== 'string') return json({ success: false, error: '密码不能为空' }, 400, origin);
      if (!token || typeof token !== 'string') return json({ success: false, error: '请完成人机验证' }, 400, origin);

      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 20) return json({ success: false, error: '用户名需 2-20 个字符' }, 400, origin);
      if (password.length < 6) return json({ success: false, error: '密码至少 6 位' }, 400, origin);

      const v = await verifyTurnstile(token, request, env);
      if (!v.success) return json({ success: false, error: '人机验证失败，请重试' }, 400, origin);

      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
        return json({ success: false, error: '服务配置错误，请联系管理员' }, 500, origin);
      }

      const supabaseUrl = env.SUPABASE_URL.replace(/\/$/, '');
      const apiHeaders = {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      };

      try {
        const rpcRes = await fetch(supabaseUrl + '/rest/v1/rpc/register_user', {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ p_name: trimmedName, p_password: password, p_avatar: '🚀' })
        });

        const text = await rpcRes.text();

        if (!rpcRes.ok) {
          let errMsg = '注册失败，请稍后重试';
          if (rpcRes.status === 404) errMsg = '注册接口不存在，请先执行数据库 SQL';
          else if (rpcRes.status === 401 || rpcRes.status === 403) errMsg = '服务密钥无效，请联系管理员';
          try {
            const errJson = JSON.parse(text);
            if (errJson.message) errMsg = errJson.message;
          } catch (_) {}
          return json({ success: false, error: errMsg }, 400, origin);
        }

        let data = null;
        try { data = JSON.parse(text); } catch (_) {}

        if (data && data.error) {
          let msg = data.error;
          if (/duplicate|unique/i.test(msg)) msg = '用户名已被注册，请换一个';
          return json({ success: false, error: msg }, 400, origin);
        }

        return json({ success: true, name: data && data.name }, 200, origin);
      } catch (e) {
        return json({ success: false, error: '服务暂时不可用，请稍后重试' }, 503, origin);
      }
    }

    return json({ error: 'Not Found' }, 404, origin);
  }
};