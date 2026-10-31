/* ============================================================
   SpaceHub — js/spacedata.js
   在线用户显示 + 太空数据中心（ISS、月相、小行星、乘组、流星雨、日食/月食）
   ============================================================ */

// ==================== 在线用户显示 ====================
async function updateLastActive() {
    if (!currentUser) return;
    try {
        await sb.rpc('update_last_active', { p_name: currentUser.name });
    } catch(e) {}
}
async function loadOnlineUsers() {
    try {
        var fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        var result = await sb.from('user_profiles').select('name,avatar,last_active,banned').gte('last_active', fiveMinAgo);
        if (result.error) throw result.error;
        renderOnlineUsers(result.data || []);
    } catch(e) {
        console.error('loadOnlineUsers error:', e);
    }
}
function renderOnlineUsers(users) {
    var bar = document.getElementById('onlineUsersBar');
    var countEl = document.getElementById('onlineCount');
    var avatarsEl = document.getElementById('onlineAvatars');
    if (!bar) return;
    if (users.length === 0) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';
    if (countEl) countEl.textContent = users.length;
    if (avatarsEl) {
        var html = '';
        users.forEach(function(u) {
            var av = u.avatar || getAvatar(u.name);
            var avHtml = av && av.startsWith('http') ? '<img src="' + av + '" alt="' + escapeHtml(u.name) + '" loading="lazy" decoding="async">' : (av || '?');
            html += '<div class="online-avatar" title="' + escapeHtml(u.name) + '" onclick="showUserProfile(\'' + escapeHtml(u.name).replace(/'/g, "\\'") + '\')">' + avHtml + '</div>';
        });
        avatarsEl.innerHTML = html;
    }
}

// ==================== 太空数据中心 ====================
// 各子面板的数据来源（底部来源栏显示）
var sdSources = {
    iss:       'wheretheiss.at 实时卫星定位 API',
    moon:      '本地天文算法（朔望月周期推算）',
    asteroids: 'NASA 近地天体 API (api.nasa.gov)',
    crew:      'howmanypeopleareinspacerightnow.com · 定时同步',
    meteors:   '国际流星组织 (IMO) 数据整理',
    eclipses:  'NASA Eclipse Predictions',
    launches:  'The Space Devs Launch Library 2',
    tonight:   '本地天文算法（行星视位置 · 恒星时 · 曙暮光推算） · 云量 Open-Meteo',
    isspass:   'satellite.js SGP4 轨道推算 · TLE 数据 tle.ivanstanojevic.me',
    aurora:    'NOAA SWPC 太阳风 · 行星际磁场 · X 射线耀斑 · Kp 指数',
    fleet:     'satellite.js SGP4 轨道推算 · TLE 数据 tle.ivanstanojevic.me',
    sentry:    'NASA/JPL Sentry 撞击风险数据 · 每 6 小时同步'
};
var sdCurrentTab = 'iss';

// 数据可信度徽章：标注每块数据的性质（实时 / 计算 / 静态）与更新时间
var sdTrustMeta = {
    iss:       { kind: 'live',   label: '实时',      note: 'wheretheiss.at 卫星定位 API' },
    moon:      { kind: 'calc',   label: '本地计算',  note: '平均朔望月推算，个别月份可能差半天' },
    asteroids: { kind: 'live',   label: '实时',      note: 'NASA NeoWs 近地天体数据' },
    crew:      { kind: 'sync',   label: '定时同步',  note: '每 6 小时同步，失败时保留上次数据' },
    meteors:   { kind: 'static', label: '静态数据',  note: 'IMO 年周期流星雨资料' },
    eclipses:  { kind: 'static', label: '静态数据',  note: '已按 NASA 官方目录校对' },
    launches:  { kind: 'live',   label: '实时',      note: 'The Space Devs Launch Library 2' },
    tonight:   { kind: 'mix',    label: '计算 + 实时', note: '行星位置本地推算；云量来自 Open-Meteo' },
    isspass:   { kind: 'calc',   label: '轨道推算',  note: 'SGP4 推算，TLE 缓存 12 小时' },
    aurora:    { kind: 'live',   label: '实时',      note: 'NOAA SWPC 空间天气数据' },
    fleet:     { kind: 'calc',   label: '轨道推算',  note: 'SGP4 推算，TLE 缓存 12 小时' },
    sentry:    { kind: 'sync',   label: '定时同步',  note: 'NASA/JPL Sentry，每 6 小时同步' }
};
var sdTrustColors = { live: '#40ff88', sync: '#00e8ff', calc: '#5b8fff', static: '#8899aa', mix: '#b558ff' };
var sdFreshAt = {};

function sdRenderTrust(key) {
    var el = document.getElementById('sdTrust-' + key);
    if (!el) return;
    var m = sdTrustMeta[key];
    if (!m) return;
    var color = sdTrustColors[m.kind] || '#8899aa';
    var time = sdFreshAt[key]
        ? new Date(sdFreshAt[key]).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + ' 更新'
        : '';
    el.innerHTML = '<span class="sd-trust-dot" style="background:' + color + ';color:' + color + ';"></span>' +
        '<span class="sd-trust-kind" style="color:' + color + ';">' + m.label + '</span>' +
        '<span class="sd-trust-note">' + escapeHtml(m.note) + '</span>' +
        (time ? '<span class="sd-trust-time">' + time + '</span>' : '');
}

// 数据成功加载后调用：记录刷新时间并同步徽章
function sdTouch(key) {
    sdFreshAt[key] = Date.now();
    sdRenderTrust(key);
}

// 主标签页「太空数据中心」被选中时调用：保持上次的子面板
function showSpaceDataTab() {
    var btn = document.querySelector('.sd-tab.active') || document.querySelector('.sd-tab');
    switchSDTab(sdCurrentTab, btn);
}

// 兼容旧入口：顶部按钮已移除，若被调用则切换到太空数据中心标签
function openSpaceDataModal() {
    var tab = document.querySelector('.tab[data-tab="spacedata"]');
    if (tab) tab.click();
}
// 兼容旧调用（如 scrollToPost / ESC 关闭）：仅停止轮询
function closeSpaceDataModal() {
    stopISSTracking();
}
window.switchSDTab = function(tab, btn) {
    sdCurrentTab = tab;
    document.querySelectorAll('.sd-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.sd-panel').forEach(function(p) { p.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var panel = document.getElementById('sdPanel-' + tab);
    if (panel) panel.classList.add('active');
    var src = document.getElementById('sdSourceBar');
    if (src) src.textContent = '📡 数据来源：' + (sdSources[tab] || 'SpaceHub');
    sdRenderTrust(tab);
    stopISSTracking();
    stopPassReminder();
    stopSatFleet();
    if (tab === 'iss') { startISSTracking(); }
        else if (tab === 'moon') { renderMoonPhase(); }
    else if (tab === 'asteroids') { loadAsteroids(); }
    else if (tab === 'crew') { loadISSCrew(); }
    else if (tab === 'meteors') { renderMeteorShowers(); }
    else if (tab === 'eclipses') { renderEclipses(); }
    else if (tab === 'launches') { loadLaunchData(); }
    else if (tab === 'tonight') { renderTonightsSky(); }
    else if (tab === 'isspass') { loadISSPasses(); }
    else if (tab === 'aurora') { loadAurora(); }
    else if (tab === 'fleet') { loadSatFleet(); }
    else if (tab === 'sentry') { loadSentry(); }
}
var issTimer = null;
var issTrack = [];
var issHasData = false;
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
        issHasData = true;
        sdTouch('iss');
        var x = ((lng + 180) / 360) * 100;
        var y = ((90 - lat) / 180) * 100;
        var marker = document.getElementById('issMarker');
        if (marker) { marker.style.left = x + '%'; marker.style.top = y + '%'; }
        issTrack.push({ x: x, y: y });
        if (issTrack.length > 30) issTrack.shift();
        renderISSTrack();
    } catch(e) {
        console.error('ISS data error:', e);
        // 保留上一次的有效数值；首次连接失败时提示自动重试，而不是显示「获取失败」
        if (!issHasData) {
            ['issLat', 'issLng', 'issAlt', 'issVel'].forEach(function(id) {
                var node = document.getElementById(id);
                if (node) node.textContent = '连接中…';
            });
        }
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
window.startISSTracking = function() { if (issTimer) return; loadISSData(); issTimer = setInterval(loadISSData, 5000); }
window.stopISSTracking = function() { if (issTimer) { clearInterval(issTimer); issTimer = null; } }

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
    if (phase < 0.03 || phase > 0.97) { phaseName = '新月'; phaseEmoji = '🌑'; }
    else if (phase < 0.22) { phaseName = '蛾眉月'; phaseEmoji = '🌒'; }
    else if (phase < 0.28) { phaseName = '上弦月'; phaseEmoji = '🌓'; }
    else if (phase < 0.47) { phaseName = '盈凸月'; phaseEmoji = '🌔'; }
    else if (phase < 0.53) { phaseName = '满月'; phaseEmoji = '🌕'; }
    else if (phase < 0.72) { phaseName = '亏凸月'; phaseEmoji = '🌖'; }
    else if (phase < 0.78) { phaseName = '下弦月'; phaseEmoji = '🌗'; }
    else { phaseName = '残月'; phaseEmoji = '🌘'; }
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
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">👾 加载近地小行星数据...</div>';
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
        var retryHtml = '<div style="text-align:center;padding:40px;color:#ff4060;">⚠️ ' + escapeHtml(emsg) + '<br><button onclick="asteroidLoaded=false;loadAsteroids()" style="margin-top:12px;padding:8px 20px;background:rgba(91,143,255,0.15);border:1px solid rgba(91,143,255,0.3);color:#5b8fff;border-radius:8px;cursor:pointer;">重试</button></div>';
        var oldCache = null;
        for (var i = 0; i < 7; i++) {
            var d = new Date(); d.setDate(d.getDate() - i);
            var key = 'asteroid_cache_' + d.toISOString().slice(0, 10);
            try { oldCache = JSON.parse(localStorage.getItem(key)); } catch(e2) {}
            if (oldCache && oldCache.neos && oldCache.neos.length > 0) break;
        }
        if (oldCache && oldCache.neos && oldCache.neos.length > 0) {
            retryHtml = '<div style="text-align:center;padding:12px;font-size:0.72rem;color:#ffaa00;background:rgba(255,170,0,0.08);border-radius:8px;margin-bottom:8px;">⚠️ API 限流，显示缓存数据</div>';
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
    html += '<div class="asteroid-header-info">☄️ 今日近地小行星: <strong style="color:#5b8fff;">' + neos.length + '</strong> 颗 | 潜在危险: <strong style="color:' + (hazardousCount > 0 ? '#ff4060' : '#40ff88') + ';">' + hazardousCount + '</strong> 颗</div>';
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
    sdTouch('asteroids');
    panel.innerHTML = html;
}

// ==================== 💥 撞击风险榜 (JPL Sentry) ====================
var SENTRY_CACHE_KEY = 'spacehub_sentry_v2';

function sentryProbText(p) {
    if (p == null || !isFinite(p)) return '未知';
    if (p >= 0.001) return (p * 100).toFixed(3) + '%';
    return p.toExponential(2);
}

function sentryYearText(range) {
    if (!range) return '未知';
    var parts = String(range).split('-');
    if (parts.length === 2 && parts[0] !== parts[1]) return parts[0] + '–' + parts[1] + ' 年';
    return (parts[0] || '未知') + ' 年';
}

async function loadSentry() {
    var panel = document.getElementById('sentryPanel');
    if (!panel) return;
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(SENTRY_CACHE_KEY) || 'null'); } catch (e) { cached = null; }
    if (cached && cached.objects && cached.objects.length) renderSentry(panel, cached);
    var fresh = cached && cached.updated && (Date.now() - Date.parse(cached.updated) < 12 * 3600 * 1000);
    if (fresh) return;
    try {
        var res = await fetch('data/sentry.json?t=' + Math.floor(Date.now() / 3600000), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        if (!data.objects || !data.objects.length) throw new Error('空数据');
        try { localStorage.setItem(SENTRY_CACHE_KEY, JSON.stringify(data)); } catch (e) {}
        renderSentry(panel, data);
        sdTouch('sentry');
    } catch (err) {
        console.warn('[Sentry] 加载失败:', err);
        if (!cached || !cached.objects || !cached.objects.length) {
            panel.innerHTML = '<div style="text-align:center;padding:30px;color:#667788;line-height:1.9;">' +
                '⚠️ 撞击风险数据加载失败<br>' +
                '<span style="font-size:0.72rem;">数据由 GitHub Actions 每 6 小时从 NASA/JPL Sentry 同步，请稍后再试</span></div>';
        }
    }
}

function renderSentry(panel, data) {
    var objs = data.objects || [];
    var html = '<div class="asteroid-header-info">💥 JPL Sentry 风险榜：<strong style="color:#5b8fff;">' +
        (data.count || objs.length) + '</strong> 颗被监测天体 | 按 Palermo 风险指数排序</div>';
    html += '<div class="sentry-note">Palermo 指数衡量撞击风险相对背景水平的高低，0 表示与背景相当，负值越低越安全。这里的概率都极低，只代表「需要继续观测」，不是撞击预警。</div>';
    for (var i = 0; i < Math.min(objs.length, 12); i++) {
        var o = objs[i];
        var risk = o.ps_cum != null && o.ps_cum >= -2;
        var diam = o.diameter_km != null
            ? (o.diameter_km < 1 ? Math.round(o.diameter_km * 1000) + ' m' : o.diameter_km.toFixed(2) + ' km')
            : '未知';
        html += '<div class="asteroid-card">';
        html += '<div class="asteroid-name">' + escapeHtml(o.fullname || o.des || '未知') +
            '<span class="asteroid-danger ' + (risk ? 'hazardous' : 'safe') + '">' +
            (risk ? '需关注' : '概率极低') + '</span></div>';
        html += '<div class="asteroid-grid">';
        html += '<div class="asteroid-stat">直径: <strong>' + diam + '</strong></div>';
        html += '<div class="asteroid-stat">可能撞击: <strong>' + sentryYearText(o.range) + '</strong></div>';
        html += '<div class="asteroid-stat">撞击概率: <strong>' + sentryProbText(o.ip) + '</strong></div>';
        html += '<div class="asteroid-stat">Palermo 指数: <strong>' + (o.ps_cum != null ? o.ps_cum.toFixed(2) : '未知') + '</strong></div>';
        html += '</div></div>';
    }
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
    sdTouch('launches');
    panel.innerHTML = html;
}

// ==================== ISS 当前乘组 ====================
var crewLoaded = false;
async function loadISSCrew() {
    var panel = document.getElementById('crewPanel');
    if (!panel) return;
    if (crewLoaded) return;
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">🚀 加载ISS乘组信息...</div>';

    var astroDb = {
        'Jessica Meir': { agency: 'NASA', flag: '🇺🇸' },
        'Jack Hathaway': { agency: 'NASA', flag: '🇺🇸' },
        'Anil Menon': { agency: 'NASA', flag: '🇺🇸' },
        'Raja Chari': { agency: 'NASA', flag: '🇺🇸' },
        'Thomas Marshburn': { agency: 'NASA', flag: '🇺🇸' },
        'Kayla Barron': { agency: 'NASA', flag: '🇺🇸' },
        'Matthias Maurer': { agency: 'ESA', flag: '🇩🇪' },
        'Bob Hines': { agency: 'NASA', flag: '🇺🇸' },
        'Samantha Cristoforetti': { agency: 'ESA', flag: '🇮🇹' },
        'Kjell Lindgren': { agency: 'NASA', flag: '🇺🇸' },
        'Bob Behnken': { agency: 'NASA', flag: '🇺🇸' },
        'Doug Hurley': { agency: 'NASA', flag: '🇺🇸' },
        'Mike Hopkins': { agency: 'NASA', flag: '🇺🇸' },
        'Victor Glover': { agency: 'NASA', flag: '🇺🇸' },
        'Shannon Walker': { agency: 'NASA', flag: '🇺🇸' },
        'Soichi Noguchi': { agency: 'JAXA', flag: '🇯🇵' },
        'Shane Kimbrough': { agency: 'NASA', flag: '🇺🇸' },
        'Megan McArthur': { agency: 'NASA', flag: '🇺🇸' },
        'Akihiko Hoshide': { agency: 'JAXA', flag: '🇯🇵' },
        'Thomas Pesquet': { agency: 'ESA', flag: '🇫🇷' },
        'Frank Rubio': { agency: 'NASA', flag: '🇺🇸' },
        'Stephen Bowen': { agency: 'NASA', flag: '🇺🇸' },
        'Warren Hoburg': { agency: 'NASA', flag: '🇺🇸' },
        'Sultan Al Neyadi': { agency: 'UAE', flag: '🇦🇪' },
        'Andrei Fedyaev': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Jasmin Moghbeli': { agency: 'NASA', flag: '🇺🇸' },
        'Andreas Mogensen': { agency: 'ESA', flag: '🇩🇰' },
        'Satoshi Furukawa': { agency: 'JAXA', flag: '🇯🇵' },
        'Konstantin Borisov': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Matthew Dominick': { agency: 'NASA', flag: '🇺🇸' },
        'Michael Barratt': { agency: 'NASA', flag: '🇺🇸' },
        'Jeanette Epps': { agency: 'NASA', flag: '🇺🇸' },
        'Alexander Grebenkin': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Butch Wilmore': { agency: 'NASA', flag: '🇺🇸' },
        'Sunita Williams': { agency: 'NASA', flag: '🇺🇸' },
        'Nick Hague': { agency: 'NASA', flag: '🇺🇸' },
        'Aleksandr Gorbunov': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Zena Cardman': { agency: 'NASA', flag: '🇺🇸' },
        'Stephanie Wilson': { agency: 'NASA', flag: '🇺🇸' },
        'Anne McClain': { agency: 'NASA', flag: '🇺🇸' },
        'Nichole Ayers': { agency: 'NASA', flag: '🇺🇸' },
        'Takuya Onishi': { agency: 'JAXA', flag: '🇯🇵' },
        'Kirill Peskov': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Jonny Kim': { agency: 'NASA', flag: '🇺🇸' },
        'Sergey Ryzhikov': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Alexey Zubritsky': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Sergey Krikalev': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Tracy Caldwell Dyson': { agency: 'NASA', flag: '🇺🇸' },
        'Oleg Kononenko': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Nikolai Chub': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Oleg Artemyev': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Denis Matveev': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Sergey Korsakov': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Pyotr Dubrov': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Anna Kikina': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Andrey Fedyaev': { agency: 'Roscosmos', flag: '🇷🇺' },
        'Frank de Winne': { agency: 'ESA', flag: '🇧🇪' },
        'Sophie Adenot': { agency: 'ESA', flag: '🇫🇷' },
        'Li Guangsu': { agency: 'CNSA', flag: '🇨🇳' },
        'Li Cong': { agency: 'CNSA', flag: '🇨🇳' },
        'Ye Guangfu': { agency: 'CNSA', flag: '🇨🇳' },
        'Jing Haipeng': { agency: 'CNSA', flag: '🇨🇳' },
        'Zhu Yangzhu': { agency: 'CNSA', flag: '🇨🇳' },
        'Gui Haichao': { agency: 'CNSA', flag: '🇨🇳' },
        'Tang Shengjie': { agency: 'CNSA', flag: '🇨🇳' },
        'Cai Xuzhe': { agency: 'CNSA', flag: '🇨🇳' },
        'Song Lingdong': { agency: 'CNSA', flag: '🇨🇳' },
        'Wang Haoze': { agency: 'CNSA', flag: '🇨🇳' },
        'Chen Dong': { agency: 'CNSA', flag: '🇨🇳' },
        'Liu Yang': { agency: 'CNSA', flag: '🇨🇳' }
    };

    var fallbackCrew = [
        { name: 'Jessica Meir', craft: 'ISS Expedition 75 (NASA)', flag: '🇺🇸' },
        { name: 'Jack Hathaway', craft: 'ISS Expedition 75 (NASA)', flag: '🇺🇸' },
        { name: 'Anil Menon', craft: 'ISS (Soyuz MS-29, NASA)', flag: '🇺🇸' },
        { name: 'Sophie Adenot', craft: 'ISS Expedition 75 (ESA)', flag: '🇫🇷' },
        { name: 'Andrey Fedyaev', craft: 'ISS Expedition 75 (Roscosmos)', flag: '🇷🇺' },
        { name: 'Pyotr Dubrov', craft: 'ISS (Soyuz MS-29, Roscosmos)', flag: '🇷🇺' },
        { name: 'Anna Kikina', craft: 'ISS (Soyuz MS-29, Roscosmos)', flag: '🇷🇺' }
    ];

    var countryInfo = {
        'usa': { agency: 'NASA', flag: '🇺🇸' },
        'russia': { agency: 'Roscosmos', flag: '🇷🇺' },
        'china': { agency: 'CNSA', flag: '🇨🇳' },
        'france': { agency: 'ESA', flag: '🇫🇷' },
        'japan': { agency: 'JAXA', flag: '🇯🇵' },
        'canada': { agency: 'CSA', flag: '🇨🇦' },
        'italy': { agency: 'ESA', flag: '🇮🇹' },
        'germany': { agency: 'ESA', flag: '🇩🇪' },
        'united kingdom': { agency: 'ESA', flag: '🇬🇧' },
        'belgium': { agency: 'ESA', flag: '🇧🇪' },
        'denmark': { agency: 'ESA', flag: '🇩🇰' },
        'spain': { agency: 'ESA', flag: '🇪🇸' },
        'netherlands': { agency: 'ESA', flag: '🇳🇱' },
        'sweden': { agency: 'ESA', flag: '🇸🇪' },
        'switzerland': { agency: 'ESA', flag: '🇨🇭' },
        'uae': { agency: 'MBRSC', flag: '🇦🇪' },
        'united arab emirates': { agency: 'MBRSC', flag: '🇦🇪' }
    };
    var roleCn = {
        'Station Commander': '空间站指令长',
        'Spacecraft Commander': '飞船指令长',
        'Commander': '指令长',
        'Pilot': '驾驶员',
        'Mission Specialist': '任务专家',
        'Flight Engineer': '飞行工程师',
        'Payload Specialist': '载荷专家'
    };

    try {
        var cacheKey = 'iss_crew_cache_v2';
        var cacheTimeKey = 'iss_crew_cache_time_v2';
        var now = Date.now();
        var cachedTime = parseInt(localStorage.getItem(cacheTimeKey) || '0');
        var cached = localStorage.getItem(cacheKey);

        if (cached && (now - cachedTime) < 3600000) {
            try {
                var cachedData = JSON.parse(cached);
                sdTouch('crew');
                renderCrewList(cachedData.iss, cachedData.tiangong);
                return;
            } catch(e) {}
        }

        // 同源数据文件：由 GitHub Actions 定时同步，避免第三方 API 的 CORS 限制与宕机风险
        var resp = await fetch('data/iss_crew.json?ts=' + Math.floor(now / 3600000));
        if (!resp.ok) throw new Error('Crew data error: ' + resp.status);
        var data = await resp.json();

        var issCrew = [];
        var tiangongCrew = [];
        var people = data.people || [];
        for (var i = 0; i < people.length; i++) {
            var p = people[i];
            var info = astroDb[p.name] || countryInfo[String(p.country || '').toLowerCase()] || { agency: 'Unknown', flag: '🚀' };
            var isTiangong = String(p.location || '').indexOf('Tiangong') >= 0;
            var entry = {
                name: p.name,
                craft: isTiangong ? 'Tiangong' : 'ISS',
                agency: info.agency,
                flag: info.flag,
                role: roleCn[p.title] || p.title || ''
            };
            if (isTiangong) tiangongCrew.push(entry);
            else issCrew.push(entry);
        }
        if (!issCrew.length && !tiangongCrew.length) throw new Error('乘组数据为空');

        localStorage.setItem(cacheKey, JSON.stringify({ iss: issCrew, tiangong: tiangongCrew }));
        localStorage.setItem(cacheTimeKey, String(now));

        sdTouch('crew');
        renderCrewList(issCrew, tiangongCrew);
    } catch(e) {
        console.error('ISS crew fetch error:', e);
        var cached2 = localStorage.getItem('iss_crew_cache_v2');
        if (cached2) {
            try {
                var cachedData2 = JSON.parse(cached2);
                renderCrewList(cachedData2.iss, cachedData2.tiangong);
                var note2 = document.getElementById('crewPanel');
                if (note2) {
                    var warn = document.createElement('div');
                    warn.style.cssText = 'text-align:center;padding:6px;color:#667788;font-size:0.8rem;';
                    warn.textContent = '⚠️ 同步数据读取失败，显示上次缓存';
                    note2.appendChild(warn);
                }
                return;
            } catch(e2) {}
        }
        renderCrewList(fallbackCrew, []);
        var note = document.getElementById('crewPanel');
        if (note) {
            var warn = document.createElement('div');
            warn.style.cssText = 'text-align:center;padding:6px;color:#667788;font-size:0.8rem;';
            warn.textContent = '⚠️ 乘组数据读取失败，显示最近一次已知名单';
            note.appendChild(warn);
        }
    }

    function renderCrewList(issList, tgList) {
        var html = '<div class="crew-header-info">🚀 ISS 当前乘组: <strong style="color:#5b8fff;">' + issList.length + '</strong> 名宇航员</div>';
        html += '<div class="crew-list">';
        for (var i = 0; i < issList.length; i++) {
            var c = issList[i];
            html += '<div class="crew-card">';
            html += '<div class="crew-avatar">' + c.flag + '</div>';
            html += '<div class="crew-info">';
            html += '<div class="crew-name">' + escapeHtml(c.name) + '</div>';
            html += '<div class="crew-craft">ISS (' + escapeHtml(c.agency) + ')' + (c.role ? ' · ' + escapeHtml(c.role) : '') + '</div>';
            html += '</div></div>';
        }
        html += '</div>';
        if (tgList.length > 0) {
            html += '<div class="crew-header-info" style="margin-top:16px;">🇨🇳 天宫空间站乘组: <strong style="color:#5b8fff;">' + tgList.length + '</strong> 名宇航员</div>';
            html += '<div class="crew-list">';
            for (var j = 0; j < tgList.length; j++) {
                var t = tgList[j];
                html += '<div class="crew-card">';
                html += '<div class="crew-avatar">' + t.flag + '</div>';
                html += '<div class="crew-info">';
                html += '<div class="crew-name">' + escapeHtml(t.name) + '</div>';
                html += '<div class="crew-craft">天宫空间站 (' + escapeHtml(t.agency) + ')' + (t.role ? ' · ' + escapeHtml(t.role) : '') + '</div>';
                html += '</div></div>';
            }
            html += '</div>';
        }
        html += '<div style="text-align:center;margin-top:12px;font-size:0.75rem;color:#667788;">数据来源: howmanypeopleareinspacerightnow.com · 每 6 小时同步</div>';
        panel.innerHTML = html;
    }
}

// ==================== 流星雨日历 ====================
var meteorShowers = [
    { name: '象限仪流星雨', en: 'Quadrantids', peak: '01-04', start: '12-28', end: '01-12', zhr: 110, radiant: '牧夫座', parent: '小行星2003 EH1', note: '新年第一场大流星雨，辐射点在牧夫座' },
    { name: '天琴座流星雨', en: 'Lyrids', peak: '04-22', start: '04-15', end: '04-29', zhr: 18, radiant: '天琴座', parent: '撒切尔彗星 C/1861 G1', note: '四月流星雨，偶尔有火流星' },
    { name: '宝瓶座 eta 流星雨', en: 'Eta Aquariids', peak: '05-06', start: '04-19', end: '05-28', zhr: 50, radiant: '宝瓶座', parent: '哈雷彗星 1P/Halley', note: '南半球更佳，哈雷彗星留下的尘埃' },
    { name: '宝瓶座 delta 流星雨', en: 'Delta Aquariids', peak: '07-30', start: '07-12', end: '08-23', zhr: 25, radiant: '宝瓶座', parent: '未知彗星', note: '夏季中等流星雨，南半球更佳' },
    { name: '英仙座流星雨', en: 'Perseids', peak: '08-13', start: '07-17', end: '08-24', zhr: 100, radiant: '英仙座', parent: '斯威夫特-塔特尔彗星 109P/Swift-Tuttle', note: '北半球夏季最壮观的流星雨' },
    { name: '猎户座流星雨', en: 'Orionids', peak: '10-22', start: '10-02', end: '11-07', zhr: 20, radiant: '猎户座', parent: '哈雷彗星 1P/Halley', note: '哈雷彗星留下的另一束尘埃' },
    { name: '金牛座流星雨', en: 'Taurids', peak: '11-06', start: '09-07', end: '11-19', zhr: 10, radiant: '金牛座', parent: '恩克彗星 2P/Encke', note: '流星较慢但常有火流星' },
    { name: '狮子座流星雨', en: 'Leonids', peak: '11-18', start: '11-06', end: '11-30', zhr: 15, radiant: '狮子座', parent: '坦普尔-塔特尔彗星 55P/Tempel-Tuttle', note: '每隔33年有大爆发，下次约2032年' },
    { name: '双子座流星雨', en: 'Geminids', peak: '12-14', start: '12-04', end: '12-20', zhr: 150, radiant: '双子座', parent: '小行星3200 Phaethon', note: '北半球冬季最壮观的流星雨' },
    { name: '小熊座流星雨', en: 'Ursids', peak: '12-22', start: '12-17', end: '12-26', zhr: 10, radiant: '小熊座', parent: '塔特尔彗星 8P/Tuttle', note: '冬至前后的小型流星雨' }
];

function renderMeteorShowers() {
    var panel = document.getElementById('meteorPanel');
    if (!panel) return;
    var now = new Date();
    var nowMD = (now.getMonth() + 1) * 100 + now.getDate();
    var html = '<div class="meteor-header-info">☄️ 全年主要流星雨日历 | 当前日期: ' + (now.getMonth() + 1) + '月' + now.getDate() + '日</div>';
    var nextFound = false;
    for (var i = 0; i < meteorShowers.length; i++) {
        var m = meteorShowers[i];
        var peakParts = m.peak.split('-');
        var peakMD = parseInt(peakParts[0]) * 100 + parseInt(peakParts[1]);
        var startParts = m.start.split('-');
        var endParts = m.end.split('-');
        var startMD = parseInt(startParts[0]) * 100 + parseInt(startParts[1]);
        var endMD = parseInt(endParts[0]) * 100 + parseInt(endParts[1]);
        var isActive = false;
        if (startMD <= endMD) {
            isActive = nowMD >= startMD && nowMD <= endMD;
        } else {
            isActive = nowMD >= startMD || nowMD <= endMD;
        }
        var isPeak = false;
        if (peakMD === nowMD) isPeak = true;
        var daysToPeak;
        if (peakMD >= nowMD) {
            daysToPeak = Math.round((new Date(now.getFullYear(), parseInt(peakParts[0]) - 1, parseInt(peakParts[1])) - now) / 86400000);
        } else {
            daysToPeak = Math.round((new Date(now.getFullYear() + 1, parseInt(peakParts[0]) - 1, parseInt(peakParts[1])) - now) / 86400000);
        }
        var badge = '';
        var cardClass = '';
        if (isPeak) { badge = '<span class="meteor-badge peak">⭐ 今日峰值</span>'; cardClass = 'next-active'; }
        else if (isActive) { badge = '<span class="meteor-badge active">✅ 活跃中</span>'; cardClass = 'next-active'; }
        else if (!nextFound && daysToPeak > 0) { badge = '<span class="meteor-badge upcoming">⏳ ' + daysToPeak + '天后峰值</span>'; nextFound = true; cardClass = 'next-active'; }
        html += '<div class="meteor-card ' + cardClass + '">';
        html += '<div class="meteor-name">' + escapeHtml(m.name) + ' (' + escapeHtml(m.en) + ')' + badge + '</div>';
        html += '<div class="meteor-grid">';
        html += '<div class="meteor-stat">峰值日期: <strong>' + m.peak.replace('-', '月') + '日</strong></div>';
        html += '<div class="meteor-stat">ZHR: <strong>' + m.zhr + '/小时</strong></div>';
        html += '<div class="meteor-stat">活跃期: <strong>' + m.start.replace('-', '月') + '日 - ' + m.end.replace('-', '月') + '日</strong></div>';
        html += '<div class="meteor-stat">辐射点: <strong>' + escapeHtml(m.radiant) + '</strong></div>';
        html += '</div>';
        html += '<div class="meteor-desc">母天体: ' + escapeHtml(m.parent) + ' | ' + escapeHtml(m.note) + '</div>';
        html += '</div>';
    }
    html += '<div style="text-align:center;margin-top:8px;font-size:0.68rem;color:#445566;">ZHR = 天顶每小时流量 (辐射点在天顶时的理想流星数)</div>';
    panel.innerHTML = html;
}

// ==================== 日食/月食预报 ====================
var eclipseData = [
    { date: '2026-02-17', type: 'annular', kind: 'solar', name: '日环食', visibility: '南极洲、阿根廷与智利南部、非洲南部', magnitude: '0.963', duration: '环食 2分20秒', note: '环食带穿过南极洲，南美洲南端与非洲南部可见偏食' },
    { date: '2026-03-03', type: 'total', kind: 'lunar', name: '月全食', visibility: '亚洲东部、大洋洲、太平洋、美洲', magnitude: '1.151', duration: '全食 58 分钟', note: '中国可见全过程' },
    { date: '2026-08-12', type: 'total', kind: 'solar', name: '日全食', visibility: '格陵兰、冰岛、西班牙；北美洲、西非、欧洲偏食', magnitude: '1.039', duration: '全食 2分18秒', note: '全食带经过北极、格陵兰、冰岛与西班牙' },
    { date: '2026-08-28', type: 'partial', kind: 'lunar', name: '月偏食', visibility: '东太平洋、美洲、欧洲、非洲', magnitude: '0.930', duration: '偏食 3小时18分', note: '美洲地区可见' },
    { date: '2027-02-06', type: 'annular', kind: 'solar', name: '日环食', visibility: '南美洲、南极洲、非洲西部与南部', magnitude: '0.928', duration: '环食 7分51秒', note: '环食带经过智利、阿根廷与南大西洋' },
    { date: '2027-02-20', type: 'penumbral', kind: 'lunar', name: '半影月食', visibility: '美洲、欧洲、非洲、亚洲', magnitude: '—', duration: '约 4 小时', note: '半影月食，亮度变化很小，肉眼不易察觉' },
    { date: '2027-07-18', type: 'penumbral', kind: 'lunar', name: '半影月食', visibility: '非洲东部、亚洲、澳大利亚、太平洋', magnitude: '—', duration: '约 4 小时', note: '半影很深，但仍难以用肉眼分辨' },
    { date: '2027-08-02', type: 'total', kind: 'solar', name: '日全食', visibility: '摩洛哥、西班牙、阿尔及利亚、利比亚、埃及、沙特阿拉伯、也门、索马里', magnitude: '1.079', duration: '全食 6分23秒', note: '本世纪最长日全食之一，全食带横跨北非与中东' },
    { date: '2027-08-17', type: 'penumbral', kind: 'lunar', name: '半影月食', visibility: '太平洋、美洲', magnitude: '—', duration: '约 3.5 小时', note: '半影月食，亮度变化很轻微' },
    { date: '2028-01-12', type: 'partial', kind: 'lunar', name: '月偏食', visibility: '美洲、欧洲、非洲', magnitude: '0.066', duration: '偏食 56 分钟', note: '食分很小，仅月面边缘略微变暗' },
    { date: '2028-01-26', type: 'annular', kind: 'solar', name: '日环食', visibility: '厄瓜多尔、秘鲁、巴西、苏里南、西班牙、葡萄牙', magnitude: '0.921', duration: '环食 10分27秒', note: '环食带跨越南美洲北部、大西洋与伊比利亚半岛' },
    { date: '2028-07-06', type: 'partial', kind: 'lunar', name: '月偏食', visibility: '欧洲、非洲、亚洲、澳大利亚', magnitude: '0.389', duration: '偏食 2小时21分', note: '非洲、欧洲与亚洲可见' },
    { date: '2028-07-22', type: 'total', kind: 'solar', name: '日全食', visibility: '澳大利亚、新西兰、东南亚', magnitude: '1.056', duration: '全食 5分10秒', note: '全食带经过澳大利亚与新西兰' },
    { date: '2028-12-31', type: 'total', kind: 'lunar', name: '月全食', visibility: '欧洲、非洲、亚洲、澳大利亚、太平洋', magnitude: '1.246', duration: '全食 1小时11分', note: '跨年夜月全食，亚洲大部分地区可见' }
];

function renderEclipses() {
    var panel = document.getElementById('eclipsePanel');
    if (!panel) return;
    var now = new Date();
    var nowTs = now.getTime();
    var upcoming = [];
    var past = [];
    for (var i = 0; i < eclipseData.length; i++) {
        var e = eclipseData[i];
        var eTs = new Date(e.date + 'T00:00:00').getTime();
        if (eTs >= nowTs - 86400000) {
            upcoming.push({ data: e, ts: eTs });
        } else {
            past.push({ data: e, ts: eTs });
        }
    }
    upcoming.sort(function(a, b) { return a.ts - b.ts; });
    past.sort(function(a, b) { return b.ts - a.ts; });
    var nextOne = upcoming.length > 0 ? upcoming[0] : null;
    var html = '<div class="eclipse-header-info">🌙 未来日食/月食预报 | 共 ' + upcoming.length + ' 场即将发生</div>';
    if (nextOne) {
        var daysLeft = Math.ceil((nextOne.ts - nowTs) / 86400000);
        if (daysLeft === 0) daysLeft = '今天';
        else if (daysLeft === 1) daysLeft = '明天';
        else daysLeft = daysLeft + ' 天后';
        html = '<div class="eclipse-header-info">🌙 下一次: ' + escapeHtml(nextOne.data.name) + ' | 距今约 ' + daysLeft + ' | ' + nextOne.data.date + '</div>';
    }
    var list = upcoming.concat(past.slice(0, 3));
    for (var j = 0; j < list.length; j++) {
        var e = list[j].data;
        var ts = list[j].ts;
        var isNext = (nextOne && ts === nextOne.ts);
        var daysDiff = Math.ceil((ts - nowTs) / 86400000);
        var typeClass = e.type;
        var kindEmoji = e.kind === 'solar' ? '☀️' : '🌙';
        var cardClass = isNext ? 'next-up' : '';
        var countdownStr = '';
        if (daysDiff > 0) countdownStr = '<div class="eclipse-countdown">⏳ ' + (daysDiff === 1 ? '明天' : daysDiff + ' 天后') + '</div>';
        else if (daysDiff === 0) countdownStr = '<div class="eclipse-countdown" style="color:#40ff88;">✅ 今天</div>';
        else countdownStr = '<div class="eclipse-countdown" style="color:#556677;">✔ 已发生 (' + Math.abs(daysDiff) + '天前)</div>';
        html += '<div class="eclipse-card ' + cardClass + '">';
        html += '<div class="eclipse-name">' + kindEmoji + ' ' + escapeHtml(e.name);
        html += '<span class="eclipse-type-badge ' + typeClass + '">' + escapeHtml(e.name) + '</span></div>';
        html += '<div class="eclipse-grid">';
        html += '<div class="eclipse-stat">日期: <strong>' + e.date + '</strong></div>';
        html += '<div class="eclipse-stat">食分: <strong>' + e.magnitude + '</strong></div>';
        html += '<div class="eclipse-stat">可见区域: <strong>' + escapeHtml(e.visibility) + '</strong></div>';
        html += '<div class="eclipse-stat">持续时间: <strong>' + escapeHtml(e.duration) + '</strong></div>';
        html += '</div>';
        html += '<div class="eclipse-desc">' + escapeHtml(e.note) + '</div>';
        html += countdownStr;
        html += '</div>';
    }
    html += '<div style="text-align:center;margin-top:8px;font-size:0.68rem;color:#445566;">数据来源: NASA Eclipse predictions</div>';
    panel.innerHTML = html;
}

// ==================== 观测者位置（今夜星空 / ISS过境共用） ====================
function sdGetObserver() {
    try {
        var c = JSON.parse(localStorage.getItem('sd_observer'));
        if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return c;
    } catch (e) {}
    return { lat: 39.9042, lng: 116.4074, label: '北京（默认位置）' };
}
function sdRequestObserver(then) {
    if (!navigator.geolocation) { alert('浏览器不支持定位'); return; }
    navigator.geolocation.getCurrentPosition(function(pos) {
        var obs = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: '我的位置' };
        try { localStorage.setItem('sd_observer', JSON.stringify(obs)); } catch (e) {}
        if (then) then(obs);
    }, function() {
        alert('定位失败或被拒绝，将继续使用 ' + sdGetObserver().label);
    }, { timeout: 8000, maximumAge: 600000 });
}
function sdLocRowHtml(obs, rerenderCall) {
    return '<div class="sd-loc-row"><span>📍 ' + escapeHtml(obs.label) + '（' + obs.lat.toFixed(1) + '°, ' + obs.lng.toFixed(1) + '°）</span>' +
        '<button onclick="sdRequestObserver(function(){' + rerenderCall + '})">更新位置</button></div>';
}

// ==================== 天文算法工具（低精度视位置，显示用） ====================
function sdRad(d) { return d * Math.PI / 180; }
function sdDeg(r) { return r * 180 / Math.PI; }
function sdJD(date) { return date.getTime() / 86400000 + 2440587.5; }

// 当地恒星时（度）
function sdLST(jd, lngDeg) {
    var d = jd - 2451545, T = d / 36525;
    var g = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T;
    g = ((g % 360) + 360) % 360;
    return ((g + lngDeg) % 360 + 360) % 360;
}

// 赤经(小时)/赤纬(度) → 地平坐标 {alt, az}
function sdAltAz(raHours, decDeg, latDeg, lngDeg, date) {
    var ha = ((sdLST(sdJD(date), lngDeg) - raHours * 15 + 360) % 360) * Math.PI / 180;
    var phi = sdRad(latDeg), dec = sdRad(decDeg);
    var sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
    var alt = sdDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
    var cosAz = (Math.sin(dec) - sinAlt * Math.sin(phi)) / (Math.cos(sdRad(alt)) * Math.cos(phi));
    var az = sdDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
    if (Math.sin(ha) > 0) az = 360 - az;
    return { alt: alt, az: az };
}

// 太阳地心黄道经度（弧度）
function sdSunEcliptic(date) {
    var n = sdJD(date) - 2451545;
    var L = 280.46 + 0.9856474 * n;
    var M = sdRad(357.528 + 0.9856003 * n);
    return sdRad(L + 1.915 * Math.sin(M) + 0.02 * Math.sin(2 * M));
}

// 行星轨道根数（Schlyter 低精度模型，n = 自 1999-12-31 起的天数）
var sdPlanetElems = {
    Venus:   { cn: '金星', sym: '♀', color: '#fde68a', mag: -4.0, N: [76.6799, 2.4659e-5],  i: [3.3946, 2.75e-8],   w: [54.891, 2.45878e-5],  a: 0.723330, e: [0.006773, -1.302e-9], M: [48.0052, 1.6021302244] },
    Mars:    { cn: '火星', sym: '♂', color: '#f87171', mag: 0.7,  N: [49.5574, 2.11081e-5], i: [1.8497, -1.78e-8],  w: [286.5016, 2.92961e-5], a: 1.523688, e: [0.093405, 2.516e-9],  M: [18.6021, 0.5240207766] },
    Jupiter: { cn: '木星', sym: '♃', color: '#fb923c', mag: -2.0, N: [100.4542, 2.76854e-5], i: [1.3030, -1.557e-7], w: [273.8777, 1.64505e-5], a: 5.20256,  e: [0.048498, 4.469e-9],  M: [19.8950, 0.0830853001] },
    Saturn:  { cn: '土星', sym: '♄', color: '#fbbf24', mag: 0.7,  N: [113.6634, 2.38980e-5], i: [2.4886, -1.081e-7], w: [339.3939, 2.97661e-5], a: 9.55475,  e: [0.055546, -9.499e-9], M: [316.9670, 0.0334442282] }
};

// 行星地心赤经(小时)/赤纬(度)
function sdPlanetRaDec(name, date) {
    var el = sdPlanetElems[name];
    var n = sdJD(date) - 2451543.5;
    var N = sdRad(el.N[0] + el.N[1] * n);
    var i = sdRad(el.i[0] + el.i[1] * n);
    var w = sdRad(el.w[0] + el.w[1] * n);
    var a = el.a;
    var e = el.e[0] + el.e[1] * n;
    var M = sdRad(((el.M[0] + el.M[1] * n) % 360 + 360) % 360);
    var E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    var xv = a * (Math.cos(E) - e);
    var yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    var v = Math.atan2(yv, xv);
    var rp = Math.sqrt(xv * xv + yv * yv);
    // 日心黄道直角坐标
    var u = v + w;
    var xs = rp * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(i));
    var ys = rp * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(i));
    var zs = rp * Math.sin(u) * Math.sin(i);
    // 太阳地心向量
    var ls = sdSunEcliptic(date);
    var rs = 1.00014 - 0.01671 * Math.cos(sdRad(357.528 + 0.9856003 * (sdJD(date) - 2451545)));
    var xg = xs + rs * Math.cos(ls);
    var yg = ys + rs * Math.sin(ls);
    var zg = zs;
    // 黄道 → 赤道（含交角）
    var lam = Math.atan2(yg, xg);
    var bet = Math.atan2(zg, Math.sqrt(xg * xg + yg * yg));
    var eps = sdRad(23.4393);
    var ra = sdDeg(Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(bet) * Math.sin(eps), Math.cos(lam))) / 15;
    var dec = sdDeg(Math.asin(Math.sin(bet) * Math.cos(eps) + Math.cos(bet) * Math.sin(eps) * Math.sin(lam)));
    return { ra: (ra + 24) % 24, dec: dec };
}

