/* ============================================================
   SpaceHub — js/notifications.js
   通知系统：加载、渲染、标记已读、删除
   ============================================================ */

let notifications = [];
let _notifyMsgIntervalId = null;

/* ---------- 加载通知（只读，anon key 可用） ---------- */
window.loadNotifications = async function() {
    if (!currentUser) return;
    try {
        var result = await sb.from('notifications')
            .select('*')
            .eq('target_user', currentUser.name)
            .order('created_at', { ascending: false })
            .limit(50);
        if (result.error) throw result.error;
        notifications = result.data || [];
        updateNotifyBadge();
    } catch (e) {
        console.error('加载通知失败:', e);
    }
};

/* ---------- 更新通知徽章 ---------- */
window.updateNotifyBadge = function() {
    var unread = notifications.filter(function(n) { return !n.is_read; }).length;
    var badge = document.getElementById('notifyBadge');
    if (badge) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }
};

/* ---------- 打开通知弹窗 ---------- */
window.openNotifyModal = function() {
    if (!currentUser) { openAuthModal(); return; }
    var modal = document.getElementById('notifyModal');
    if (modal) {
        modal.classList.add('show');
        renderNotifications();
        markAllNotificationsRead();
    }
};

/* ---------- 关闭通知弹窗 ---------- */
window.closeNotifyModal = function() {
    var modal = document.getElementById('notifyModal');
    if (modal) modal.classList.remove('show');
};

/* ---------- 点击通知 ---------- */
window.handleNotificationClick = function(index) {
    var n = notifications[index];
    if (!n) return;
    closeNotifyModal();
    if (n.post_id) {
        var post = null;
        if (typeof posts !== 'undefined' && Array.isArray(posts)) {
            post = posts.find(function(p) { return String(p.id) === String(n.post_id); });
        }
        if (post && typeof toggleComments === 'function') {
            toggleComments(n.post_id);
        }
    }
};

/* ---------- 删除通知（只读删除本地，DB 删除走 Edge Function） ---------- */
window.deleteNotification = async function(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    var n = notifications[index];
    if (!n) return;
    try {
        var result = await callEdgeFunction('notification-write', { action: 'delete', id: n.id });
        if (!result.ok) throw new Error(result.error || '删除失败');
        notifications.splice(index, 1);
        updateNotifyBadge();
        renderNotifications();
    } catch (e) {
        console.error('删除通知失败:', e);
    }
};

/* ---------- 渲染通知列表 ---------- */
window.renderNotifications = function() {
    var list = document.getElementById('notifyList');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">暂无通知</div>';
        return;
    }

    var iconMap = { 'like': '❤️', 'comment': '💬', 'mention': '🔔' };

    list.innerHTML = notifications.map(function(n, index) {
        var icon = iconMap[n.type] || '🔔';
        var timeStr = formatTime(n.created_at);

        var html = '';
        html += '<div class="notification-item' + (n.is_read ? '' : ' unread') + '"';
        html += ' onclick="handleNotificationClick(' + index + ')"';
        html += ' style="cursor:pointer;">';
        html +=   '<div class="notification-icon">' + icon + '</div>';
        html +=   '<div class="notification-content">';
        html +=     '<div class="notification-text">' + escapeHtml(n.content) + '</div>';
        html +=     '<div class="notification-time">' + timeStr + '</div>';
        html +=   '</div>';
        html +=   '<button class="notification-delete-btn"';
        html +=     ' onclick="deleteNotification(' + index + ', event)"';
        html +=     ' title="删除该通知"';
        html +=     ' style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.9rem;padding:4px 8px;opacity:0.6;flex-shrink:0;"';
        html +=     ' onmouseover="this.style.opacity=1"';
        html +=     ' onmouseout="this.style.opacity=0.6">✕</button>';
        html += '</div>';
        return html;
    }).join('');
};

/* ---------- 标记所有已读 ---------- */
window.markAllNotificationsRead = async function() {
    if (!currentUser || notifications.length === 0) return;
    var unreadIds = notifications.filter(function(n) { return !n.is_read; }).map(function(n) { return n.id; });
    if (unreadIds.length === 0) return;
    try {
        var result = await callEdgeFunction('notification-write', { action: 'mark_read', ids: unreadIds });
        if (!result.ok) throw new Error(result.error || '标记失败');
        notifications.forEach(function(n) { n.is_read = true; });
        updateNotifyBadge();
    } catch (e) {
        console.error('标记已读失败:', e);
    }
};

/* ---------- 添加通知（通过 notification-write Edge Function） ---------- */
window.addNotification = async function(targetUser, fromUser, type, postId, content) {
    if (!targetUser || !fromUser || targetUser === fromUser) return;
    try {
        var result = await callEdgeFunction('notification-write', {
            action: 'create',
            target_user: targetUser,
            from_user: fromUser,
            type: type,
            post_id: postId || null,
            content: content,
            is_read: false,
            created_at: Date.now()
        });
        if (!result.ok) throw new Error(result.error || '通知创建失败');
    } catch (e) {
        console.error('创建通知失败:', e);
    }
};

/* ---------- 初始化通知定时刷新 ---------- */
window.initNotifyMessageSystem = function() {
    if (currentUser) {
        loadNotifications();
    }
    if (_notifyMsgIntervalId) {
        clearInterval(_notifyMsgIntervalId);
    }
    _notifyMsgIntervalId = setInterval(function() {
        if (currentUser) {
            loadNotifications();
        }
    }, 30000);
};

/* ---------- 停止通知定时刷新 ---------- */
window.stopNotifyMessageSystem = function() {
    if (_notifyMsgIntervalId) {
        clearInterval(_notifyMsgIntervalId);
        _notifyMsgIntervalId = null;
    }
    notifications = [];
    updateNotifyBadge();
};

/* ---------- 手动刷新通知 ---------- */
window.refreshNotifyAndMessages = async function() {
    if (!currentUser) return;
    try {
        await loadNotifications();
        updateNotifyBadge();
    } catch (e) {
        console.error('刷新通知和私信失败:', e);
    }
};
