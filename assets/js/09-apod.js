// ==================== NASA 每日天文一图 ====================
// NASA API Key - 免费申请：https://api.nasa.gov
// 注意：DEMO_KEY 为全局共享、限 30 次/小时，易触发 OVER_RATE_LIMIT，故使用专属 Key
var NASA_API_KEY = 'llTHds3HslMGm93xpIjm0kt7NyJ1PFW1DZ8WMynt';
// NASA 接口偶发 500 / 返回异常，带退避的自动重试
async function nasaGetJSON(url, retries) {
    if (retries == null) retries = 4;
    var lastErr;
    for (var i = 0; i < retries; i++) {
        try {
            var resp = await fetch(url);
            if (resp.status === 429) throw new Error('RATE_LIMIT');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (!data || data.code || data.error) throw new Error('Bad payload');
            return data;
        } catch (e) {
            lastErr = e;
            if (e && e.message === 'RATE_LIMIT') throw e;
            if (i < retries - 1) await new Promise(function(r) { setTimeout(r, 700 * (i + 1)); });
        }
    }
    throw lastErr;
}
// 说明：api.nasa.gov 的 APOD 接口目前异常——省略 date 时直接返回 500，
// 且 url/hdurl 被固定为 NASA logo（title 恒为 "NASA Science"）。
// 而官方站点 science.nasa.gov 的 WordPress REST API 开放 CORS（回显任意 Origin），
// 浏览器可直连拿到真实图片、标题与解说，无需任何第三方代理。
var APOD_PAGE = 'https://science.nasa.gov/apod/';
var APOD_WP = 'https://science.nasa.gov/wp-json/wp/v2/image-article?per_page=1&orderby=date&order=desc';

