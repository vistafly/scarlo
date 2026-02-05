// Scarlo — Navbar Logo & Text Animation
// Seamless ping-pong loop (0→19→0→19...) for never-ending morph
// Navbar logo, text, and footer logo animate in perfect sync

(function() {
    'use strict';

    const TOTAL_FRAMES = 20;

    const CONFIG = {
        // Time per frame (ms)
        frameInterval: 120
    };

    class NavbarLogoAnimation {
        constructor() {
            this.logoContainer = document.getElementById('navbarLogoAnimated');
            this.textContainer = document.getElementById('navbarTextAnimated');
            this.logoStack = document.getElementById('navbarLogoStack');
            this.textStack = document.getElementById('navbarTextStack');
            this.brandContainer = document.getElementById('navbarBrand');

            // Footer logo elements
            this.footerLogoContainer = document.getElementById('footerLogoAnimated');
            this.footerLogoStack = document.getElementById('footerLogoStack');

            this.logos = [];
            this.texts = [];
            this.footerLogos = [];

            // Collect logo frames
            for (let i = 0; i < TOTAL_FRAMES; i++) {
                const logoEl = document.getElementById('navLogo' + i);
                if (logoEl) this.logos.push(logoEl);

                const textEl = document.getElementById('navText' + i);
                if (textEl) this.texts.push(textEl);

                const footerLogoEl = document.getElementById('footerLogo' + i);
                if (footerLogoEl) this.footerLogos.push(footerLogoEl);
            }

            this.currentIndex = 0;
            this.direction = 1; // 1 = forward, -1 = backward
            this.isRunning = false;
            this.animationFrameId = null;
            this.lastFrameTime = 0;

            if (this.logoContainer && this.logoStack && this.logos.length > 0) {
                this.init();
            }
        }

        init() {
            // Set all frames to hidden, show first - for logo, text, and footer
            this.logos.forEach((logo, i) => {
                if (i === 0) {
                    logo.classList.add('visible');
                } else {
                    logo.classList.remove('visible');
                }
            });

            this.texts.forEach((text, i) => {
                if (i === 0) {
                    text.classList.add('visible');
                } else {
                    text.classList.remove('visible');
                }
            });

            this.footerLogos.forEach((logo, i) => {
                if (i === 0) {
                    logo.classList.add('visible');
                } else {
                    logo.classList.remove('visible');
                }
            });

            this.currentIndex = 0;

            // Reset timing when tab becomes visible to prevent frame burst
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.lastFrameTime = performance.now();
                }
            });

            // Start animation loop
            this.startLoop();
        }

        showFrame(index) {
            // Update logo frames
            this.logos.forEach((logo, i) => {
                if (i === index) {
                    logo.classList.add('visible');
                } else {
                    logo.classList.remove('visible');
                }
            });

            // Update text frames in sync
            this.texts.forEach((text, i) => {
                if (i === index) {
                    text.classList.add('visible');
                } else {
                    text.classList.remove('visible');
                }
            });

            // Update footer logo frames in sync
            this.footerLogos.forEach((logo, i) => {
                if (i === index) {
                    logo.classList.add('visible');
                } else {
                    logo.classList.remove('visible');
                }
            });

            this.currentIndex = index;
        }

        nextFrame() {
            // Move to next frame
            this.currentIndex += this.direction;

            // Reverse direction at ends (ping-pong)
            if (this.currentIndex >= this.logos.length - 1) {
                this.currentIndex = this.logos.length - 1;
                this.direction = -1;
            } else if (this.currentIndex <= 0) {
                this.currentIndex = 0;
                this.direction = 1;
            }

            this.showFrame(this.currentIndex);
        }

        stopLoop() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            this.isRunning = false;
        }

        startLoop() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.lastFrameTime = performance.now();

            const animate = (currentTime) => {
                if (!this.isRunning) return;

                const elapsed = currentTime - this.lastFrameTime;

                if (elapsed >= CONFIG.frameInterval) {
                    this.nextFrame();
                    this.lastFrameTime = currentTime;
                }

                this.animationFrameId = requestAnimationFrame(animate);
            };

            this.animationFrameId = requestAnimationFrame(animate);
        }
    }

    // Initialize after loading screen completes
    let navbarAnimation = null;

    function initNavbar() {
        if (!navbarAnimation) {
            navbarAnimation = new NavbarLogoAnimation();
        }
    }

    window.addEventListener('loadingComplete', initNavbar);

    window.addEventListener('load', () => {
        if (!document.getElementById('logoLoadingScreen')) {
            initNavbar();
        }

        // Fallback init after 5 seconds
        setTimeout(initNavbar, 5000);
    });

    window.NavbarLogoAnimation = {
        get: () => navbarAnimation
    };

})();
