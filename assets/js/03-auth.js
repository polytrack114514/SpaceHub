        // ==================== Supabase 无需心跳保活 ====================
        // ==================== 用户账号系统 ====================
        let currentUser = JSON.parse(localStorage.getItem('space_user')) || null;
        let allUsers = [];
        async function loadUsers() {
            try {
                const { data, error } = await sb.from('user_profiles').select('*');
                if (error) throw error;
                allUsers = data || [];
            } catch (e) {
                console.error('加载用户失败:', e);
            }
        }
        function renderAuthArea() {
            const area = document.getElementById('authArea');
            if (!area) return;
            if (currentUser) {
                const av = getAvatar(currentUser.name);
                const avHtml = av.startsWith('http') ? `<img src="${av}" alt="avatar">` : av;
                const badge = OFFICIAL_USERS[currentUser.name] ? `<span class="auth-user-badge">${OFFICIAL_USERS[currentUser.name].badge}</span>` : '';
                area.innerHTML = `
                    <div class="auth-user">
                        <div class="auth-avatar-small">${avHtml}</div>
                        <span class="auth-name" style="cursor:pointer;" onclick="showUserProfile('${escapeHtml(currentUser.name)}')">${escapeHtml(currentUser.name)}</span>
                        ${badge}
                        <button class="btn-logout" onclick="showUserProfile(currentUser.name)" style="margin-right:6px;">👤 我的主页</button><button class="btn-logout" onclick="handleLogout()">退出</button>
                    </div>
                `;
                renderLaunchControls();
                var adminBtn = document.getElementById('adminEntryBtn');
                if (adminBtn) adminBtn.style.display = 'inline-flex';
            } else {
                area.innerHTML = `<button class="btn-auth" onclick="openAuthModal()">登录</button>
                    <button class="btn-auth" onclick="window.location.href='./sign-up'">注册</button>`;
            }
        }
        function openAuthModal() {
            updateAuthUI();
            document.getElementById('authUsername').value = '';
            document.getElementById('authPassword').value = '';
            document.getElementById('authConfirm').value = '';
            document.getElementById('authError').classList.remove('show');
            document.getElementById('authSuccess').classList.remove('show');
            document.getElementById('authModal').classList.add('show');
            setTimeout(() => document.getElementById('authUsername').focus(), 100);
        }
        function closeAuthModal() {
            document.getElementById('authModal').classList.remove('show');
        }
        function updateAuthUI() {
            document.getElementById('authTitle').textContent = '登录';
            document.getElementById('authSubmitBtn').textContent = '登录';
            document.getElementById('authSwitchText').textContent = '还没有账号？';
            document.getElementById('authSwitchLink').textContent = '前往注册';
            document.getElementById('authConfirmField').style.display = 'none';
        }
        async function handleAuth() {
            const username = document.getElementById('authUsername').value.trim();
            const password = document.getElementById('authPassword').value;
            const errEl = document.getElementById('authError');
            const sucEl = document.getElementById('authSuccess');
            const btn = document.getElementById('authSubmitBtn');
            errEl.classList.remove('show');
            sucEl.classList.remove('show');
            if (!username) { showAuthErr('请输入用户名'); return; }
            if (!password || password.length < 6) { showAuthErr('密码至少6位'); return; }
            btn.disabled = true;
            btn.textContent = '请稍候...';
            await loadUsers();
            const { data: loginData, error: loginErr } = await sb.rpc('verify_user_login', { p_name: username, p_password: password });
            if (loginErr || !loginData) { showAuthErr('用户名或密码错误'); btn.disabled = false; btn.textContent = '登录'; return; }
            if (loginData.banned) { showAuthErr('该账号已被禁言，请联系管理员'); btn.disabled = false; btn.textContent = '登录'; return; }
            currentUser = { name: loginData.name, avatar: loginData.avatar };
            localStorage.setItem('space_user', JSON.stringify(currentUser));
            closeAuthModal();
            renderAuthArea();
            btn.disabled = false;
            btn.textContent = '登录';
        }
        function showAuthErr(msg) {
            const el = document.getElementById('authError');
            el.textContent = msg; el.classList.add('show');
            document.getElementById('authSuccess').classList.remove('show');
        }
        function handleLogout() {
            currentUser = null;
            localStorage.removeItem('space_user');
            if (typeof stopNotifyMessageSystem === 'function') stopNotifyMessageSystem();
            renderAuthArea();
            renderLaunchControls();
            var adminBtn = document.getElementById('adminEntryBtn');
            if (adminBtn) adminBtn.style.display = 'none';
        }
        // Override openModal to require login
        const _origOpenModal = openModal;
        openModal = async function() {
            if (!currentUser) {
                openAuthModal();
                return;
            }
            try {
                const { data } = await sb.from('user_profiles').select('banned').eq('name', currentUser.name).single();
                if (data && data.banned) {
                    alert('你已被禁言，无法发帖');
                    return;
                }
            } catch(e) {
                console.error('检查禁言状态失败:', e);
            }
            _origOpenModal();
            document.getElementById('modalName').value = currentUser.name;
            document.getElementById('modalName').readOnly = true;
            document.getElementById('modalName').style.opacity = '0.6';
            document.getElementById('modalTitle').focus();
        };