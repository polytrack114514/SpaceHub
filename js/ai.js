/* ============================================================
   SpaceHub — js/ai.js
   AI 助手 + Agnes-AI 智能任务控制中心
   ============================================================ */

var aiMessages = [];
var aiProxyUrl = 'https://tktfrrvaqwbtdhiqwnna.supabase.co/functions/v1/ai-chat-proxy';
var aiInitialized = false;
var aiApiKey = 'sb_publishable_J0U_8Wc50piNP-yluDx33g_WTgfzYwv';

/* ---------- 站内知识库检索 ----------
   代理函数只做纯对话转发，模型本身没有联网、知识截止 2026-07。
   这里把站内实时同步的发射数据检索出来，作为 system 上下文注入，
   让回答以站内数据为准，而不是凭训练记忆。 */
var AI_RULES = [
    '你是 SpaceHub 的航天助手。',
    '信息优先级：【联网检索】实时结果 > 【站内知识库】 > 你自己的训练知识（截止 2026年7月）。',
    '用【站内知识库】作答时，末尾标注“来源：SpaceHub 发射数据库”。',
    '用【联网检索】作答时，在末尾另起一行以“参考：”列出你实际引用的网址。',
    '两者都没有覆盖、且属于 2026年7月之后的事件时，直接说明“这超出我的离线知识范围”，不要猜测，也不要编造任务细节。',
    '回答用简体中文，简洁准确。'
].join('\n');

/* ---------- 联网检索（Tavily 代理） ---------- */
var webSearchUrl = 'https://tktfrrvaqwbtdhiqwnna.supabase.co/functions/v1/web-search';

function shouldWebSearch(q) {
    var s = String(q || '').trim();
    if (s.length < 4) return false;
    if (/^(你好|您好|hi|hello|在吗|谢谢|thanks)/i.test(s)) return false;
    return true;
}

async function fetchWebResults(question) {
    if (!shouldWebSearch(question)) return null;
    var q = String(question).slice(0, 200);

    // 首选：自家 Supabase 代理（key 藏在服务端）
    var viaProxy = await tavilyRequest(webSearchUrl, q, true);
    if (viaProxy) return viaProxy;

    // 降级：代理未部署时走 Tavily keyless（无需 key，按 IP 限速）
    return await tavilyRequest('https://api.tavily.com/search', q, false);
}