function apodHtmlDecode(s) {
    return String(s || '')
        .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, '–')
        .replace(/&#8217;|&#8216;|&#039;|&rsquo;|&lsquo;/g, "'")
        .replace(/&#8220;|&#8221;|&quot;/g, '"')
        .replace(/&#038;|&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); })
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function apodImgBroken(url) { return !url || /nasa-logo|wp-content\/themes/.test(url); }
function apodCleanTitle(t) { return String(t || '').replace(/^APOD:\s*/i, '').replace(/^\d{4}\s+\w+\s+\d+\s*[–-]\s*/, '').trim(); }

// 首选：官方站点 WordPress REST（真实图片；CORS 开放，可浏览器直连）
async function fetchApodFromWp() {
    var resp = await fetch(APOD_WP, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var arr = await resp.json();
    var item = Array.isArray(arr) ? arr[0] : null;
    if (!item) throw new Error('empty apod list');

    // 解说文字：取 content 中 "Explanation:" 段落
    var paras = [];
    var re = /<p[^>]*>([\s\S]*?)<\/p>/g, m;
    var content = (item.content && item.content.rendered) || '';
    while ((m = re.exec(content)) !== null) {
        var txt = apodHtmlDecode(m[1]);
        if (txt) paras.push(txt);
    }
    var expl = '';
    for (var i = 0; i < paras.length; i++) {
        if (/^Explanation:/i.test(paras[i])) { expl = paras[i].replace(/^Explanation:\s*/i, ''); break; }
    }
    if (!expl) {
        for (var j = 0; j < paras.length; j++) {
            if (paras[j].length > 80 && !/Discover the cosmos/i.test(paras[j])) { expl = paras[j]; break; }
        }
    }
    return {
        date: String(item.date || '').slice(0, 10),
        title: apodCleanTitle(apodHtmlDecode(item.title && item.title.rendered)) || 'NASA APOD',
        explanation: expl,
        media_type: 'image',
        _img: item.featured_image_url || '',
        _href: item.link || APOD_PAGE,
        _source: 'wp'
    };
}

// 回退：NASA 官方 API（必须显式传 date，否则整接口返回 500）
async function fetchApodFromApi() {
    var today = new Date().toISOString().split('T')[0];
    return nasaGetJSON('https://api.nasa.gov/planetary/apod?api_key=' + NASA_API_KEY + '&date=' + today);
}
async function loadAPOD() {
    var container = document.getElementById('apodContainer');
    if (!container) return;
    var today = new Date().toISOString().split('T')[0];
    var cacheKey = 'apod_data_' + today;
    var timeKey = 'apod_time_' + today;

    // 1) 当日有效缓存（图片可用才直接用）
    try {
        var cached = localStorage.getItem(cacheKey);
        var cachedTime = localStorage.getItem(timeKey);
        if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < 24 * 60 * 60 * 1000) {
            var cd = JSON.parse(cached);
            if (cd && !apodImgBroken(cd._img || cd.url)) { renderAPOD(cd); return; }
        }
    } catch (e) {}

    container.innerHTML = '<div class="apod-container"><div class="apod-loading">📡 正在获取今日天文图片...</div></div>';

    var data = null;
    // 2) 首选：官方站点 REST（真实图片，CORS 开放）
    try {
        data = await fetchApodFromWp();
        if (apodImgBroken(data._img)) data = null;
    } catch (e) { console.warn('APOD wp-json failed:', e); data = null; }

    // 3) 回退：NASA 官方 API（补文字；图片可能仍是 logo，由 render 屏蔽）
    if (!data) {
        try {
            var api = await fetchApodFromApi();
            if (api && !api.code && !api.error) {
                data = {
                    date: api.date || today,
                    title: apodCleanTitle(api.title) || 'NASA APOD',
                    explanation: api.explanation || '',
                    media_type: api.media_type || 'image',
                    _img: api.media_type === 'video' ? (api.thumbnail_url || '') : (api.url || api.hdurl || ''),
                    _href: api.hdurl || api.url || APOD_PAGE,
                    _source: 'api'
                };
            }
        } catch (e) { console.warn('APOD api fallback failed:', e); }
    }

    if (data && !apodImgBroken(data._img)) {
        try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(timeKey, String(Date.now()));
        } catch (e) {}
        renderAPOD(data);
        return;
    }

    // 4) 最近 7 天缓存兜底
    for (var d = 0; d < 7; d++) {
        var dd = new Date(); dd.setDate(dd.getDate() - d);
        var key = 'apod_data_' + dd.toISOString().split('T')[0];
        var c2 = null;
        try { c2 = JSON.parse(localStorage.getItem(key)); } catch (e2) {}
        if (c2 && !apodImgBroken(c2._img || c2.url)) {
            renderAPOD(c2);
            var note = document.createElement('div');
            note.style.cssText = 'text-align:center;padding:8px;color:var(--text-muted);font-size:0.8rem;';
            note.textContent = '⚠️ 今日数据获取失败，显示缓存 (' + (c2.date || '') + ')';
            container.appendChild(note);
            return;
        }
    }
    container.innerHTML = '<div class="apod-container"><div class="apod-loading" style="padding:30px;">⚠️ 每日天文一图暂时无法加载，请稍后刷新重试</div></div>';
}
function renderAPOD(data) {
    var container = document.getElementById('apodContainer');
    if (!container || !data) return;
    var isVideo = data.media_type === 'video';
    var imgUrl = data._img || (isVideo ? (data.thumbnail_url || '') : (data.url || data.hdurl || ''));
    if (apodImgBroken(imgUrl)) imgUrl = '';
    var linkUrl = data._href || (isVideo ? data.url : (data.hdurl || data.url)) || APOD_PAGE;
    var title = data.title || data._title || '';
    var html = '<div class="apod-container">';
    html += '<div class="apod-header">';
    html += '<span class="apod-badge">NASA APOD</span>';
    html += '<span class="apod-title">每日天文一图</span>';
    html += '</div>';
    html += '<div class="apod-body">';
    if (imgUrl) {
        html += '<div class="apod-image-wrap"><a href="' + escapeHtml(linkUrl) + '" target="_blank" rel="noopener"><img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(title) + '" loading="lazy" decoding="async" onerror="this.closest(\'.apod-image-wrap\').style.display=\'none\'"></a></div>';
    } else {
        html += '<div class="apod-image-wrap"><a href="' + APOD_PAGE + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;min-height:130px;width:100%;color:var(--text-muted);font-size:0.85rem;text-decoration:none;border:1px dashed rgba(255,255,255,0.22);border-radius:12px;">🔭 查看今日原图 · science.nasa.gov/apod</a></div>';
    }
    html += '<div class="apod-info">';
    html += '<div class="apod-date">' + escapeHtml(data.date||'') + '</div>';
    html += '<h3>' + escapeHtml(title) + '</h3>';
    var desc = (data.explanation||'').substring(0, 300);
    if ((data.explanation||'').length > 300) desc += '...';
    html += '<p>' + escapeHtml(desc) + '</p>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    container.innerHTML = html;
}