// 月相信息（与月相面板同一算法）
function sdMoonInfo(date) {
    var knownNew = Date.UTC(2000, 0, 6, 18, 14, 0);
    var syn = 29.530588853;
    var age = ((date.getTime() - knownNew) / 86400000) % syn;
    if (age < 0) age += syn;
    var phase = age / syn;
    var illum = Math.round((1 - Math.cos(2 * Math.PI * phase)) / 2 * 100);
    var name, emoji;
    if (phase < 0.03 || phase > 0.97) { name = '新月'; emoji = '🌑'; }
    else if (phase < 0.22) { name = '蛾眉月'; emoji = '🌒'; }
    else if (phase < 0.28) { name = '上弦月'; emoji = '🌓'; }
    else if (phase < 0.47) { name = '盈凸月'; emoji = '🌔'; }
    else if (phase < 0.53) { name = '满月'; emoji = '🌕'; }
    else if (phase < 0.72) { name = '亏凸月'; emoji = '🌖'; }
    else if (phase < 0.78) { name = '下弦月'; emoji = '🌗'; }
    else { name = '残月'; emoji = '🌘'; }
    return { phase: phase, illum: illum, name: name, emoji: emoji };
}

// 日出/日落/天文昏影终（本地时区近似）
function sdSunTimes(date, lat, lng) {
    var eps = sdRad(23.439), phi = sdRad(lat);
    var dec = Math.asin(Math.sin(eps) * Math.sin(sdSunEcliptic(date)));
    function h(h0deg) {
        var x = (Math.sin(sdRad(h0deg)) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
        return sdDeg(Math.acos(Math.max(-1, Math.min(1, x)))) / 15;
    }
    var tz = -date.getTimezoneOffset() / 60; // 本地时区偏移（小时）
    var noon = 12 - lng / 15 + tz; // 本地太阳正午（本地时钟小时）
    function mk(hours) {
        var d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return new Date(d.getTime() + hours * 3600000);
    }
    return {
        sunset: mk(noon + h(-0.833)),
        sunrise: mk(noon - h(-0.833)),
        astroDusk: mk(noon + h(-18))
    };
}
function sdFmtTime(d) {
    try { return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch (e) { return '--:--'; }
}
function sdFmtDur(ms) {
    var min = Math.round(ms / 60000);
    if (min < 60) return min + ' 分钟';
    return Math.floor(min / 60) + ' 小时 ' + (min % 60) + ' 分';
}

// ==================== 🌃 今夜星空推荐 ====================
function renderTonightsSky() {
    var panel = document.getElementById('tonightPanel');
    if (!panel) return;
    var obs = sdGetObserver();
    var now = new Date();
    var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    var moon = sdMoonInfo(now);
    var times = sdSunTimes(now, obs.lat, obs.lng);
    var dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

    var html = sdLocRowHtml(obs, 'renderTonightsSky()');

    // 顶部四格：日落 / 天文暗夜 / 日出 / 月相照明
    html += '<div class="sd-stat-row">';
    html += '<div class="sd-stat-tile"><div class="t-icon">🌅</div><div class="t-val">' + sdFmtTime(times.sunset) + '</div><div class="t-label">日落</div></div>';
    html += '<div class="sd-stat-tile"><div class="t-icon">🌑</div><div class="t-val">' + sdFmtTime(times.astroDusk) + '</div><div class="t-label">天文暗夜</div></div>';
    html += '<div class="sd-stat-tile"><div class="t-icon">🌄</div><div class="t-val">' + sdFmtTime(sdSunTimes(midnight, obs.lat, obs.lng).sunrise) + '</div><div class="t-label">日出</div></div>';
    html += '<div class="sd-stat-tile"><div class="t-icon">' + moon.emoji + '</div><div class="t-val">' + moon.illum + '%</div><div class="t-label">月光照明</div></div>';
    html += '</div>';

    // 月相横幅
    var moonTip = moon.illum > 70 ? '<div class="m-tip" style="color:#fbbf24;">⚠️ 月光较亮，暗弱天体会受影响</div>'
        : (moon.illum < 20 ? '<div class="m-tip" style="color:#40ff88;">✅ 黑夜条件好，适合深空观测！</div>' : '');
    html += '<div class="sd-moon-banner"><div class="m-emoji">' + moon.emoji + '</div><div>' +
        '<div class="m-name">今夜月相：' + moon.name + '</div>' +
        '<div class="m-sub">照明 ' + moon.illum + '% · 月龄 ' + ((now.getTime() - Date.UTC(2000, 0, 6, 18, 14, 0)) / 86400000 % 29.530588853).toFixed(1) + ' 天</div>' +
        moonTip + '</div></div>';

    // 今夜观星条件（异步填充）
    html += '<div id="tonightCloud"></div>';

    // 午夜可见行星
    html += '<div class="sd-section-title">🪐 午夜可见的行星</div>';
    var visible = [], hidden = [];
    Object.keys(sdPlanetElems).forEach(function(en) {
        var el = sdPlanetElems[en];
        var pos = sdPlanetRaDec(en, midnight);
        var aa = sdAltAz(pos.ra, pos.dec, obs.lat, obs.lng, midnight);
        var p = { en: en, cn: el.cn, sym: el.sym, color: el.color, mag: el.mag, alt: aa.alt, az: dirs[Math.round(aa.az / 45) % 8] };
        (aa.alt > 5 ? visible : hidden).push(p);
    });
    if (visible.length === 0) {
        html += '<div class="sd-empty-tip">午夜时分没有肉眼行星在地平线上</div>';
    } else {
        html += '<div class="sd-planet-grid">';
        visible.forEach(function(p) {
            html += '<div class="sd-planet-card" style="background:' + p.color + '10;border:1px solid ' + p.color + '35;">' +
                '<div class="p-name"><span style="color:' + p.color + ';font-size:1.05rem;">' + p.sym + '</span><span style="color:' + p.color + ';">' + p.cn + '</span></div>' +
                '<div class="p-alt">' + p.alt.toFixed(0) + '° 高度角</div>' +
                '<div class="p-sub">' + p.az + '方向 · 星等 ' + p.mag.toFixed(1) + '</div></div>';
        });
        html += '</div>';
    }
    if (hidden.length > 0) {
        html += '<div style="font-size:0.72rem;color:#556677;margin-top:6px;">今夜午夜不可见：' + hidden.map(function(p) { return p.cn; }).join('、') + '</div>';
    }

    // 当季最佳深空天体
    html += '<div class="sd-section-title">🔭 当季最佳观测目标</div>';
    var mIdx = now.getMonth();
    var dso = [{ name: '月球', emoji: moon.emoji, sub: '卫星 · 目视目标', tip: '照明 ' + moon.illum + '%' }];
    if (mIdx >= 8 && mIdx <= 11) {
        dso.push({ name: '仙女座星系 M31', emoji: '🌌', sub: '旋涡星系 · 3.4 等', tip: '秋季最佳，肉眼可见' });
        dso.push({ name: '英仙座双星团', emoji: '✨', sub: '疏散星团 · 4.3 等', tip: '双筒镜绝佳目标' });
    }
    if (mIdx >= 11 || mIdx <= 2) {
        dso.push({ name: '猎户座大星云 M42', emoji: '🌫️', sub: '弥漫星云 · 4.0 等', tip: '肉眼可见的恒星摇篮' });
        dso.push({ name: '昴星团 M45', emoji: '✨', sub: '疏散星团 · 1.6 等', tip: '七姊妹，肉眼轻松可见' });
        dso.push({ name: '参宿四', emoji: '⭐', sub: '红超巨星 · 0.5 等', tip: '猎户座左肩的亮度明星' });
    }
    if (mIdx >= 3 && mIdx <= 6) {
        dso.push({ name: '狮子座三重星系', emoji: '🌌', sub: '星系群 · 9.3 等', tip: '春季星系季，需望远镜' });
        dso.push({ name: '室女座星系团', emoji: '🌌', sub: '星系团 · 8.4 等', tip: '1300+ 星系 · 6500 万光年' });
    }
    if (mIdx >= 5 && mIdx <= 9) {
        dso.push({ name: '银河核心（人马座）', emoji: '🌌', sub: '银河中心带', tip: '暗夜地点下最壮观' });
        dso.push({ name: 'M13 武仙座星团', emoji: '✨', sub: '球状星团 · 5.8 等', tip: '30 万颗恒星 · 2.5 万光年' });
    }
    dso.slice(0, 5).forEach(function(d) {
        html += '<div class="sd-dso-row"><span class="d-emoji">' + d.emoji + '</span>' +
            '<div style="flex:1;min-width:0;"><div class="d-name">' + escapeHtml(d.name) + '</div><div class="d-sub">' + escapeHtml(d.sub) + '</div></div>' +
            '<div class="d-tip">' + escapeHtml(d.tip) + '</div></div>';
    });
    html += '<div class="sd-note">💡 计算基于你所在位置的本地天文算法（行星视位置误差通常小于 1°）。点击「更新位置」可获得更精确的结果。</div>';
    panel.innerHTML = html;
    loadTonightCloud(obs);
}

// 今夜观星条件：Open-Meteo 云量预报（异步填充到 #tonightCloud）
async function loadTonightCloud(obs) {
    var box = document.getElementById('tonightCloud');
    if (!box) return;
    box.innerHTML = '<div class="sd-section-title">🌤️ 今夜观星条件</div><div style="text-align:center;color:#667788;font-size:0.8rem;padding:8px;">正在获取云量预报...</div>';
    try {
        var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + obs.lat.toFixed(3) + '&longitude=' + obs.lng.toFixed(3) +
            '&hourly=cloud_cover,precipitation_probability&daily=sunrise,sunset&timezone=auto&forecast_days=2';
        var resp = await fetch(url);
        if (!resp.ok) throw new Error('云量数据获取失败 (' + resp.status + ')');
        var data = await resp.json();
        var hourly = data.hourly;
        var daily = data.daily;
        if (!hourly || !hourly.time || !hourly.time.length) throw new Error('无云量预报数据');
        if (!daily || !daily.sunset || !daily.sunset.length) throw new Error('无日出日落数据');
        // 以观测地本地时钟的日落→次日日出作为今夜窗口，避免浏览器时区差异
        var sunset = new Date(daily.sunset[0]);
        var sunrise = new Date((daily.sunrise && daily.sunrise[1]) ? daily.sunrise[1] : daily.sunrise[0]);
        var list = [];
        for (var i = 0; i < hourly.time.length; i++) {
            var d = new Date(hourly.time[i]);
            if (d >= sunset && d <= sunrise) {
                list.push({
                    t: d,
                    cc: hourly.cloud_cover ? (hourly.cloud_cover[i] || 0) : 0,
                    pp: hourly.precipitation_probability ? (hourly.precipitation_probability[i] || 0) : 0
                });
            }
        }
        if (!list.length) throw new Error('今夜时段无预报');
        var sum = 0, sumPp = 0;
        list.forEach(function(x) {
            sum += typeof x.cc === 'number' ? x.cc : 0;
            sumPp += typeof x.pp === 'number' ? x.pp : 0;
        });
        var avg = Math.round(sum / list.length);
        var avgPp = Math.round(sumPp / list.length);
        var disp = list.filter(function(x) { return x.t.getHours() % 3 === 0; });
        if (disp.length < 3) disp = list;
        var v = avg < 20 ? ['极佳', '🌟', '#40ff88'] : avg < 40 ? ['良好', '✅', '#a3e635'] : avg < 65 ? ['一般', '⚠️', '#fbbf24'] : ['较差', '❌', '#f87171'];

        // ---- 今夜观测综合评分：云量 60% + 降水 15% + 月光干扰 25% ----
        var moonNow = sdMoonInfo(new Date());
        var cloudScore = Math.max(0, 100 - avg);
        var rainScore = Math.max(0, 100 - avgPp);
        var moonScore = Math.max(0, 100 - Math.round(moonNow.illum * 0.85));
        var score = Math.round(cloudScore * 0.6 + rainScore * 0.15 + moonScore * 0.25);
        var scoreInfo = score >= 85 ? ['极佳', '🌟', '#40ff88']
            : score >= 70 ? ['良好', '✅', '#a3e635']
            : score >= 50 ? ['一般', '⚠️', '#fbbf24']
            : score >= 30 ? ['较差', '❌', '#fb923c']
            : ['不适合', '🚫', '#f87171'];

        // 最佳时段：连续 2 小时以上、云量 < 40% 且降水概率 < 30%
        var best = null, run = [];
        list.forEach(function(x) {
            if (x.cc < 40 && x.pp < 30) {
                run.push(x);
            } else {
                if (!best || run.length > best.length) best = run.slice();
                run = [];
            }
        });
        if (!best || run.length > best.length) best = run.slice();

        var h = '<div class="sd-section-title">🌤️ 今夜观星条件</div>';
        h += '<div class="sd-score-card">' +
            '<div class="sd-score-num" style="color:' + scoreInfo[2] + ';">' + score + '</div>' +
            '<div><div class="sd-score-label">' + scoreInfo[1] + ' ' + scoreInfo[0] + '</div>' +
            '<div class="sd-score-sub">今夜观测综合评分（满分 100）</div></div>' +
            '<div class="sd-score-factors">' +
            '<div class="sd-factor-row"><span>云量</span><div class="sd-factor-bar"><i style="width:' + cloudScore + '%;background:#40ff88;"></i></div><span class="sd-factor-val">' + avg + '%</span></div>' +
            '<div class="sd-factor-row"><span>降水</span><div class="sd-factor-bar"><i style="width:' + rainScore + '%;background:#22d3ee;"></i></div><span class="sd-factor-val">' + avgPp + '%</span></div>' +
            '<div class="sd-factor-row"><span>月光</span><div class="sd-factor-bar"><i style="width:' + moonScore + '%;background:#b558ff;"></i></div><span class="sd-factor-val">' + moonNow.illum + '%</span></div>' +
            '</div></div>';
        if (best && best.length >= 2) {
            var bStart = best[0].t.getHours();
            var bEnd = (best[best.length - 1].t.getHours() + 1) % 24;
            h += '<div style="font-size:0.72rem;color:#40ff88;margin:0 0 8px;">✨ 最佳观测时段：<strong>' +
                bStart + ':00 - ' + bEnd + ':00</strong>（云量最低、无降水干扰）</div>';
        } else {
            h += '<div style="font-size:0.72rem;color:#fbbf24;margin:0 0 8px;">⚠️ 今夜没有连续 2 小时的晴空窗口，建议关注短时天气变化</div>';
        }
        h += '<div class="sd-cloud-verdict"><span style="font-size:1.3rem;">' + v[1] + '</span>' +
            '<span>今夜平均云量 <strong style="color:' + v[2] + ';">' + avg + '%</strong></span>' +
            '<span class="v-tag" style="color:' + v[2] + ';margin-left:auto;">' + v[0] + '</span></div>';
        h += '<div class="sd-trend-row">';
        disp.forEach(function(x) {
            var cc = Math.max(0, Math.min(100, x.cc));
            var bh = Math.max(5, (1 - cc / 100) * 44);
            var col = cc < 30 ? '#40ff88' : cc < 60 ? '#fbbf24' : '#f87171';
            h += '<div class="sd-trend-col"><div class="sd-trend-bar" style="height:' + bh.toFixed(0) + 'px;background:' + col + 'cc;" title="云量 ' + cc + '%"></div>' +
                '<div class="sd-trend-label">' + x.t.getHours() + '时</div></div>';
        });
        h += '</div>';
        h += '<div style="font-size:0.68rem;color:#556677;margin-top:4px;">柱高表示晴空比例（越高越晴）· 评分 = 云量 60% + 降水 15% + 月光 25% · 数据源 Open-Meteo</div>';
        sdTouch('tonight');
        box.innerHTML = h;
    } catch (e) {
        box.innerHTML = '<div class="sd-section-title">🌤️ 今夜观星条件</div><div style="font-size:0.76rem;color:#667788;padding:6px 2px;">云量预报暂不可用（' + escapeHtml(e.message || '') + '）</div>';
    }
}

// ==================== ⏰ ISS 过境预报 ====================
var issPassReminderTimer = null;
var issPassCdTimer = null;
var sdSatPromise = null;

function ensureSatelliteJs() {
    if (window.satellite) return Promise.resolve();
    if (sdSatPromise) return sdSatPromise;
    sdSatPromise = new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js';
        s.onload = function() { resolve(); };
        s.onerror = function() { sdSatPromise = null; reject(new Error('satellite.js 加载失败')); };
        document.head.appendChild(s);
    });
    return sdSatPromise;
}

