/**
 * SpaceHub Turnstile + 注册 Worker
 *
 * 环境变量（在 Cloudflare Dashboard → Worker → Variables 里设置）：
 *   TURNSTILE_SECRET       — Turnstile Secret Key（不是 Site Key）
 *   SUPABASE_SERVICE_KEY   — Supabase service_role JWT
 *   SUPABASE_URL           — Supabase 项目 URL，如 https://tktfrrvaqwbtdhiqwnna.supabase.co
 */

const CORS = {
  'Access-Control-Allow-Origin': 'https://polytrack114514.github.io',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

async function verifyTurnstile(token, request) {
  if (!token) return { success: false, 'error-codes': ['missing-input-response'] };

  const form = new FormData();
  form.append('secret', TURNSTILE_SECRET);
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
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // GET /?token=xxx — 纯 Turnstile 校验（前端分步验证兼容接口）
    if (request.method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) return new Response(JSON.stringify({ success: false }), { status: 400, headers: CORS });
      const v = await verifyTurnstile(token, request);
      return new Response(JSON.stringify(v), {
        status: v.success ? 200 : 400,
        headers: CORS
      });
    }

    // POST /register — 完整注册（Turnstile 校验 + 注册，service_role key 在 Worker 内）
    if (request.method === 'POST' && url.pathname === '/register') {
      let body;
      try { body = await request.json(); } catch (_) {
        return new Response(JSON.stringify({ success: false, error: '无效的 JSON' }), { status: 400, headers: CORS });
      }

      const { name, password, token } = body || {};

      // 参数校验
      if (!name || typeof name !== 'string') return new Response(JSON.stringify({ success: false, error: '用户名不能为空' }), { status: 400, headers: CORS });
      if (!password || typeof password !== 'string') return new Response(JSON.stringify({ success: false, error: '密码不能为空' }), { status: 400, headers: CORS });
      if (!token || typeof token !== 'string') return new Response(JSON.stringify({ success: false, error: '请完成人机验证' }), { status: 400, headers: CORS });

      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 20) return new Response(JSON.stringify({ success: false, error: '用户名需 2-20 个字符' }), { status: 400, headers: CORS });
      if (password.length < 6) return new Response(JSON.stringify({ success: false, error: '密码至少 6 位' }), { status: 400, headers: CORS });

      // Turnstile 服务端校验
      const v = await verifyTurnstile(token, request);
      if (!v.success) return new Response(JSON.stringify({ success: false, error: '人机验证失败，请重试' }), { status: 400, headers: CORS });

      // 调用 Supabase service_role RPC
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('[worker] SUPABASE_URL 或 SUPABASE_SERVICE_KEY 未配置');
        return new Response(JSON.stringify({ success: false, error: '服务配置错误，请联系管理员' }), { status: 500, headers: CORS });
      }

      const supabaseUrl = SUPABASE_URL.replace(/\/$/, '');
      const apiHeaders = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      };

      try {
        const rpcRes = await fetch(supabaseUrl + '/rest/v1/rpc/register_user', {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ p_name: trimmedName, p_password: password, p_avatar: '🚀' })
        });

        if (rpcRes.status === 200) {
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
        }

        // 解析错误
        let errMsg = '注册失败，请稍后重试';
        try {
          const errText = await rpcRes.text();
          const errJson = JSON.parse(errText);
          if (errJson.message) errMsg = errJson.message;
          else if (errJson.details) errMsg = errJson.details;
        } catch (_) {}

        if (/duplicate|unique/i.test(errMsg)) errMsg = '用户名已被注册，请换一个';
        return new Response(JSON.stringify({ success: false, error: errMsg }), { status: 400, headers: CORS });
      } catch (e) {
        console.error('[worker] Supabase RPC 调用失败:', e.message);
        return new Response(JSON.stringify({ success: false, error: '服务暂时不可用，请稍后重试' }), { status: 503, headers: CORS });
      }
    }

    // 404
    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: CORS });
  }
};
