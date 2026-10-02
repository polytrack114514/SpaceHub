// ==================== 发射提醒 ====================
function getLaunchReminders() {
    try { return JSON.parse(localStorage.getItem('launch_reminders') || '[]'); } catch(e) { return []; }
}
function saveLaunchReminders(list) {
    localStorage.setItem('launch_reminders', JSON.stringify(list));
}
function toggleLaunchNotify(i, launchId, rocketName, launchTime) {
    if (!launchTime || launchTime === 0) {
        alert('\u8be5\u53d1\u5c04\u65e5\u671f\u672a\u786e\u5b9a\uff0c\u65e0\u6cd5\u8bbe\u7f6e\u63d0\u9192');
        return;
    }
    var reminders = getLaunchReminders();
    var idx = reminders.findIndex(function(r) { return r.launchId === launchId; });
    var btn = document.getElementById('notify-btn-' + i);
    if (idx >= 0) {
        reminders.splice(idx, 1);
        saveLaunchReminders(reminders);
        if (btn) { btn.classList.remove('active'); btn.innerHTML = '\ud83d\udd14 \u63d0\u9192'; }
    } else {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        reminders.push({ launchId: launchId, rocket: rocketName, launchTime: launchTime, notified1h: false, notified10m: false });
        saveLaunchReminders(reminders);
        if (btn) { btn.classList.add('active'); btn.innerHTML = '\u2705 \u5df2\u8bbe\u63d0\u9192'; }
        var launchDate = new Date(launchTime);
        var dateStr = launchDate.toLocaleDateString('zh-CN') + ' ' + launchDate.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
        alert('\u2705 \u5df2\u8bbe\u7f6e\u63d0\u9192\uff01\n\u706b\u7bad\uff1a' + rocketName + '\n\u53d1\u5c04\u65f6\u95f4\uff1a' + dateStr + '\n\n\u53d1\u5c04\u524d1\u5c0f\u65f6\u548c10\u5206\u949f\u4f1a\u63a8\u9001\u6d4f\u89c8\u5668\u901a\u77e5\u3002');
    }
}
var launchNotifyTimer = null;
function startLaunchNotifyChecker() {
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
                    new Notification('\ud83d\udd14 \u53d1\u5c04\u63d0\u9192 (1\u5c0f\u65f6\u540e)', { body: r.rocket + ' \u5c06\u57281\u5c0f\u65f6\u540e\u53d1\u5c04\uff01' });
                }
            }
            if (!r.notified10m && diff <= 600000 && diff > 0) {
                r.notified10m = true; changed = true;
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('\ud83d\udd14 \u53d1\u5c04\u63d0\u9192 (10\u5206\u949f\u540e)', { body: r.rocket + ' \u5c06\u572810\u5206\u949f\u540e\u53d1\u5c04\uff01\u51c6\u5907\u89c2\u770b\uff01' });
                }
            }
        }
        if (changed) saveLaunchReminders(reminders);
    }, 30000);
}


// ==================== 初始化新功能 ====================
// Load APOD on page load
loadAPOD();
loadSiteSettings();
// Online users heartbeat
if (currentUser) {
    updateLastActive();
    setInterval(updateLastActive, 30000);
}
loadOnlineUsers();
setInterval(loadOnlineUsers, 30000);

