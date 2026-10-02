// ============================================================
// 太空探索帖子网站 - 视频嵌入/发射结果记录功能
// 数据库: Supabase (客户端变量: sb)
// 全局变量: currentUser, posts, launches, isOfficialUser, OFFICIAL_USERS
// ============================================================

// ==================== 视频嵌入功能 ====================

function getVideoEmbed(text) {
    if (!text) return '';
    var url = '';

    // YouTube 链接检测
    // 格式: https://www.youtube.com/watch?v=VIDEO_ID 或 https://youtu.be/VIDEO_ID
    var ytMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        var videoId = ytMatch[1];
        return '<div class="video-embed"><iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=0&rel=0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe></div>';
    }

    // B站链接检测
    // 格式: https://www.bilibili.com/video/BVxxxxxx 或 https://b23.tv/xxxxxx
    var biliMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:bilibili\.com\/video\/|b23\.tv\/)([a-zA-Z0-9]+)/);
    if (biliMatch) {
        var bvid = biliMatch[1];
        // 对于b23.tv短链接，无法直接获取BVID，使用外链跳转
        if (bvid.length <= 8) {
            // b23.tv 短链接，使用跳转
            return '<div class="video-embed" style="display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);padding:20px;"><a href="https://b23.tv/' + bvid + '" target="_blank" style="color:var(--accent-color);font-size:0.9rem;">📹 点击观看B站视频</a></div>';
        }
        // 提取BV号
        var bvId = bvid.startsWith('BV') ? bvid : 'BV' + bvid;
        return '<div class="video-embed"><iframe src="https://player.bilibili.com/player.html?bvid=' + bvId + '&page=1&high_quality=1&autoplay=0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe></div>';
    }

    return '';
}

// 检查帖子是否包含视频链接，返回嵌入HTML
function getPostVideoHtml(post) {
    // 检查图片字段和内容字段
    var fromImage = getVideoEmbed(post.image);
    if (fromImage) return fromImage;
    var fromContent = getVideoEmbed(post.content);
    if (fromContent) return fromContent;
    var fromSource = getVideoEmbed(post.source_url);
    if (fromSource) return fromSource;
    return '';
}

// 判断帖子是否包含视频（用于决定是否隐藏图片显示）
function hasVideoUrl(post) {
    return !!(getVideoEmbed(post.image) || getVideoEmbed(post.content) || getVideoEmbed(post.source_url));
}

// ==================== 发射结果记录功能 ====================

// 标记发射结果
async function markLaunchResult(index, result) {
    if (!currentUser || !isOfficialUser(currentUser.name)) {
        alert('只有官方机构账号才能标记发射结果');
        return;
    }
    var launch = launches[index];
    if (!launch || !launch.id) return;

    // 切换：如果已是这个结果，则取消标记回到pending
    var newResult = launch.result === result ? 'pending' : result;

    try {
        const { error } = await sb.from('launches')
            .update({ result: newResult })
            .eq('id', launch.id);
        if (error) throw error;
        launch.result = newResult;
        renderLaunches();
    } catch(e) {
        console.error('标记发射结果失败:', e);
        alert('标记失败: ' + e.message);
    }
}

// 获取发射结果徽章HTML
function getLaunchResultBadge(result) {
    if (!result || result === 'pending') return '';
    var resultMap = {
        'success': { text: '✅ 发射成功', class: 'launch-result-success' },
        'failure': { text: '❌ 发射失败', class: 'launch-result-fail' },
        'partial': { text: '⚠️ 部分成功', class: 'launch-result-partial' }
    };
    var info = resultMap[result];
    if (!info) return '';
    return '<span class="launch-result-badge ' + info.class + '">' + info.text + '</span>';
}

// 获取发射结果操作按钮HTML（仅官方账号可见）
function getLaunchResultActions(index, isLaunched) {
    if (!currentUser || !isOfficialUser(currentUser.name) || !isLaunched) return '';
    var launch = launches[index];
    if (!launch) return '';
    var currentResult = launch.result || 'pending';
    return '<div class="launch-result-actions">' +
        '<button class="launch-result-btn' + (currentResult === 'success' ? ' active' : '') + '" onclick="markLaunchResult(' + index + ', \'success\')" style="' + (currentResult === 'success' ? 'background:rgba(34,197,94,0.2);color:#22c55e;border-color:#22c55e;' : '') + '">✅ 成功</button>' +
        '<button class="launch-result-btn' + (currentResult === 'partial' ? ' active' : '') + '" onclick="markLaunchResult(' + index + ', \'partial\')" style="' + (currentResult === 'partial' ? 'background:rgba(245,158,11,0.2);color:#f59e0b;border-color:#f59e0b;' : '') + '">⚠️ 部分</button>' +
        '<button class="launch-result-btn' + (currentResult === 'failure' ? ' active' : '') + '" onclick="markLaunchResult(' + index + ', \'failure\')" style="' + (currentResult === 'failure' ? 'background:rgba(239,68,68,0.2);color:#ef4444;border-color:#ef4444;' : '') + '">❌ 失败</button>' +
        '</div>';
}


