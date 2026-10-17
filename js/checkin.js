/* ============================================================
   SpaceHub — js/checkin.js
   每日签到 · 探索点数 · 装饰物商店（头像框 / 帖子背景）
   后端逻辑全部在 Postgres RPC：checkin_status / checkin_daily /
   checkin_buy / checkin_equip
   ============================================================ */

var __rewardItems = {};   // id -> { id, name, type, cost, css, preview }
var __userRewards = {};   // user_name -> { equipped, streak }
var __myStatus = null;    // 当前用户签到状态（RPC 返回）
var __ckTab = 'shop';     // 'shop' | 'mine'

/* ---------- 数据加载 ---------- */
async function loadRewardCatalog() {
    if (!sb) return;
    try {
        var r = await sb.from('reward_items').select('*').order('sort_order', { ascending: true });
        if (r.error) throw r.error;
        __rewardItems = {};
        (r.data || []).forEach(function(it) { __rewardItems[it.id] = it; });
    } catch (e) {
        console.error('[签到] 加载装饰物目录失败:', e);
    }
}

async function loadUserRewards() {
    if (!sb) return;
    try {
        var r = await sb.from('user_rewards').select('user_name,equipped,streak');
        if (r.error) throw r.error;
        __userRewards = {};
        (r.data || []).forEach(function(row) {
            __userRewards[row.user_name] = { equipped: row.equipped || {}, streak: row.streak || 0 };
        });
    } catch (e) {
        console.error('[签到] 加载用户装扮失败:', e);
    }
}

async function refreshMyStatus() {
    var token = getSessionToken();
    if (!token || !currentUser) { __myStatus = null; return; }
    try {
        var res = await sb.rpc('checkin_status', { p_token: token });
        if (res.error) throw res.error;
        __myStatus = res.data;
        if (__myStatus && __myStatus.ok) {
            // 同步到本地缓存，保证头像框/帖子背景立即生效
            __userRewards[currentUser.name] = {
                equipped: __myStatus.equipped || {},
                streak: __myStatus.streak || 0
            };
        }
    } catch (e) {
        console.error('[签到] 查询签到状态失败:', e);
        __myStatus = null;
    }
}

window.loadCheckinData = async function() {
    await loadRewardCatalog();
    await loadUserRewards();
    if (currentUser && getSessionToken()) await refreshMyStatus();
    refreshCheckinHeader();
    // 顶部头像重建后统一重新应用装饰样式，保证一进入页面就能看到头像框 / 帖子背景
    if (window.renderAuthArea) window.renderAuthArea();
    if (window.applyRewardStyles) window.applyRewardStyles(document);
};

/* ---------- 供渲染器使用 ---------- */
function getFrameCss(user) {
    var r = __userRewards[user];
    if (!r || !r.equipped || !r.equipped.avatar_frame) return '';
    var item = __rewardItems[r.equipped.avatar_frame];
    return item ? item.css : '';
}

function getPostBgCss(user) {
    var r = __userRewards[user];
    if (!r || !r.equipped || !r.equipped.post_bg) return '';
    var item = __rewardItems[r.equipped.post_bg];
    return item ? item.css : '';
}

function getStreak(user) {
    var r = __userRewards[user];
    return r ? (r.streak || 0) : 0;
}

function frameShadowValue(css) {
    if (!css) return '';
    return String(css).replace(/^\s*box-shadow\s*:\s*/i, '');
}

window.getStreak = getStreak;

/* 在指定 DOM 根节点内统一应用装饰物样式 */
window.applyRewardStyles = function(root) {
    if (!root || !root.querySelectorAll) return;
    // 头像框（帖子头像 / 资料大头像 / 顶部小头像 / 我的装扮预览）
    root.querySelectorAll('.avatar[data-author], .profile-avatar[data-author], .auth-avatar-small[data-author], .ck-mine-avatar[data-author]')
        .forEach(function(el) {
            var css = getFrameCss(el.getAttribute('data-author'));
            if (!css) return;
            el.style.setProperty('box-shadow', frameShadowValue(css), 'important');
            el.style.setProperty('border-radius', '50%', 'important');
        });
    // 帖子背景
    root.querySelectorAll('.post-card[data-author]').forEach(function(el) {
        var bg = getPostBgCss(el.getAttribute('data-author'));
        if (bg) el.style.setProperty('background', bg, 'important');
    });
};

/* ---------- 顶部签到按钮 ---------- */
window.refreshCheckinHeader = function() {
    var btn = document.getElementById('checkinBtn');
    var dot = document.getElementById('checkinDot');
    if (!btn) return;
    // 所有访客都可见（未登录时点击会引导登录），保证功能可被发现
    btn.style.display = 'inline-flex';
    if (dot) dot.style.display = (currentUser && __myStatus && __myStatus.can_checkin) ? 'block' : 'none';
};

