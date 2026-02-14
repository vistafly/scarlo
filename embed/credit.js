/**
 * SCarlo Developer Credit — Embeddable Badge with Morphing Logo + Text
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

    // Brand wrapper (logo + text morph stacks)
    var brand = document.createElement('span');
    brand.className = 'sc-brand';

    // --- Logo morph stack ---
    var logoWrap = document.createElement('span');
    logoWrap.className = 'sc-logo-animated';

    var logoAmbient = document.createElement('span');
    logoAmbient.className = 'sc-ambient';
    logoWrap.appendChild(logoAmbient);

    var logoStack = document.createElement('span');
    logoStack.className = 'sc-logo-stack';

    var logoFrames = [];
    for (var i = 0; i < TOTAL_FRAMES; i++) {
      var pad = i < 10 ? '0' + i : '' + i;
      var img = document.createElement('img');
      img.src = BASE_URL + '/images/morph-logo' + pad + '.png';
      img.alt = i === 0 ? 'SCarlo' : '';
      img.className = 'sc-frame' + (i === 0 ? ' visible' : '');
      img.loading = 'eager';
      img.draggable = false;
      logoStack.appendChild(img);
      logoFrames.push(img);
    }

    logoWrap.appendChild(logoStack);
    brand.appendChild(logoWrap);

    // --- Text morph stack ---
    var textWrap = document.createElement('span');
    textWrap.className = 'sc-text-animated';

    var textAmbient = document.createElement('span');
    textAmbient.className = 'sc-ambient';
    textWrap.appendChild(textAmbient);

    var textStack = document.createElement('span');
    textStack.className = 'sc-text-stack';

    var textFrames = [];
    for (var j = 0; j < TOTAL_FRAMES; j++) {
      var tpad = j < 10 ? '0' + j : '' + j;
      var timg = document.createElement('img');
      timg.src = BASE_URL + '/images/morph-text' + tpad + '.png';
      timg.alt = j === 0 ? 'carlo' : '';
      timg.className = 'sc-frame' + (j === 0 ? ' visible' : '');
      timg.loading = 'eager';
      timg.draggable = false;
      textStack.appendChild(timg);
      textFrames.push(timg);
    }

    textWrap.appendChild(textStack);
    brand.appendChild(textWrap);

    link.appendChild(brand);
    shadow.appendChild(link);

    // Start ping-pong morph animation once all images are ready
    var allFrames = logoFrames.concat(textFrames);
    preloadFrames(allFrames, function () {
      startMorphLoop(logoFrames, textFrames);
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

  function startMorphLoop(logoFrames, textFrames) {
    var current = 0;
    var direction = 1; // 1 = forward, -1 = backward (ping-pong)
    var lastTime = performance.now();

    function tick(now) {
      if (now - lastTime >= FRAME_INTERVAL) {
        // Hide current frame on both stacks
        logoFrames[current].classList.remove('visible');
        if (textFrames[current]) textFrames[current].classList.remove('visible');

        // Advance index (ping-pong)
        current += direction;
        if (current >= logoFrames.length - 1) {
          current = logoFrames.length - 1;
          direction = -1;
        } else if (current <= 0) {
          current = 0;
          direction = 1;
        }

        // Show new frame on both stacks
        logoFrames[current].classList.add('visible');
        if (textFrames[current]) textFrames[current].classList.add('visible');
        lastTime = now;
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function getStyles(theme, position) {
    var isDark = theme === 'dark';
    var textColor = isDark ? '#86868b' : '#86868b';
    var textHover = isDark ? '#c7c7cc' : '#555';
    var ambientColor = isDark
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(180, 160, 130, 0.08)';

    var justify =
      position === 'left' ? 'flex-start' :
      position === 'right' ? 'flex-end' : 'center';

    return '\
      :host {\
        display: flex;\
        justify-content: ' + justify + ';\
        padding: 10px 0 4px;\
      }\
      \
      @keyframes sc-ambient-pulse {\
        0%, 100% { opacity: 0.6; transform: scale(1); }\
        50% { opacity: 1; transform: scale(1.08); }\
      }\
      \
      @keyframes sc-text-glow {\
        0%, 100% { opacity: 0.85; }\
        50% { opacity: 1; }\
      }\
      \
      .sc-credit {\
        display: inline-flex;\
        align-items: center;\
        gap: 4px;\
        text-decoration: none;\
        padding: 4px 8px;\
        border-radius: 8px;\
        position: relative;\
        cursor: pointer;\
      }\
      \
      .sc-credit::before {\
        content: "";\
        position: absolute;\
        width: 100%;\
        height: 200%;\
        border-radius: 50%;\
        background: radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, transparent 60%);\
        filter: blur(24px);\
        pointer-events: none;\
        z-index: -1;\
        animation: sc-ambient-pulse 3s ease-in-out infinite;\
      }\
      \
      .sc-credit:hover::before {\
        background: radial-gradient(circle, rgba(255, 255, 255, 0.07) 0%, transparent 60%);\
      }\
      \
      .sc-text {\
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;\
        font-size: 0.8125rem;\
        letter-spacing: 0.03em;\
        color: ' + textColor + ';\
        transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);\
        animation: sc-text-glow 3s ease-in-out infinite;\
      }\
      \
      .sc-credit:hover .sc-text {\
        color: ' + textHover + ';\
        text-shadow: 0 0 12px rgba(255, 255, 255, 0.1);\
      }\
      \
      .sc-brand {\
        display: flex;\
        align-items: center;\
        flex-shrink: 0;\
        isolation: isolate;\
      }\
      \
      .sc-logo-animated {\
        position: relative;\
        width: 50px;\
        height: 28px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        flex-shrink: 0;\
        pointer-events: none;\
        isolation: isolate;\
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
      .sc-logo-stack .sc-frame {\
        position: absolute;\
        max-width: 100%;\
        max-height: 100%;\
        object-fit: contain;\
        opacity: 0;\
        will-change: opacity;\
        backface-visibility: hidden;\
        -webkit-backface-visibility: hidden;\
        transform: translateZ(0);\
      }\
      \
      .sc-logo-stack .sc-frame.visible {\
        opacity: 1;\
      }\
      \
      .sc-text-animated {\
        position: relative;\
        width: 55px;\
        height: 28px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        flex-shrink: 0;\
        margin-left: -14px;\
        opacity: 0.57;\
        bottom: 2px;\
        pointer-events: none;\
        isolation: isolate;\
      }\
      \
      .sc-text-stack {\
        position: relative;\
        width: 100%;\
        height: 100%;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        z-index: 1;\
      }\
      \
      .sc-text-stack .sc-frame {\
        position: absolute;\
        max-width: 100%;\
        max-height: 100%;\
        object-fit: contain;\
        opacity: 0;\
        will-change: opacity;\
        backface-visibility: hidden;\
        -webkit-backface-visibility: hidden;\
        transform: translateZ(0);\
        margin-left: -3px;\
      }\
      \
      .sc-text-stack .sc-frame.visible {\
        opacity: 1;\
      }\
      \
      .sc-ambient {\
        position: absolute;\
        width: 150%;\
        height: 150%;\
        border-radius: 50%;\
        background: radial-gradient(circle, ' + ambientColor + ' 0%, transparent 60%);\
        filter: blur(20px);\
        opacity: 0.8;\
        pointer-events: none;\
        z-index: -1;\
        animation: sc-ambient-pulse 3s ease-in-out infinite;\
      }\
      \
      .sc-credit:hover .sc-ambient {\
        background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 60%);\
      }\
      \
      @media (prefers-reduced-motion: reduce) {\
        .sc-ambient { animation: none; }\
      }\
    ';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
