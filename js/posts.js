/* ============================================================
   SpaceHub — js/posts.js
   帖子列表、发帖/编辑/删除、点赞、搜索、渲染、发射数据
   ============================================================ */

let posts = [];
let currentTab = 'hot';
let isLoading = false;
let displayCount = 20;
let editingPostId = null;
let launchesCache = null;
let launchesCacheTime = 0;
var launches = [];

/* ---------- 工具函数（内联，避免跨模块依赖） ---------- */
function getVideoEmbed(text) {
    if (!text) return '';
    var ytMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        return '<div class="video-embed"><iframe src="https://www.youtube.com/embed/' + ytMatch[1] + '?autoplay=0&rel=0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe></div>';
    }
    var biliMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:bilibili\.com\/video\/|b23\.tv\/)([a-zA-Z0-9]+)/);
    if (biliMatch) {
        var bvid = biliMatch[1];
        if (bvid.length <= 8) {
            return '<div class="video-embed" style="display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);padding:20px;"><a href="https://b23.tv/' + bvid + '" target="_blank" style="color:var(--accent-color);font-size:0.9rem;">📹 点击观看B站视频</a></div>';
        }
        var bvId = bvid.startsWith('BV') ? bvid : 'BV' + bvid;
        return '<div class="video-embed"><iframe src="https://player.bilibili.com/player.html?bvid=' + bvId + '&page=1&high_quality=1&autoplay=0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe></div>';
    }
    return '';
}

function hasVideoUrl(post) {
    return !!(getVideoEmbed(post.image) || getVideoEmbed(post.content) || getVideoEmbed(post.source_url));
}

function getPostVideoHtml(post) {
    var fromImage = getVideoEmbed(post.image);
    if (fromImage) return fromImage;
    var fromContent = getVideoEmbed(post.content);
    if (fromContent) return fromContent;
    return getVideoEmbed(post.source_url);
}

function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + '分钟前';
    if (diff < day) return Math.floor(diff / hour) + '小时前';
    if (diff < 7 * day) return Math.floor(diff / day) + '天前';
    return new Date(timestamp).toLocaleDateString('zh-CN');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getAvatar(name) {
    if (OFFICIAL_USERS[name]) return OFFICIAL_USERS[name].avatar;
    return '🚀';
}

/* ---------- 加载帖子（只读，anon key 可用） ---------- */
window.loadPosts = async function() {
    isLoading = true;
    try {
        var result = await sb.from('posts').select('*').order('time', { ascending: false });
        if (result.error) throw result.error;
        posts = result.data || [];
        renderPosts();
        await loadLaunches();
    } catch (err) {
        console.error('加载失败:', err);
        var el = document.getElementById('postsList');
        if (el) el.innerHTML = '<div class="empty-state"><div class="emoji">⚠️</div><p>加载失败，请检查网络连接</p></div>';
    }
    isLoading = false;
};

/* ---------- 加载发射数据（只读 + 首次插入默认数据走 Edge Function） ---------- */
window.loadLaunches = async function() {
    try {
        if (launchesCache && (Date.now() - launchesCacheTime) < 5 * 60 * 1000) {
            launches = launchesCache;
            renderLaunches && renderLaunches();
            return;
        }
        var result = await sb.from('launches').select('*').order('date', { ascending: true });
        if (result.error) throw result.error;
        var data = result.data;
        if (data && data.length > 0) {
            launches = data;
            launchesCache = data;
            launchesCacheTime = Date.now();
            renderLaunches && renderLaunches();
        } else {
            // 首次运行：通过 Edge Function 插入默认数据
            try {
                await callEdgeFunction('launch-write', {
                    action: 'create',
                    rocket: 'Falcon 9',
                    agency: 'SpaceX',
                    date: new Date('2026-10-10').getTime(),
                    location: 'LC-39A',
                    mission: 'Starlink Group',
                    status: 'scheduled'
                });
                await callEdgeFunction('launch-write', {
                    action: 'create',
                    rocket: 'Long March 5',
                    agency: 'CNSA',
                    date: new Date('2026-10-15').getTime(),
                    location: '文昌',
                    mission: '天问系列',
                    status: 'scheduled'
                });
            } catch (e) { console.error('插入默认发射数据失败:', e); }
            launchesCache = null;
        }
    } catch (err) {
        console.error('加载发射数据失败:', err);
    }
};