/* ---------- 弹窗 ---------- */
window.openCheckinModal = async function() {
    if (!currentUser) { openAuthModal(); return; }
    var modal = document.getElementById('checkinModal');
    if (!modal) return;
    modal.classList.add('show');
    var body = document.getElementById('ckBody');
    if (body && !__myStatus) body.innerHTML = '<div class="ck-loading">加载中...</div>';
    await refreshMyStatus();
    renderCheckinModal();
};

window.closeCheckinModal = function() {
    var m = document.getElementById('checkinModal');
    if (m) m.classList.remove('show');
};

window.switchCKTab = function(tab, el) {
    __ckTab = tab;
    var tabs = document.querySelectorAll('.ck-tab');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    if (el) el.classList.add('active');
    renderCKBody();
};

function renderCheckinModal() {
    var s = __myStatus || { points: 0, streak: 0, next_award: 10, can_checkin: true,
                            total_checkins: 0, best_streak: 0, owned_items: [], equipped: {} };
    var pEl = document.getElementById('ckPoints');
    if (pEl) pEl.textContent = s.points || 0;
    var stEl = document.getElementById('ckStreakNum');
    if (stEl) stEl.textContent = s.streak || 0;

    var btn = document.getElementById('ckActionBtn');
    if (btn) {
        if (s.can_checkin) {
            btn.disabled = false;
            btn.classList.remove('done');
            btn.textContent = '立即签到  +' + (s.next_award || 10) + ' 分';
        } else {
            btn.disabled = true;
            btn.classList.add('done');
            btn.textContent = '今日已签到 ✓';
        }
    }

    var sub = document.getElementById('ckNextAward');
    if (sub) {
        sub.textContent = (s.can_checkin ? '今日可得 +' + (s.next_award || 10) : '明日可得 +' + (s.next_award || 10))
            + ' 分 · 连签每日 +2（上限 30） · 断签清零';
    }

    var best = document.getElementById('ckBestStreak');
    if (best) best.textContent = '最长连签 ' + (s.best_streak || 0) + ' 天 · 累计签到 ' + (s.total_checkins || 0) + ' 次';

    renderCKBody();
}

function previewStyle(it) {
    if (it.type === 'avatar_frame') return frameShadowValue(it.css);
    return 'background:' + it.css + ';';
}

function avatarInner(name) {
    var av = getAvatar(name);
    return (av && av.indexOf('http') === 0)
        ? '<img src="' + escapeHtml(av) + '" alt="avatar" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;">'
        : escapeHtml(av);
}

function renderCKBody() {
    var body = document.getElementById('ckBody');
    if (!body) return;
    if (__ckTab === 'mine') {
        body.innerHTML = renderMineHtml();
    } else {
        body.innerHTML = renderShopHtml();
    }
    window.applyRewardStyles(body);
}

function renderShopHtml() {
    var s = __myStatus || { points: 0, owned_items: [], equipped: {} };
    var owned = s.owned_items || [];
    var equipped = s.equipped || {};
    var groups = [['avatar_frame', '🖼 头像框'], ['post_bg', '🎨 帖子背景']];
    var html = '';
    groups.forEach(function(g) {
        var items = Object.keys(__rewardItems).map(function(k) { return __rewardItems[k]; })
            .filter(function(it) { return it.type === g[0]; });
        if (!items.length) return;
        html += '<div class="ck-group-title">' + g[1] + '</div><div class="ck-grid">';
        items.forEach(function(it) {
            var has = owned.indexOf(it.id) >= 0;
            var on = equipped[g[0]] === it.id;
            html += '<div class="ck-item' + (on ? ' equipped' : '') + '">';
            html += '<div class="ck-item-preview ' + (it.type === 'avatar_frame' ? 'ck-prev-frame' : 'ck-prev-bg')
                + '" style="' + previewStyle(it) + '"></div>';
            html += '<div class="ck-item-name">' + escapeHtml(it.name) + '</div>';
            html += '<div class="ck-item-cost">' + it.cost + ' 点</div>';
            if (on) {
                html += '<button class="ck-btn on" onclick="equipReward(\'' + g[0] + '\', null)">卸下</button>';
            } else if (has) {
                html += '<button class="ck-btn" onclick="equipReward(\'' + g[0] + '\', \'' + it.id + '\')">佩戴</button>';
            } else {
                var can = (s.points || 0) >= it.cost;
                html += '<button class="ck-btn buy"' + (can ? '' : ' disabled')
                    + ' onclick="buyReward(\'' + it.id + '\')">兑换</button>';
            }
            html += '</div>';
        });
        html += '</div>';
    });
    if (!html) html = '<div class="ck-loading">装饰商店加载中...</div>';
    return html;
}

