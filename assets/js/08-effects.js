// ==================== 加载动画控制 ====================
function hideSpaceLoader() {
    var loader = document.getElementById('spaceLoader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(function() { if (loader) loader.style.display = 'none'; }, 800);
    }
}
function initWarpSpeed() {
    var canvas = document.getElementById('warpCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width = window.innerWidth;
    var h = canvas.height = window.innerHeight;
    var cx = w / 2;
    var cy = h / 2;
    var stars = [];
    var numStars = 300;
    var speed = 2;
    var maxSpeed = 25;

    for (var i = 0; i < numStars; i++) {
        stars.push({
            x: (Math.random() - 0.5) * w,
            y: (Math.random() - 0.5) * h,
            z: Math.random() * w
        });
    }

    var animationId = null;
    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, w, h);

        if (speed < maxSpeed) speed += 0.15;

        for (var i = 0; i < numStars; i++) {
            var star = stars[i];
            star.z -= speed;
            if (star.z <= 0) {
                star.x = (Math.random() - 0.5) * w;
                star.y = (Math.random() - 0.5) * h;
                star.z = w;
            }
            var sx = (star.x / star.z) * w + cx;
            var sy = (star.y / star.z) * h + cy;
            if (sx < 0 || sx > w || sy < 0 || sy > h) continue;

            var size = Math.max(0.1, (1 - star.z / w) * 3);
            var opacity = Math.max(0, Math.min(1, 1 - star.z / w));
            var prevZ = star.z + speed;
            var psx = (star.x / prevZ) * w + cx;
            var psy = (star.y / prevZ) * h + cy;

            var dist = Math.sqrt((sx - psx) * (sx - psx) + (sy - psy) * (sy - psy));
            if (dist > 1) {
                ctx.strokeStyle = 'rgba(' + Math.floor(91 + opacity * 100) + ',' + Math.floor(155 + opacity * 50) + ',' + Math.floor(245) + ',' + opacity + ')';
                ctx.lineWidth = size;
                ctx.beginPath();
                ctx.moveTo(psx, psy);
                ctx.lineTo(sx, sy);
                ctx.stroke();
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, ' + opacity + ')';
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        animationId = requestAnimationFrame(draw);
    }
    draw();

    window.addEventListener('resize', function() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        cx = w / 2;
        cy = h / 2;
    });
}
initWarpSpeed();

// ==================== @提及功能 ====================
function parseMentions(text) {
    if (!text) return '';
    var escaped = escapeHtml(text);
    return escaped.replace(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g, function(match, username) {
        return '<span class="mention-link" onclick="showUserProfile(\'' + username + '\')">@' + username + '</span>';
    });
}
function extractMentions(text) {
    if (!text) return [];
    var matches = text.match(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g) || [];
    return matches.map(function(m) { return m.substring(1); });
}

// ==================== 初始化 ====================
        // launchModalOverlay 在 script 之后渲染，这里绑定事件
        var lmo = document.getElementById('launchModalOverlay');
        if (lmo) lmo.addEventListener('click', function(e) {
            if (e.target === this) closeLaunchEditor();
        });

        // 用户资料弹窗点击关闭
        var pmo = document.getElementById('profileModal');
        if (pmo) pmo.addEventListener('click', function(e) {
            if (e.target === this) closeProfileModal();
        });
        var nmo = document.getElementById('notifyModal');
        if (nmo) nmo.addEventListener('click', function(e) {
            if (e.target === this) closeNotifyModal();
        });

        // Agnes-AI 抽屉点击关闭
        var agnesOv = document.getElementById('agnesDrawerOverlay');
        if (agnesOv) agnesOv.addEventListener('click', function(e) {
            if (e.target === this) closeAgnesAI();
        });

        
        renderAuthArea();
        loadUsers();
        loadPosts().then(function() { hideSpaceLoader(); });
        initNotifyMessageSystem();
        // Safety: hide loader after 5s even if loadPosts hangs
        setTimeout(function() { hideSpaceLoader(); }, 5000);

// ==================== 背景星空动画 ====================
(function() {
    var canvas = document.getElementById('starField');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var stars = [];
    var numStars = 80;
    var w, h;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (var i = 0; i < numStars; i++) {
        stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            size: Math.random() * 1.5 + 0.3,
            speed: Math.random() * 0.15 + 0.05,
            opacity: Math.random() * 0.5 + 0.2,
            twinkle: Math.random() * Math.PI * 2
        });
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < numStars; i++) {
            var s = stars[i];
            s.y += s.speed;
            if (s.y > h) {
                s.y = 0;
                s.x = Math.random() * w;
            }
            s.twinkle += 0.02;
            var tw = Math.sin(s.twinkle) * 0.3 + 0.7;
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (s.opacity * tw) + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }
    draw();
})();

// ==================== 液态玻璃 · 鼠标跟随高光 + 3D 视差 ====================
(function() {
    var mqFine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
    var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (!mqFine || !mqFine.matches || (mqReduce && mqReduce.matches)) return;

    var SEL = '.post-card, .launch-card, .apod-container';
    var MAX = 5; // 最大倾斜角度(deg)
    var current = null;
    var pendingEvent = null;
    var rafId = 0;

    function reset(el) {
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
        el.style.setProperty('--hl-x', '50%');
        el.style.setProperty('--hl-y', '0%');
    }
    function apply(el, e) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (e.clientX - r.left) / r.width;   // 0..1
        var py = (e.clientY - r.top) / r.height;   // 0..1
        el.style.setProperty('--hl-x', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--hl-y', (py * 100).toFixed(1) + '%');
        el.style.setProperty('--tilt-y', ((px - 0.5) * 2 * MAX).toFixed(2) + 'deg');
        el.style.setProperty('--tilt-x', ((0.5 - py) * 2 * MAX).toFixed(2) + 'deg');
    }
    function clearCurrent() {
        if (current) { reset(current); current = null; }
    }

    // 事件委托 + rAF 节流：动态渲染的卡片无需逐个绑定，每帧最多更新一次
    document.addEventListener('pointermove', function(e) {
        pendingEvent = e;
        if (rafId) return;
        rafId = requestAnimationFrame(function() {
            rafId = 0;
            var ev = pendingEvent;
            if (!ev || !ev.target || !ev.target.closest) return;
            var el = ev.target.closest(SEL);
            if (el !== current) {
                if (current) reset(current);
                current = el;
            }
            if (el) apply(el, ev);
        });
    }, { passive: true });

    document.addEventListener('pointerleave', clearCurrent);
    document.documentElement.addEventListener('mouseleave', clearCurrent);
    window.addEventListener('blur', clearCurrent);
})();
