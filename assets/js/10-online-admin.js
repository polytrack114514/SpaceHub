// ==================== 在线用户显示 ====================
async function updateLastActive() {
    if (!currentUser) return;
    try {
        await sb.rpc('update_last_active', { p_name: currentUser.name });
    } catch(e) {}
}
async function loadOnlineUsers() {
    try {
        var fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        var { data, error } = await sb.from('user_profiles').select('name,avatar,last_active,banned').gte('last_active', fiveMinAgo);
        if (error) throw error;
        renderOnlineUsers(data || []);
    } catch(e) {
        console.error('loadOnlineUsers error:', e);
    }
}
function renderOnlineUsers(users) {
    var bar = document.getElementById('onlineUsersBar');
    var countEl = document.getElementById('onlineCount');
    var avatarsEl = document.getElementById('onlineAvatars');
    if (!bar) return;
    if (users.length === 0) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';
    if (countEl) countEl.textContent = users.length;
    if (avatarsEl) {
        var html = '';
        users.forEach(function(u) {
            var av = u.avatar || getAvatar(u.name);
            var avHtml = av && av.startsWith('http') ? '<img src="' + av + '" alt="' + escapeHtml(u.name) + '" loading="lazy" decoding="async">' : (av || '?');
            html += '<div class="online-avatar" title="' + escapeHtml(u.name) + '" onclick="showUserProfile(\'' + escapeHtml(u.name).replace(/'/g, "\\'") + '\')">' + avHtml + '</div>';
        });
        avatarsEl.innerHTML = html;
    }
}

// ==================== 管理员后台 ====================

var siteSettings = { disableRegister: false };

async function loadSiteSettings() {
    try {
        var { data, error } = await sb.from('site_settings').select('*');
        if (error) throw error;
        siteSettings = { disableRegister: false };
        if (data && data.length > 0) {
            data.forEach(function(s) { siteSettings[s.key] = s.value; });
        }
        updateRegStatus();
    } catch(e) {
        console.warn('加载站点设置失败:', e.message);
        siteSettings = { disableRegister: false };
    }
}

async function saveSiteSetting(key, value) {
    try {
        var { error } = await sb.from('site_settings').upsert({ key: key, value: value }, { onConflict: 'key' });
        if (error) throw error;
        siteSettings[key] = value;
        updateRegStatus();
    } catch(e) {
        alert('保存失败: ' + e.message);
    }
}

function updateRegStatus() {
    var el = document.getElementById('regStatusText');
    var toggle = document.getElementById('disableRegToggle');
    if (!el) return;
    var disabled = siteSettings.disableRegister;
    if (toggle) toggle.checked = disabled;
    if (el) {
        el.textContent = disabled ? '已禁止注册' : '允许注册';
        el.className = 'settings-status ' + (disabled ? 'on' : 'off');
    }
}

function renderSettingsPanel() {
    var c = document.getElementById('adminContent');
    if (!c) return;
    c.innerHTML = '<div class="settings-panel">' +
        '<div class="settings-row">' +
            '<div><div class="settings-label">禁止注册</div>' +
            '<div class="settings-desc">开启后，新用户将无法注册账号</div></div>' +
            '<label class="toggle-switch">' +
                '<input type="checkbox" id="disableRegToggle" onchange="saveSiteSetting(\'disableRegister\', this.checked)">' +
                '<span class="toggle-slider"></span>' +
            '</label>' +
        '</div>' +
        '<div class="settings-row">' +
            '<div class="settings-label">当前状态</div>' +
            '<span class="settings-status off" id="regStatusText">允许注册</span>' +
        '</div>' +
        '</div>';
    updateRegStatus();
}

var adminCurrentTab = 'users';
var adminToken = null;
var adminTokenExpiry = 0;

async function verifyAdminPassword(pwd) {
    try {
        var resp = await fetch('https://tktfrrvaqwbtdhiqwnna.supabase.co/functions/v1/admin-verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'sb_publishable_J0U_8Wc50piNP-yluDx33g_WTgfzYwv',
                'Authorization': 'Bearer sb_publishable_J0U_8Wc50piNP-yluDx33g_WTgfzYwv'
            },
            body: JSON.stringify({ password: pwd })
        });
        if (!resp.ok) throw new Error('\u9a8c\u8bc1\u670d\u52a1\u9519\u8bef: ' + resp.status);
        var data = await resp.json();
        if (data.valid && data.token) {
            adminToken = data.token;
            adminTokenExpiry = Date.now() + 3600000;
            return true;
        }
        return false;
    } catch(e) {
        console.error('Admin verify error:', e);
        throw e;
    }
}

