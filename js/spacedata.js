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
function openSpaceDataModal() {
    document.getElementById('spaceDataModal').classList.add('show');
    switchSDTab('iss', document.querySelector('.sd-tab'));
}
function closeSpaceDataModal() {
    var f = document.getElementById('nasaEyesFrame'); if (f && f.src !== 'about:blank') { f.src = 'about:blank'; }
    document.getElementById('spaceDataModal').classList.remove('show');
    stopISSTracking();
}
window.switchSDTab = function(tab, btn) {
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
        var resp = await fetch('https://api.whertheiss.at/v1/satellites/25544');
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

    try {
        var cacheKey = 'iss_crew_cache';
        var cacheTimeKey = 'iss_crew_cache_time';
        var now = Date.now();
        var cachedTime = parseInt(localStorage.getItem(cacheTimeKey) || '0');
        var cached = localStorage.getItem(cacheKey);

        if (cached && (now - cachedTime) < 3600000) {
            try {
                var cachedData = JSON.parse(cached);
                renderCrewList(cachedData.iss, cachedData.tiangong);
                return;
            } catch(e) {}
        }

        var resp = await fetch('https://api.open-notify.org/astros.json');
        if (!resp.ok) throw new Error('Astros API error: ' + resp.status);
        var data = await resp.json();

        var issCrew = [];
        var tiangongCrew = [];
        for (var i = 0; i < data.people.length; i++) {
            var p = data.people[i];
            var info = astroDb[p.name] || { agency: 'Unknown', flag: '🚀' };
            var entry = {
                name: p.name,
                craft: p.craft,
                agency: info.agency,
                flag: info.flag
            };
            if (p.craft === 'ISS') issCrew.push(entry);
            else if (p.craft === 'Tiangong') tiangongCrew.push(entry);
        }

        localStorage.setItem(cacheKey, JSON.stringify({ iss: issCrew, tiangong: tiangongCrew }));
        localStorage.setItem(cacheTimeKey, String(now));

        renderCrewList(issCrew, tiangongCrew);
    } catch(e) {
        console.error('ISS crew fetch error:', e);
        var cached2 = localStorage.getItem('iss_crew_cache');
        if (cached2) {
            try {
                var cachedData2 = JSON.parse(cached2);
                renderCrewList(cachedData2.iss, cachedData2.tiangong);
                var note2 = document.getElementById('crewPanel');
                if (note2) {
                    var warn = document.createElement('div');
                    warn.style.cssText = 'text-align:center;padding:6px;color:#667788;font-size:0.8rem;';
                    warn.textContent = '⚠️ 实时数据获取失败，显示缓存数据';
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
            warn.textContent = '⚠️ 实时数据获取失败，显示默认乘组名单';
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
            html += '<div class="crew-craft">ISS (' + escapeHtml(c.agency) + ')</div>';
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
                html += '<div class="crew-craft">' + escapeHtml(t.craft) + ' (' + escapeHtml(t.agency) + ')</div>';
                html += '</div></div>';
            }
            html += '</div>';
        }
        html += '<div style="text-align:center;margin-top:12px;font-size:0.75rem;color:#667788;">数据来源: open-notify.org 实时在轨人员API · 每小时更新</div>';
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
    { date: '2026-02-17', type: 'annular', kind: 'solar', name: '日环食', visibility: '南极洲', magnitude: 0.963, duration: '2分20秒', note: '南极洲可见，南美洲南端可见偏食' },
    { date: '2026-03-03', type: 'total', kind: 'lunar', name: '月全食', visibility: '亚洲东部、大洋洲、太平洋', magnitude: 1.151, duration: '全食58分', note: '中国可见全过程' },
    { date: '2026-08-12', type: 'total', kind: 'solar', name: '日全食', visibility: '北欧、格陵兰、冰岛、西班牙', magnitude: 1.039, duration: '2分18秒', note: '欧洲北部可见全食，北半球其他地区可见偏食' },
    { date: '2026-08-28', type: 'partial', kind: 'lunar', name: '月偏食', visibility: '美洲、欧洲、非洲', magnitude: 0.930, duration: '偏食3h18m', note: '美洲地区可见' },
    { date: '2027-02-06', type: 'annular', kind: 'solar', name: '日环食', visibility: '南美洲、太平洋、大西洋', magnitude: 0.928, duration: '7分51秒', note: '智利、阿根廷可见环食' },
    { date: '2027-02-20', type: 'penumbral', kind: 'lunar', name: '半影月食', visibility: '美洲、欧洲、非洲', magnitude: 0.929, duration: '约4小时', note: '半影月食，亮度变化不明显' },
    { date: '2027-03-29', type: 'partial', kind: 'solar', name: '日偏食', visibility: '北美洲、欧洲、非洲北部', magnitude: 0.938, duration: '-', note: '北大西洋和欧洲可见偏食' },
    { date: '2027-07-07', type: 'penumbral', kind: 'lunar', name: '半影月食', visibility: '太平洋、澳洲、亚洲东部', magnitude: 0.390, duration: '约3小时', note: '半影月食，不易察觉' },
    { date: '2027-08-02', type: 'total', kind: 'solar', name: '日全食', visibility: '北非、中东、西班牙', magnitude: 1.079, duration: '6分23秒', note: '本世纪最长日全食之一，埃及、沙特可见' },
    { date: '2027-08-28', type: 'penumbral', kind: 'lunar', name: '半影月食', visibility: '美洲、欧洲、非洲', magnitude: 0.470, duration: '约3.5小时', note: '半影月食' },
    { date: '2028-01-26', type: 'annular', kind: 'solar', name: '日环食', visibility: '南美洲、北大西洋、欧洲', magnitude: 0.921, duration: '10分27秒', note: '西班牙、葡萄牙可见环食' },
    { date: '2028-02-12', type: 'total', kind: 'lunar', name: '月全食', visibility: '太平洋、美洲、亚洲东部', magnitude: 1.099, duration: '全食约80分', note: '中国东部可见' },
    { date: '2028-07-22', type: 'total', kind: 'solar', name: '日全食', visibility: '澳大利亚、新西兰', magnitude: 1.056, duration: '5分10秒', note: '澳大利亚悉尼可见全食' },
    { date: '2028-07-31', type: 'partial', kind: 'lunar', name: '月偏食', visibility: '非洲、亚洲、澳洲', magnitude: 0.187, duration: '偏食约2小时', note: '非洲和亚洲可见' },
    { date: '2028-12-25', type: 'annular', kind: 'solar', name: '日环食', visibility: '南美洲、大西洋', magnitude: 0.950, duration: '2分35秒', note: '南美洲可见' }
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
            var sdm = document.getElementById('spaceDataModal');
            if (sdm && sdm.classList.contains('show')) closeSpaceDataModal();
        }
    });
}
