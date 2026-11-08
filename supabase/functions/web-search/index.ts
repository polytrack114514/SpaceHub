/**
 * web-search — Tavily 搜索代理
 *
 * 用途：把 TAVILY_API_KEY 藏在服务端，前端只调用本函数，不接触 key。
 * 未配置 TAVILY_API_KEY 时自动降级为 Tavily keyless 模式（限速，但可用）。
 *
 * 部署：Supabase Dashboard → Edge Functions → 新建 web-search，粘贴本文件
 * 密钥：Dashboard → Settings → Edge Functions Secrets → TAVILY_API_KEY
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

const MAX_RESULTS = 5

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: '仅支持 POST' }, 405)

  let query = ''
  let maxResults = 3
  let topic: string | undefined
  let days: number | undefined
  try {
    const body = await req.json()
    query = String(body.query || '').trim()
    if (body.max_results) {
      maxResults = Math.min(Math.max(Number(body.max_results) || 3, 1), MAX_RESULTS)
    }
    if (body.topic === 'news') {
      topic = 'news'
      days = Math.min(Math.max(Number(body.days) || 30, 1), 90)
    }
  } catch {
    return jsonResponse({ error: '请求体不是合法 JSON' }, 400)
  }

  if (!query) return jsonResponse({ error: '缺少 query 参数' }, 400)
  if (query.length > 300) query = query.slice(0, 300)

  const apiKey = Deno.env.get('TAVILY_API_KEY') || ''
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  } else {
    headers['X-Tavily-Access-Mode'] = 'keyless'
  }

  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: 'basic',
        topic,
        days,
        include_answer: true,
        include_raw_content: false,
      }),
    })

    if (!resp.ok) {
      const text = (await resp.text()).slice(0, 300)
      return jsonResponse({ error: `检索服务返回 ${resp.status}`, detail: text }, 502)
    }

    const data = await resp.json()
    const results = (data.results || []).map((r: Record<string, unknown>) => ({
      title: String(r.title || '').slice(0, 120),
      url: String(r.url || ''),
      published_date: r.published_date ? String(r.published_date).slice(0, 32) : '',
      content: String(r.content || '').slice(0, 400),
    }))

    return jsonResponse({ query, keyless: !apiKey, answer: data.answer || '', results })
  } catch (e) {
    return jsonResponse({ error: '检索请求失败：' + (e as Error).message }, 502)
  }
})