function isAdminVerified() {
    if (adminToken && Date.now() < adminTokenExpiry) return true;
    adminToken = null;
    return false;
}

async function requireAdminAuth(actionName) {
    if (isAdminVerified()) return true;
    var pwd = prompt('\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u5bc6\u7801\uff08' + (actionName || '\u7ba1\u7406\u64cd\u4f5c') + '\uff09\uff1a');
    if (pwd === null) return false;
    try {
        var valid = await verifyAdminPassword(pwd);
        if (!valid) { alert('\u5bc6\u7801\u9519\u8bef'); return false; }
        return true;
    } catch(e) {
        alert('\u9a8c\u8bc1\u670d\u52a1\u6682\u4e0d\u53ef\u7528: ' + e.message);
        return false;
    }
}

async function openAdminModal() {
    if (!isAdminVerified()) {
        var pwd = prompt('\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u5bc6\u7801\uff1a');
        if (pwd === null) return;
        try {
            var valid = await verifyAdminPassword(pwd);
            if (!valid) { alert('\u5bc6\u7801\u9519\u8bef'); return; }
        } catch(e) {
            alert('\u9a8c\u8bc1\u670d\u52a1\u6682\u4e0d\u53ef\u7528: ' + e.message);
            return;
        }
    }
    document.getElementById('adminModal').classList.add('show');
    adminCurrentTab = 'users';
    loadSiteSettings();
    renderAdminContent();

}
function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('show');
}
function switchAdminTab(tab, btn) {
    adminCurrentTab = tab;
    document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    renderAdminContent();
}
async function renderAdminContent() {
    var content = document.getElementById('adminContent');
    if (!content) return;
    if (adminCurrentTab === 'users') {
        await loadUsers();
        var html = '';
        allUsers.forEach(function(u) {
            var av = u.avatar || '?';
            var avHtml = av && av.startsWith('http') ? '<img src="' + av + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">' : av;
            var isBanned = u.banned || false;
            var statusClass = isBanned ? 'banned' : 'normal';
            var statusText = isBanned ? '已禁言' : '正常';
            var btnText = isBanned ? '解禁' : '禁言';
            var btnClass = isBanned ? 'admin-ban-btn unban' : 'admin-ban-btn';
            html += '<div class="admin-user-row">';
            html += '<div style="width:28px;height:28px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(91,143,255,0.1);border:1px solid rgba(91,143,255,0.15);">' + avHtml + '</div>';
            html += '<div class="admin-user-name">' + escapeHtml(u.name || '') + '</div>';
            html += '<div class="admin-user-pass">' + (OFFICIAL_USERS[u.name] ? escapeHtml(OFFICIAL_USERS[u.name].badge) : '普通用户') + '</div>';
            html += '<span class="admin-user-status ' + statusClass + '">' + statusText + '</span>';
            html += '<button class="' + btnClass + '" onclick="toggleBanUser(\'' + escapeHtml(u.name).replace(/'/g, "\\'") + '\')">' + btnText + '</button>';
            html += '</div>';
        });
        content.innerHTML = html || '<div style="text-align:center;color:var(--text-muted);padding:40px;">暂无用户</div>';
    }  else if (adminCurrentTab === 'settings') {
        renderSettingsPanel();
        return;
    }
}
async function toggleBanUser(username) {
    try {
        var u = allUsers.find(function(x) { return x.name === username; });
        if (!u) return;
        var newBanned = !u.banned;
        var { error } = await sb.rpc('ban_user', { p_name: username, p_banned: newBanned });
        if (error) throw error;
        u.banned = newBanned;
        renderAdminContent();
    } catch(e) {
        alert('操作失败: ' + e.message);
    }
}
function scrollToPost(postId) {
    if (typeof closeSpaceDataModal === 'function') closeSpaceDataModal();
    if (typeof closeProfileModal === 'function') closeProfileModal();
    setTimeout(function() {
        var el = document.querySelector('[data-id="' + postId + '"]');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'box-shadow 0.5s';
            el.style.boxShadow = '0 0 20px rgba(91,143,255,0.5)';
            setTimeout(function() { el.style.boxShadow = ''; }, 2000);
        } else {
            try { currentTab = 'new'; updateTabs(); renderPosts(); } catch(e) {}
            setTimeout(function() {
                var el2 = document.querySelector('[data-id="' + postId + '"]');
                if (el2) {
                    el2.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el2.style.transition = 'box-shadow 0.5s';
                    el2.style.boxShadow = '0 0 20px rgba(91,143,255,0.5)';
                    setTimeout(function() { el2.style.boxShadow = ''; }, 2000);
                }
            }, 300);
        }
    }, 300);
}