function stopPassReminder() {
    if (issPassReminderTimer) { clearTimeout(issPassReminderTimer); issPassReminderTimer = null; }
    if (issPassCdTimer) { clearInterval(issPassCdTimer); issPassCdTimer = null; }
    var btn = document.getElementById('issPassReminderBtn');
    if (btn) { btn.textContent = '🔔 过境提醒'; btn.style.cssText = ''; }
}

window.togglePassReminder = function() {
    if (issPassReminderTimer) { stopPassReminder(); return; }
    var passes = window._sdIssPasses || [];
    if (!passes.length) { alert('暂无可提醒的过境'); return; }
    var next = passes[0];
    var wait = next.start - Date.now() - 10 * 60000;
    if (wait < 0) wait = Math.max(next.start - Date.now(), 0);
    if (window.Notification && Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (e) {}
    }
    issPassReminderTimer = setTimeout(function() {
        issPassReminderTimer = null;
        var msg = '🛸 ISS 将在 10 分钟内过境（最大高度 ' + next.maxEl.toFixed(0) + '°），抬头看看！';
        try {
            if (window.Notification && Notification.permission === 'granted') new Notification('ISS 过境提醒', { body: msg });
            else alert(msg);
        } catch (e) { alert(msg); }
    }, wait);
    var btn = document.getElementById('issPassReminderBtn');
    if (btn) { btn.textContent = '✅ 已设提醒（提前10分钟）'; btn.style.cssText = 'background:rgba(64,255,136,0.15);border-color:rgba(64,255,136,0.4);color:#40ff88;'; }
};

