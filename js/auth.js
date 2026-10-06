/* ============================================================
   SpaceHub — js/auth.js
   登录/登出、用户资料弹窗、Token 签发
   ============================================================ */

var allUsers = [];
var isRegisterMode = false;

window.loadUsers = async function() {
    try {
        var result = await sb.from('user_profiles').select('*');
        if (result.error) throw result.error;
        allUsers = result.data || [];
    } catch (e) {
        console.error('加载用户失败:', e);
    }
};

window.renderAuthArea = function() {
    var area = document.getElementById('authArea');
    if (!area) return;
    if (currentUser) {
        var av = getAvatar(currentUser.name);
        var avHtml = av.startsWith('http')
            ? '<img src="' + escapeHtml(av) + '" alt="avatar">'
            : escapeHtml(av);
        var badge = OFFICIAL_USERS[currentUser.name]
            ? '<span class="auth-user-badge">' + escapeHtml(OFFICIAL_USERS[currentUser.name].badge) + '</span>'
            : '';
        area.innerHTML =
            '<div class="auth-user">'
            + '<div class="auth-avatar-small">' + avHtml + '</div>'
            + '<span class="auth-name" style="cursor:pointer;" onclick="showUserProfile(\'' + escapeHtml(currentUser.name) + '\')">' + escapeHtml(currentUser.name) + '</span>'
            + badge
            + '<button class="btn-logout" onclick="showUserProfile(\'' + escapeHtml(currentUser.name) + '\')" style="margin-right:6px;">👤 我的主页</button>'
            + '<button class="btn-logout" onclick="handleLogout()">退出</button>'
            + '</div>';
        window.renderLaunchControls && window.renderLaunchControls();
        var adminBtn = document.getElementById('adminEntryBtn');
        if (adminBtn) adminBtn.style.display = 'inline-flex';
    } else {
        area.innerHTML =
            '<button class="btn-auth" onclick="openAuthModal()">登录</button>'
            + '<button class="btn-auth" onclick="openAuthModal(true)">注册</button>';
    }
};

window.openAuthModal = function(register) {
    updateAuthUI();
    var u = document.getElementById('authUsername');
    var p = document.getElementById('authPassword');
    var c = document.getElementById('authConfirm');
    var err = document.getElementById('authError');
    var suc = document.getElementById('authSuccess');
    if (u) u.value = '';
    if (p) p.value = '';
    if (c) c.value = '';
    if (err) err.classList.remove('show');
    if (suc) suc.classList.remove('show');
    isRegisterMode = register === true;
    if (isRegisterMode) {
        var title = document.getElementById('authTitle');
        var btn = document.getElementById('authSubmitBtn');
        var switchText = document.getElementById('authSwitchText');
        var switchLink = document.getElementById('authSwitchLink');
        var confirmField = document.getElementById('authConfirmField');
        if (title) title.textContent = '注册';
        if (btn) btn.textContent = '注册';
        if (switchText) switchText.textContent = '已有账号？';
        if (switchLink) switchLink.textContent = '去登录';
        if (confirmField) confirmField.style.display = 'block';
    }
    var modal = document.getElementById('authModal');
    if (modal) modal.classList.add('show');
    setTimeout(function() { if (u) u.focus(); }, 100);
};

window.closeAuthModal = function() {
    var modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('show');
};

function updateAuthUI() {
    var title = document.getElementById('authTitle');
    var btn = document.getElementById('authSubmitBtn');
    var switchText = document.getElementById('authSwitchText');
    var switchLink = document.getElementById('authSwitchLink');
    var confirmField = document.getElementById('authConfirmField');
    if (title) title.textContent = '登录';
    if (btn) btn.textContent = '登录';
    if (switchText) switchText.textContent = '还没有账号？';
    if (switchLink) switchLink.textContent = '前往注册';
    if (confirmField) confirmField.style.display = 'none';
}

