/* ============================================================
   SpaceHub — js/comments.js
   评论提交、删除、@提及解析
   ============================================================ */

/* ---------- @提及功能 ---------- */
function parseMentions(text) {
    if (!text) return '';
    var escaped = escapeHtml(text);
    return escaped.replace(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g, function(match, username) {
        return '<span class="mention-link" onclick="showUserProfile(\'' + username + '\')">@' + username + '</span>';
    });
}

function extractMentions(text) {
    if (!text) return [];
    var matches = text.match(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g) || [];
    return matches.map(function(m) { return m.substring(1); });
}

/* ---------- 提交评论 ---------- */
window.submitComment = async function(postId) {
    if (!currentUser) {
        alert('请先登录后再发表评论');
        openAuthModal();
        return;
    }
    var textInput = document.getElementById('comment-text-' + postId);
    var content = textInput.value.trim();
    if (!content) {
        textInput.focus();
        return;
    }
    var name = currentUser.name;
    var post = posts.find(function(p) { return String(p.id) === String(postId); });
    if (!post) return;
    if (!post.comments) post.comments = [];
    post.comments.push({
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        author: name,
        content: content,
        time: Date.now()
    });
    var nameInput = document.getElementById('modalName');
    if (nameInput) nameInput.value = '';
    textInput.value = '';
    await updatePostDB(postId);
    renderPosts();
    // 重新展开评论区
    setTimeout(function() {
        var section = document.getElementById('comments-' + postId);
        if (section) section.classList.add('show');
    }, 50);
    // 发送通知
    if (post.author !== currentUser.name) {
        addNotification(post.author, currentUser.name, 'comment', postId, currentUser.name + ' 评论了你的帖子' + (post.title ? '「' + post.title + '」' : ''));
    }
    // @提及通知
    var commentMentions = extractMentions(content);
    var commentAuthor = currentUser ? currentUser.name : name;
    commentMentions.forEach(function(uname) {
        if (uname !== commentAuthor && uname !== post.author && allUsers && allUsers.some(function(u) { return u.name === uname; })) {
            addNotification(uname, commentAuthor, 'mention', postId, commentAuthor + ' 在评论中提到了你' + (post.title ? '「' + post.title + '」' : ''));
        }
    });
};

/* ---------- 删除评论（通过 post-write Edge Function 更新 comments 数组） ---------- */
window.deleteComment = async function(postId, commentId) {
    if (!(await requireAdminAuth('删除评论'))) return;
    var post = posts.find(function(p) { return String(p.id) === String(postId); });
    if (!post || !post.comments) return;
    var firstIdx = post.comments.findIndex(function(c) { return String(c.id) === String(commentId); });
    if (firstIdx === -1) return;
    post.comments.splice(firstIdx, 1);
    await updatePostDB(postId);
    renderPosts();
    setTimeout(function() {
        var section = document.getElementById('comments-' + postId);
        if (section) section.classList.add('show');
    }, 50);
};