/* ---------- 同步帖子元数据到 DB（通过 post-write Edge Function） ---------- */
window.updatePostDB = async function(postId) {
    var post = posts.find(function(p) { return String(p.id) === String(postId); });
    if (!post) return;
    try {
        await callEdgeFunction('post-write', {
            action: 'update',
            post_id: postId,
            likes: post.likes || 0,
            pinned: post.pinned || false,
            source_url: post.source_url || '',
            comments: post.comments || []
        });
    } catch (err) {
        console.error('更新帖子失败:', err);
    }
};

window.saveLaunches = async function() {};

/* ---------- 定时刷新 ---------- */
setInterval(function() {
    if (!isLoading) loadPosts();
    if (currentUser) window.updateNotifyBadge && window.updateNotifyBadge();
}, 60000);

/* ---------- 模态框 ---------- */
window.openModal = function() {
    if (!currentUser) {
        alert('请先登录后再发布帖子');
        openAuthModal && openAuthModal();
        return;
    }
    editingPostId = null;
    var titleEl = document.getElementById('modalTitleText');
    if (titleEl) titleEl.textContent = '发布帖子';
    var nameEl = document.getElementById('modalName');
    if (nameEl) {
        nameEl.value = currentUser.name;
        nameEl.readOnly = true;
        nameEl.style.opacity = '0.6';
    }
    var overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.add('show');
    setTimeout(function() {
        var titleInput = document.getElementById('modalTitle');
        if (titleInput) titleInput.focus();
    }, 100);
};

window.closeModal = function() {
    editingPostId = null;
    var overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('show');
    ['modalName', 'modalTitle', 'modalContent', 'modalImage', 'modalSourceUrl'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) { el.value = ''; el.readOnly = false; el.style.opacity = '1'; }
    });
};

(function bindModalEvents() {
    var overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
    }
})();

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        window.closeLaunchEditor && window.closeLaunchEditor();
        window.closeProfileModal && window.closeProfileModal();
        window.closeNotifyModal && window.closeNotifyModal();
        window.closeAgnesAI && window.closeAgnesAI();
    }
});

/* ---------- 发帖 / 编辑（通过 post-write Edge Function） ---------- */
window.submitPost = async function() {
    if (!currentUser) {
        alert('请先登录后再发布帖子');
        openAuthModal && openAuthModal();
        return;
    }
    var titleEl = document.getElementById('modalTitle');
    var contentEl = document.getElementById('modalContent');
    var sourceEl = document.getElementById('modalSourceUrl');
    var title = titleEl ? titleEl.value.trim() : '';
    var content = contentEl ? contentEl.value.trim() : '';
    var sourceUrl = sourceEl ? (sourceEl.value.trim() || '') : '';
    var name = currentUser.name;

    if (!title && !content) { titleEl && titleEl.focus(); return; }

    var btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = editingPostId ? '保存中...' : '发布中...';

    /* 编辑模式 */
    if (editingPostId) {
        var imgEl = document.getElementById('modalImage');
        var editImage = imgEl ? (imgEl.value.trim() || '') : '';
        var ep = posts.find(function(p) { return String(p.id) === String(editingPostId); });
        if (ep && ep.author !== currentUser.name) {
            alert('只能编辑自己的帖子');
            btn.disabled = false;
            btn.textContent = '发布';
            return;
        }
        try {
            var result = await callEdgeFunction('post-write', {
                action: 'update',
                post_id: editingPostId,
                title: title,
                content: content,
                image: editImage,
                source_url: sourceUrl
            });
            if (!result.ok) throw new Error(result.error || '更新失败');
            if (ep) {
                ep.title = title; ep.content = content;
                ep.image = editImage; ep.source_url = sourceUrl;
            }
            closeModal();
            renderPosts();
        } catch (err) {
            alert('保存失败: ' + err.message);
        }
        btn.disabled = false;
        btn.textContent = '发布';
        return;
    }

    /* 新增 — 通过 post-write Edge Function */
    var newPost = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: title,
        content: content,
        author: name,
        avatar: getAvatar(name),
        image: document.getElementById('modalImage') ? (document.getElementById('modalImage').value.trim() || '') : '',
        source_url: sourceUrl,
        time: Date.now(),
        likes: 0,
        comments: []
    };
    try {
        var insResult = await callEdgeFunction('post-write', {
            action: 'create',
            id: newPost.id,
            title: newPost.title,
            content: newPost.content,
            author: newPost.author,
            avatar: newPost.avatar,
            image: newPost.image,
            source_url: newPost.source_url || '',
            time: newPost.time,
            likes: 0,
            comments: [],
            pinned: false
        });
        if (!insResult.ok) throw new Error(insResult.error || '发布失败');
        posts.unshift(newPost);
        closeModal();
        // 发送 @ 提及通知
        var mentionedUsers = extractMentions(content + ' ' + title);
        mentionedUsers.forEach(function(uname) {
            if (uname !== newPost.author && allUsers && allUsers.some(function(u) { return u.name === uname; })) {
                addNotification(uname, newPost.author, 'mention', newPost.id, newPost.author + ' 在帖子中提到了你' + (title ? '「' + title + '」' : ''));
            }
        });
        currentTab = 'new';
        updateTabs();
        renderPosts();
    } catch (err) {
        alert('发布失败: ' + err.message);
    }
    btn.disabled = false;
    btn.textContent = '发布';
};