/* ---------- 登录（签发 Session Token） ---------- */
window.handleAuth = async function() {
    if (isRegisterMode) { handleRegister(); return; }
    var username = document.getElementById('authUsername').value.trim();
    var password = document.getElementById('authPassword').value;
    var errEl = document.getElementById('authError');
    var sucEl = document.getElementById('authSuccess');
    var btn = document.getElementById('authSubmitBtn');
    errEl.classList.remove('show');
    sucEl.classList.remove('show');
    if (!username) { showAuthErr('请输入用户名'); return; }
    if (!password || password.length < 6) { showAuthErr('密码至少6位'); return; }
    btn.disabled = true;
    btn.textContent = '请稍候...';
    try {
        // 调用 auth-token Edge Function（内部执行 verify_user_login + 签发 token）
        var result = await callEdgeFunction('auth-token', { action: 'issue', name: username, password: password });
        if (!result.ok) { showAuthErr(result.error || '登录失败'); btn.disabled = false; btn.textContent = '登录'; return; }
        // 拉取用户信息
        await loadUsers();
        var loginData = allUsers.find(function(u) { return u.name === username; });
        if (!loginData) { showAuthErr('用户信息获取失败'); btn.disabled = false; btn.textContent = '登录'; return; }
        if (loginData.banned) { showAuthErr('该账号已被禁言，请联系管理员'); btn.disabled = false; btn.textContent = '登录'; return; }
        setSessionToken(result.token);
        currentUser = { name: loginData.name, avatar: loginData.avatar };
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        closeAuthModal();
        renderAuthArea();
        btn.disabled = false;
        btn.textContent = '登录';
    } catch (err) {
        showAuthErr('登录失败: ' + err.message);
        btn.disabled = false;
        btn.textContent = '登录';
    }
};

/* ---------- 注册（创建新用户） ---------- */
window.handleRegister = async function() {
    var username = document.getElementById('authUsername').value.trim();
    var password = document.getElementById('authPassword').value;
    var confirm = document.getElementById('authConfirm').value;
    var errEl = document.getElementById('authError');
    var sucEl = document.getElementById('authSuccess');
    var btn = document.getElementById('authSubmitBtn');
    errEl.classList.remove('show');
    sucEl.classList.remove('show');
    if (!username || username.length < 2) { showAuthErr('用户名需2-20个字符'); return; }
    if (username.length > 20) { showAuthErr('用户名需2-20个字符'); return; }
    if (!password || password.length < 6) { showAuthErr('密码至少6位'); return; }
    if (password !== confirm) { showAuthErr('两次密码不一致'); return; }
    btn.disabled = true;
    btn.textContent = '请稍候...';
    try {
        var result = await callEdgeFunction('auth-token', { action: 'register', name: username, password: password, confirm_password: confirm });
        if (!result.ok) { showAuthErr(result.error || '注册失败'); btn.disabled = false; btn.textContent = '注册'; return; }
        showAuthSuc('注册成功！正在切换到登录...');
        setTimeout(function() {
            isRegisterMode = false;
            updateAuthUI();
            btn.disabled = false;
            btn.textContent = '登录';
        }, 1500);
    } catch (err) {
        showAuthErr('注册失败: ' + err.message);
        btn.disabled = false;
        btn.textContent = '注册';
    }
};

function showAuthErr(msg) {
    var el = document.getElementById('authError');
    if (el) { el.textContent = msg; el.classList.add('show'); }
    var suc = document.getElementById('authSuccess');
    if (suc) suc.classList.remove('show');
}
function showAuthSuc(msg) {
    var el = document.getElementById('authSuccess');
    if (el) { el.textContent = msg; el.classList.add('show'); }
    var err = document.getElementById('authError');
    if (err) err.classList.remove('show');
}

window.handleLogout = function() {
    currentUser = null;
    localStorage.removeItem(USER_KEY);
    clearSessionToken();
    if (typeof stopNotifyMessageSystem === 'function') stopNotifyMessageSystem();
    renderAuthArea();
    window.renderLaunchControls && window.renderLaunchControls();
    var adminBtn = document.getElementById('adminEntryBtn');
    if (adminBtn) adminBtn.style.display = 'none';
};

/* ---------- 注册模式切换 ---------- */
(function initAuthSwitch() {
    var switchLink = document.getElementById('authSwitchLink');
    if (!switchLink) return;
    switchLink.addEventListener('click', function(e) {
        e.preventDefault();
        isRegisterMode = !isRegisterMode;
        var title = document.getElementById('authTitle');
        var btn = document.getElementById('authSubmitBtn');
        var switchText = document.getElementById('authSwitchText');
        var confirmField = document.getElementById('authConfirmField');
        var err = document.getElementById('authError');
        var suc = document.getElementById('authSuccess');
        if (err) err.classList.remove('show');
        if (suc) suc.classList.remove('show');
        if (isRegisterMode) {
            if (title) title.textContent = '注册';
            if (btn) btn.textContent = '注册';
            if (switchText) switchText.textContent = '已有账号？';
            if (switchLink) switchLink.textContent = '去登录';
            if (confirmField) confirmField.style.display = 'block';
        } else {
            if (title) title.textContent = '登录';
            if (btn) btn.textContent = '登录';
            if (switchText) switchText.textContent = '还没有账号？';
            if (switchLink) switchLink.textContent = '前往注册';
            if (confirmField) confirmField.style.display = 'none';
        }
    });
})();