function computeISSPasses(obs, line1, line2, days) {
    var satrec = satellite.twoline2satrec(line1, line2);
    if (satrec.error && satrec.error !== 0) throw new Error('TLE 解析失败 (错误码 ' + satrec.error + ')');
    var obsGd = { latitude: sdRad(obs.lat), longitude: sdRad(obs.lng), height: 0.05 };
    var start = Date.now();
    var end = start + days * 86400000;
    var step = 30000;
    var passes = [], cur = null;
    for (var t = start; t <= end; t += step) {
        var date = new Date(t);
        var eci = satellite.propagate(satrec, date);
        if (!eci || !eci.position) continue;
        var gmst = satellite.gstime(date);
        var ecf = satellite.eciToEcf(eci.position, gmst);
        var look = satellite.ecfToLookAngles ? satellite.ecfToLookAngles(obsGd, ecf) : satellite.eciToLookAngles(obsGd, ecf);
        var el = sdDeg(look.elevation);
        if (el >= 0) {
            if (!cur) cur = { start: t, end: t, maxEl: el, maxT: t, azMax: sdDeg(look.azimuth) };
            else {
                cur.end = t;
                if (el > cur.maxEl) { cur.maxEl = el; cur.maxT = t; cur.azMax = sdDeg(look.azimuth); }
            }
        } else if (cur) {
            if (cur.maxEl >= 10) passes.push(cur);
            cur = null;
        }
    }
    return passes.slice(0, 10);
}