/* ---------- 点赞（通知通过 notification-write Edge Function） ---------- */
window.toggleLike = async function(id) {
    if (!currentUser) {
        alert('请先登录后再点赞！');
        openAuthModal && openAuthModal();
        return;
    }
    var isLiked = likedPosts[id] || false;
    var post = posts.find(function(p) { return p.id === id; });
    if (post) {
        post.likes = isLiked ? Math.max(0, (post.likes || 0) - 1) : (post.likes || 0) + 1;
        if (!isLiked && post.author !== currentUser.name) {
            addNotification(post.author, currentUser.name, 'like', post.id, currentUser.name + ' 赞了你的帖子' + (post.title ? '「' + post.title + '」' : ''));
        }
    }
    likedPosts[id] = !isLiked;
    localStorage.setItem(LIKED_POSTS_KEY, JSON.stringify(likedPosts));
    renderPosts();
    await updatePostDB(id);
};

/* ---------- 搜索 ---------- */
var searchKeyword = '';
var searchTimer = null;

window.handleSearch = function(val) {
    searchKeyword = val.trim().toLowerCase();
    var clearBtn = document.getElementById('searchClear');
    if (clearBtn) clearBtn.style.display = searchKeyword ? 'block' : 'none';
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function() { displayCount = 20; renderPosts(); }, 300);
};

window.clearSearch = function() {
    var input = document.getElementById('searchInput');
    if (input) input.value = '';
    searchKeyword = '';
    if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
    var clearBtn = document.getElementById('searchClear');
    if (clearBtn) clearBtn.style.display = 'none';
    displayCount = 20;
    renderPosts();
};

