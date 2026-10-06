/* ============================================================
   SpaceHub — js/effects.js
   星空动画、液态玻璃高光、灯箱、初始化绑定
   ============================================================ */

/* ---------- 背景星空动画 ---------- */
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
            if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
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

/* ---------- 液态玻璃 · 鼠标跟随高光 + 3D 视差 ---------- */
(function() {
    var mqFine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
    var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (!mqFine || !mqFine.matches || (mqReduce && mqReduce.matches)) return;

    var SEL = '.post-card, .launch-card, .apod-container';
    var MAX = 5;
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
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--hl-x', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--hl-y', (py * 100).toFixed(1) + '%');
        el.style.setProperty('--tilt-y', ((px - 0.5) * 2 * MAX).toFixed(2) + 'deg');
        el.style.setProperty('--tilt-x', ((0.5 - py) * 2 * MAX).toFixed(2) + 'deg');
    }
    function clearCurrent() {
        if (current) { reset(current); current = null; }
    }

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

/* ---------- 图片灯箱 ---------- */
window.openImageLightbox = function(src) {
    var lightbox = document.getElementById('imageLightbox');
    var img = document.getElementById('lightboxImage');
    if (img) img.src = src;
    if (lightbox) lightbox.classList.add('show');
};
window.closeImageLightbox = function() {
    var lightbox = document.getElementById('imageLightbox');
    if (lightbox) lightbox.classList.remove('show');
};
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
        if (sdm && sdm.classList.contains('show')) closeSpaceDataModal && closeSpaceDataModal();
    }
});

/* ---------- 全局事件初始化（在 DOM ready 后调用） ---------- */
window.initEventBindings = function() {
    var lmo = document.getElementById('launchModalOverlay');
    if (lmo) lmo.addEventListener('click', function(e) { if (e.target === this) closeLaunchEditor(); });

    var pmo = document.getElementById('profileModal');
    if (pmo) pmo.addEventListener('click', function(e) { if (e.target === this) closeProfileModal(); });

    var nmo = document.getElementById('notifyModal');
    if (nmo) nmo.addEventListener('click', function(e) { if (e.target === this) closeNotifyModal(); });

    var agnesOv = document.getElementById('agnesDrawerOverlay');
    if (agnesOv) agnesOv.addEventListener('click', function(e) { if (e.target === this) closeAgnesAI(); });
};

/* ---------- 加载动画控制 ---------- */
window.hideSpaceLoader = function() {
    var loader = document.getElementById('spaceLoader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(function() { if (loader) loader.style.display = 'none'; }, 800);
    }
};

window.initWarpSpeed = function() {
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
};
window.initWarpSpeed();