function mineRow(type, label, item) {
    var val = item ? escapeHtml(item.name) : '<span class="ck-mine-none">未佩戴</span>';
    var html = '<div class="ck-mine-row"><span class="ck-mine-label">' + label + '</span>'
        + '<span class="ck-mine-val">' + val + '</span>';
    if (item) {
        html += '<button class="ck-btn" onclick="equipReward(\'' + type + '\', null)">卸下</button>';
    }
    html += '</div>';
    return html;
}

function renderMineHtml() {
    var s = __myStatus || { equipped: {}, streak: 0, total_checkins: 0 };
    var equipped = s.equipped || {};
    var frame = equipped.avatar_frame ? __rewardItems[equipped.avatar_frame] : null;
    var bg = equipped.post_bg ? __rewardItems[equipped.post_bg] : null;
    var html = '';
    html += '<div class="ck-mine-preview">';
    html += '<div class="avatar ck-mine-avatar" data-author="' + escapeHtml(currentUser.name) + '">'
        + avatarInner(currentUser.name) + '</div>';
    html += '<div class="ck-mine-name">' + escapeHtml(currentUser.name) + '</div>';
    html += '<div class="ck-mine-streak">🔥 连续签到 ' + (s.streak || 0) + ' 天 · 累计 ' + (s.total_checkins || 0) + ' 次</div>';
    html += '</div>';
    html += '<div class="ck-mine-rows">';
    html += mineRow('avatar_frame', '头像框', frame);
    html += mineRow('post_bg', '帖子背景', bg);
    html += '</div>';
    html += '<div class="ck-mine-tip">兑换后即可在上面佩戴，效果会同步显示在所有帖子的头像与卡片上。</div>';
    return html;
}

/* ---------- 签到 / 兑换 / 佩戴 ---------- */
window.doDailyCheckin = async function() {
    var token = getSessionToken();
    if (!token) { openAuthModal(); return; }
    var btn = document.getElementById('ckActionBtn');
    if (btn) { btn.disabled = true; btn.textContent = '签到中...'; }
    try {
        var res = await sb.rpc('checkin_daily', { p_token: token });
        if (res.error) throw res.error;
        var d = res.data || {};
        if (!d.ok) {
            await refreshMyStatus();
            renderCheckinModal();
            refreshCheckinHeader();
            ckToast(d.error || '签到失败');
            return;
        }
        ckToast('🎉 获得 +' + d.awarded + ' 探索点数，已连续签到 ' + d.streak + ' 天');
        await refreshMyStatus();
        renderCheckinModal();
        refreshCheckinHeader();
    } catch (e) {
        console.error('[签到] 签到失败:', e);
        ckToast('签到失败：' + e.message);
        renderCheckinModal();
    }
};

window.buyReward = async function(itemId) {
    var token = getSessionToken();
    if (!token) { openAuthModal(); return; }
    var item = __rewardItems[itemId];
    if (!item) return;
    if (!confirm('确定花费 ' + item.cost + ' 点兑换「' + item.name + '」吗？')) return;
    try {
        var res = await sb.rpc('checkin_buy', { p_token: token, p_item: itemId });
        if (res.error) throw res.error;
        var d = res.data || {};
        if (!d.ok) { ckToast(d.error || '兑换失败'); return; }
        ckToast('兑换成功！已拥有「' + item.name + '」');
        await refreshMyStatus();
        renderCheckinModal();
    } catch (e) {
        console.error('[签到] 兑换失败:', e);
        ckToast('兑换失败：' + e.message);
    }
};

window.equipReward = async function(type, itemId) {
    var token = getSessionToken();
    if (!token) { openAuthModal(); return; }
    try {
        var res = await sb.rpc('checkin_equip', { p_token: token, p_type: type, p_item: itemId });
        if (res.error) throw res.error;
        var d = res.data || {};
        if (!d.ok) { ckToast(d.error || '操作失败'); return; }
        ckToast(itemId ? '已佩戴' : '已卸下');
        await refreshMyStatus();
        renderCheckinModal();
        if (window.renderAuthArea) window.renderAuthArea();
        if (window.applyRewardStyles) window.applyRewardStyles(document);
        var pm = document.getElementById('profileModal');
        if (pm && pm.classList.contains('show') && pm.dataset.username && window.showUserProfile) {
            window.showUserProfile(pm.dataset.username);
        }
    } catch (e) {
        console.error('[签到] 佩戴失败:', e);
        ckToast('操作失败：' + e.message);
    }
};

/* ---------- 轻提示 ---------- */
function ckToast(msg) {
    var el = document.getElementById('ckToast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'ckToast';
        el.className = 'ck-toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el.__t);
    el.__t = setTimeout(function() { el.classList.remove('show'); }, 2400);
}

/* ---------- 弹窗遮罩点击关闭 ---------- */
(function bindCheckinModal() {
    var m = document.getElementById('checkinModal');
    if (m) {
        m.addEventListener('click', function(e) { if (e.target === m) closeCheckinModal(); });
    }
})();