/* ---------- 渲染帖子列表 ---------- */
window.renderPosts = function() {
    var list = document.getElementById('postsList');
    if (!list) return;

    var displayPosts = posts.slice();

    if (searchKeyword) {
        displayPosts = displayPosts.filter(function(p) {
            var title = (p.title || '').toLowerCase();
            var content = (p.content || '').toLowerCase();
            var author = (p.author || '').toLowerCase();
            var source = (p.source_url || '').toLowerCase();
            return title.includes(searchKeyword) || content.includes(searchKeyword) || author.includes(searchKeyword) || source.includes(searchKeyword);
        });
    }

    displayPosts.sort(function(a, b) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (currentTab === 'hot') return (b.likes || 0) - (a.likes || 0);
        return (b.time || 0) - (a.time || 0);
    });

    if (displayPosts.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="emoji">' + (searchKeyword ? '🔍' : '🚀') + '</div><p>' + (searchKeyword ? '没有找到匹配的帖子，换个关键词试试吧' : '还没有帖子，点击右上角发布第一条宇宙探索动态吧') + '</p></div>';
        return;
    }

    var visiblePosts = displayPosts.slice(0, displayCount);
    var html = visiblePosts.map(function(post) {
        var isLiked = likedPosts[post.id] || false;
        var avHtml = post.avatar.startsWith('http')
            ? '<img src="' + escapeHtml(post.avatar) + '" alt="avatar" loading="lazy" decoding="async">'
            : escapeHtml(post.avatar);
        var badge = OFFICIAL_USERS[post.author] ? '<span class="badge-official">' + escapeHtml(OFFICIAL_USERS[post.author].badge) + '</span>' : '';
        var commentsHtml = (post.comments && post.comments.length > 0)
            ? post.comments.map(function(c) {
                return '<div class="comment-item"><div class="comment-avatar">🌟</div>'
                    + '<div class="comment-body"><div class="comment-author">' + escapeHtml(c.author) + '</div>'
                    + '<div class="comment-text">' + (parseMentions ? parseMentions(c.content) : escapeHtml(c.content)) + '</div>'
                    + '<div class="comment-time">' + formatTime(c.time) + '</div></div>'
                    + '<button class="action-btn" style="color:#ff5555;font-size:12px;" onclick="deleteComment(\'' + escapeHtml(post.id) + '\', \'' + escapeHtml(c.id) + '\')">&#128465;️</button></div>';
            }).join('')
            : '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">暂无评论，来做第一个评论的人吧</div>';

        var commentArea = currentUser
            ? '<div class="comment-user-info">评论身份：<strong>' + escapeHtml(currentUser.name) + '</strong></div>'
            + '<textarea class="comment-textarea" id="comment-text-' + post.id + '" placeholder="写下你的评论..." maxlength="300" onkeydown="if(event.key===\'Enter\'&&event.ctrlKey)submitComment(\'' + post.id + '\')"></textarea>'
            + '<button class="comment-submit" onclick="submitComment(\'' + post.id + '\')">发送评论</button>'
            : '<div class="comment-user-info comment-login-hint">请 <a href="javascript:void(0)" onclick="openAuthModal()" style="color:#5b8fff;text-decoration:none;">登录</a> 后发表评论</div>'
            + '<textarea class="comment-textarea" id="comment-text-' + post.id + '" placeholder="登录后即可发表评论" maxlength="300" disabled style="opacity:0.5;cursor:not-allowed;"></textarea>'
            + '<button class="comment-submit" disabled style="opacity:0.4;cursor:not-allowed;">发送评论</button>';

        var videoHtml = hasVideoUrl(post) ? getPostVideoHtml(post)
            : (post.image ? "<div class='post-images'><img src='" + escapeHtml(post.image) + "' class='post-image' alt='图片' loading='lazy' decoding='async' onerror=\"this.style.display='none'\"></div>" : '');

        var sourceHtml = post.source_url
            ? '<div class="post-source"><span class="source-label">📄 内容来源：</span><a href="' + escapeHtml(post.source_url) + '" target="_blank" rel="noopener noreferrer" class="source-link">' + escapeHtml(post.source_url.length > 60 ? post.source_url.substring(0, 60) + '...' : post.source_url) + '</a></div>'
            : '';

        return '<div class="post-card" data-id="' + post.id + '">'
            + '<div class="post-header"><div class="post-author"><div class="avatar" style="cursor:pointer;" onclick="showUserProfile(\'' + escapeHtml(post.author) + '\')">' + avHtml + '</div>'
            + '<div class="author-info"><span class="author-name" style="cursor:pointer;" onclick="showUserProfile(\'' + escapeHtml(post.author) + '\')">'
            + escapeHtml(post.author) + ' ' + badge + '</span>'
            + '<span class="post-time">' + formatTime(post.time) + '</span></div></div>'
            + '<div style="display:flex;flex-shrink:0;gap:4px;">'
            + '<button class="pin-btn" onclick="togglePin(\'' + post.id + '\')" title="置顶/取消置顶">' + (post.pinned ? '📌 取消置顶' : '📌 置顶') + '</button>'
            + (currentUser && post.author === currentUser.name ? '<button class="edit-btn" onclick="editPost(\'' + post.id + '\')" title="编辑帖子">✏️ 编辑</button>' : '')
            + '<button class="delete-btn" onclick="deletePost(\'' + post.id + '\')" title="删除帖子">🗑 删除</button>'
            + '</div></div>'
            + (post.title ? '<div class="post-title">' + (post.pinned ? '📌 ' : '') + escapeHtml(post.title) + '</div>' : '')
            + videoHtml
            + '<div class="post-content">' + (parseMentions ? parseMentions(post.content) : escapeHtml(post.content)) + '</div>'
            + sourceHtml
            + '<div class="post-footer"><button class="action-btn ' + (isLiked ? 'liked' : '') + '" onclick="toggleLike(\'' + post.id + '\')"><span>' + (isLiked ? '❤️' : '🤍') + '</span><span>' + (post.likes || 0) + '</span></button>'
            + '<button class="comments-toggle-btn" onclick="toggleComments(\'' + post.id + '\')"><span>💬</span><span>' + ((post.comments && post.comments.length) || 0) + '</span></button></div>'
            + '<div class="comments-section" id="comments-' + post.id + '"><div class="comments-list" id="comments-list-' + post.id + '">' + commentsHtml + '</div><div class="comment-input-area">' + commentArea + '</div></div>'
            + '</div>';
    }).join('');

    list.innerHTML = html;

    if (displayPosts.length > displayCount) {
        list.innerHTML += '<div style="text-align:center;padding:16px;"><button class="load-more-btn" onclick="loadMorePosts()" style="padding:10px 32px;background:rgba(91,143,255,0.12);border:1px solid rgba(91,143,255,0.3);color:#5b8fff;border-radius:24px;cursor:pointer;font-size:0.9rem;">加载更多 (还有 ' + (displayPosts.length - displayCount) + ' 条)</button></div>';
    }
};

