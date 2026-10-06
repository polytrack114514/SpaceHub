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

async function verifyToken(req: Request): Promise<{ userName: string; isAdmin: boolean } | null> {
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
  // 检查是否为管理员
  const { data: profile } = await sb
    .from('user_profiles')
    .select('role')
    .eq('name', data.user_name)
    .single()
  return { userName: data.user_name, isAdmin: profile?.role === 'admin' }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const user = await verifyToken(req)
  if (!user) return jsonResponse({ ok: false, error: '未授权或token已过期' }, 401)
  const { userName, isAdmin } = user
  const body = await req.json().catch(() => ({}))
  const {
    action, launch_id, id, rocket, agency, date, location, mission,
    image, description, status, result,
  } = body as any
  const launchId = launch_id || id

  switch (action) {
    case 'create': {
      if (!isAdmin) return jsonResponse({ ok: false, error: '仅管理员可创建发射任务' }, 403)
      const { data: inserted, error } = await sb.from('launches').insert({
        rocket, agency, date, location, mission, image: image || '',
        description: description || '', status: status || 'scheduled',
      }).select().single()
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true, launch_id: inserted?.id })
    }
    case 'update': {
      if (!isAdmin) return jsonResponse({ ok: false, error: '仅管理员可修改发射任务' }, 403)
      if (!launchId) return jsonResponse({ ok: false, error: '缺少 launch_id' }, 400)
      const updates: Record<string, unknown> = {}
      if (rocket !== undefined) updates.rocket = rocket
      if (agency !== undefined) updates.agency = agency
      if (date !== undefined) updates.date = date
      if (location !== undefined) updates.location = location
      if (mission !== undefined) updates.mission = mission
      if (image !== undefined) updates.image = image
      if (description !== undefined) updates.description = description
      if (status !== undefined) updates.status = status
      const { error } = await sb.from('launches').update(updates).eq('id', launchId)
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true, launch_id: launchId })
    }
    case 'delete': {
      if (!isAdmin) return jsonResponse({ ok: false, error: '仅管理员可删除发射任务' }, 403)
      if (!launchId) return jsonResponse({ ok: false, error: '缺少 launch_id' }, 400)
      const { error } = await sb.from('launches').delete().eq('id', launchId)
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true, launch_id: launchId })
    }
    case 'mark_result': {
      if (!isAdmin) return jsonResponse({ ok: false, error: '仅管理员可标记结果' }, 403)
      if (!launchId) return jsonResponse({ ok: false, error: '缺少 launch_id' }, 400)
      const { error } = await sb.from('launches').update({ result: result || 'pending' }).eq('id', launchId)
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true, launch_id: launchId })
    }
    case 'prune': {
      // 自动清理：保留已发射记录中最新 15 条，删除更早的
      const { data: old } = await sb
        .from('launches')
        .select('id, date, status')
        .lt('date', Date.now())
        .order('date', { ascending: false })
      const toDelete = (old || []).slice(15).map((l: any) => l.id)
      if (toDelete.length > 0) {
        const { error } = await sb.from('launches').delete().in('id', toDelete)
        if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      }
      return jsonResponse({ ok: true, pruned: toDelete.length })
    }
    default:
      return jsonResponse({ ok: false, error: '未知 action' }, 400)
  }
})