var issPassLoadedOnce = false;
async function loadISSPasses() {
    var panel = document.getElementById('issPassPanel');
    if (!panel) return;
    if (window._sdIssPasses && window._sdIssPassesTime && Date.now() - window._sdIssPassesTime < 10 * 60000) {
        renderISSPasses(panel, window._sdIssPasses);
        return;
    }
    var obs = sdGetObserver();
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">🛰️ 正在推算未来 5 天「' + escapeHtml(obs.label) + '」上空的 ISS 过境...</div>';
    try {
        await ensureSatelliteJs();
        var tle = null;
        try { tle = JSON.parse(localStorage.getItem('sd_iss_tle')); } catch (e) {}
        if (!tle || !tle.line1 || Date.now() - (tle.t || 0) > 12 * 3600000) {
            var resp = await fetch('https://tle.ivanstanojevic.me/api/tle/25544');
            if (!resp.ok) throw new Error('TLE 数据获取失败: ' + resp.status);
            var data = await resp.json();
            tle = { line1: data.line1, line2: data.line2, t: Date.now() };
            try { localStorage.setItem('sd_iss_tle', JSON.stringify(tle)); } catch (e2) {}
        }
        var passes = computeISSPasses(obs, tle.line1, tle.line2, 5);
        window._sdIssPasses = passes;
        window._sdIssPassesTime = Date.now();
        issPassLoadedOnce = true;
        sdTouch('isspass');
        renderISSPasses(panel, passes);
    } catch (e) {
        panel.innerHTML = '<div style="text-align:center;padding:40px;color:#ff4060;">⚠️ ' + escapeHtml(e.message || '计算失败') +
            '<br><button onclick="loadISSPasses()" style="margin-top:12px;padding:8px 20px;background:rgba(91,143,255,0.15);border:1px solid rgba(91,143,255,0.3);color:#5b8fff;border-radius:8px;cursor:pointer;">重试</button></div>';
    }
}

