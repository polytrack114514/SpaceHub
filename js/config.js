/* ============================================================
   SpaceHub — js/config.js
   全局状态、Supabase 初始化、常量定义、Token 管理、公共工具
   ============================================================ */

/* ---------- 常量 ---------- */
const SUPABASE_URL = 'https://tktfrrvaqwbtdhiqwnna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdGZycnZhcXdidGRoaXF3bm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MzcyMjYsImV4cCI6MjEwMTMxMzIyNn0.CYNPqmQUrnkMFUq-Bkd_09q7CjQ8rZlNX5brb5-UrbQ';
const NASA_API_KEY = 'llTHds3HslMGm93xpIjm0kt7NyJ1PFW1DZ8WMynt';
const EDGE_BASE = SUPABASE_URL + '/functions/v1';

const SESSION_TOKEN_KEY = 'space_session_token';
const USER_KEY = 'space_user';
const LIKED_POSTS_KEY = 'likedPosts';

/* ---------- 官方账号 ---------- */
const OFFICIAL_USERS = {
    'NASA':    { avatar: 'https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg', badge: 'NASA官方' },
    'CNSA':    { avatar: 'https://picx.zhimg.com/v2-264f1e06887851be0703902fb9f106ca_r.jpg?source=2c26e567', badge: '国家航天局' },
    'SpaceX':  { avatar: 'https://i.imglt.com/20260802/f61b49848b4eda0e49a759683af30679.jpg', badge: 'SpaceX官方' },
    '其他火箭发射': { avatar: 'https://i0.hdslb.com/bfs/new_dyn/43b61571f1e9a172c5ef0e1bc70d709f3461574224251726.jpg', badge: '火箭发射' }
};

function isOfficialUser(name) {
    return !!OFFICIAL_USERS[name];
}

/* ---------- Supabase 客户端 ---------- */
var sb;
(function initSupabase() {
    try {
        if (typeof supabase === 'undefined') throw new Error('Supabase SDK 未加载');
        sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[SpaceHub] Supabase 初始化成功');
    } catch (e) {
        console.error('[SpaceHub] Supabase 初始化失败:', e.message);
        sb = null;
    }
})();

/* ---------- 全局状态 ---------- */
let currentUser = JSON.parse(localStorage.getItem(USER_KEY)) || null;
let likedPosts  = JSON.parse(localStorage.getItem(LIKED_POSTS_KEY)) || {};

/* ---------- Token 管理 ---------- */
function generateSessionToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function getSessionToken() {
    return localStorage.getItem(SESSION_TOKEN_KEY) || null;
}

function setSessionToken(token) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
}

function clearSessionToken() {
    localStorage.removeItem(SESSION_TOKEN_KEY);
}

/* ---------- 获取 Authorization header ---------- */
function getAuthHeaders() {
    const token = getSessionToken();
    if (token) return { 'Authorization': 'Bearer ' + token };
    // 未登录时用 anon key 作为 Authorization；不要额外发送 apikey 头，
    // 否则会触发浏览器 CORS 预检失败（Edge Function 未在 allow-headers 中声明 apikey）
    return { 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };
}

/* ---------- 通用 fetch → Edge Function ---------- */
async function callEdgeFunction(fnName, body, opts) {
    const url = EDGE_BASE + '/' + fnName;
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
    };
    // 允许覆盖 token（例如管理员 token）
    if (opts && opts.token) {
        headers['Authorization'] = 'Bearer ' + opts.token;
    }
    const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
}

/* ---------- 工具函数 ---------- */
function escapeHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}

function getAvatar(name) {
    if (!name) return '';
    if (OFFICIAL_USERS[name] && OFFICIAL_USERS[name].avatar) {
        return OFFICIAL_USERS[name].avatar;
    }
    // 用名字首字母生成 SVG 头像
    var initial = name.charAt(0).toUpperCase();
    var hue = ((name.charCodeAt(0) * 137) % 360);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">'
        + '<rect width="40" height="40" rx="20" fill="hsl(' + hue + ',70%,35%)"/>'
        + '<text x="20" y="27" text-anchor="middle" fill="#fff" font-size="20" font-family="system-ui">'
        + initial + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function timeAgo(ts) {
    if (!ts) return '';
    var seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return Math.floor(seconds / 60) + '分钟前';
    if (seconds < 86400) return Math.floor(seconds / 3600) + '小时前';
    if (seconds < 2592000) return Math.floor(seconds / 86400) + '天前';
    return new Date(ts).toLocaleDateString('zh-CN');
}

function truncate(str, n) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '…' : str;
}

/* ---------- 全局错误处理 ---------- */
window.addEventListener('error', function(e) {
    console.error('[SpaceHub] 全局错误:', e.message);
});

/* ---------- 暴露给其他模块的变量 ---------- */
window.__config__ = {
    SUPABASE_URL,
    NASA_API_KEY,
    EDGE_BASE,
    OFFICIAL_USERS,
    isOfficialUser,
    generateSessionToken,
    getSessionToken,
    setSessionToken,
    clearSessionToken,
    getAuthHeaders,
    callEdgeFunction,
    escapeHtml,
    getAvatar,
    timeAgo,
    truncate
};
