
// ==================== Supabase 配置 ====================
        const SUPABASE_URL = 'https://tktfrrvaqwbtdhiqwnna.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdGZycnZhcXdidGRoaXF3bm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MzcyMjYsImV4cCI6MjEwMTMxMzIyNn0.CYNPqmQUrnkMFUq-Bkd_09q7CjQ8rZlNX5brb5-UrbQ';
        // 全局错误处理：即使 Supabase 失败也要隐藏加载动画
        window.addEventListener('error', function(e) {
            console.error('[SpaceHub] 全局错误:', e.message);
            hideSpaceLoader();
        });
        // 安全初始化 Supabase 客户端
        var sb;
        try {
            if (typeof supabase === 'undefined') {
                throw new Error('Supabase SDK 未加载');
            }
            sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('[SpaceHub] Supabase 初始化成功');
        } catch (e) {
            console.error('[SpaceHub] Supabase 初始化失败:', e.message);
            sb = null;
            hideSpaceLoader();  // 失败也要显示页面
        }
        // ==================== 数据 ====================
        let posts = [];
        let currentTab = 'hot';
        let likedPosts = JSON.parse(localStorage.getItem('likedPosts')) || {};
        let isLoading = false;
        let displayCount = 20;
        let launchesCache = null;
        let launchesCacheTime = 0;
        // ==================== 官方机构账号配置 ====================
        const OFFICIAL_USERS = {
            'NASA': { avatar: 'https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg', badge: 'NASA官方' },
            'CNSA': { avatar: 'https://picx.zhimg.com/v2-264f1e06887851be0703902fb9f106ca_r.jpg?source=2c26e567', badge: '国家航天局' },
            'SpaceX': { avatar: 'https://i.imglt.com/20260802/f61b49848b4eda0e49a759683af30679.jpg', badge: 'SpaceX官方' },
            '其他火箭发射': { avatar: 'https://i0.hdslb.com/bfs/new_dyn/43b61571f1e9a172c5ef0e1bc70d709f3461574224251726.jpg', badge: '火箭发射' }
        };
        function isOfficialUser(name) {
            return !!OFFICIAL_USERS[name];
        }
        // ==================== 从云端加载帖子 ====================
        async function loadPosts() {
            isLoading = true;
            try {
                const { data: postData, error: postErr } = await sb.from('posts').select('*').order('time', { ascending: false });
                if (postErr) throw postErr;
                posts = postData || [];
                renderPosts();
                // 加载发射数据
                await loadLaunches();
            } catch (err) {
                console.error('加载失败:', err);
                document.getElementById('postsList').innerHTML = '<div class="empty-state"><div class="emoji">⚠️</div><p>加载失败，请检查网络连接</p></div>';
            }
            isLoading = false;
        }
        // ==================== 加载发射数据 ====================
        async function loadLaunches() {
            try {
                if (launchesCache && (Date.now() - launchesCacheTime) < 5 * 60 * 1000) {
                    launches = launchesCache;
                    renderLaunches();
                    return;
                }
                const { data, error } = await sb.from('launches').select('*').order('date', { ascending: true });
                if (error) throw error;
                if (data && data.length > 0) {
                    launches = data;
                    launchesCache = data;
                    launchesCacheTime = Date.now();
                    renderLaunches();
                } else {
                    // 首次运行，插入默认数据
                    for (const l of launches) {
                        await sb.from('launches').insert({
                            rocket: l.rocket, agency: l.agency, date: l.date,
                            location: l.location, mission: l.mission,
                            image: l.image || '', description: l.description, status: l.status || 'tentative'
                        });
                    }
                    launchesCache = null;
                }
            } catch (err) {
                console.error('加载发射数据失败:', err);
            }
        }
        // ==================== 更新单个帖子到 Supabase ====================
        async function updatePostDB(postId) {
            const post = posts.find(p => String(p.id) === String(postId));
            if (!post) return;
            try {
                const updateData = {
                    likes: post.likes || 0,
                    pinned: post.pinned || false,
                    source_url: post.source_url || ''
                };
                if (post.comments) updateData.comments = post.comments;
                const { error } = await sb.from('posts').update(updateData).eq('id', postId);
                if (error) console.error('更新帖子失败:', error);
            } catch (err) {
                console.error('更新帖子失败:', err);
            }
        }
        // ==================== saveLaunches 兼容占位 ====================
        async function saveLaunches() {}
        // ==================== 自动刷新（每1分钟同步一次） ====================
        setInterval(() => {
            if (!isLoading) loadPosts();
            if (currentUser) updateNotifyBadge();
        }, 60000);
        // ==================== 模态框 ====================
        function openModal() {
            editingPostId = null;
            document.getElementById('modalTitleText').textContent = '发布帖子';
            document.getElementById('modalOverlay').classList.add('show');
            setTimeout(() => {
                document.getElementById('modalName').focus();
            }, 100);
        }
        function closeModal() {
            editingPostId = null;
            document.getElementById('modalOverlay').classList.remove('show');
            document.getElementById('modalName').value = '';
            document.getElementById('modalTitle').value = '';
            document.getElementById('modalContent').value = '';
            document.getElementById('modalImage').value = '';
            document.getElementById('modalSourceUrl').value = '';
            document.getElementById('modalName').readOnly = false;
            document.getElementById('modalName').style.opacity = '1';
        }
        document.getElementById('modalOverlay').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { closeModal(); closeLaunchEditor(); closeProfileModal(); closeNotifyModal(); closeAgnesAI(); }
        });
        // ==================== 发帖 ====================
        async function submitPost() {
            const name = document.getElementById('modalName').value.trim();
            const title = document.getElementById('modalTitle').value.trim();
            const content = document.getElementById('modalContent').value.trim();
            const sourceUrl = document.getElementById('modalSourceUrl') ? (document.getElementById('modalSourceUrl').value.trim() || '') : '';
            if (!name) {
                document.getElementById('modalName').focus();
                return;
            }
            if (!title && !content) {
                document.getElementById('modalTitle').focus();
                return;
            }
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.textContent = editingPostId ? '保存中...' : '发布中...';

            // === 编辑模式 ===
            if (editingPostId) {
                try {
                    const editImage = document.getElementById('modalImage') ? (document.getElementById('modalImage').value.trim() || '') : '';
                    const ep = posts.find(p => String(p.id) === String(editingPostId));
                    if (ep && ep.author !== currentUser.name) {
                        alert('只能编辑自己的帖子');
                        btn.disabled = false;
                        btn.textContent = '发布';
                        return;
                    }

                    const { error: editErr } = await sb.from('posts').update({
                        title: title,
                        content: content,
                        image: editImage,
                        source_url: sourceUrl
                    }).eq('id', editingPostId);
                    if (editErr) throw editErr;
                    if (ep) {
                        ep.title = title;
                        ep.content = content;
                        ep.image = editImage;
                        ep.source_url = sourceUrl;
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

            const newPost = {
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
            // 插入到 Supabase
            try {
                const { error } = await sb.from('posts').insert({
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
                if (error) throw error;
                posts.unshift(newPost);
                closeModal();
                // Send mention notifications
                var mentionedUsers = extractMentions(content + ' ' + title);
                mentionedUsers.forEach(function(uname) {
                    if (uname !== newPost.author && allUsers.some(function(u) { return u.name === uname; })) {
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
        }