async function tavilyRequest(url, query, isProxy) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    try {
        var headers = { 'Content-Type': 'application/json' };
        var body;
        if (isProxy) {
            headers['apikey'] = aiApiKey;
            headers['Authorization'] = 'Bearer ' + aiApiKey;
            body = JSON.stringify({ query: query, max_results: 3 });
        } else {
            headers['X-Tavily-Access-Mode'] = 'keyless';
            body = JSON.stringify({ query: query, max_results: 3, include_answer: false });
        }
        var resp = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body,
            signal: ctrl ? ctrl.signal : undefined
        });
        if (!resp.ok) return null;
        var data = await resp.json();
        if (!data || !data.results || !data.results.length) return null;
        return data.results;
    } catch (e) {
        return null; // 检索不可用时静默退回站内知识库
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function formatWebContext(results) {
    if (!results || !results.length) return '';
    var lines = ['【联网检索 · 实时网页结果】（这些内容晚于你的知识截止，可据此回答）'];
    for (var i = 0; i < results.length; i++) {
        lines.push((i + 1) + '. ' + (results[i].title || '无标题'));
        lines.push('   网址：' + (results[i].url || ''));
        if (results[i].content) lines.push('   摘要：' + results[i].content);
    }
    return lines.join('\n');
}

var STATUS_CN = {
    tbd: '日期待定', tentative: '待定', go: '即将发射', scheduled: '已排期',
    success: '已发射-成功', failure: '已发射-失败', partial: '已发射-部分成功',
    pending: '待定'
};

function launchTokens(l) {
    var text = [l.rocket, l.mission, l.agency, l.location].join(' ');
    var out = [];
    var latin = text.match(/[A-Za-z0-9][A-Za-z0-9\-.]+/g) || [];
    for (var i = 0; i < latin.length; i++) out.push(latin[i].toLowerCase());
    var cjk = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    for (var j = 0; j < cjk.length; j++) out.push(cjk[j]);
    return out;
}

function launchDateText(ts) {
    if (!ts) return '未公布';
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '未公布';
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function formatLaunchLine(l) {
    var parts = [];
    parts.push('任务：' + (l.mission || '未命名'));
    parts.push('火箭：' + (l.rocket || '未知'));
    if (l.agency) parts.push('机构：' + l.agency);
    if (l.location) parts.push('地点：' + l.location);
    parts.push('日期：' + launchDateText(l.date));
    parts.push('状态：' + (STATUS_CN[l.status] || l.status || '未知'));
    if (l.result) parts.push('结果：' + l.result);
    var line = '- ' + parts.join('；');
    if (l.description) line += '\n  说明：' + String(l.description).slice(0, 220);
    return line;
}

async function buildSiteContext(question) {
    var list = (typeof launches !== 'undefined' && Array.isArray(launches)) ? launches.slice() : [];
    if (!list.length) {
        try {
            var snap = await loadStaticJSON('data/launches.json');
            if (snap && Array.isArray(snap.launches)) list = snap.launches;
        } catch (e) { /* 没有快照就跳过 */ }
    }
    if (!list.length) return '';

    var q = String(question || '').toLowerCase();
    var scored = [];
    for (var i = 0; i < list.length; i++) {
        var toks = launchTokens(list[i]);
        var score = 0;
        for (var t = 0; t < toks.length; t++) {
            if (toks[t].length >= 2 && q.indexOf(toks[t]) !== -1) score += toks[t].length;
        }
        if (score >= 4) scored.push({ l: list[i], s: score });
    }
    scored.sort(function (a, b) { return b.s - a.s; });

    var picked = [];
    for (var k = 0; k < scored.length && picked.length < 3; k++) picked.push(scored[k].l);

    // 泛问「最新/即将」时补充近期任务
    if (!picked.length && /最新|近期|即将|下一次|什么时候|发射计划/.test(q)) {
        var upcoming = list.filter(function (x) { return x.status !== 'success' && x.status !== 'failure'; });
        upcoming.sort(function (a, b) { return Number(a.date || 9e15) - Number(b.date || 9e15); });
        picked = upcoming.slice(0, 3);
    }

    if (!picked.length) return '';

    var lines = ['【站内知识库 · 火箭发射任务】（数据由本站实时同步，优先于你的训练记忆）'];
    for (var p = 0; p < picked.length; p++) lines.push(formatLaunchLine(picked[p]));
    return lines.join('\n');
}

function initAI() {
    if (aiInitialized) return;
    aiInitialized = true;
    aiMessages.push({
        role: 'assistant',
        content: '你好！我是星际助手 \ud83d\ude80\n我可以回答关于太空探索、航天、天文等方面的问题。\n问我任何关于宇宙的问题吧！'
    });
    renderAIMessages();
}

function clearAIChat() {
    aiMessages = [];
    aiInitialized = false;
    initAI();
}

function formatAIResponse(text) {
    var escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/`(.+?)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
}

function renderAIMessages() {
    var container = document.getElementById('aiMessages');
    if (!container) return;
    var html = '';
    for (var i = 0; i < aiMessages.length; i++) {
        var msg = aiMessages[i];
        if (msg.role === 'user') {
            html += '<div class="ai-msg user"><div class="ai-msg-bubble">' + escapeHtml(msg.content) + '</div></div>';
        } else {
            var formatted = formatAIResponse(msg.content);
            if (formatted.length > 1500) formatted = formatted.substring(0, 1500) + '<span class="ai-more">…点击展开全文</span>';
            html += '<div class="ai-msg assistant"><div class="ai-avatar">\ud83e\udd16</div><div class="ai-msg-bubble ai-bubble-long">' + formatted + '</div></div>';
        }
    }
    container.innerHTML = html;
    requestAnimationFrame(function() {
        container.scrollTop = container.scrollHeight;
    });
    var moreSpans = container.querySelectorAll('.ai-more');
    for (var m = 0; m < moreSpans.length; m++) {
        moreSpans[m].addEventListener('click', function() {
            var bubble = this.closest('.ai-msg-bubble');
            if (bubble) bubble.classList.toggle('expanded');
            this.style.display = 'none';
        });
    }
}

function showAITyping() {
    var container = document.getElementById('aiMessages');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'ai-msg assistant';
    div.id = 'aiTyping';
    div.innerHTML = '<div class="ai-avatar">\ud83e\udd16</div><div class="ai-typing-dots"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function hideAITyping() {
    var el = document.getElementById('aiTyping');
    if (el) el.remove();
}

async function sendAIMessage() {
    var input = document.getElementById('aiInput');
    var btn = document.getElementById('aiSendBtn');
    if (!input || !btn) return;
    var msg = input.value.trim();
    if (!msg) return;

    aiMessages.push({ role: 'user', content: msg });
    input.value = '';
    btn.disabled = true;
    renderAIMessages();
    showAITyping();

    try {
        var found = await Promise.all([buildSiteContext(msg), fetchWebResults(msg)]);
        var context = AI_RULES;
        if (found[1]) context += '\n\n' + formatWebContext(found[1]);
        if (found[0]) context += '\n\n' + found[0];

        var payload = [{ role: 'system', content: context }].concat(aiMessages.slice(-20));

        var response = await fetch(aiProxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': aiApiKey,
                'Authorization': 'Bearer ' + aiApiKey
            },
            body: JSON.stringify({ messages: payload })
        });

        if (!response.ok) throw new Error('API ' + response.status);
        var data = await response.json();
        if (data.error) throw new Error(data.error);
        var reply = data.content || data.message || data.response || '';
        if (!reply) throw new Error('AI 未返回有效内容');

        hideAITyping();
        aiMessages.push({ role: 'assistant', content: reply });
        renderAIMessages();
    } catch (e) {
        hideAITyping();
        aiMessages.push({ role: 'assistant', content: '抱歉，出了点问题：' + e.message + '\n请稍后再试。' });
        renderAIMessages();
    }

    btn.disabled = false;
}


// ==================== Agnes-AI 智能任务控制中心 ====================
var agnesMessages = [];
var agnesInitialized = false;
var agnesSending = false;
var agnesLaunchContext = null;
var agnesProxyUrl = 'https://tktfrrvaqwbtdhiqwnna.supabase.co/functions/v1/ai-chat-proxy';
var agnesApiKey = 'sb_publishable_J0U_8Wc50piNP-yluDx33g_WTgfzYwv';

function openAgnesAI(launchIndex) {
    var launch = launches[launchIndex];
    if (!launch) return;

    agnesLaunchContext = {
        rocket: launch.rocket || '',
        agency: launch.agency || '',
        mission: launch.mission || '',
        location: launch.location || '',
        description: launch.description || '',
        status: launch.status || '',
        date: launch.date || 0,
        result: launch.result || '',
        id: launch.id || ''
    };

    var contextLabel = document.getElementById('agnesContextLabel');
    if (contextLabel) {
        var statusMap = { 'tbd': '日期待定', 'tentative': '待定', 'go': '即将发射', 'success': '已发射-成功', 'failure': '已发射-失败', 'partial': '已发射-部分成功' };
        contextLabel.textContent = (launch.rocket || '未知火箭') + ' · ' + (statusMap[launch.status] || launch.status || '未知状态');
    }

    var overlay = document.getElementById('agnesDrawerOverlay');
    var drawer = document.getElementById('agnesDrawer');
    if (overlay && drawer) {
        overlay.classList.add('show');
        drawer.classList.add('show');
    }

    agnesMessages = [];
    agnesInitialized = false;
    if (!agnesInitialized) {
        agnesInitialized = true;
        agnesMessages.push({
            role: 'assistant',
            content: '你好，我是 Agnes-AI。你可以问我关于当前发射任务的任何问题。'
        });
        renderAgnesMessages();
    }

    setTimeout(function() {
        var input = document.getElementById('agnesInput');
        if (input) input.focus();
    }, 300);
}

function closeAgnesAI() {
    var overlay = document.getElementById('agnesDrawerOverlay');
    var drawer = document.getElementById('agnesDrawer');
    if (overlay) overlay.classList.remove('show');
    if (drawer) drawer.classList.remove('show');
}

function renderAgnesMessages() {
    var container = document.getElementById('agnesMessages');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < agnesMessages.length; i++) {
        var msg = agnesMessages[i];
        var div = document.createElement('div');
        div.className = 'agnes-msg ' + msg.role;
        if (msg.role === 'user') {
            var bubble = document.createElement('div');
            bubble.className = 'agnes-msg-bubble';
            bubble.textContent = msg.content;
            div.appendChild(bubble);
        } else {
            var avatar = document.createElement('span');
            avatar.className = 'agnes-msg-avatar';
            avatar.textContent = '\uD83E\uDD16';
            var bubble2 = document.createElement('div');
            bubble2.className = 'agnes-msg-bubble';
            bubble2.textContent = msg.content;
            div.appendChild(avatar);
            div.appendChild(bubble2);
        }
        container.appendChild(div);
    }
    container.scrollTop = container.scrollHeight;
}

function showAgnesTyping() {
    var container = document.getElementById('agnesMessages');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'agnes-msg assistant';
    div.id = 'agnesTyping';
    var avatar = document.createElement('span');
    avatar.className = 'agnes-msg-avatar';
    avatar.textContent = '\uD83E\uDD16';
    var typing = document.createElement('div');
    typing.className = 'agnes-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    div.appendChild(avatar);
    div.appendChild(typing);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function hideAgnesTyping() {
    var el = document.getElementById('agnesTyping');
    if (el) el.remove();
}

function showAgnesError(msg) {
    var container = document.getElementById('agnesMessages');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'agnes-error';
    div.textContent = msg;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function handleAgnesKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAgnesMessage();
        return false;
    }
    return true;
}

function autoResizeAgnesInput(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function sendAgnesQuickQuestion(question) {
    var input = document.getElementById('agnesInput');
    if (input) input.value = question;
    sendAgnesMessage();
}

async function sendAgnesMessage() {
    if (agnesSending) return;
    var input = document.getElementById('agnesInput');
    var btn = document.getElementById('agnesSendBtn');
    if (!input || !btn) return;

    var msg = input.value.trim();
    if (!msg) return;
    if (msg.length > 500) {
        showAgnesError('消息过长，请控制在 500 字以内');
        return;
    }

    agnesMessages.push({ role: 'user', content: msg });
    input.value = '';
    input.style.height = 'auto';
    btn.disabled = true;
    agnesSending = true;
    renderAgnesMessages();
    showAgnesTyping();

    try {
        var messagesToSend = agnesMessages.slice(-20);

        // 并行：站内发射数据 + 实时网页检索
        var found = await Promise.all([buildSiteContext(msg), fetchWebResults(msg)]);
        var context = AI_RULES;
        if (found[1]) context += '\n\n' + formatWebContext(found[1]);
        var siteCtx = found[0] || (agnesLaunchContext ? formatLaunchLine(agnesLaunchContext) : '');
        if (siteCtx) context += '\n\n【站内知识库 · 当前任务】\n' + siteCtx;

        var payload = [{ role: 'system', content: context }].concat(messagesToSend);

        var response = await fetch(agnesProxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + agnesApiKey
            },
            body: JSON.stringify({
                messages: payload,
                launch: agnesLaunchContext
            })
        });

        if (response.status === 429) {
            throw new Error('请求过于频繁，请稍后再试');
        }
        if (!response.ok) throw new Error('服务暂时不可用 (' + response.status + ')');

        var data = await response.json();
        if (data.error) throw new Error(data.error);

        hideAgnesTyping();
        agnesMessages.push({ role: 'assistant', content: data.content || 'AI 未返回有效内容' });
        renderAgnesMessages();
    } catch (e) {
        hideAgnesTyping();
        showAgnesError(e.message || '发送失败，请稍后再试');
    }

    btn.disabled = false;
    agnesSending = false;
    var input2 = document.getElementById('agnesInput');
    if (input2) input2.focus();
}
