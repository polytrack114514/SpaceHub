        // ==================== 点赞 ====================
        async function toggleLike(id) {
            if (!currentUser) {
                alert('请先登录后再点赞！');
                openAuthModal();
                return;
            }
            const isLiked = likedPosts[id] || false;
            // 在本地找到帖子并修改
            const post = posts.find(p => p.id === id);
            if (post) {
                post.likes = isLiked ? Math.max(0, (post.likes || 0) - 1) : (post.likes || 0) + 1;
                if (!isLiked && currentUser && post.author !== currentUser.name) {
                    addNotification(post.author, currentUser.name, 'like', post.id, currentUser.name + ' 赞了你的帖子' + (post.title ? '「' + post.title + '」' : ''));
                }
            }
            likedPosts[id] = !isLiked;
            localStorage.setItem('likedPosts', JSON.stringify(likedPosts));
            renderPosts();
            // 同步到 Supabase
            updatePostDB(id);
        }
        // ==================== 渲染 ====================
        let searchKeyword = '';
        let searchTimer = null;
        function handleSearch(val) {
            searchKeyword = val.trim().toLowerCase();
            document.getElementById('searchClear').style.display = searchKeyword ? 'block' : 'none';
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { displayCount = 20; renderPosts(); }, 300);
        }
        function clearSearch() {
            document.getElementById('searchInput').value = '';
            searchKeyword = '';
            if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
            document.getElementById('searchClear').style.display = 'none';
            displayCount = 20;
            renderPosts();
        }
        function renderPosts() {
            const list = document.getElementById('postsList');
            let displayPosts = [...posts];
            // 搜索过滤
            if (searchKeyword) {
                displayPosts = displayPosts.filter(p => {
                    const title = (p.title || '').toLowerCase();
                    const content = (p.content || '').toLowerCase();
                    const author = (p.author || '').toLowerCase();
                    const source = (p.source_url || '').toLowerCase();
                    return title.includes(searchKeyword) || content.includes(searchKeyword) || author.includes(searchKeyword) || source.includes(searchKeyword);
                });
            }

            if (currentTab === 'hot') {
                displayPosts.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return (b.likes || 0) - (a.likes || 0);
                });
            } else {
                displayPosts.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return (b.time || 0) - (a.time || 0);
                });
            }
            if (displayPosts.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <div class="emoji">${searchKeyword ? '🔍' : '🚀'}</div>
                        <p>${searchKeyword ? '没有找到匹配的帖子，换个关键词试试吧' : '还没有帖子，点击右上角发布第一条宇宙探索动态吧'}</p>
                    </div>
                `;
                return;
            }
            const visiblePosts = displayPosts.slice(0, displayCount);
            list.innerHTML = visiblePosts.map(post => {
                const isLiked = likedPosts[post.id] || false;
                return `
                    <div class="post-card" data-id="${post.id}">
                        <div class="post-header">
                            <div class="post-author">
                                <div class="avatar" style="cursor:pointer;" onclick="showUserProfile('${escapeHtml(post.author)}')">${post.avatar.startsWith('http') ? `<img src="${escapeHtml(post.avatar)}" alt="avatar" loading="lazy" decoding="async">` : escapeHtml(post.avatar)}</div>
                                <div class="author-info">
                                    <span class="author-name" style="cursor:pointer;" onclick="showUserProfile('${escapeHtml(post.author)}')">
                                        ${escapeHtml(post.author)}
                                        ${OFFICIAL_USERS[post.author] ? `<span class="badge-official">${OFFICIAL_USERS[post.author].badge}</span>` : ''}
                                    </span>
                                    <span class="post-time">${formatTime(post.time)}</span>
                                    </div>
                            </div>
                            <div style="display: flex; flex-shrink: 0; gap: 4px;">
                                <button class="pin-btn" onclick="togglePin('${post.id}')" title="置顶/取消置顶">${post.pinned ? '📌 取消置顶' : '📌 置顶'}</button>
                                ${currentUser && post.author === currentUser.name ? `<button class="edit-btn" onclick="editPost('${post.id}')" title="编辑帖子">✏️ 编辑</button>` : ''}
                                <button class="delete-btn" onclick="deletePost('${post.id}')" title="删除帖子">🗑 删除</button>
                            </div>
                        </div>
                        ${post.title ? `<div class="post-title">${post.pinned ? '📌 ' : ''}${escapeHtml(post.title)}</div>` : ''}
                        ${hasVideoUrl(post) ? getPostVideoHtml(post) : (post.image ? `<div class='post-images'><img src='${escapeHtml(post.image)}' class='post-image' alt='图片' loading="lazy" decoding="async" onerror="this.style.display='none'"></div>` : '')}
                        <div class="post-content">${parseMentions(post.content)}</div>
                        ${post.source_url ? `<div class="post-source"><span class="source-label">📄 内容来源：</span><a href="${escapeHtml(post.source_url)}" target="_blank" rel="noopener noreferrer" class="source-link">${escapeHtml(post.source_url.length > 60 ? post.source_url.substring(0, 60) + '...' : post.source_url)}</a></div>` : ''}
                        <div class="post-footer">
                            <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">
                                <span>${isLiked ? '❤️' : '🤍'}</span>
                                <span>${post.likes || 0}</span>
                            </button>
                            <button class="comments-toggle-btn" onclick="toggleComments('${post.id}')">
                                <span>💬</span>
                                <span>${(post.comments && post.comments.length) || 0}</span>
                            </button>
                            
                            </div>
                        <div class="comments-section" id="comments-${post.id}">
                            <div class="comments-list" id="comments-list-${post.id}">
                                ${(post.comments && post.comments.length > 0) ? post.comments.map(c => `
                                    <div class="comment-item">
                                        <div class="comment-avatar">🌟</div>
                                        <div class="comment-body">
                                            <div class="comment-author">${escapeHtml(c.author)}</div>
                                            <div class="comment-text">${parseMentions(c.content)}</div>
                                            <div class="comment-time">${formatTime(c.time)}</div>
                                        </div>
                                        <button class="action-btn" style="color:#ff5555;font-size:12px;" onclick="deleteComment('${post.id}', '${c.id}')">🗑️</button>
                                    </div>
                                `).join('') : '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 8px 0;">暂无评论，来做第一个评论的人吧</div>'}
                            </div>
                            <div class="comment-input-area">
                                ${currentUser ? `<div class="comment-user-info">评论身份：<strong>${escapeHtml(currentUser.name)}</strong></div>` : `<div class="comment-user-info comment-login-hint">请 <a href="javascript:void(0)" onclick="openAuthModal()" style="color:#5b8fff;text-decoration:none;">\u767b\u5f55</a> 后发表评论</div>`}
                                <textarea class="comment-textarea" id="comment-text-${post.id}" placeholder="${currentUser ? '\u5199\u4e0b\u4f60\u7684\u8bc4\u8bba...' : '\u767b\u5f55\u540e\u5373\u53ef\u53d1\u8868\u8bc4\u8bba'}" maxlength="300" ${currentUser ? '' : 'disabled style="opacity:0.5;cursor:not-allowed;"'} onkeydown="if(event.key==='Enter'&&event.ctrlKey)submitComment('${post.id}')"></textarea>
                                <button class="comment-submit" onclick="submitComment('${post.id}')" ${currentUser ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}>\u53d1\u9001\u8bc4\u8bba</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            if (displayPosts.length > displayCount) {
                list.innerHTML += `<div style="text-align:center;padding:16px;">
                    <button class="load-more-btn" onclick="loadMorePosts()" style="padding:10px 32px;background:rgba(91,143,255,0.12);border:1px solid rgba(91,143,255,0.3);color:#5b8fff;border-radius:24px;cursor:pointer;font-size:0.9rem;">加载更多 (还有 ${displayPosts.length - displayCount} 条)</button>
                </div>`;
            }
        }
        function loadMorePosts() {
            displayCount += 20;
            renderPosts();
        }
        async function togglePin(postId) {
            if (!(await requireAdminAuth('置顶帖子'))) return;
            const post = posts.find(p => String(p.id) === String(postId));
            if (post) {
                post.pinned = !post.pinned;
                await updatePostDB(postId);
                renderPosts();
                alert(post.pinned ? '📌 已置顶' : '📌 已取消置顶');
            }
        }
        async function deletePost(postId) {
            if (!(await requireAdminAuth('删除帖子'))) return;
            if (!confirm('确定要删除这条帖子吗？')) return;
            try {
                const { error } = await sb.from('posts').delete().eq('id', postId);
                if (error) throw error;
                posts = posts.filter(p => String(p.id) !== String(postId));
                delete likedPosts[postId];
                localStorage.setItem('likedPosts', JSON.stringify(likedPosts));
                renderPosts();
                alert('🗑 帖子已删除');
            } catch (err) {
                alert('删除失败: ' + err.message);
            }
        }
        // ==================== 评论功能 ====================
        function toggleComments(postId) {
            const section = document.getElementById('comments-' + postId);
            if (section) {
                section.classList.toggle('show');
            }
        }
        async function submitComment(postId) {
            if (!currentUser) {
                alert('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u53d1\u8868\u8bc4\u8bba');
                openAuthModal();
                return;
            }
            const textInput = document.getElementById('comment-text-' + postId);
            const content = textInput.value.trim();
            if (!content) {
                textInput.focus();
                return;
            }
            const name = currentUser.name;
            const post = posts.find(p => String(p.id) === String(postId));
            if (!post) return;
            if (!post.comments) post.comments = [];
            post.comments.push({
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                author: name,
                content: content,
                time: Date.now()
            });
            nameInput.value = '';
            textInput.value = '';
            await updatePostDB(postId);
            renderPosts();
            // 重新展开评论区
            setTimeout(() => {
                const section = document.getElementById('comments-' + postId);
                if (section) section.classList.add('show');
            }, 50);
            // 发送通知
            if (currentUser && post.author !== currentUser.name) {
                addNotification(post.author, currentUser.name, 'comment', postId, currentUser.name + ' 评论了你的帖子' + (post.title ? '「' + post.title + '」' : ''));
            } else if (!currentUser && post.author !== name) {
                addNotification(post.author, name, 'comment', postId, name + ' 评论了你的帖子' + (post.title ? '「' + post.title + '」' : ''));
            }
            // @提及通知
            var commentMentions = extractMentions(content);
            var commentAuthor = currentUser ? currentUser.name : name;
            commentMentions.forEach(function(uname) {
                if (uname !== commentAuthor && uname !== post.author && allUsers.some(function(u) { return u.name === uname; })) {
                    addNotification(uname, commentAuthor, 'mention', postId, commentAuthor + ' 在评论中提到了你' + (post.title ? '「' + post.title + '」' : ''));
                }
            });
        }
        async function deleteComment(postId, commentId) {
            if (!(await requireAdminAuth('删除评论'))) return;
            const post = posts.find(p => String(p.id) === String(postId));
            if (!post || !post.comments) return;
            const firstIdx = post.comments.findIndex(c => String(c.id) === String(commentId));
            if (firstIdx === -1) return;
            post.comments.splice(firstIdx, 1);
            await updatePostDB(postId);
            renderPosts();
            setTimeout(() => {
                const section = document.getElementById('comments-' + postId);
                if (section) section.classList.add('show');
            }, 50);
        }
        // ==================== 工具函数 ====================
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
        function getAvatar(name) {
            if (OFFICIAL_USERS[name]) return OFFICIAL_USERS[name].avatar;
            return '🚀';
        }
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        function updateTabs() {
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === currentTab);
            });
        }
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentTab = tab.dataset.tab;
                displayCount = 20;
                updateTabs();
                if (currentTab === 'ai') {
                    document.getElementById('postsList').style.display = 'none';
                    document.getElementById('aiChatContainer').style.display = '';
                    document.getElementById('launchTabContainer').style.display = 'none';
                    initAI();
                } else if (currentTab === 'launches') {
                    document.getElementById('postsList').style.display = 'none';
                    document.getElementById('aiChatContainer').style.display = 'none';
                    document.getElementById('launchTabContainer').style.display = '';
                    renderLaunches();
                } else {
                    document.getElementById('postsList').style.display = '';
                    document.getElementById('aiChatContainer').style.display = 'none';
                    document.getElementById('launchTabContainer').style.display = 'none';
                    renderPosts();
                }
            });
        });