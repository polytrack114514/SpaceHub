/* ============================================================
   SpaceHub — js/ai.js
   AI 助手 + Agnes-AI 智能任务控制中心
   ============================================================ */

var aiMessages = [];
var aiProxyUrl = 'https://tktfrrvaqwbtdhiqwnna.supabase.co/functions/v1/ai-chat-proxy';
var aiInitialized = false;

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
        var response = await fetch(aiProxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'sb_publishable_J0U_8Wc50piNP-yluDx33g_WTgfzYwv',
                'Authorization': 'Bearer sb_publishable_J0U_8Wc50piNP-yluDx33g_WTgfzYwv'
            },
            body: JSON.stringify({ messages: aiMessages })
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
        var response = await fetch(agnesProxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + agnesApiKey
            },
            body: JSON.stringify({
                messages: messagesToSend,
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
