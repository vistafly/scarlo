/**
 * SCarlo Developer Credit — Embeddable Badge with Morphing Logo
 *
 * Usage:
 *   <div id="scarlo-credit"></div>
 *   <script src="https://scarlo.dev/embed/credit.js"></script>
 *
 * Options (data attributes on the container):
 *   data-theme="light"   — light background mode (default: dark)
 *   data-position="left" | "center" | "right" (default: center)
 */
(function () {
  'use strict';

  var BASE_URL = 'https://scarlo.dev';
  var TOTAL_FRAMES = 20;
  var FRAME_INTERVAL = 120; // ms per frame — matches navbarlogoanimation.js

  function init() {
    var container = document.getElementById('scarlo-credit');
    if (!container) {
      container = document.createElement('div');
      container.id = 'scarlo-credit';
      document.body.appendChild(container);
    }

    var theme = container.getAttribute('data-theme') || 'dark';
    var position = container.getAttribute('data-position') || 'center';

    // Shadow DOM — full style isolation
    var shadow = container.attachShadow({ mode: 'closed' });

    var style = document.createElement('style');
    style.textContent = getStyles(theme, position);
    shadow.appendChild(style);

    // Build credit element
    var link = document.createElement('a');
    link.href = 'https://scarlo.dev';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'sc-credit';
    link.setAttribute('aria-label', 'Developed by SCarlo');

    // "Developed by" text
    var textSpan = document.createElement('span');
    textSpan.className = 'sc-text';
    textSpan.textContent = 'Developed by';
    link.appendChild(textSpan);

    // Logo wrap with ambient glow + morph frames
    var logoWrap = document.createElement('span');
    logoWrap.className = 'sc-logo-wrap';

    var ambientEl = document.createElement('span');
    ambientEl.className = 'sc-logo-ambient';
    logoWrap.appendChild(ambientEl);

    var stack = document.createElement('span');
    stack.className = 'sc-logo-stack';

    var frames = [];
    for (var i = 0; i < TOTAL_FRAMES; i++) {
      var pad = i < 10 ? '0' + i : '' + i;
      var img = document.createElement('img');
      img.src = BASE_URL + '/images/morph-logo' + pad + '.png';
      img.alt = i === 0 ? 'SCarlo' : '';
      img.width = 30;
      img.height = 30;
      img.className = 'sc-frame' + (i === 0 ? ' visible' : '');
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.draggable = false;
      stack.appendChild(img);
      frames.push(img);
    }

    logoWrap.appendChild(stack);
    link.appendChild(logoWrap);

    // "carlo" name
    var nameSpan = document.createElement('span');
    nameSpan.className = 'sc-name';
    nameSpan.textContent = 'carlo';
    link.appendChild(nameSpan);

    shadow.appendChild(link);

    // Start ping-pong morph animation once images are ready
    preloadFrames(frames, function () {
      startMorphLoop(frames);
    });
  }

  function preloadFrames(frames, callback) {
    var loaded = 0;
    var total = frames.length;

    function check() {
      loaded++;
      if (loaded >= total) callback();
    }

    frames.forEach(function (img) {
      if (img.complete) {
        check();
      } else {
        img.onload = check;
        img.onerror = check;
      }
    });
  }

  function startMorphLoop(frames) {
    var current = 0;
    var direction = 1; // 1 = forward, -1 = backward (ping-pong)
    var lastTime = performance.now();

    function tick(now) {
      if (now - lastTime >= FRAME_INTERVAL) {
        // Hide current
        frames[current].classList.remove('visible');

        // Advance index (ping-pong)
        current += direction;
        if (current >= frames.length - 1) {
          current = frames.length - 1;
          direction = -1;
        } else if (current <= 0) {
          current = 0;
          direction = 1;
        }

        // Show new
        frames[current].classList.add('visible');
        lastTime = now;
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function getStyles(theme, position) {
    var isDark = theme === 'dark';
    var textColor = isDark ? '#6e6e73' : '#86868b';
    var textHover = isDark ? '#a1a1a6' : '#555';
    var ambientColor = isDark
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(180, 160, 130, 0.08)';
    var nameGrad = isDark
      ? '#6e6e73 0%, #d4c8b0 35%, #f0e8d8 50%, #d4c8b0 65%, #6e6e73 100%'
      : '#86868b 0%, #a89478 35%, #c4b08a 50%, #a89478 65%, #86868b 100%';
    var nameHoverGrad = isDark
      ? '#a1a1a6 0%, #E4D8C4 25%, #ffffff 50%, #E4D8C4 75%, #a1a1a6 100%'
      : '#555 0%, #a89478 25%, #E4D8C4 50%, #a89478 75%, #555 100%';
    var nameGlow = isDark
      ? 'rgba(228, 216, 196, 0.35)'
      : 'rgba(160, 140, 100, 0.2)';

    var justify =
      position === 'left' ? 'flex-start' :
      position === 'right' ? 'flex-end' : 'center';

    return '\
      :host {\
        display: flex;\
        justify-content: ' + justify + ';\
        padding: 8px 0;\
      }\
      \
      @keyframes sc-ambient {\
        0%, 100% { opacity: 0.6; transform: scale(1); }\
        50% { opacity: 1; transform: scale(1.08); }\
      }\
      \
      @keyframes sc-shimmer {\
        0% { background-position: -200% center; }\
        100% { background-position: 200% center; }\
      }\
      \
      .sc-credit {\
        display: inline-flex;\
        align-items: center;\
        gap: 6px;\
        text-decoration: none;\
        padding: 8px 14px;\
        border-radius: 8px;\
        position: relative;\
        cursor: pointer;\
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\
      }\
      \
      .sc-text {\
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;\
        font-size: 0.8125rem;\
        letter-spacing: 0.03em;\
        color: ' + textColor + ';\
        transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);\
      }\
      \
      .sc-logo-wrap {\
        position: relative;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        width: 30px;\
        height: 30px;\
        margin: 0 2px;\
      }\
      \
      .sc-logo-ambient {\
        position: absolute;\
        width: 150%;\
        height: 150%;\
        top: 50%;\
        left: 50%;\
        transform: translate(-50%, -50%);\
        border-radius: 50%;\
        background: radial-gradient(circle, ' + ambientColor + ' 0%, transparent 60%);\
        filter: blur(20px);\
        pointer-events: none;\
        z-index: 0;\
        animation: sc-ambient 3s ease-in-out infinite;\
      }\
      \
      .sc-logo-stack {\
        position: relative;\
        width: 100%;\
        height: 100%;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        z-index: 1;\
      }\
      \
      .sc-frame {\
        position: absolute;\
        max-width: 100%;\
        max-height: 100%;\
        object-fit: contain;\
        opacity: 0;\
        backface-visibility: hidden;\
        -webkit-backface-visibility: hidden;\
        transform: translateZ(0);\
        pointer-events: none;\
        user-select: none;\
      }\
      \
      .sc-frame.visible {\
        opacity: 1;\
      }\
      \
      .sc-name {\
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;\
        font-size: 0.875rem;\
        font-weight: 600;\
        letter-spacing: 0.04em;\
        background: linear-gradient(90deg, ' + nameGrad + ');\
        background-size: 200% auto;\
        -webkit-background-clip: text;\
        background-clip: text;\
        -webkit-text-fill-color: transparent;\
        animation: sc-shimmer 4s linear infinite;\
      }\
      \
      .sc-credit:hover .sc-text {\
        color: ' + textHover + ';\
      }\
      \
      .sc-credit:hover .sc-logo-ambient {\
        background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 60%);\
      }\
      \
      .sc-credit:hover .sc-name {\
        animation-duration: 1.5s;\
        background: linear-gradient(90deg, ' + nameHoverGrad + ');\
        background-size: 200% auto;\
        -webkit-background-clip: text;\
        background-clip: text;\
        -webkit-text-fill-color: transparent;\
        filter: drop-shadow(0 0 10px ' + nameGlow + ');\
      }\
      \
      @media (prefers-reduced-motion: reduce) {\
        .sc-logo-ambient { animation: none; }\
        .sc-name { animation: none; }\
      }\
    ';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
