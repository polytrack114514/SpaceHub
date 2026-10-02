        // ==================== 火箭发射时间表 ====================
        let launches = [];
        let currentLaunchTab = 'upcoming';
        function renderLaunches() {
            const list = document.getElementById('launchList');
            const launchedList = document.getElementById('launchedList');
            if (!list) return;
            const now = Date.now();
            // 分离即将发射和已发射
            const upcoming = [];
            const launched = [];
            launches.forEach((l, i) => {
                if (l.status === 'tbd') {
                    // TBD 发射始终留在"近期发射"
                    upcoming.push({ data: l, origIndex: i });
                } else if (l.date - now <= 0) {
                    launched.push({ data: l, origIndex: i });
                } else {
                    upcoming.push({ data: l, origIndex: i });
                }
            });
            // 已发射按时间倒序，只保留前15个
            launched.sort((a, b) => b.data.date - a.data.date);
            if (launched.length > 15) {
                const toRemove = launched.slice(15);
                for (const item of toRemove) {
                    if (item.data.id) {
                        sb.from('launches').delete().eq('id', item.data.id).then(() => {}).catch(e => console.error('删除旧发射记录失败:', e));
                    }
                    const idx = launches.indexOf(item.data);
                    if (idx !== -1) launches.splice(idx, 1);
                }
                launched.length = 15;
            }
            // 渲染即将发射
            list.innerHTML = upcoming.length > 0 ? upcoming.map((item) => {
                const l = item.data;
                const i = item.origIndex;
                const diff = l.date - now;
                const isTBD = l.status === 'tbd';
                let badgeClass = 'badge-upcoming';
                let badgeText = '即将发射';
                if (isTBD) {
                    badgeClass = 'badge-tentative';
                    badgeText = '日期待定';
                } else {
                    if (l.status === 'tentative') {
                        badgeClass = 'badge-tentative';
                        badgeText = '待定';
                    }
                    if (diff > 0 && diff < 3 * 24 * 60 * 60 * 1000) {
                        badgeClass = 'badge-soon';
                        badgeText = '发射在即';
                    }
                }
                const dateStr = isTBD ? '发射日期待确定' : new Date(l.date).toLocaleString('zh-CN', {
                    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                let countdownHtml;
                let launchTime = isTBD ? 0 : new Date(l.date).getTime();
                if (isTBD) {
                    countdownHtml = `<div class="launch-countdown"><div class="launch-tbd-message">⏳ 发射日期待确定</div></div>`;
                } else {
                    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
                    const secs = Math.floor((diff % (60 * 1000)) / 1000);
                    countdownHtml = `
                        <div class="launch-countdown">
                            <div class="countdown-box">
                                <div class="countdown-num" id="cd-days-${i}">${days}</div>
                                <div class="countdown-label">天</div>
                            </div>
                            <div class="countdown-box">
                                <div class="countdown-num" id="cd-hours-${i}">${String(hours).padStart(2,'0')}</div>
                                <div class="countdown-label">时</div>
                            </div>
                            <div class="countdown-box">
                                <div class="countdown-num" id="cd-mins-${i}">${String(mins).padStart(2,'0')}</div>
                                <div class="countdown-label">分</div>
                            </div>
                            <div class="countdown-box">
                                <div class="countdown-num" id="cd-secs-${i}">${String(secs).padStart(2,'0')}</div>
                                <div class="countdown-label">秒</div>
                            </div>
                        </div>
                    `;
                }
                return `
                    <div class="launch-card ${!isTBD && diff > 0 && diff < 3 * 24 * 60 * 60 * 1000 ? 'launching-soon' : ''}">
                        <div class="launch-card-top">
                            <div class="launch-info">
                                <div class="launch-rocket">${l.rocket}</div>
                                <div class="launch-agency">${l.agency}</div>
                                <div class="launch-meta">
                                    <span>📅 ${dateStr}</span>
                                    <span>📍 ${l.location}</span>
                                    <span>🎯 ${l.mission}</span>
                                </div>
                            </div>
                            <span class="launch-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        ${countdownHtml}
                        ${l.image ? `<img src="${escapeHtml(l.image)}" class="launch-image" alt="发射图片" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ''}
                        <div class="launch-desc">${escapeHtml(l.description)}</div>
                        <div class="launch-card-actions">
                            <button class="launch-ai-btn" onclick="openAgnesAI(${i})">&#129302; Agnes-AI</button>
                            <button class="launch-notify-btn" id="notify-btn-${i}" onclick="toggleLaunchNotify(${i}, '${l.id}', '${escapeHtml(l.rocket)}', ${launchTime})">&#128276; 提醒</button>
                            ${currentUser && isOfficialUser(currentUser.name) ? `
                            <button class="launch-edit-btn" onclick="editLaunch(${i})">✏️ 编辑</button>
                            <button class="launch-delete-btn" onclick="deleteLaunch(${i})">🗑 删除</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('') : '<div class="empty-state"><div class="emoji">🚀</div><p>暂无即将发射的火箭</p></div>';
            // 渲染已发射
            if (launchedList) {
                launchedList.innerHTML = getLaunchStatsHtml() + (launched.length > 0 ? launched.map((item) => {
                    const l = item.data;
                    const i = item.origIndex;
                    const dateStr = new Date(l.date).toLocaleString('zh-CN', {
                        month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                    const ago = Date.now() - l.date;
                    const agoDays = Math.floor(ago / (24 * 60 * 60 * 1000));
                    const agoHours = Math.floor((ago % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                    const agoMins = Math.floor((ago % (60 * 60 * 1000)) / (60 * 1000));
                    let agoStr = '';
                    if (agoDays > 0) agoStr = `${agoDays}天${agoHours}小时前`;
                    else if (agoHours > 0) agoStr = `${agoHours}小时${agoMins}分钟前`;
                    else agoStr = `${agoMins}分钟前`;
                    return `
                        <div class="launch-card launched-card">
                            <div class="launch-card-top">
                                <div class="launch-info">
                                    <div class="launch-rocket">${l.rocket}</div>
                                    <div class="launch-agency">${l.agency}</div>
                                    <div class="launch-meta">
                                        <span>📅 ${dateStr}</span>
                                        <span>📍 ${l.location}</span>
                                        <span>🎯 ${l.mission}</span>
                                    </div>
                                </div>
                                <span class="launch-badge badge-launched">已发射</span>
                            </div>
                            <div class="launched-time">🚀 发射于 <strong>${agoStr}</strong></div>
                            ${getLaunchResultBadge(l.result)}
                            ${l.image ? `<img src="${escapeHtml(l.image)}" class="launch-image" alt="发射图片" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ''}
                            <div class="launch-desc">${escapeHtml(l.description)}</div>
                            ${getLaunchResultActions(i, true)}
                            <div class="launch-card-actions">
                                <button class="launch-ai-btn" onclick="openAgnesAI(${i})">&#129302; Agnes-AI</button>
                                ${currentUser && isOfficialUser(currentUser.name) ? `
                                <button class="launch-edit-btn" onclick="editLaunch(${i})">✏️ 编辑</button>
                                <button class="launch-delete-btn" onclick="deleteLaunch(${i})">🗑 删除</button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('') : '<div class="empty-state"><div class="emoji">🏁</div><p>暂无已发射的火箭</p></div>');
            }
        }
        // Tab 切换
        function updateLaunchTabs() {
            document.querySelectorAll('.launch-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.launchTab === currentLaunchTab);
            });
            const list = document.getElementById('launchList');
            const launchedList = document.getElementById('launchedList');
            if (list) list.style.display = currentLaunchTab === 'upcoming' ? '' : 'none';
            if (launchedList) launchedList.style.display = currentLaunchTab === 'launched' ? '' : 'none';
        }
        document.querySelectorAll('.launch-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentLaunchTab = tab.dataset.launchTab;
                updateLaunchTabs();
            });
        });
        function updateCountdowns() {
            const now = Date.now();
            let needRerender = false;
            launches.forEach((l, i) => {
                if (l.status === 'tbd') return; // 跳过TBD发射
                const diff = l.date - now;
                if (diff <= 0) {
                    needRerender = true;
                    return;
                }
                const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
                const secs = Math.floor((diff % (60 * 1000)) / 1000);
                const dEl = document.getElementById('cd-days-' + i);
                const hEl = document.getElementById('cd-hours-' + i);
                const mEl = document.getElementById('cd-mins-' + i);
                const sEl = document.getElementById('cd-secs-' + i);
                if (dEl) dEl.textContent = days;
                if (hEl) hEl.textContent = String(hours).padStart(2, '0');
                if (mEl) mEl.textContent = String(mins).padStart(2, '0');
                if (sEl) sEl.textContent = String(secs).padStart(2, '0');
            });
            if (needRerender) renderLaunches();
        }
        // ==================== 发射管理控件 ====================
        function renderLaunchControls() {
            const wrap = document.getElementById('launchControlsWrap');
            if (!wrap) return;
            wrap.innerHTML = '';
            if (currentUser && isOfficialUser(currentUser.name)) {
                wrap.innerHTML = '<button class="btn-add-launch" onclick="openLaunchEditor()">+ 添加发射</button>';
            }
        }
        // ==================== 发射编辑器 ====================
        let editingLaunchId = null;
        // ==================== 发射日期待确定开关 ====================
        function toggleLaunchDateTBD(checked) {
            const dateInput = document.getElementById('launchDate');
            dateInput.disabled = checked;
            if (checked) {
                dateInput.value = '';
            }
        }
        function openLaunchEditor() {
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
            setTimeout(() => document.getElementById('launchRocket').focus(), 100);
        }
        function closeLaunchEditor() {
            document.getElementById('launchModalOverlay').classList.remove('show');
            editingLaunchId = null;
        }
        function editLaunch(index) {
            const l = launches[index];
            if (!l) return;
            editingLaunchId = index;
            // 检查是否为TBD（发射日期待确定）
            const isEditTBD = l.status === 'tbd';
            document.getElementById('launchDateTBD').checked = isEditTBD;
            document.getElementById('launchDate').disabled = isEditTBD;
            // 转换时间为 datetime-local 格式
            if (isEditTBD) {
                document.getElementById('launchDate').value = '';
            } else {
                const d = new Date(l.date);
                const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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
        }
        async function submitLaunch() {
            if (!currentUser || !isOfficialUser(currentUser.name)) {
                alert('只有官方机构账号才能管理发射时间表');
                return;
            }
            const rocket = document.getElementById('launchRocket').value.trim();
            const agency = document.getElementById('launchAgency').value.trim();
            const dateStr = document.getElementById('launchDate').value;
            const location = document.getElementById('launchLocation').value.trim();
            const mission = document.getElementById('launchMission').value.trim();
            const image = document.getElementById('launchImage').value.trim();
            const desc = document.getElementById('launchDesc').value.trim();
            const isTBD = document.getElementById('launchDateTBD').checked;
            if (!rocket) { document.getElementById('launchRocket').focus(); return; }
            if (!isTBD && !dateStr) { document.getElementById('launchDate').focus(); return; }
            const btn = document.getElementById('launchSubmitBtn');
            btn.disabled = true;
            btn.textContent = '保存中...';
            const launchData = {
                rocket: rocket,
                agency: agency,
                date: isTBD ? null : new Date(dateStr).getTime(),
                location: location,
                mission: mission,
                image: image,
                description: desc,
                status: isTBD ? 'tbd' : 'tentative'
            };
            if (editingLaunchId !== null) {
                // 更新现有发射记录
                const existing = launches[editingLaunchId];
                const dbId = existing.id;
                const { error } = await sb.from('launches').update({
                    rocket: rocket, agency: agency, date: isTBD ? null : launchData.date,
                    location: location, mission: mission, image: image,
                    description: desc, status: isTBD ? 'tbd' : 'tentative'
                }).eq('id', dbId);
                if (error) { alert('保存失败: ' + error.message); btn.disabled = false; btn.textContent = '保存'; return; }
                launches[editingLaunchId] = { ...launchData, id: dbId };
            } else {
                // 新增发射记录
                const { data: inserted, error } = await sb.from('launches').insert({
                    rocket: rocket, agency: agency, date: isTBD ? null : launchData.date,
                    location: location, mission: mission, image: image,
                    description: desc, status: isTBD ? 'tbd' : 'tentative'
                }).select();
                if (error) { alert('保存失败: ' + error.message); btn.disabled = false; btn.textContent = '保存'; return; }
                if (inserted && inserted[0]) launches.push(inserted[0]);
            }
            // 按日期排序（TBD排到最后）
            launches.sort((a, b) => {
                if (a.status === 'tbd' && b.status !== 'tbd') return 1;
                if (a.status !== 'tbd' && b.status === 'tbd') return -1;
                return (a.date || 0) - (b.date || 0);
            });
            renderLaunches();
            btn.disabled = false;
            btn.textContent = '保存';
            closeLaunchEditor();
        }
        async function deleteLaunch(index) {
            if (!currentUser || !isOfficialUser(currentUser.name)) return;
            if (!confirm('确定要删除这条发射信息吗？')) return;
            const launch = launches[index];
            if (launch && launch.id) {
                const { error } = await sb.from('launches').delete().eq('id', launch.id);
                if (error) { alert('删除失败: ' + error.message); return; }
            }
            launches.splice(index, 1);
            renderLaunches();
        }
// 获取发射统计HTML
function getLaunchStatsHtml() {
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
    return '<div class="launch-stats">' +
        '<div class="launch-stat-item"><span class="launch-stat-num" style="color:#22c55e;">' + successCount + '</span><span class="launch-stat-label">成功</span></div>' +
        '<div class="launch-stat-item"><span class="launch-stat-num" style="color:#f59e0b;">' + partialCount + '</span><span class="launch-stat-label">部分成功</span></div>' +
        '<div class="launch-stat-item"><span class="launch-stat-num" style="color:#ef4444;">' + failCount + '</span><span class="launch-stat-label">失败</span></div>' +
        '<div class="launch-stat-item"><span class="launch-stat-num" style="color:var(--text-muted);">' + pendingCount + '</span><span class="launch-stat-label">待定</span></div>' +
        '</div>';
}

        renderLaunches();
        renderLaunchControls();
        setInterval(updateCountdowns, 1000);