window.loadMorePosts = function() {
    displayCount += 20;
    renderPosts();
};

/* ---------- 置顶 / 删除（通过 post-write Edge Function） ---------- */
window.togglePin = async function(postId) {
    if (!(await requireAdminAuth('置顶帖子'))) return;
    var post = posts.find(function(p) { return String(p.id) === String(postId); });
    if (post) {
        post.pinned = !post.pinned;
        await updatePostDB(postId);
        renderPosts();
        alert(post.pinned ? '📌 已置顶' : '📌 已取消置顶');
    }
};

window.deletePost = async function(postId) {
    if (!(await requireAdminAuth('删除帖子'))) return;
    if (!confirm('确定要删除这条帖子吗？')) return;
    try {
        var result = await callEdgeFunction('post-write', { action: 'delete', post_id: postId });
        if (!result.ok) throw new Error(result.error || '删除失败');
        posts = posts.filter(function(p) { return String(p.id) !== String(postId); });
        delete likedPosts[postId];
        localStorage.setItem(LIKED_POSTS_KEY, JSON.stringify(likedPosts));
        renderPosts();
        alert('🗑 帖子已删除');
    } catch (err) {
        alert('删除失败: ' + err.message);
    }
};

/* ---------- 编辑帖子 ---------- */
window.editPost = function(postId) {
    var post = posts.find(function(p) { return String(p.id) === String(postId); });
    if (!post) return;
    editingPostId = postId;
    var titleEl = document.getElementById('modalTitleText');
    if (titleEl) titleEl.textContent = '编辑帖子';
    var nameEl = document.getElementById('modalName');
    if (nameEl) { nameEl.value = post.author || ''; nameEl.readOnly = true; nameEl.style.opacity = '0.6'; }
    var titleInput = document.getElementById('modalTitle');
    if (titleInput) titleInput.value = post.title || '';
    var contentInput = document.getElementById('modalContent');
    if (contentInput) contentInput.value = post.content || '';
    var imgInput = document.getElementById('modalImage');
    if (imgInput) imgInput.value = post.image || '';
    var srcInput = document.getElementById('modalSourceUrl');
    if (srcInput) srcInput.value = post.source_url || '';
    var btn = document.getElementById('submitBtn');
    if (btn) btn.textContent = '保存';
    var overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.add('show');
};

/* ---------- 评论切换（仅展开/折叠） ---------- */
window.toggleComments = function(postId) {
    var section = document.getElementById('comments-' + postId);
    if (section) section.classList.toggle('show');
};

/* ---------- Tab 切换 ---------- */
window.updateTabs = function() {
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.classList.toggle('active', tab.dataset.tab === currentTab);
    });
};

document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
        currentTab = tab.dataset.tab;
        displayCount = 20;
        updateTabs();

        var postsList      = document.getElementById('postsList');
        var aiContainer    = document.getElementById('aiChatContainer');
        var launchContainer = document.getElementById('launchTabContainer');

        if (currentTab === 'ai') {
            if (postsList) postsList.style.display = 'none';
            if (launchContainer) launchContainer.style.display = 'none';
            if (aiContainer) { aiContainer.style.display = 'flex'; initAI(); }
        } else if (currentTab === 'launches') {
            if (postsList) postsList.style.display = 'none';
            if (aiContainer) aiContainer.style.display = 'none';
            if (launchContainer) { launchContainer.style.display = 'block'; renderLaunches(); }
        } else {
            if (postsList) { postsList.style.display = 'block'; renderPosts(); }
            if (aiContainer) aiContainer.style.display = 'none';
            if (launchContainer) launchContainer.style.display = 'none';
        }
    });
});
