// ==================== ISS 当前乘组 ====================
var crewLoaded = false;
async function loadISSCrew() {
    var panel = document.getElementById('crewPanel');
    if (!panel) return;
    if (crewLoaded) return;
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#667788;">\u{1f680} \u52a0\u8f7dISS\u4e58\u7ec4\u4fe1\u606f...</div>';

    // Astronaut name -> {agency, flag} lookup (comprehensive, covers active astronauts 2024-2027)
    var astroDb = {
        // NASA (USA)
        'Jessica Meir': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Jack Hathaway': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Anil Menon': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Raja Chari': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Thomas Marshburn': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Kayla Barron': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Matthias Maurer': { agency: 'ESA', flag: '\u{1f1ea}\u{1f1f6}' },
        'Bob Hines': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Samantha Cristoforetti': { agency: 'ESA', flag: '\u{1f1ea}\u{1f1f6}' },
        'Kjell Lindgren': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Bob Behnken': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Doug Hurley': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Mike Hopkins': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Victor Glover': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Shannon Walker': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Soichi Noguchi': { agency: 'JAXA', flag: '\u{1f1ef}\u{1f1f5}' },
        'Shane Kimbrough': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Megan McArthur': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Akihiko Hoshide': { agency: 'JAXA', flag: '\u{1f1ef}\u{1f1f5}' },
        'Thomas Pesquet': { agency: 'ESA', flag: '\u{1f1ea}\u{1f1f6}' },
        'Frank Rubio': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Stephen Bowen': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Warren Hoburg': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Sultan Al Neyadi': { agency: 'UAE', flag: '\u{1f1e6}\u{1f1ea}' },
        'Andrei Fedyaev': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Jasmin Moghbeli': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Andreas Mogensen': { agency: 'ESA', flag: '\u{1f1ea}\u{1f1f6}' },
        'Satoshi Furukawa': { agency: 'JAXA', flag: '\u{1f1ef}\u{1f1f5}' },
        'Konstantin Borisov': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Matthew Dominick': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Michael Barratt': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Jeanette Epps': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Alexander Grebenkin': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Butch Wilmore': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Sunita Williams': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Nick Hague': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Aleksandr Gorbunov': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Zena Cardman': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Stephanie Wilson': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Anne McClain': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Nichole Ayers': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Takuya Onishi': { agency: 'JAXA', flag: '\u{1f1ef}\u{1f1f5}' },
        'Kirill Peskov': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Jonny Kim': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Sergey Ryzhikov': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Alexey Zubritsky': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Sergey Krikalev': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Tracy Caldwell Dyson': { agency: 'NASA', flag: '\u{1f1fa}\u{1f1f8}' },
        'Oleg Kononenko': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Nikolai Chub': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Oleg Artemyev': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Denis Matveev': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Sergey Korsakov': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Pyotr Dubrov': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Anna Kikina': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Andrey Fedyaev': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Frank de Winne': { agency: 'ESA', flag: '\u{1f1ea}\u{1f1f6}' },
        'Andrei Fedyaev': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        'Sophie Adenot': { agency: 'ESA', flag: '\u{1f1ea}\u{1f1f6}' },
        'Andrey Fedyaev': { agency: 'Roscosmos', flag: '\u{1f1f7}\u{1f1fa}' },
        // Tiangong crew
        'Li Guangsu': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Li Cong': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Ye Guangfu': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Jing Haipeng': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Zhu Yangzhu': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Gui Haichao': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Tang Shengjie': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Cai Xuzhe': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Song Lingdong': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Wang Haoze': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Chen Dong': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Liu Yang': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' },
        'Cai Xuzhe': { agency: 'CNSA', flag: '\u{1f1e8}\u{1f1f3}' }
    };

    var fallbackCrew = [
        { name: 'Jessica Meir', craft: 'ISS Expedition 75 (NASA)', flag: '\u{1f1fa}\u{1f1f8}' },
        { name: 'Jack Hathaway', craft: 'ISS Expedition 75 (NASA)', flag: '\u{1f1fa}\u{1f1f8}' },
        { name: 'Anil Menon', craft: 'ISS (Soyuz MS-29, NASA)', flag: '\u{1f1fa}\u{1f1f8}' },
        { name: 'Sophie Adenot', craft: 'ISS Expedition 75 (ESA)', flag: '\u{1f1ea}\u{1f1f6}' },
        { name: 'Andrey Fedyaev', craft: 'ISS Expedition 75 (Roscosmos)', flag: '\u{1f1f7}\u{1f1fa}' },
        { name: 'Pyotr Dubrov', craft: 'ISS (Soyuz MS-29, Roscosmos)', flag: '\u{1f1f7}\u{1f1fa}' },
        { name: 'Anna Kikina', craft: 'ISS (Soyuz MS-29, Roscosmos)', flag: '\u{1f1f7}\u{1f1fa}' }
    ];

    try {
        var cacheKey = 'iss_crew_cache';
        var cacheTimeKey = 'iss_crew_cache_time';
        var now = Date.now();
        var cachedTime = parseInt(localStorage.getItem(cacheTimeKey) || '0');
        var cached = localStorage.getItem(cacheKey);

        // Use cache if less than 1 hour old
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
            var info = astroDb[p.name] || { agency: 'Unknown', flag: '\u{1f680}' };
            var entry = {
                name: p.name,
                craft: p.craft,
                agency: info.agency,
                flag: info.flag
            };
            if (p.craft === 'ISS') issCrew.push(entry);
            else if (p.craft === 'Tiangong') tiangongCrew.push(entry);
        }

        // Cache the result
        localStorage.setItem(cacheKey, JSON.stringify({ iss: issCrew, tiangong: tiangongCrew }));
        localStorage.setItem(cacheTimeKey, String(now));

        renderCrewList(issCrew, tiangongCrew);
    } catch(e) {
        console.error('ISS crew fetch error:', e);
        // Try cached data even if expired
        var cached2 = localStorage.getItem('iss_crew_cache');
        if (cached2) {
            try {
                var cachedData2 = JSON.parse(cached2);
                renderCrewList(cachedData2.iss, cachedData2.tiangong);
                var note2 = document.getElementById('crewPanel');
                if (note2) {
                    var warn = document.createElement('div');
                    warn.style.cssText = 'text-align:center;padding:6px;color:#667788;font-size:0.8rem;';
                    warn.textContent = '\u26a0\ufe0f \u5b9e\u65f6\u6570\u636e\u83b7\u53d6\u5931\u8d25\uff0c\u663e\u793a\u7f13\u5b58\u6570\u636e';
                    note2.appendChild(warn);
                }
                return;
            } catch(e2) {}
        }
        // Fallback to hardcoded
        renderCrewList(fallbackCrew, []);
        var note = document.getElementById('crewPanel');
        if (note) {
            var warn = document.createElement('div');
            warn.style.cssText = 'text-align:center;padding:6px;color:#667788;font-size:0.8rem;';
            warn.textContent = '\u26a0\ufe0f \u5b9e\u65f6\u6570\u636e\u83b7\u53d6\u5931\u8d25\uff0c\u663e\u793a\u9ed8\u8ba4\u4e58\u7ec4\u540d\u5355';
            note.appendChild(warn);
        }
    }

    function renderCrewList(issList, tgList) {
        var html = '<div class="crew-header-info">\u{1f680} ISS \u5f53\u524d\u4e58\u7ec4: <strong style="color:#5b8fff;">' + issList.length + '</strong> \u540d\u5b87\u822a\u5458</div>';
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
            html += '<div class="crew-header-info" style="margin-top:16px;">\u{1f1e8}\u{1f1f3} \u5929\u5bab\u7a7a\u95f4\u7ad9\u4e58\u7ec4: <strong style="color:#5b8fff;">' + tgList.length + '</strong> \u540d\u5b87\u822a\u5458</div>';
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
        html += '<div style="text-align:center;margin-top:12px;font-size:0.75rem;color:#667788;">\u6570\u636e\u6765\u6e90: open-notify.org \u5b9e\u65f6\u5728\u8f68\u4eba\u5458API \u00b7 \u6bcf\u5c0f\u65f6\u66f4\u65b0</div>';
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
    var html = '<div class="meteor-header-info">\u2604\ufe0f 全年主要流星雨日历 | 当前日期: ' + (now.getMonth() + 1) + '月' + now.getDate() + '日</div>';
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
        if (isPeak) { badge = '<span class="meteor-badge peak">\u2b50 今日峰值</span>'; cardClass = 'next-active'; }
        else if (isActive) { badge = '<span class="meteor-badge active">\u2705 活跃中</span>'; cardClass = 'next-active'; }
        else if (!nextFound && daysToPeak > 0) { badge = '<span class="meteor-badge upcoming">\u23f3 ' + daysToPeak + '天后峰值</span>'; nextFound = true; cardClass = 'next-active'; }
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
    var html = '<div class="eclipse-header-info">\ud83c\udf19 未来日食/月食预报 | 共 ' + upcoming.length + ' 场即将发生</div>';
    if (nextOne) {
        var daysLeft = Math.ceil((nextOne.ts - nowTs) / 86400000);
        if (daysLeft === 0) daysLeft = '今天';
        else if (daysLeft === 1) daysLeft = '明天';
        else daysLeft = daysLeft + ' 天后';
        html = '<div class="eclipse-header-info">\ud83c\udf19 下一次: ' + escapeHtml(nextOne.data.name) + ' | 距今约 ' + daysLeft + ' | ' + nextOne.data.date + '</div>';
    }
    var list = upcoming.concat(past.slice(0, 3));
    for (var j = 0; j < list.length; j++) {
        var e = list[j].data;
        var ts = list[j].ts;
        var isNext = (nextOne && ts === nextOne.ts);
        var daysDiff = Math.ceil((ts - nowTs) / 86400000);
        var typeClass = e.type;
        var kindEmoji = e.kind === 'solar' ? '\u2600\ufe0f' : '\ud83c\udf19';
        var cardClass = isNext ? 'next-up' : '';
        var countdownStr = '';
        if (daysDiff > 0) countdownStr = '<div class="eclipse-countdown">\u23f3 ' + (daysDiff === 1 ? '明天' : daysDiff + ' 天后') + '</div>';
        else if (daysDiff === 0) countdownStr = '<div class="eclipse-countdown" style="color:#40ff88;">\u2705 今天</div>';
        else countdownStr = '<div class="eclipse-countdown" style="color:#556677;">\u2714 已发生 (' + Math.abs(daysDiff) + '天前)</div>';
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

function openImageLightbox(src) {
    var lightbox = document.getElementById('imageLightbox');
    var img = document.getElementById('lightboxImage');
    if (img) img.src = src;
    if (lightbox) lightbox.classList.add('show');
}
function closeImageLightbox() {
    var lightbox = document.getElementById('imageLightbox');
    if (lightbox) lightbox.classList.remove('show');
}
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