function renderISSPasses(panel, passes) {
    var obs = sdGetObserver();
    var dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    var html = sdLocRowHtml(obs, 'window._sdIssPasses=null;loadISSPasses()');
    html += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px;">' +
        '<button id="issPassReminderBtn" onclick="togglePassReminder()" style="background:rgba(91,143,255,0.12);border:1px solid rgba(91,143,255,0.25);color:#5b8fff;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:0.75rem;font-family:inherit;">🔔 过境提醒</button></div>';

    if (passes.length === 0) {
        html += '<div class="sd-empty-tip">未来 5 天计算窗口内没有最大高度超过 10° 的过境（可尝试更新位置）</div>';
        panel.innerHTML = html;
        return;
    }

    // 下次过境倒计时
    var next = passes[0];
    html += '<div class="sd-countdown-banner"><div class="cd-label">下一次过境 · ' +
        new Date(next.start).toLocaleString('zh-CN', { month: 'long', day: 'numeric' }) + ' ' + sdFmtTime(new Date(next.start)) + '</div>' +
        '<div class="cd-val" id="issPassCd">--</div>' +
        '<div class="cd-sub">最大高度 ' + next.maxEl.toFixed(0) + '° · ' + dirs[Math.round(next.azMax / 45) % 8] + '方向</div></div>';

    passes.slice(0, 8).forEach(function(p, idx) {
        var d = new Date(p.start);
        var dur = p.end - p.start;
        var times = sdSunTimes(d, obs.lat, obs.lng);
        var isDark = (d.getTime() > times.astroDusk.getTime()) || (d.getTime() < times.sunrise.getTime() - 90 * 60000);
        var darkBadge = isDark
            ? '<span class="ps-badge" style="background:rgba(64,255,136,0.12);color:#40ff88;">🌙 暗夜 · 肉眼可见</span>'
            : '<span class="ps-badge" style="background:rgba(251,191,36,0.1);color:#fbbf24;">☀️ 白天/黄昏 · 较难目视</span>';
        html += '<div class="sd-pass-card' + (idx === 0 ? ' next' : '') + '">' +
            '<div class="ps-head"><span class="ps-time">' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + sdFmtTime(d) + '</span>' + darkBadge + '</div>' +
            '<div class="ps-grid">' +
            '<span>最大高度 <strong>' + p.maxEl.toFixed(0) + '°</strong></span>' +
            '<span>方向 <strong>' + dirs[Math.round(p.azMax / 45) % 8] + '</strong></span>' +
            '<span>持续 <strong>' + sdFmtDur(dur) + '</strong></span>' +
            '</div></div>';
    });
    html += '<div class="sd-note">💡 高度角 ≥10° 的过境才会列出。白天过境时 ISS 同样在天上飞，但阳光太亮肉眼看不到；黄昏/黎明的过境最容易看到一颗「不眨眼的星」划过夜空。</div>';
    panel.innerHTML = html;

    // 倒计时每秒刷新
    if (issPassCdTimer) clearInterval(issPassCdTimer);
    issPassCdTimer = setInterval(function() {
        var el = document.getElementById('issPassCd');
        if (!el) { if (issPassCdTimer) clearInterval(issPassCdTimer); issPassCdTimer = null; return; }
        var diff = next.start - Date.now();
        el.textContent = diff <= 0 ? '正在过境！抬头看！' : sdFmtDur(diff) + ' 后';
    }, 1000);
}