// ==================== 太空数据中心 ====================
function openSpaceDataModal() {
    document.getElementById('spaceDataModal').classList.add('show');
    switchSDTab('iss', document.querySelector('.sd-tab'));
}
function closeSpaceDataModal() {
    var f = document.getElementById('nasaEyesFrame'); if (f && f.src !== 'about:blank') { f.src = 'about:blank'; }
    document.getElementById('spaceDataModal').classList.remove('show');
    stopISSTracking();
    
}
function switchSDTab(tab, btn) {
    document.querySelectorAll('.sd-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.sd-panel').forEach(function(p) { p.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var panel = document.getElementById('sdPanel-' + tab);
    if (panel) panel.classList.add('active');
    stopISSTracking();
    if (tab === 'iss') { startISSTracking(); }
        else if (tab === 'moon') { renderMoonPhase(); }
    else if (tab === 'asteroids') { loadAsteroids(); }
    else if (tab === 'crew') { loadISSCrew(); }
    else if (tab === 'meteors') { renderMeteorShowers(); }
    else if (tab === 'eclipses') { renderEclipses(); }
    else if (tab === 'launches') { loadLaunchData(); }
    else if (tab === 'nasaeys') {
        var frame = document.getElementById('nasaEyesFrame');
        if (frame && frame.src === 'about:blank') {
            frame.src = 'https://eyes.nasa.gov/apps/solar-system/#/home?embed=true';
        }
    }
}
var issTimer = null;
var issTrack = [];
async function loadISSData() {
    try {
        var resp = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        if (!resp.ok) throw new Error('ISS API error: ' + resp.status);
        var data = await resp.json();
        var lat = data.latitude, lng = data.longitude, alt = data.altitude, vel = data.velocity;
        var el = document.getElementById('issLat'); if (el) el.textContent = lat.toFixed(2) + ' deg';
        el = document.getElementById('issLng'); if (el) el.textContent = lng.toFixed(2) + ' deg';
        el = document.getElementById('issAlt'); if (el) el.textContent = alt.toFixed(1) + ' km';
        el = document.getElementById('issVel'); if (el) el.textContent = (vel / 3600).toFixed(2) + ' km/s';
        var x = ((lng + 180) / 360) * 100;
        var y = ((90 - lat) / 180) * 100;
        var marker = document.getElementById('issMarker');
        if (marker) { marker.style.left = x + '%'; marker.style.top = y + '%'; }
        issTrack.push({ x: x, y: y });
        if (issTrack.length > 30) issTrack.shift();
        renderISSTrack();
    } catch(e) {
        console.error('ISS data error:', e);
        var el2 = document.getElementById('issLat'); if (el2) el2.textContent = '获取失败';
    }
}
function renderISSTrack() {
    var trackEl = document.getElementById('issTrack');
    if (!trackEl) return;
    var html = '';
    for (var i = 0; i < issTrack.length; i++) {
        var p = issTrack[i];
        var op = (i / issTrack.length) * 0.4;
        html += '<div style="position:absolute;left:' + p.x + '%;top:' + p.y + '%;width:3px;height:3px;background:rgba(91,143,255,' + op + ');border-radius:50%;transform:translate(-50%,-50%);"></div>';
    }
    trackEl.innerHTML = html;
}
function startISSTracking() { if (issTimer) return; loadISSData(); issTimer = setInterval(loadISSData, 5000); }
function stopISSTracking() { if (issTimer) { clearInterval(issTimer); issTimer = null; } }
// ==================== 月相计算 ====================
function renderMoonPhase() {
    var panel = document.getElementById('moonPanel');
    if (!panel) return;
    var now = new Date();
    var knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    var synodicMonth = 29.530588853;
    var diffDays = (now.getTime() - knownNewMoon) / 86400000;
    var age = diffDays % synodicMonth;
    if (age < 0) age += synodicMonth;
    var phase = age / synodicMonth;
    var illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    var illumPct = Math.round(illum * 100);
    var phaseName, phaseEmoji;
    if (phase < 0.03 || phase > 0.97) { phaseName = '新月'; phaseEmoji = '\ud83c\udf11'; }
    else if (phase < 0.22) { phaseName = '蛾眉月'; phaseEmoji = '\ud83c\udf12'; }
    else if (phase < 0.28) { phaseName = '上弦月'; phaseEmoji = '\ud83c\udf13'; }
    else if (phase < 0.47) { phaseName = '盈凸月'; phaseEmoji = '\ud83c\udf14'; }
    else if (phase < 0.53) { phaseName = '满月'; phaseEmoji = '\ud83c\udf15'; }
    else if (phase < 0.72) { phaseName = '亏凸月'; phaseEmoji = '\ud83c\udf16'; }
    else if (phase < 0.78) { phaseName = '下弦月'; phaseEmoji = '\ud83c\udf17'; }
    else { phaseName = '残月'; phaseEmoji = '\ud83c\udf18'; }
    var nextNewAge = synodicMonth - age;
    var nextFullAge = (phase < 0.5) ? (0.5 * synodicMonth - age) : (1.5 * synodicMonth - age);
    var nextNewDays = Math.round(nextNewAge);
    var nextFullDays = Math.round(nextFullAge);
    var r = 70, cx = 80, cy = 80;
    var moonPath;
    if (phase < 0.5) {
        var x = r * Math.cos(2 * Math.PI * phase);
        moonPath = 'M ' + cx + ',' + (cy - r) + ' A ' + r + ',' + r + ' 0 0 1 ' + cx + ',' + (cy + r) + ' A ' + Math.abs(x) + ',' + r + ' 0 0 ' + (x > 0 ? 1 : 0) + ' ' + cx + ',' + (cy - r) + ' Z';
    } else {
        var x2 = r * Math.cos(2 * Math.PI * (phase - 0.5));
        moonPath = 'M ' + cx + ',' + (cy - r) + ' A ' + r + ',' + r + ' 0 0 0 ' + cx + ',' + (cy + r) + ' A ' + Math.abs(x2) + ',' + r + ' 0 0 ' + (x2 > 0 ? 0 : 1) + ' ' + cx + ',' + (cy - r) + ' Z';
    }
    var html = '<div class="moon-visual">';
    html += '<svg class="moon-svg" viewBox="0 0 160 160">';
    html += '<defs><radialGradient id="moonLit" cx="35%" cy="35%"><stop offset="0%" stop-color="#f0f0e8"/><stop offset="70%" stop-color="#c8c8c0"/><stop offset="100%" stop-color="#888880"/></radialGradient></defs>';
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#1a1a28"/>';
    html += '<path d="' + moonPath + '" fill="url(#moonLit)"/>';
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(91,143,255,0.15)" stroke-width="0.5"/>';
    html += '</svg>';
    html += '</div>';
    html += '<div class="moon-info">';
    html += '<div class="moon-phase-name">' + phaseEmoji + ' ' + phaseName + '</div>';
    html += '<div class="moon-illum">照明: ' + illumPct + '%</div>';
    html += '<div class="moon-age">月龄: ' + age.toFixed(1) + ' 天</div>';
    html += '<div class="moon-extra">';
    html += '<div class="iss-info-item"><div class="iss-info-label">下次满月</div><div class="iss-info-value" style="font-size:0.9rem;">' + nextFullDays + ' 天后</div></div>';
    html += '<div class="iss-info-item"><div class="iss-info-label">下次新月</div><div class="iss-info-value" style="font-size:0.9rem;">' + nextNewDays + ' 天后</div></div>';
    html += '</div>';
    html += '<div style="margin-top:12px;font-size:0.72rem;color:#445566;">计算时间: ' + now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN') + '</div>';
    html += '</div>';
    panel.innerHTML = html;
}

// ==================== 近地小行星 ====================
var asteroidLoaded = false;
async function loadAsteroids() {
    var panel = document.getElementById('asteroidPanel');
    if (!panel) return;
    if (asteroidLoaded) return;
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">\ud83d\udc7e 加载近地小行星数据...</div>';
    var today = new Date().toISOString().slice(0, 10);
    var cacheKey = 'asteroid_cache_' + today;
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch(e) {}
    if (cached && cached.neos) {
        renderAsteroids(panel, cached.neos, cached.element_count);
        asteroidLoaded = true;
        return;
    }
    try {
        var data = await nasaGetJSON('https://api.nasa.gov/neo/rest/v1/feed?start_date=' + today + '&end_date=' + today + '&api_key=' + NASA_API_KEY);
        var neos = data.near_earth_objects[today] || [];
        try { localStorage.setItem(cacheKey, JSON.stringify({ neos: neos, element_count: data.element_count || neos.length })); } catch(e) {}
        renderAsteroids(panel, neos, data.element_count || neos.length);
        asteroidLoaded = true;
    } catch(e) {
        console.error('Asteroid load error:', e);
        var emsg = (e && e.message === 'RATE_LIMIT') ? 'NASA API 请求次数已达上限，请稍后再试' : ((e && e.message) || '加载失败');
        var retryHtml = '<div style="text-align:center;padding:40px;color:#ff4060;">\u26a0\ufe0f ' + escapeHtml(emsg) + '<br><button onclick="asteroidLoaded=false;loadAsteroids()" style="margin-top:12px;padding:8px 20px;background:rgba(91,143,255,0.15);border:1px solid rgba(91,143,255,0.3);color:#5b8fff;border-radius:8px;cursor:pointer;">重试</button></div>';
        var oldCache = null;
        for (var i = 0; i < 7; i++) {
            var d = new Date(); d.setDate(d.getDate() - i);
            var key = 'asteroid_cache_' + d.toISOString().slice(0, 10);
            try { oldCache = JSON.parse(localStorage.getItem(key)); } catch(e2) {}
            if (oldCache && oldCache.neos && oldCache.neos.length > 0) break;
        }
        if (oldCache && oldCache.neos && oldCache.neos.length > 0) {
            retryHtml = '<div style="text-align:center;padding:12px;font-size:0.72rem;color:#ffaa00;background:rgba(255,170,0,0.08);border-radius:8px;margin-bottom:8px;">\u26a0\ufe0f API 限流，显示缓存数据</div>';
            renderAsteroids(panel, oldCache.neos, oldCache.element_count, retryHtml);
            asteroidLoaded = true;
        } else {
            panel.innerHTML = retryHtml;
        }
    }
}

function renderAsteroids(panel, neos, totalCount, prefixHtml) {
    var hazardousCount = neos.filter(function(n) { return n.is_potentially_hazardous_asteroid; }).length;
    var html = prefixHtml || '';
    html += '<div class="asteroid-header-info">\u2604\ufe0f 今日近地小行星: <strong style="color:#5b8fff;">' + neos.length + '</strong> 颗 | 潜在危险: <strong style="color:' + (hazardousCount > 0 ? '#ff4060' : '#40ff88') + ';">' + hazardousCount + '</strong> 颗</div>';
    neos.sort(function(a, b) {
        var da = parseFloat(a.close_approach_data[0].miss_distance.kilometers);
        var db = parseFloat(b.close_approach_data[0].miss_distance.kilometers);
        return da - db;
    });
    for (var i = 0; i < Math.min(neos.length, 12); i++) {
        var n = neos[i];
        var approach = n.close_approach_data[0];
        var distKm = parseFloat(approach.miss_distance.kilometers);
        var distLD = parseFloat(approach.miss_distance.lunar);
        var vel = parseFloat(approach.relative_velocity.kilometers_per_hour);
        var minD = parseFloat(n.estimated_diameter.meters.estimated_diameter_min);
        var maxD = parseFloat(n.estimated_diameter.meters.estimated_diameter_max);
        var isHazard = n.is_potentially_hazardous_asteroid;
        var distStr = distKm > 1000000 ? (distKm / 1000000).toFixed(2) + ' M km' : Math.round(distKm).toLocaleString() + ' km';
        html += '<div class="asteroid-card">';
        html += '<div class="asteroid-name">' + escapeHtml(n.name);
        html += '<span class="asteroid-danger ' + (isHazard ? 'hazardous' : 'safe') + '">' + (isHazard ? '潜在危险' : '安全') + '</span></div>';
        html += '<div class="asteroid-grid">';
        html += '<div class="asteroid-stat">距离: <strong>' + distStr + '</strong></div>';
        html += '<div class="asteroid-stat">月球距离: <strong>' + distLD.toFixed(2) + ' LD</strong></div>';
        html += '<div class="asteroid-stat">直径: <strong>' + minD.toFixed(0) + '-' + maxD.toFixed(0) + ' m</strong></div>';
        html += '<div class="asteroid-stat">速度: <strong>' + (vel / 3600).toFixed(2) + ' km/s</strong></div>';
        html += '</div></div>';
    }
    if (neos.length === 0) {
        html += '<div style="text-align:center;padding:30px;color:#667788;">今日没有近地小行星接近数据</div>';
    }
    html += '<div style="text-align:center;margin-top:8px;font-size:0.68rem;color:#445566;">数据来源: NASA NeoWS API</div>';
    panel.innerHTML = html;
}

// ==================== 🚀 发射任务详情 (Launch Library 2) ====================
var launchesLoaded = false;
async function loadLaunchData() {
    var panel = document.getElementById('launchPanel');
    if (!panel) return;
    if (launchesLoaded) return;
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">🚀 加载发射任务...</div>';
    var today = new Date().toISOString().slice(0, 10);
    var cacheKey = 'launches_cache_' + today;
    try { var cached = JSON.parse(localStorage.getItem(cacheKey)); if (cached) { renderLaunchData(panel, cached); return; } } catch(e) {}
    try {
        var resp = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=12&network__name=NASA&net_score_min=50&pretty=true');
        if (!resp.ok) throw new Error('Launch Library API error: ' + resp.status);
        var data = await resp.json();
        var launches = (data.results || []);
        // If no NASA results, try broader query
        if (launches.length === 0) {
            var resp2 = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=12&pretty=true');
            if (resp2.ok) { var d2 = await resp2.json(); launches = d2.results || []; }
        }
        try { localStorage.setItem(cacheKey, JSON.stringify(launches)); } catch(e) {}
        renderLaunchData(panel, launches);
        launchesLoaded = true;
    } catch(e) {
        panel.innerHTML = '<div style="text-align:center;padding:40px;color:#ff4060;">⚠️ ' + escapeHtml(e.message) + '</div>';
    }
}
function renderLaunchData(panel, launches) {
    if (!launches || launches.length === 0) {
        panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">暂无即将发射的任务</div>';
        return;
    }
    var html = '';
    for (var i = 0; i < launches.length; i++) {
        var lv = launches[i];
        var name = lv.name || '未命名任务';
        var lsp = (lv.launch_service_provider || {}).name || '未知机构';
        var vehicle = ((lv.rocket || {}).configuration || {}).name || (lv.pad || {}).name || '';
        var windowStart = lv.window_start || lv.net || '';
        var dateStr = windowStart ? new Date(windowStart).toLocaleString('zh-CN', {timeZone:'UTC'}) : '';
        var isToday = windowStart && windowStart.slice(0,10) === new Date().toISOString().slice(0,10);
        var statusColor = isToday ? '#40ff88' : '#667788';
        var statusText = isToday ? '今日发射' : '计划中';
        html += '<div style="background:rgba(91,143,255,0.05);border:1px solid rgba(91,143,255,0.12);border-radius:8px;padding:12px 16px;margin-bottom:8px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
        html += '<span style="color:#ccdde8;font-weight:600;font-size:0.92rem;">🚀 ' + escapeHtml(name) + '</span>';
        html += '<span style="font-size:0.78rem;color:' + statusColor + ';background:rgba(64,255,136,0.08);padding:2px 8px;border-radius:4px;">' + escapeHtml(statusText) + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.78rem;color:#8899aa;">' + escapeHtml(vehicle) + ' · ' + escapeHtml(lsp) + '</div>';
        if (dateStr) html += '<div style="font-size:0.75rem;color:#667788;margin-top:2px;">发射窗口: ' + escapeHtml(dateStr) + ' (UTC)</div>';
        html += '</div>';
    }
    html += '<div style="text-align:center;margin-top:10px;font-size:0.68rem;color:#445566;">数据来源: The Space Devs Launch Library 2</div>';
    panel.innerHTML = html;
}
