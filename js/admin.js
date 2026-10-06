/* ============================================================
   SpaceHub — js/admin.js
   管理员后台：密码验证、用户管理、站点设置
   ============================================================ */

var siteSettings = { disableRegister: false };
var adminCurrentTab = 'users';
var adminToken = null;
var adminTokenExpiry = 0;

/* ---------- 管理员密码验证（Edge Function）---------- */
async function verifyAdminPassword(pwd) {
    var result = await callEdgeFunction('admin-verify', { password: pwd });
    if (!result.ok) throw new Error('验证服务错误: ' + (result.error || ''));
    if (result.valid && result.token) {
        adminToken = result.token;
        adminTokenExpiry = Date.now() + 3600000;
        return true;
    }
    return false;
}

function isAdminVerified() {
    if (adminToken && Date.now() < adminTokenExpiry) return true;
    adminToken = null;
    return false;
}

/* ---------- 操作前要求管理员认证 ---------- */
window.requireAdminAuth = async function(actionName) {
    if (isAdminVerified()) return true;
    var pwd = prompt('请输入管理员密码（' + (actionName || '管理操作') + '）：');
    if (pwd === null) return false;
    try {
        var valid = await verifyAdminPassword(pwd);
        if (!valid) { alert('密码错误'); return false; }
        return true;
    } catch (e) {
        alert('验证服务暂不可用: ' + e.message);
        return false;
    }
};

/* ---------- 打开管理员弹窗 ---------- */
window.openAdminModal = async function() {
    if (!isAdminVerified()) {
        var pwd = prompt('请输入管理员密码：');
        if (pwd === null) return;
        try {
            var valid = await verifyAdminPassword(pwd);
            if (!valid) { alert('密码错误'); return; }
        } catch (e) {
            alert('验证服务暂不可用: ' + e.message);
            return;
        }
    }
    var modal = document.getElementById('adminModal');
    if (modal) modal.classList.add('show');
    adminCurrentTab = 'users';
    loadSiteSettings();
    renderAdminContent();
};

window.closeAdminModal = function() {
    var modal = document.getElementById('adminModal');
    if (modal) modal.classList.remove('show');
};

/* ---------- 切换管理标签 ---------- */
window.switchAdminTab = function(tab, btn) {
    adminCurrentTab = tab;
    document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    renderAdminContent();
};

/* ---------- 加载站点设置 ---------- */
window.loadSiteSettings = async function() {
    try {
        var result = await sb.from('site_settings').select('*');
        if (result.error) throw result.error;
        siteSettings = { disableRegister: false };
        var data = result.data || [];
        data.forEach(function(s) { siteSettings[s.key] = s.value; });
        updateRegStatus();
    } catch (e) {
        console.warn('加载站点设置失败:', e.message);
        siteSettings = { disableRegister: false };
    }
}

/* ---------- 保存站点设置 ---------- */
window.saveSiteSetting = async function(key, value) {
    if (!isAdminVerified()) {
        var ok = await window.requireAdminAuth('保存设置');
        if (!ok) return;
    }
    try {
        var result = await callEdgeFunction('settings-write', {
            action: 'set',
            key: key,
            value: value
        }, { token: adminToken });
        if (!result.ok) throw new Error(result.error || '保存失败');
        siteSettings[key] = value;
        updateRegStatus();
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
}

window.updateRegStatus = function() {
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

window.renderSettingsPanel = function() {
    var c = document.getElementById('adminContent');
    if (!c) return;
    c.innerHTML = '<div class="settings-panel">'
        + '<div class="settings-row">'
            + '<div><div class="settings-label">禁止注册</div>'
            + '<div class="settings-desc">开启后，新用户将无法注册账号</div></div>'
            + '<label class="toggle-switch">'
                + '<input type="checkbox" id="disableRegToggle" onchange="saveSiteSetting(\'disableRegister\', this.checked)">'
                + '<span class="toggle-slider"></span>'
            + '</label>'
        + '</div>'
        + '<div class="settings-row">'
            + '<div class="settings-label">当前状态</div>'
            + '<span class="settings-status off" id="regStatusText">允许注册</span>'
        + '</div>'
        + '</div>';
    updateRegStatus();
}

/* ---------- 渲染管理员内容 ---------- */
async function renderAdminContent() {
    var content = document.getElementById('adminContent');
    if (!content) return;
    if (adminCurrentTab === 'users') {
        await loadUsers();
        var html = '';
        allUsers.forEach(function(u) {
            var av = u.avatar || '?';
            var avHtml = av && av.startsWith('http')
                ? '<img src="' + av + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">'
                : av;
            var isBanned = u.banned || false;
            var statusClass = isBanned ? 'banned' : 'normal';
            var statusText = isBanned ? '已禁言' : '正常';
            var btnText = isBanned ? '解禁' : '禁言';
            var btnClass = isBanned ? 'admin-ban-btn unban' : 'admin-ban-btn';
            html += '<div class="admin-user-row">'
                + '<div style="width:28px;height:28px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(91,143,255,0.1);border:1px solid rgba(91,143,255,0.15);">' + avHtml + '</div>'
                + '<div class="admin-user-name">' + escapeHtml(u.name || '') + '</div>'
                + '<div class="admin-user-pass">' + (OFFICIAL_USERS[u.name] ? escapeHtml(OFFICIAL_USERS[u.name].badge) : '普通用户') + '</div>'
                + '<span class="admin-user-status ' + statusClass + '">' + statusText + '</span>'
                + '<button class="' + btnClass + '" onclick="toggleBanUser(\'' + escapeHtml(u.name).replace(/'/g, "\\'") + '\')">' + btnText + '</button>'
                + '</div>';
        });
        content.innerHTML = html || '<div style="text-align:center;color:var(--text-muted);padding:40px;">暂无用户</div>';
    } else if (adminCurrentTab === 'settings') {
        renderSettingsPanel();
        return;
    }
}

/* ---------- 禁用/解禁用户（通过 Edge Function）---------- */
window.toggleBanUser = async function(username) {
    if (!isAdminVerified()) {
        var ok = await window.requireAdminAuth('禁言操作');
        if (!ok) return;
    }
    try {
        var u = allUsers.find(function(x) { return x.name === username; });
        if (!u) return;
        var result = await callEdgeFunction('admin-ban', {
            action: 'toggle',
            username: username,
            banned: !u.banned
        }, { token: adminToken });
        if (!result.ok) throw new Error(result.error || '操作失败');
        u.banned = !u.banned;
        renderAdminContent();
    } catch (e) {
        alert('操作失败: ' + e.message);
    }
};

/* ---------- 跳转到帖子（由太空数据中心调用）---------- */
window.scrollToPost = function(postId) {
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
};
