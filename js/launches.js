/* ============================================================
   SpaceHub — js/launches.js
   发射时间表渲染、管理、结果记录
   ============================================================ */

/* `launches` 全局数组由 posts.js 声明，此处不再重复声明，避免重复定义报错 */
let currentLaunchTab = 'upcoming';
let editingLaunchId = null;

/* ---------- 渲染发射列表 ---------- */
window.renderLaunches = function() {
    var list = document.getElementById('launchList');
    var launchedList = document.getElementById('launchedList');
    if (!list) return;
    var now = Date.now();
    var upcoming = [];
    var launched = [];
    launches.forEach(function(l, i) {
        if (l.status === 'tbd') {
            upcoming.push({ data: l, origIndex: i });
        } else if (l.date - now <= 0) {
            launched.push({ data: l, origIndex: i });
        } else {
            upcoming.push({ data: l, origIndex: i });
        }
    });
    launched.sort(function(a, b) { return b.data.date - a.data.date; });
    if (launched.length > 15) {
        var toRemove = launched.slice(15);
        for (var idx = 0; idx < toRemove.length; idx++) {
            var item = toRemove[idx];
            var li = launches.indexOf(item.data);
            if (li !== -1) launches.splice(li, 1);
        }
        launched.length = 15;
        // 数据库清理交由 Edge Function（服务端权限），失败静默
        if (currentUser && getSessionToken()) {
            callEdgeFunction('launch-write', { action: 'prune' }).catch(function(e) {
                console.error('清理旧发射记录失败:', e);
            });
        }
    }

    list.innerHTML = upcoming.length > 0 ? upcoming.map(function(item) {
        var l = item.data;
        var i = item.origIndex;
        var diff = l.date - now;
        var isTBD = l.status === 'tbd';
        var badgeClass = 'badge-upcoming';
        var badgeText = '即将发射';
        if (isTBD) {
            badgeClass = 'badge-tentative';
            badgeText = '日期待定';
        } else {
            if (l.status === 'tentative') { badgeClass = 'badge-tentative'; badgeText = '待定'; }
            if (diff > 0 && diff < 3 * 24 * 60 * 60 * 1000) { badgeClass = 'badge-soon'; badgeText = '发射在即'; }
        }
        var dateStr = isTBD ? '发射日期待确定' : new Date(l.date).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        var countdownHtml;
        var launchTime = isTBD ? 0 : new Date(l.date).getTime();
        if (isTBD) {
            countdownHtml = '<div class="launch-countdown"><div class="launch-tbd-message">⏳ 发射日期待确定</div></div>';
        } else {
            var days = Math.floor(diff / (24 * 60 * 60 * 1000));
            var hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            var mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
            var secs = Math.floor((diff % (60 * 1000)) / 1000);
            countdownHtml = '<div class="launch-countdown">'
                + '<div class="countdown-box"><div class="countdown-num" id="cd-days-' + i + '">' + days + '</div><div class="countdown-label">天</div></div>'
                + '<div class="countdown-box"><div class="countdown-num" id="cd-hours-' + i + '">' + String(hours).padStart(2, '0') + '</div><div class="countdown-label">时</div></div>'
                + '<div class="countdown-box"><div class="countdown-num" id="cd-mins-' + i + '">' + String(mins).padStart(2, '0') + '</div><div class="countdown-label">分</div></div>'
                + '<div class="countdown-box"><div class="countdown-num" id="cd-secs-' + i + '">' + String(secs).padStart(2, '0') + '</div><div class="countdown-label">秒</div></div>'
                + '</div>';
        }
        return '<div class="launch-card' + (!isTBD && diff > 0 && diff < 3 * 24 * 60 * 60 * 1000 ? ' launching-soon' : '') + '">'
            + '<div class="launch-card-top">'
            + '<div class="launch-info">'
            + '<div class="launch-rocket">' + escapeHtml(l.rocket) + '</div>'
            + '<div class="launch-agency">' + escapeHtml(l.agency) + '</div>'
            + '<div class="launch-meta"><span>📅 ' + dateStr + '</span><span>📍 ' + escapeHtml(l.location) + '</span><span>🎯 ' + escapeHtml(l.mission) + '</span></div>'
            + '</div>'
            + '<span class="launch-badge ' + badgeClass + '">' + badgeText + '</span>'
            + '</div>'
            + countdownHtml
            + (l.image ? '<img src="' + escapeHtml(l.image) + '" class="launch-image" alt="发射图片" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : '')
            + '<div class="launch-desc">' + escapeHtml(l.description) + '</div>'
            + '<div class="launch-card-actions">'
            + '<button class="launch-ai-btn" onclick="openAgnesAI(' + i + ')">&#129302; Agnes-AI</button>'
            + '<button class="launch-notify-btn" id="notify-btn-' + i + '" onclick="toggleLaunchNotify(' + i + ", '" + escapeHtml(l.id) + "', '" + escapeHtml(l.rocket) + "', " + launchTime + ')">&#128276; 提醒</button>'
            + (currentUser && isOfficialUser(currentUser.name) ? '<button class="launch-edit-btn" onclick="editLaunch(' + i + ')">✏️ 编辑</button><button class="launch-delete-btn" onclick="deleteLaunch(' + i + ')">🗑 删除</button>' : '')
            + '</div></div>';
    }).join('') : '<div class="empty-state"><div class="emoji">🚀</div><p>暂无即将发射的火箭</p></div>';

    if (launchedList) {
        launchedList.innerHTML = getLaunchStatsHtml() + (launched.length > 0 ? launched.map(function(item) {
            var l = item.data;
            var i = item.origIndex;
            var dateStr = new Date(l.date).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            var ago = Date.now() - l.date;
            var agoDays = Math.floor(ago / (24 * 60 * 60 * 1000));
            var agoHours = Math.floor((ago % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            var agoMins = Math.floor((ago % (60 * 60 * 1000)) / (60 * 1000));
            var agoStr = agoDays > 0 ? agoDays + '天' + agoHours + '小时前' : agoHours > 0 ? agoHours + '小时' + agoMins + '分钟前' : agoMins + '分钟前';
            return '<div class="launch-card launched-card">'
                + '<div class="launch-card-top">'
                + '<div class="launch-info">'
                + '<div class="launch-rocket">' + escapeHtml(l.rocket) + '</div>'
                + '<div class="launch-agency">' + escapeHtml(l.agency) + '</div>'
                + '<div class="launch-meta"><span>📅 ' + dateStr + '</span><span>📍 ' + escapeHtml(l.location) + '</span><span>🎯 ' + escapeHtml(l.mission) + '</span></div>'
                + '</div>'
                + '<span class="launch-badge badge-launched">已发射</span>'
                + '</div>'
                + '<div class="launched-time">🚀 发射于 <strong>' + agoStr + '</strong></div>'
                + getLaunchResultBadge(l.result)
                + (l.image ? '<img src="' + escapeHtml(l.image) + '" class="launch-image" alt="发射图片" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : '')
                + '<div class="launch-desc">' + escapeHtml(l.description) + '</div>'
                + getLaunchResultActions(i, true)
                + '<div class="launch-card-actions">'
                + '<button class="launch-ai-btn" onclick="openAgnesAI(' + i + ')">&#129302; Agnes-AI</button>'
                + (currentUser && isOfficialUser(currentUser.name) ? '<button class="launch-edit-btn" onclick="editLaunch(' + i + ')">✏️ 编辑</button><button class="launch-delete-btn" onclick="deleteLaunch(' + i + ')">🗑 删除</button>' : '')
                + '</div></div>';
        }).join('') : '<div class="empty-state"><div class="emoji">🏁</div><p>暂无已发射的火箭</p></div>');
    }
};

/* ---------- 发射 Tab 切换 ---------- */
window.updateLaunchTabs = function() {
    document.querySelectorAll('.launch-tab').forEach(function(tab) {
        tab.classList.toggle('active', tab.dataset.launchTab === currentLaunchTab);
    });
    var list = document.getElementById('launchList');
    var launchedList = document.getElementById('launchedList');
    if (list) list.style.display = currentLaunchTab === 'upcoming' ? '' : 'none';
    if (launchedList) launchedList.style.display = currentLaunchTab === 'launched' ? '' : 'none';
};

document.querySelectorAll('.launch-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
        currentLaunchTab = tab.dataset.launchTab;
        updateLaunchTabs();
    });
});

/* ---------- 倒计时更新 ---------- */
window.updateCountdowns = function() {
    var now = Date.now();
    var needRerender = false;
    launches.forEach(function(l, i) {
        if (l.status === 'tbd') return;
        var diff = l.date - now;
        if (diff <= 0) { needRerender = true; return; }
        var days = Math.floor(diff / (24 * 60 * 60 * 1000));
        var hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        var mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        var secs = Math.floor((diff % (60 * 1000)) / 1000);
        var dEl = document.getElementById('cd-days-' + i);
        var hEl = document.getElementById('cd-hours-' + i);
        var mEl = document.getElementById('cd-mins-' + i);
        var sEl = document.getElementById('cd-secs-' + i);
        if (dEl) dEl.textContent = days;
        if (hEl) hEl.textContent = String(hours).padStart(2, '0');
        if (mEl) mEl.textContent = String(mins).padStart(2, '0');
        if (sEl) sEl.textContent = String(secs).padStart(2, '0');
    });
    if (needRerender) renderLaunches();
};

/* ---------- 发射管理控件 ---------- */
window.renderLaunchControls = function() {
    var wrap = document.getElementById('launchControlsWrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (currentUser && isOfficialUser(currentUser.name)) {
        wrap.innerHTML = '<button class="btn-add-launch" onclick="openLaunchEditor()">+ 添加发射</button>';
    }
};

/* ---------- 发射编辑器 ---------- */
window.toggleLaunchDateTBD = function(checked) {
    var dateInput = document.getElementById('launchDate');
    dateInput.disabled = checked;
    if (checked) dateInput.value = '';
};

window.openLaunchEditor = function() {
    editingLaunchId = null;
    document.getElementById('launchRocket').value = '';
    document.getElementById('launchAgency').value = '';
    document.getElementById('launchDate').value = '';
    document.getElementById('launchDateTBD').checked = false;
    document.getElementById('launchDate').disabled = false;
    document.getElementById('launchLocation').value = '';
    document.getElementById('launchMission').value = '';
    document.getElementById('launchImage').value = '';
    document.getElementById('launchDesc').value = '';
    document.getElementById('launchModalTitle').textContent = '添加火箭发射';
    document.getElementById('launchModalOverlay').classList.add('show');
    setTimeout(function() { document.getElementById('launchRocket').focus(); }, 100);
};

window.closeLaunchEditor = function() {
    document.getElementById('launchModalOverlay').classList.remove('show');
    editingLaunchId = null;
};

window.editLaunch = function(index) {
    var l = launches[index];
    if (!l) return;
    editingLaunchId = index;
    var isEditTBD = l.status === 'tbd';
    document.getElementById('launchDateTBD').checked = isEditTBD;
    document.getElementById('launchDate').disabled = isEditTBD;
    if (isEditTBD) {
        document.getElementById('launchDate').value = '';
    } else {
        var d = new Date(l.date);
        var localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('launchDate').value = localISO;
    }
    document.getElementById('launchRocket').value = l.rocket || '';
    document.getElementById('launchAgency').value = l.agency || '';
    document.getElementById('launchLocation').value = l.location || '';
    document.getElementById('launchMission').value = l.mission || '';
    document.getElementById('launchImage').value = l.image || '';
    document.getElementById('launchDesc').value = l.description || '';
    document.getElementById('launchModalTitle').textContent = '编辑火箭发射';
    document.getElementById('launchModalOverlay').classList.add('show');
};

window.submitLaunch = async function() {
    if (!currentUser || !isOfficialUser(currentUser.name)) {
        alert('只有官方机构账号才能管理发射时间表');
        return;
    }
    var rocket = document.getElementById('launchRocket').value.trim();
    var agency = document.getElementById('launchAgency').value.trim();
    var dateStr = document.getElementById('launchDate').value;
    var location = document.getElementById('launchLocation').value.trim();
    var mission = document.getElementById('launchMission').value.trim();
    var image = document.getElementById('launchImage').value.trim();
    var desc = document.getElementById('launchDesc').value.trim();
    var isTBD = document.getElementById('launchDateTBD').checked;
    if (!rocket) { document.getElementById('launchRocket').focus(); return; }
    if (!isTBD && !dateStr) { document.getElementById('launchDate').focus(); return; }
    var btn = document.getElementById('launchSubmitBtn');
    btn.disabled = true;
    btn.textContent = '保存中...';
    try {
        var dateValue = isTBD ? null : new Date(dateStr).getTime();
        var result;
        if (editingLaunchId !== null) {
            result = await callEdgeFunction('launch-write', {
                action: 'update',
                id: launches[editingLaunchId].id,
                rocket: rocket,
                agency: agency,
                date: dateValue,
                location: location,
                mission: mission,
                image: image,
                description: desc,
                status: isTBD ? 'tbd' : 'scheduled'
            });
        } else {
            result = await callEdgeFunction('launch-write', {
                action: 'create',
                rocket: rocket,
                agency: agency,
                date: dateValue,
                location: location,
                mission: mission,
                image: image,
                description: desc,
                status: isTBD ? 'tbd' : 'scheduled'
            });
        }
        if (!result.ok) throw new Error(result.error || '保存失败');
        closeLaunchEditor();
        loadLaunches();
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
    btn.disabled = false;
    btn.textContent = '保存';
};

window.deleteLaunch = async function(index) {
    if (!confirm('确定要删除这条发射记录吗？')) return;
    var l = launches[index];
    if (!l || !l.id) return;
    try {
        var result = await callEdgeFunction('launch-write', { action: 'delete', id: l.id });
        if (!result.ok) throw new Error(result.error || '删除失败');
        launches.splice(index, 1);
        renderLaunches();
    } catch (e) {
        alert('删除失败: ' + e.message);
    }
};

/* ---------- 发射结果标记（通过 launch-write Edge Function） ---------- */
window.markLaunchResult = async function(index, result) {
    if (!currentUser || !isOfficialUser(currentUser.name)) {
        alert('只有官方机构账号才能标记发射结果');
        return;
    }
    var launch = launches[index];
    if (!launch || !launch.id) return;
    var newResult = launch.result === result ? 'pending' : result;
    try {
        var res = await callEdgeFunction('launch-write', {
            action: 'mark_result',
            id: launch.id,
            result: newResult
        });
        if (!res.ok) throw new Error(res.error || '标记失败');
        launch.result = newResult;
        renderLaunches();
    } catch (e) {
        alert('标记失败: ' + e.message);
    }
};

/* ---------- 发射结果徽章 ---------- */
window.getLaunchResultBadge = function(result) {
    if (!result || result === 'pending') return '';
    var resultMap = {
        'success': { text: '✅ 发射成功', class: 'launch-result-success' },
        'failure': { text: '❌ 发射失败', class: 'launch-result-fail' },
        'partial': { text: '⚠️ 部分成功', class: 'launch-result-partial' }
    };
    var info = resultMap[result];
    if (!info) return '';
    return '<span class="launch-result-badge ' + info.class + '">' + info.text + '</span>';
};

window.getLaunchResultActions = function(index, isLaunched) {
    if (!currentUser || !isOfficialUser(currentUser.name) || !isLaunched) return '';
    var launch = launches[index];
    if (!launch) return '';
    var currentResult = launch.result || 'pending';
    return '<div class="launch-result-actions">'
        + '<button class="launch-result-btn' + (currentResult === 'success' ? ' active' : '') + '" onclick="markLaunchResult(' + index + ', \'success\')" style="' + (currentResult === 'success' ? 'background:rgba(34,197,94,0.2);color:#22c55e;border-color:#22c55e;' : '') + '">✅ 成功</button>'
        + '<button class="launch-result-btn' + (currentResult === 'partial' ? ' active' : '') + '" onclick="markLaunchResult(' + index + ', \'partial\')" style="' + (currentResult === 'partial' ? 'background:rgba(245,158,11,0.2);color:#f59e0b;border-color:#f59e0b;' : '') + '">⚠️ 部分</button>'
        + '<button class="launch-result-btn' + (currentResult === 'failure' ? ' active' : '') + '" onclick="markLaunchResult(' + index + ', \'failure\')" style="' + (currentResult === 'failure' ? 'background:rgba(239,68,68,0.2);color:#ef4444;border-color:#ef4444;' : '') + '">❌ 失败</button>'
        + '</div>';
};

window.getLaunchStatsHtml = function() {
    var successCount = 0, failCount = 0, partialCount = 0, pendingCount = 0;
    var now = Date.now();
    launches.forEach(function(l) {
        if (l.status === 'tbd') return;
        if (l.date && l.date < now) {
            var r = l.result || 'pending';
            if (r === 'success') successCount++;
            else if (r === 'failure') failCount++;
            else if (r === 'partial') partialCount++;
            else pendingCount++;
        }
    });
    var total = successCount + failCount + partialCount;
    if (total === 0 && pendingCount === 0) return '';
    return '<div class="launch-stats">'
        + '<div class="launch-stat-item"><span class="launch-stat-num" style="color:#22c55e;">' + successCount + '</span><span class="launch-stat-label">成功</span></div>'
        + '<div class="launch-stat-item"><span class="launch-stat-num" style="color:#f59e0b;">' + partialCount + '</span><span class="launch-stat-label">部分成功</span></div>'
        + '<div class="launch-stat-item"><span class="launch-stat-num" style="color:#ef4444;">' + failCount + '</span><span class="launch-stat-label">失败</span></div>'
        + '<div class="launch-stat-item"><span class="launch-stat-num" style="color:var(--text-muted);">' + pendingCount + '</span><span class="launch-stat-label">待定</span></div>'
        + '</div>';
};

/* ---------- 发射提醒（localStorage + 浏览器通知） ---------- */
window.getLaunchReminders = function() {
    try { return JSON.parse(localStorage.getItem('launch_reminders') || '[]'); } catch(e) { return []; }
};
window.saveLaunchReminders = function(list) {
    localStorage.setItem('launch_reminders', JSON.stringify(list));
};
window.toggleLaunchNotify = function(index, launchId, rocketName, launchTime) {
    if (!launchTime || launchTime === 0) {
        alert('该发射日期未确定，无法设置提醒');
        return;
    }
    var reminders = getLaunchReminders();
    var idx = reminders.findIndex(function(r) { return r.launchId === launchId; });
    var btn = document.getElementById('notify-btn-' + index);
    if (idx >= 0) {
        reminders.splice(idx, 1);
        saveLaunchReminders(reminders);
        if (btn) { btn.classList.remove('active'); btn.innerHTML = '🔔 提醒'; }
    } else {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        reminders.push({ launchId: launchId, rocket: rocketName, launchTime: launchTime, notified1h: false, notified10m: false });
        saveLaunchReminders(reminders);
        if (btn) { btn.classList.add('active'); btn.innerHTML = '✅ 已设提醒'; }
        var launchDate = new Date(launchTime);
        var dateStr = launchDate.toLocaleDateString('zh-CN') + ' ' + launchDate.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
        alert('✅ 已设置提醒！\n火箭：' + rocketName + '\n发射时间：' + dateStr + '\n\n发射前1小时和10分钟会推送浏览器通知。');
    }
};
var launchNotifyTimer = null;
window.startLaunchNotifyChecker = function() {
    if (launchNotifyTimer) clearInterval(launchNotifyTimer);
    launchNotifyTimer = setInterval(function() {
        var reminders = getLaunchReminders();
        var now = Date.now();
        var changed = false;
        for (var i = 0; i < reminders.length; i++) {
            var r = reminders[i];
            var diff = r.launchTime - now;
            if (diff <= 0) continue;
            if (!r.notified1h && diff <= 3600000 && diff > 600000) {
                r.notified1h = true; changed = true;
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('🔔 发射提醒 (1小时后)', { body: r.rocket + ' 将在1小时后发射！' });
                }
            }
            if (!r.notified10m && diff <= 600000 && diff > 0) {
                r.notified10m = true; changed = true;
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('🔔 发射提醒 (10分钟后)', { body: r.rocket + ' 将在10分钟后发射！准备观看！' });
                }
            }
        }
        if (changed) saveLaunchReminders(reminders);
    }, 30000);
};