/* ---------- 用户资料弹窗 ---------- */
window.showUserProfile = function(username) {
    var modal = document.getElementById('profileModal');
    var contentDiv = document.getElementById('profileContent');
    if (!modal || !contentDiv) return;
    modal.dataset.username = username;
    var userPosts = posts.filter(function(p) { return p.author === username; });
    var totalLikes = userPosts.reduce(function(sum, p) { return sum + (p.likes || 0); }, 0);
    var avatar = getAvatar(username);
    var avHtml = avatar.startsWith('http')
        ? '<img src="' + escapeHtml(avatar) + '" alt="avatar" loading="lazy" decoding="async">'
        : escapeHtml(avatar);
    var badge = OFFICIAL_USERS[username]
        ? '<span class="badge-official">' + escapeHtml(OFFICIAL_USERS[username].badge) + '</span>'
        : '';
    var postsHtml = '';
    if (userPosts.length > 0) {
        postsHtml = '<div class="profile-posts"><div class="profile-posts-title">TA的帖子 (' + userPosts.length + ')</div>';
        userPosts.forEach(function(post) {
            var isLiked = likedPosts[post.id] || false;
            postsHtml += '<div class="post-card" data-id="' + post.id + '">';
            postsHtml += '<div class="post-header"><div class="post-author">';
            postsHtml += '<div class="avatar">' + (post.avatar && post.avatar.startsWith('http') ? '<img src="' + escapeHtml(post.avatar) + '" alt="avatar" loading="lazy" decoding="async">' : escapeHtml(post.avatar || '🌟')) + '</div>';
            postsHtml += '<div class="author-info"><span class="author-name" style="cursor:pointer;" onclick="showUserProfile(\'' + escapeHtml(post.author) + '\')">' + escapeHtml(post.author) + '</span>';
            postsHtml += '<span class="post-time">' + formatTime(post.time) + '</span></div></div></div>';
            postsHtml += (post.title ? '<div class="post-title">' + (post.pinned ? '📌 ' : '') + escapeHtml(post.title) + '</div>' : '');
            postsHtml += '<div class="post-content">' + (parseMentions ? parseMentions(post.content) : escapeHtml(post.content)) + '</div>';
            postsHtml += '<div class="post-footer"><button class="action-btn ' + (isLiked ? 'liked' : '') + '" onclick="toggleLike(\'' + post.id + '\')"><span>' + (isLiked ? '❤️' : '🤍') + '</span><span>' + (post.likes || 0) + '</span></button>';
            postsHtml += '<button class="comments-toggle-btn" onclick="toggleComments(\'' + post.id + '\')"><span>💬</span><span>' + ((post.comments && post.comments.length) || 0) + '</span></button></div></div>';
        });
        postsHtml += '</div>';
    } else {
        postsHtml = '<div class="empty-state"><p>暂无帖子</p></div>';
    }
    contentDiv.innerHTML =
        '<div class="profile-header">'
        + '<div class="profile-avatar">' + avHtml + '</div>'
        + '<div class="profile-info">'
        + '<h2>' + escapeHtml(username) + ' ' + badge + '</h2>'
        + '<div class="profile-stats"><span>帖子 ' + userPosts.length + '</span><span>获赞 ' + totalLikes + '</span></div>'
        + '</div></div>'
        + postsHtml
        + '<div style="text-align:center;margin-top:16px;"><button class="btn-auth" onclick="closeProfileModal()">关闭</button></div>';
    modal.classList.add('show');
};

window.closeProfileModal = function() {
    var modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('show');
};

(function bindProfileModal() {
    var pmo = document.getElementById('profileModal');
    if (pmo) {
        pmo.addEventListener('click', function(e) {
            if (e.target === pmo) closeProfileModal();
        });
    }
})();
