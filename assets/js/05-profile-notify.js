        // ==================== 主题切换 ====================
        // ==================== 编辑帖子 ====================
        let editingPostId = null;

        function editPost(postId) {
            const post = posts.find(p => String(p.id) === String(postId));
            if (!post) return;
            editingPostId = postId;
            document.getElementById('modalTitleText').textContent = '编辑帖子';
            document.getElementById('modalName').value = post.author || '';
            document.getElementById('modalName').readOnly = true;
            document.getElementById('modalName').style.opacity = '0.6';
            document.getElementById('modalTitle').value = post.title || '';
            document.getElementById('modalContent').value = post.content || '';
            document.getElementById('modalImage').value = post.image || '';
            document.getElementById('modalSourceUrl').value = post.source_url || '';
            document.getElementById('submitBtn').textContent = '保存';
            document.getElementById('modalOverlay').classList.add('show');
        }

        // ==================== 用户资料 ====================
        function showUserProfile(username) {

            const modal = document.getElementById('profileModal');
            const contentDiv = document.getElementById('profileContent');
            if (!modal || !contentDiv) return;
            modal.dataset.username = username;
            const userPosts = posts.filter(function(p) { return p.author === username; });
            const totalLikes = userPosts.reduce(function(sum, p) { return sum + (p.likes || 0); }, 0);
            const avatar = getAvatar(username);
            const avHtml = avatar.startsWith('http') ? '<img src="' + avatar + '" alt="avatar" loading="lazy" decoding="async">' : avatar;
            const badge = OFFICIAL_USERS[username] ? '<span class="badge-official">' + OFFICIAL_USERS[username].badge + '</span>' : '';
            var postsHtml = '';
            if (userPosts.length > 0) {
                postsHtml = '<div class="profile-posts"><div class="profile-posts-title">TA的帖子 (' + userPosts.length + ')</div>';
                userPosts.forEach(function(post) {
                    var isLiked = likedPosts[post.id] || false;
                    postsHtml += '<div class="post-card" data-id="' + post.id + '">';
                    postsHtml += '<div class="post-header"><div class="post-author">';
                    postsHtml += '<div class="avatar">' + (post.avatar && post.avatar.startsWith('http') ? '<img src="' + escapeHtml(post.avatar) + '" alt="avatar" loading="lazy" decoding="async">' : (escapeHtml(post.avatar || '🌟'))) + '</div>';
                    postsHtml += '<div class="author-info"><span class="author-name" style="cursor:pointer;" onclick="showUserProfile(\'' + escapeHtml(post.author) + '\')">' + escapeHtml(post.author) + '</span>';
                    postsHtml += '<span class="post-time">' + formatTime(post.time) + '</span></div></div></div>';
                    if (post.title) postsHtml += '<div class="post-title">' + escapeHtml(post.title) + '</div>';
                    if (post.image) postsHtml += "<div class='post-images'><img src='" + escapeHtml(post.image) + "' class='post-image' alt='图片' loading='lazy' decoding='async'></div>";
                    if (post.content) postsHtml += '<div class="post-content">' + escapeHtml(post.content) + '</div>';
                    postsHtml += '<div class="post-footer"><button class="action-btn ' + (isLiked ? 'liked' : '') + '" onclick="toggleLike(\'' + post.id + '\')"><span>' + (isLiked ? '❤️' : '🤍') + '</span><span>' + (post.likes || 0) + '</span></button></div>';
                    postsHtml += '</div>';
                });
                postsHtml += '</div>';
            } else {
                postsHtml = '<div class="profile-posts"><div class="profile-posts-title">暂无帖子</div></div>';
            }
            contentDiv.innerHTML = '<div class="profile-header"><div class="profile-avatar-large">' + avHtml + '</div><div class="profile-info"><div class="profile-name">' + escapeHtml(username) + ' ' + badge + '</div><div class="profile-stats"><div class="profile-stat"><span class="profile-stat-num">' + userPosts.length + '</span><span>帖子</span></div><div class="profile-stat"><span class="profile-stat-num">' + totalLikes + '</span><span>获赞</span></div></div></div></div>' + postsHtml;
            modal.classList.add('show');
        }

        function closeProfileModal() {
            const modal = document.getElementById('profileModal');
            if (modal) modal.classList.remove('show');
        }

// ============================================
// 通知系统 & 私信系统 - 太空探索帖子网站
// ============================================
//
// 依赖全局变量：
//   sb          - Supabase 客户端实例 (supabase.createClient)
//   currentUser - 当前登录用户对象 (有 .name 属性)
//   posts       - 帖点数组
//   allUsers    - 所有用户数组
//
// 依赖已有函数：
//   escapeHtml(str)        - HTML 转义
//   formatTime(timestamp)  - 时间格式化
//   getAvatar(username)    - 获取头像 (返回 URL 或 emoji)
//   openAuthModal()        - 打开登录弹窗
//   closeProfileModal()    - 关闭用户主页弹窗
//   showUserProfile(name)  - 显示用户主页
//   toggleComments(postId) - 切换帖子评论区
//
// 数据库表：
//   notifications(id, target_user, from_user, type, post_id, content, is_read, created_at)
//   messages(id, from_user, to_user, content, is_read, created_at)
//
// 弹窗显示规则：modal 元素添加 class="show" 时显示 (display:flex)
// 所需 DOM 元素 ID：
//   通知：notifyBadge, notifyModal, notifyList

// ============================================

// ===== 全局变量 =====

// 通知系统
let notifications = [];

// 定时器 ID
let _notifyMsgIntervalId = null;