// ==================== ☀️ 空间天气 (NOAA SWPC) ====================
var kpBands = [
    { max: 1.9, lat: '~67°N', label: '极光活动平静', places: '冰岛北部 · 挪威特罗姆瑟 · 阿拉斯加费尔班克斯' },
    { max: 2.9, lat: '~66°N', label: '微弱活动', places: '雷克雅未克 · 罗瓦涅米 · 摩尔曼斯克' },
    { max: 3.9, lat: '~62°N', label: '轻度活动', places: '赫尔辛基 · 安克雷奇 · 漠河（需高值配合）' },
    { max: 4.9, lat: '~58°N', label: '中度活动', places: '爱丁堡 · 莫斯科 · 奥斯陆' },
    { max: 5.9, lat: '~55°N', label: 'G1 弱磁暴', places: '哥本哈根 · 塔林 · 阿伯丁' },
    { max: 6.9, lat: '~52°N', label: 'G2 中等磁暴', places: '伦敦 · 华沙 · 温哥华' },
    { max: 7.9, lat: '~48°N', label: 'G3 强磁暴', places: '巴黎 · 西雅图 · 多伦多' },
    { max: 8.9, lat: '~42°N', label: 'G4 严重磁暴', places: '纽约 · 罗马 · 马德里' },
    { max: 99,  lat: '<40°N', label: 'G5 极端磁暴', places: '开罗 · 休斯顿 · 上海 · 东京' }
];
var kpSegColors = ['#40ff88', '#40ff88', '#a3e635', '#fbbf24', '#fb923c', '#f87171', '#f87171', '#fb7185', '#f43f5e'];

function sdKpLevel(kp) {
    if (kp >= 9) return { label: 'G5 极端磁暴', color: '#f43f5e' };
    if (kp >= 8) return { label: 'G4 严重磁暴', color: '#fb7185' };
    if (kp >= 7) return { label: 'G3 强磁暴', color: '#f87171' };
    if (kp >= 6) return { label: 'G2 中等磁暴', color: '#fb923c' };
    if (kp >= 5) return { label: 'G1 弱磁暴', color: '#fbbf24' };
    if (kp >= 4) return { label: '中度活动', color: '#a3e635' };
    if (kp >= 2) return { label: '轻度活动', color: '#40ff88' };
    return { label: '极光活动平静', color: '#40ff88' };
}
function sdParseUTC(s) {
    if (/Z|[+-]\d\d:?\d\d$/.test(s)) return new Date(s);
    return new Date(s.replace(' ', 'T') + 'Z');
}

// X 射线耀斑等级对应的颜色
function sdFlareColor(cls) {
    var c = (cls || '').charAt(0).toUpperCase();
    if (c === 'X') return '#f43f5e';
    if (c === 'M') return '#fb923c';
    if (c === 'C') return '#fbbf24';
    if (c === 'B') return '#a3e635';
    return '#40ff88';
}

// 空间天气顶部：太阳风 / IMF / 耀斑 / F10.7
function renderSpaceWeatherTiles() {
    var wArr = window._sdAuroraWind, mArr = window._sdAuroraMag, fArr = window._sdAuroraFlare, xArr = window._sdAuroraFlux;
    var wind = wArr && wArr.length ? wArr[wArr.length - 1] : null;
    var mag = mArr && mArr.length ? mArr[mArr.length - 1] : null;
    var flare = fArr && fArr.length ? fArr[fArr.length - 1] : null;
    var flux = xArr && xArr.length ? xArr[xArr.length - 1] : null;
    if (!wind && !mag && !flare && !flux) return '';
    var h = '<div class="sd-section-title">☀️ 太阳活动实时</div><div class="sd-stat-row">';
    if (wind && typeof wind.proton_speed === 'number') {
        var sp = wind.proton_speed;
        var sl = sp >= 600 ? ['高速', '#f87171'] : sp >= 500 ? ['偏快', '#fb923c'] : sp >= 400 ? ['中等', '#fbbf24'] : ['平静', '#40ff88'];
        h += '<div class="sd-stat-tile"><div class="t-icon">🌬️</div><div class="t-val">' + Math.round(sp) + ' <span style="font-size:0.58rem;color:#667788;">km/s</span></div><div class="t-label" style="color:' + sl[1] + ';">太阳风 · ' + sl[0] + '</div></div>';
    }
    if (mag && typeof mag.bz_gsm === 'number') {
        var bz = mag.bz_gsm;
        var bl = bz <= -10 ? ['强南向', '#f43f5e'] : bz <= -5 ? ['南向', '#fb923c'] : bz < 0 ? ['弱南向', '#fbbf24'] : ['北向', '#40ff88'];
        h += '<div class="sd-stat-tile"><div class="t-icon">🧲</div><div class="t-val">' + (bz > 0 ? '+' : '') + bz.toFixed(0) + ' <span style="font-size:0.58rem;color:#667788;">nT</span></div><div class="t-label" style="color:' + bl[1] + ';">IMF Bz · ' + bl[0] + '</div></div>';
    }
    if (flare && flare.current_class) {
        h += '<div class="sd-stat-tile"><div class="t-icon">💥</div><div class="t-val" style="color:' + sdFlareColor(flare.current_class) + ';">' + escapeHtml(flare.current_class) + '</div><div class="t-label">X 射线耀斑</div></div>';
    }
    if (flux && typeof flux.flux === 'number') {
        h += '<div class="sd-stat-tile"><div class="t-icon">📻</div><div class="t-val">' + flux.flux + ' <span style="font-size:0.58rem;color:#667788;">sfu</span></div><div class="t-label">F10.7 射电通量</div></div>';
    }
    h += '</div>';
    h += '<div class="sd-section-title">🌍 地磁活动与极光</div>';
    return h;
}

async function loadAurora() {
    var panel = document.getElementById('auroraPanel');
    if (!panel) return;
    if (window._sdAuroraTime && Date.now() - window._sdAuroraTime < 30 * 60000) {
        renderAurora(panel, window._sdAuroraObs, window._sdAuroraFc);
        return;
    }
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">☀️ 正在获取 NOAA 空间天气数据...</div>';
    var swGet = function(url) { return fetch(url).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }); };
    try {
        var res = await Promise.all([
            swGet('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
            swGet('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'),
            swGet('https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json'),
            swGet('https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json'),
            swGet('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json'),
            swGet('https://services.swpc.noaa.gov/products/summary/10cm-flux.json')
        ]);
        var obsJson = res[0], fcJson = res[1];
        if (!obsJson) throw new Error('NOAA 观测数据获取失败');
        window._sdAuroraObs = obsJson;
        window._sdAuroraFc = fcJson;
        window._sdAuroraWind = res[2];
        window._sdAuroraMag = res[3];
        window._sdAuroraFlare = res[4];
        window._sdAuroraFlux = res[5];
        window._sdAuroraTime = Date.now();
        renderAurora(panel, obsJson, fcJson);
    } catch (e) {
        panel.innerHTML = '<div style="text-align:center;padding:40px;color:#ff4060;">⚠️ ' + escapeHtml(e.message || '加载失败') +
            '<br><button onclick="loadAurora()" style="margin-top:12px;padding:8px 20px;background:rgba(91,143,255,0.15);border:1px solid rgba(91,143,255,0.3);color:#5b8fff;border-radius:8px;cursor:pointer;">重试</button></div>';
    }
}

