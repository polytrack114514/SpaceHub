import { serve } from 'https://deno.land/std@0.177.1/http/server.ts'

const SUPABASE_URL = 'https://tktfrrvaqwbtdhiqwnna.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdGZycnZhcXdidGRoaXF3bm5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTczNzIyNiwiZXhwIjoyMTAxMzEzMjI2fQ._TJh8K5Eh6PuQN5TUAvN6hzIjqIX1grO8On3uLu5fUI'

serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  
  if (token !== SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const body = await req.json().catch(() => ({}))
  const action: string = body.action || ''

  const results: any[] = []
  const errors: string[] = []

  try {
    if (action === 'create_sessions_table') {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_sessions_table`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) errors.push(`create_sessions_table: ${data.message || resp.statusText}`)
      else results.push({ action: 'create_sessions_table', ok: true })
    }

    if (action === 'add_role_column') {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_role_column`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) errors.push(`add_role_column: ${data.message || resp.statusText}`)
      else results.push({ action: 'add_role_column', ok: true })
    }

    if (action === 'set_admin_role') {
      const userName = body.userName || 'NASA'
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?name=eq.${encodeURIComponent(userName)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ role: 'admin' })
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) errors.push(`set_admin_role: ${data.message || resp.statusText}`)
      else results.push({ action: 'set_admin_role', user: userName, ok: true, data })
    }

    if (action === 'deploy_migration_functions') {
      // Create the SECURITY DEFINER functions via edge function
      // We need to create them one at a time
      const migrationSql = `
        CREATE OR REPLACE FUNCTION public.create_sessions_table()
        RETURNS text AS $$
        BEGIN
          EXECUTE 'CREATE TABLE IF NOT EXISTS sessions (
            id          SERIAL PRIMARY KEY,
            user_name   TEXT NOT NULL REFERENCES user_profiles(name),
            token       TEXT UNIQUE NOT NULL,
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            expires_at  TIMESTAMPTZ NOT NULL
          )';
          RETURN 'ok';
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        CREATE OR REPLACE FUNCTION public.add_role_column()
        RETURNS text AS $$
        BEGIN
          EXECUTE 'ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT '\''user'\''::text';
          RETURN 'ok';
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        CREATE OR REPLACE FUNCTION public.update_rls_policies()
        RETURNS text AS $$
        BEGIN
          -- Posts RLS
          DROP POLICY IF EXISTS "allow_authenticated_posts_insert" ON posts;
          DROP POLICY IF EXISTS "allow_authenticated_posts_update" ON posts;
          DROP POLICY IF EXISTS "allow_authenticated_posts_delete" ON posts;
          DROP POLICY IF EXISTS "allow_service_role_posts" ON posts;
          CREATE POLICY "allow_service_role_posts" ON posts FOR ALL TO service_role USING (true) WITH CHECK (true);
          CREATE POLICY "allow_public_posts_select" ON posts FOR SELECT TO anon, authenticated USING (true);

          -- Notifications RLS
          DROP POLICY IF EXISTS "allow_authenticated_notifications_insert" ON notifications;
          DROP POLICY IF EXISTS "allow_authenticated_notifications_update" ON notifications;
          DROP POLICY IF EXISTS "allow_service_role_notifications" ON notifications;
          DROP POLICY IF EXISTS "allow_public_notifications_select" ON notifications;
          CREATE POLICY "allow_service_role_notifications" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
          CREATE POLICY "allow_public_notifications_select" ON notifications FOR SELECT TO anon, authenticated USING (true);

          -- Launches RLS
          DROP POLICY IF EXISTS "allow_authenticated_launches_insert" ON launches;
          DROP POLICY IF EXISTS "allow_authenticated_launches_update" ON launches;
          DROP POLICY IF EXISTS "allow_authenticated_launches_delete" ON launches;
          DROP POLICY IF EXISTS "allow_service_role_launches" ON launches;
          DROP POLICY IF EXISTS "allow_public_launches_select" ON launches;
          CREATE POLICY "allow_service_role_launches" ON launches FOR ALL TO service_role USING (true) WITH CHECK (true);
          CREATE POLICY "allow_public_launches_select" ON launches FOR SELECT TO anon, authenticated USING (true);

          -- User profiles RLS
          DROP POLICY IF EXISTS "allow_admin_update_user_profiles" ON user_profiles;
          DROP POLICY IF EXISTS "allow_service_role_user_profiles" ON user_profiles;
          DROP POLICY IF EXISTS "allow_public_user_profiles_select" ON user_profiles;
          CREATE POLICY "allow_service_role_user_profiles" ON user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
          CREATE POLICY "allow_public_user_profiles_select" ON user_profiles FOR SELECT TO anon, authenticated USING (true);

          -- Sessions RLS
          DROP POLICY IF EXISTS "allow_service_role_sessions" ON sessions;
          CREATE POLICY "allow_service_role_sessions" ON sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

          RETURN 'ok';
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `

      // We need to execute this via the migration function approach
      // For now, return instructions
      return new Response(JSON.stringify({
        message: 'Migration functions need to be created via SQL. Here is the SQL to run:',
        sql: migrationSql,
        note: 'Run this in Supabase Dashboard > SQL Editor or via psql connection'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // register: 通过 service_role 直接插入 users 表（绕 RLS）
    if (action === 'register') {
      const { name, password, confirm_password } = body as any
      if (!name || !password) {
        return new Response(JSON.stringify({ ok: false, error: '用户名和密码不能为空' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        })
      }
      const userName = name.trim()
      if (userName.length < 2 || userName.length > 20) {
        return new Response(JSON.stringify({ ok: false, error: '用户名需2-20个字符' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        })
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ ok: false, error: '密码至少6位' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        })
      }
      if (password !== confirm_password) {
        return new Response(JSON.stringify({ ok: false, error: '两次密码不一致' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        })
      }

      // 检查用户名是否已存在
      const checkResp = await fetch(
        `${SUPABASE_URL}/rest/v1/users?name=eq.${encodeURIComponent(userName)}`,
        {
          method: 'GET',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          },
        }
      )
      const existing = await checkResp.json().catch(() => [])
      if (Array.isArray(existing) && existing.length > 0) {
        return new Response(JSON.stringify({ ok: false, error: '用户名已被注册' }), {
          status: 409, headers: { 'Content-Type': 'application/json' }
        })
      }

      // SHA-256 哈希
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
      const passwordHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // 插入新用户
      const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ name: userName, password: passwordHash, role: 'user', banned: false, avatar: '' })
      })
      const insertData = await insertResp.json().catch(() => ({}))
      if (!insertResp.ok) {
        errors.push(`register: ${insertData.message || insertResp.statusText}`)
      } else {
        results.push({ action: 'register', user: userName, ok: true })
      }
    }

    return new Response(JSON.stringify({
      total: results.length + errors.length,
      success: results.length,
      failed: errors.length,
      results,
      errors
    }), {
      status: errors.length > 0 ? 500 : 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