// ============================================
// 通知系统
// ============================================

/**
 * 加载当前用户的通知（最多 50 条，按时间倒序）
 */
async function loadNotifications() {
    if (!currentUser) return;
    try {
        const { data, error } = await sb.from('notifications')
            .select('*')
            .eq('target_user', currentUser.name)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        notifications = data || [];
        updateNotifyBadge();
    } catch (e) {
        console.error('加载通知失败:', e);
    }
}

/**
 * 更新通知徽章（未读数）
 */
function updateNotifyBadge() {
    const unread = notifications.filter(function (n) { return !n.is_read; }).length;
    const badge = document.getElementById('notifyBadge');
    if (badge) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }
}

/**
 * 打开通知弹窗并标记已读
 */
function openNotifyModal() {
    if (!currentUser) { openAuthModal(); return; }
    const modal = document.getElementById('notifyModal');
    if (modal) {
        modal.classList.add('show');
        renderNotifications();
        // 标记所有为已读
        markAllNotificationsRead();
    }
}

/**
 * 关闭通知弹窗
 */
function closeNotifyModal() {
    const modal = document.getElementById('notifyModal');
    if (modal) modal.classList.remove('show');
}

/**
 * 处理通知点击事件
 * - 如果帖子存在，跳转到帖子并展开评论
 * - 如果帖子已删除，仅关闭弹窗
 * - 如果是关注通知（无 post_id），跳转到用户主页
 * @param {number} index - 通知在 notifications 数组中的索引
 */
function handleNotificationClick(index) {
    var n = notifications[index];
    if (!n) return;
    closeNotifyModal();
    if (n.post_id) {
        // 检查帖子是否仍然存在
        var post = null;
        if (typeof posts !== 'undefined' && Array.isArray(posts)) {
            post = posts.find(function (p) { return String(p.id) === String(n.post_id); });
        }
        if (post && typeof toggleComments === 'function') {
            toggleComments(n.post_id);
        }
        // 帖子已删除则不做跳转，仅关闭弹窗
    }
}

/**
 * 删除单条通知
 * @param {number} index - 通知索引
 * @param {Event} event - 事件对象（阻止冒泡）
 */
async function deleteNotification(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    var n = notifications[index];
    if (!n) return;
    try {
        var { error } = await sb.from('notifications').delete().eq('id', n.id);
        if (error) throw error;
        notifications.splice(index, 1);
        updateNotifyBadge();
        renderNotifications();
    } catch (e) {
        console.error('删除通知失败:', e);
    }
}

/**
 * 渲染通知列表
 * 使用 index 索引方式绑定点击事件，避免字符串转义问题
 */
function renderNotifications() {
    var list = document.getElementById('notifyList');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">暂无通知</div>';
        return;
    }

    var iconMap = { 'like': '❤️', 'comment': '💬' };

    list.innerHTML = notifications.map(function (n, index) {
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
}

/**
 * 标记所有未读通知为已读
 */
async function markAllNotificationsRead() {
    if (!currentUser || notifications.length === 0) return;
    var unreadIds = notifications.filter(function (n) { return !n.is_read; }).map(function (n) { return n.id; });
    if (unreadIds.length === 0) return;
    try {
        var { error } = await sb.from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);
        if (error) throw error;
        notifications.forEach(function (n) { n.is_read = true; });
        updateNotifyBadge();
    } catch (e) {
        console.error('标记已读失败:', e);
    }
}

/**
 * 创建通知（不会给自己发通知）
 * @param {string} targetUser - 通知接收者用户名
 * @param {string} fromUser   - 通知发起者用户名
 * @param {string} type       - 通知类型: 'like' | 'comment'
 * @param {string|null} postId - 相关帖子 ID（可选）
 * @param {string} content    - 通知内容
 */
async function addNotification(targetUser, fromUser, type, postId, content) {
    if (!targetUser || !fromUser || targetUser === fromUser) return;
    try {
        var { error } = await sb.from('notifications').insert({
            target_user: targetUser,
            from_user: fromUser,
            type: type,
            post_id: postId || null,
            content: content,
            is_read: false,
            created_at: Date.now()
        });
        if (error) throw error;
    } catch (e) {
        console.error('创建通知失败:', e);
    }
}

// ============================================
// ============================================

// ============================================
// 定时刷新 & 初始化
// ============================================

/**
 * 手动刷新通知和未读私信数
 */
async function refreshNotifyAndMessages() {
    if (!currentUser) return;
    try {
        await loadNotifications();
        updateNotifyBadge();
    } catch (e) {
        console.error('刷新通知和私信失败:', e);
    }
}

/**
 * 初始化通知和私信系统
 * 在页面加载完成或用户登录成功后调用
 * 每 30 秒自动刷新通知和未读私信数
 */
function initNotifyMessageSystem() {
    // 立即加载一次
    if (currentUser) {
        loadNotifications();
    }

    // 清除旧的定时器（防止重复初始化）
    if (_notifyMsgIntervalId) {
        clearInterval(_notifyMsgIntervalId);
    }

    // 每 30 秒定时刷新
    _notifyMsgIntervalId = setInterval(function () {
        if (currentUser) {
            loadNotifications();
        }
    }, 30000);
}

/**
 * 停止通知和私信定时刷新
 * 在用户登出时调用
 */
function stopNotifyMessageSystem() {
    if (_notifyMsgIntervalId) {
        clearInterval(_notifyMsgIntervalId);
        _notifyMsgIntervalId = null;
    }
    // 清空状态
    notifications = [];
    updateNotifyBadge();
}