function renderAurora(panel, obsJson, fcJson) {
    var obsVals = [];
    (obsJson || []).forEach(function(row) {
        var kp = (typeof row === 'object' && row) ? (row.Kp !== undefined ? row.Kp : row.kp) : null;
        if (typeof kp === 'number' && !isNaN(kp)) obsVals.push({ t: sdParseUTC(row.time_tag), kp: kp });
    });
    obsVals.sort(function(a, b) { return a.t - b.t; });
    var recent = obsVals.slice(-9);
    var current = recent.length ? recent[recent.length - 1] : null;

    var html = '';
    html += renderSpaceWeatherTiles();
    if (current) {
        var level = sdKpLevel(current.kp);
        var band = null;
        for (var bi = 0; bi < kpBands.length; bi++) { if (current.kp <= kpBands[bi].max) { band = kpBands[bi]; break; } }
        html += '<div class="sd-kp-value-row"><span class="kp-num">Kp ' + current.kp.toFixed(1) + '</span>' +
            '<span class="kp-level" style="background:' + level.color + '22;color:' + level.color + ';border:1px solid ' + level.color + '55;">' + level.label + '</span>' +
            '<span style="font-size:0.7rem;color:#556677;">' + sdFmtTime(current.t) + ' 观测</span></div>';
        html += '<div class="sd-kp-gauge">';
        for (var s = 0; s < 9; s++) {
            var on = current.kp >= s + 1;
            var frac = Math.max(0, Math.min(1, current.kp - s));
            html += '<div class="sd-kp-seg" style="' + (on ? 'background:' + kpSegColors[s] + ';' : (frac > 0 ? 'background:' + kpSegColors[s] + '55;' : '')) + '"></div>';
        }
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:0.62rem;color:#556677;margin-bottom:12px;"><span>0 安静</span><span>4 中等</span><span>9 极端</span></div>';

        if (band) {
            html += '<div class="sd-aurora-loc active"><span class="a-lat">' + band.lat + '</span>' +
                '<span class="a-desc">当前极光可见南界约在 <strong style="color:#40ff88;">' + band.lat + '</strong> 纬度带 · ' + escapeHtml(band.label) + '</span></div>';
            html += '<div class="sd-aurora-loc"><span class="a-lat">🌍</span><span class="a-desc">当前纬度带代表观测地：' + escapeHtml(band.places) + '</span></div>';
        }
    } else {
        html += '<div class="sd-empty-tip">暂无有效 Kp 观测数据</div>';
    }

    // 过去 24h 观测趋势
    if (recent.length > 1) {
        html += '<div class="sd-section-title">📉 过去 24 小时 Kp 观测</div><div class="sd-trend-row">';
        recent.forEach(function(v) {
            var h = Math.min(1, v.kp / 9);
            html += '<div class="sd-trend-col"><div class="sd-trend-bar" style="height:' + Math.max(6, h * 44) + 'px;background:' + sdKpLevel(v.kp).color + 'cc;" title="Kp ' + v.kp.toFixed(2) + '"></div><div class="sd-trend-label">' + sdFmtTime(v.t).slice(0, 2) + '时</div></div>';
        });
        html += '</div>';
    }

    // 未来 24h 预报
    if (fcJson && fcJson.length) {
        var now = Date.now();
        var fc = [];
        for (var fi = 0; fi < fcJson.length; fi++) {
            var row = fcJson[fi];
            var kp = (typeof row === 'object' && row) ? (row.kp !== undefined ? row.kp : row.Kp) : null;
            if (typeof kp !== 'number' || isNaN(kp)) continue;
            var t = sdParseUTC(row.time_tag);
            if (t.getTime() > now && fc.length < 8) fc.push({ t: t, kp: kp });
        }
        if (fc.length) {
            var maxFc = fc.reduce(function(a, b) { return b.kp > a.kp ? b : a; });
            html += '<div class="sd-section-title">🔮 未来 24 小时 Kp 预报</div><div class="sd-trend-row">';
            fc.forEach(function(v) {
                var h2 = Math.min(1, v.kp / 9);
                html += '<div class="sd-trend-col"><div class="sd-trend-bar" style="height:' + Math.max(6, h2 * 44) + 'px;background:' + sdKpLevel(v.kp).color + '88;" title="Kp ' + v.kp.toFixed(2) + '"></div><div class="sd-trend-label">' + sdFmtTime(v.t).slice(0, 2) + '时</div></div>';
            });
            html += '</div>';
            html += '<div style="font-size:0.72rem;color:#667788;margin-top:4px;">未来 24h 预计最高 Kp <strong style="color:' + sdKpLevel(maxFc.kp).color + ';">' + maxFc.kp.toFixed(1) + '</strong>（' + sdFmtTime(maxFc.t) + '）</div>';
        }
    }

    html += '<div class="sd-note">🇨🇳 中国大陆处于中低磁纬，常规情况下看不到极光。当 Kp ≥ 5 时，漠河、新疆阿勒泰等高磁纬地区有机会目视极光。极光实际可见性还取决于当地天气、光污染与极光椭圆区位置。</div>';
    sdTouch('aurora');
    panel.innerHTML = html;
}

// ==================== 🛰️ 卫星编队追踪 ====================
var satFleetList = [
    { id: 25544, name: '国际空间站 ISS', type: '空间站', color: '#5b8fff' },
    { id: 48274, name: '天和核心舱（中国空间站）', type: '空间站', color: '#f87171' },
    { id: 20580, name: '哈勃太空望远镜', type: '望远镜', color: '#a78bfa' },
    { id: 25994, name: 'Terra 对地观测', type: '对地观测', color: '#34d399' },
    { id: 43013, name: 'NOAA-20 气象卫星', type: '气象', color: '#fbbf24' },
    { id: 49260, name: 'Landsat 9', type: '对地观测', color: '#22d3ee' },
    { id: 40697, name: 'Sentinel-2A', type: '对地观测', color: '#40ff88' },
    { id: 24876, name: 'GPS BIIR-2 (PRN13)', type: '导航', color: '#fb923c' }
];
var fleetTimer = null;

function stopSatFleet() {
    if (fleetTimer) { clearInterval(fleetTimer); fleetTimer = null; }
}

async function fetchFleetTle(item) {
    var key = 'sd_fleet_tle_' + item.id;
    try {
        var c = JSON.parse(localStorage.getItem(key));
        if (c && c.line1 && Date.now() - (c.t || 0) < 12 * 3600000) return c;
    } catch (e) {}
    var resp = await fetch('https://tle.ivanstanojevic.me/api/tle/' + item.id);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var d = await resp.json();
    if (!d || !d.line1 || !d.line2) throw new Error('无 TLE 数据');
    var rec = { line1: d.line1, line2: d.line2, name: d.name, t: Date.now() };
    try { localStorage.setItem(key, JSON.stringify(rec)); } catch (e2) {}
    return rec;
}

async function loadSatFleet() {
    var panel = document.getElementById('fleetPanel');
    if (!panel) return;
    stopSatFleet();
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">🛰️ 正在获取卫星轨道根数（TLE）并推算位置...</div>';
    try {
        await ensureSatelliteJs();
        var results = await Promise.all(satFleetList.map(function(it) {
            return fetchFleetTle(it).then(function(tle) { return { meta: it, tle: tle }; }).catch(function() { return null; });
        }));
        var now = new Date();
        var gmst = satellite.gstime(now);
        var sats = [];
        results.forEach(function(r) {
            if (!r) return;
            try {
                var satrec = satellite.twoline2satrec(r.tle.line1, r.tle.line2);
                var pv = satellite.propagate(satrec, now);
                if (!pv || !pv.position) return;
                var geo = satellite.eciToGeodetic(pv.position, gmst);
                sats.push({
                    meta: r.meta,
                    satrec: satrec,
                    name: r.meta.name,
                    lat: satellite.degreesLat(geo.latitude),
                    lng: satellite.degreesLong(geo.longitude),
                    alt: geo.height,
                    vel: Math.sqrt(pv.velocity.x * pv.velocity.x + pv.velocity.y * pv.velocity.y + pv.velocity.z * pv.velocity.z)
                });
            } catch (e) {}
        });
        if (!sats.length) throw new Error('未能解析任何卫星轨道（TLE 服务可能繁忙）');
        window._sdFleet = sats;
        sdTouch('fleet');
        renderSatFleet(panel, sats);
        fleetTimer = setInterval(updateFleetPositions, 5000);
    } catch (e) {
        panel.innerHTML = '<div style="text-align:center;padding:40px;color:#ff4060;">⚠️ ' + escapeHtml(e.message || '加载失败') +
            '<br><button onclick="loadSatFleet()" style="margin-top:12px;padding:8px 20px;background:rgba(91,143,255,0.15);border:1px solid rgba(91,143,255,0.3);color:#5b8fff;border-radius:8px;cursor:pointer;">重试</button></div>';
    }
}

function renderSatFleet(panel, sats) {
    var h = '<div class="sd-loc-row"><span>🛰️ 已定位 ' + sats.length + ' / ' + satFleetList.length + ' 颗航天器 · 每 5 秒刷新</span>' +
        '<button onclick="loadSatFleet()">刷新</button></div>';
    h += '<div class="fleet-map">';
    sats.forEach(function(s, i) {
        var x = (s.lng + 180) / 360 * 100;
        var y = (90 - s.lat) / 180 * 100;
        h += '<div class="fleet-dot" id="fleetDot-' + i + '" title="' + escapeHtml(s.name) + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;background:' + s.meta.color + ';box-shadow:0 0 10px ' + s.meta.color + ';"></div>';
    });
    h += '</div>';
    h += '<div class="fleet-legend">';
    sats.forEach(function(s) {
        h += '<span class="lg"><i style="background:' + s.meta.color + ';"></i>' + escapeHtml(s.meta.name) + '</span>';
    });
    h += '</div>';
    sats.forEach(function(s, i) {
        h += '<div class="fleet-row">' +
            '<span class="f-name" style="color:' + s.meta.color + ';">● ' + escapeHtml(s.name) + '</span>' +
            '<span class="f-meta"><span id="fleetLat-' + i + '">' + s.lat.toFixed(1) + '</span>°, <span id="fleetLng-' + i + '">' + s.lng.toFixed(1) + '</span>° · <span id="fleetAlt-' + i + '">' + s.alt.toFixed(0) + '</span> km · <span id="fleetVel-' + i + '">' + s.vel.toFixed(2) + '</span> km/s</span>' +
            '<span class="f-type">' + escapeHtml(s.meta.type) + '</span></div>';
    });
    h += '<div class="sd-note">💡 轨道位置由 TLE 根数经 SGP4 模型实时推算，误差通常小于数公里；TLE 每 12 小时自动更新。中国空间站、哈勃、GPS 与多颗对地观测/气象卫星同屏追踪。</div>';
    panel.innerHTML = h;
}

function updateFleetPositions() {
    var sats = window._sdFleet;
    if (!sats || !sats.length || !window.satellite) return;
    var now = new Date();
    var gmst = satellite.gstime(now);
    sats.forEach(function(s, i) {
        try {
            var pv = satellite.propagate(s.satrec, now);
            if (!pv || !pv.position) return;
            var geo = satellite.eciToGeodetic(pv.position, gmst);
            s.lat = satellite.degreesLat(geo.latitude);
            s.lng = satellite.degreesLong(geo.longitude);
            s.alt = geo.height;
            s.vel = Math.sqrt(pv.velocity.x * pv.velocity.x + pv.velocity.y * pv.velocity.y + pv.velocity.z * pv.velocity.z);
            var dot = document.getElementById('fleetDot-' + i);
            if (dot) { dot.style.left = ((s.lng + 180) / 360 * 100).toFixed(2) + '%'; dot.style.top = ((90 - s.lat) / 180 * 100).toFixed(2) + '%'; }
            var le = document.getElementById('fleetLat-' + i); if (le) le.textContent = s.lat.toFixed(1);
            var lo = document.getElementById('fleetLng-' + i); if (lo) lo.textContent = s.lng.toFixed(1);
            var al = document.getElementById('fleetAlt-' + i); if (al) al.textContent = s.alt.toFixed(0);
            var ve = document.getElementById('fleetVel-' + i); if (ve) ve.textContent = s.vel.toFixed(2);
        } catch (e) {}
    });
}

// ==================== 图片灯箱事件绑定 ====================
if (!window._spaceFeaturesInit) {
    window._spaceFeaturesInit = true;
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList && e.target.classList.contains('post-image')) {
            openImageLightbox(e.target.src);
        }
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var lb = document.getElementById('imageLightbox');
            if (lb && lb.classList.contains('show')) closeImageLightbox();
        }
    });
}
