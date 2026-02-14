// Scarlo — MOBILE-OPTIMIZED INTERACTIONS

(function() {
    'use strict';

    // Alias global translation functions (set by translations.js loaded before this module)
    var t = window.t || function(k) { return k; };
    var getCurrentLang = window.getCurrentLang || function() { return localStorage.getItem('scarlo-lang') || 'en'; };
    var setLang = window.setLang || function() {};
    var tFeature = window.tFeature || function(k) { return k; };
    var translateStoredFeature = window.translateStoredFeature || function(l) { return l; };
    var translateAddonByKey = window.translateAddonByKey || function(k, f) { return f || k; };

    // === UTILITY FUNCTIONS ===
    var $ = function(selector, parent) {
        return (parent || document).querySelector(selector);
    };
    
    var $$ = function(selector, parent) {
        var elements = (parent || document).querySelectorAll(selector);
        var array = [];
        for (var i = 0; i < elements.length; i++) {
            array.push(elements[i]);
        }
        return array;
    };

    var throttle = function(func, delay) {
        var lastCall = 0;
        return function() {
            var args = arguments;
            var now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                func.apply(this, args);
            }
        };
    };

    var debounce = function(func, delay) {
        var timeout;
        return function() {
            var args = arguments;
            var context = this;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(context, args);
            }, delay);
        };
    };

    // === LOGO CACHE FOR PDF GENERATION ===
    var cachedLogoBase64 = null;

    // Preload and cache logo as base64 for PDF generation
    var preloadLogoForPDF = function() {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            try {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                cachedLogoBase64 = canvas.toDataURL('image/png');
                console.log('Logo cached for PDF generation');
            } catch (e) {
                console.warn('Could not cache logo:', e);
            }
        };
        img.onerror = function() {
            console.warn('Could not load logo for caching');
        };
        // Use absolute URL to ensure it loads
        img.src = '/images/scarlo-logo.png';
    };

    // Get logo source for PDF (base64 if cached, URL fallback)
    var getLogoForPDF = function() {
        return cachedLogoBase64 || 'https://scarlo.dev/images/scarlo-logo.png';
    };

    // Country code configuration with digit limits
    var countryCodeConfig = {
        '+1': { maxDigits: 10, format: 'US' },    // US/Canada
        '+44': { maxDigits: 10, format: 'UK' },   // UK
        '+91': { maxDigits: 10, format: 'IN' },   // India
        '+61': { maxDigits: 9, format: 'AU' },    // Australia
        '+81': { maxDigits: 10, format: 'JP' },   // Japan
        '+49': { maxDigits: 11, format: 'DE' },   // Germany
        '+33': { maxDigits: 9, format: 'FR' },    // France
        '+86': { maxDigits: 11, format: 'CN' },   // China
        '+52': { maxDigits: 10, format: 'MX' },   // Mexico
        '+55': { maxDigits: 11, format: 'BR' }    // Brazil
    };

    // Format phone number based on country code
    var formatPhoneNumber = function(phone, countryCode) {
        if (!phone) return '';

        // Default to +1 if not specified
        countryCode = countryCode || '+1';
        var config = countryCodeConfig[countryCode] || countryCodeConfig['+1'];

        // Remove all non-digits
        var digits = phone.replace(/\D/g, '');

        // Limit to max digits for the country
        if (digits.length > config.maxDigits) {
            digits = digits.substring(0, config.maxDigits);
        }

        // Build formatted number based on country
        var result = '';
        if (config.format === 'US') {
            // US/Canada format: (xxx) xxx-xxxx
            if (digits.length > 0) {
                result = '(' + digits.substring(0, Math.min(3, digits.length));
            }
            if (digits.length > 3) {
                result += ') ' + digits.substring(3, Math.min(6, digits.length));
            }
            if (digits.length > 6) {
                result += '-' + digits.substring(6, 10);
            }
        } else {
            // International format: just add spaces every 3-4 digits
            result = digits;
            if (digits.length > 3) {
                result = digits.substring(0, 3) + ' ' + digits.substring(3);
            }
            if (digits.length > 6) {
                result = digits.substring(0, 3) + ' ' + digits.substring(3, 6) + ' ' + digits.substring(6);
            }
            if (digits.length > 9) {
                result = digits.substring(0, 3) + ' ' + digits.substring(3, 6) + ' ' + digits.substring(6, 9) + ' ' + digits.substring(9);
            }
        }

        return result;
    };

    // Normalize phone number to E.164 format (+1XXXXXXXXXX) for Firestore storage
    // This ensures phone numbers match Firebase Auth format for security rules
    var normalizeToE164 = function(phone) {
        if (!phone) return '';
        // Remove all non-digits
        var cleaned = phone.replace(/\D/g, '');
        // If it's 10 digits, add country code
        if (cleaned.length === 10) {
            return '+1' + cleaned;
        }
        // If it's 11 digits starting with 1, add +
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return '+' + cleaned;
        }
        // If already has + at start, return as-is
        if (phone.startsWith('+')) {
            return phone.replace(/[^\d+]/g, '');
        }
        // Fallback: return with +1 prefix if we have digits
        if (cleaned.length >= 10) {
            return '+1' + cleaned.slice(-10);
        }
        return phone; // Return original if can't normalize
    };

    // Live phone input formatter - attach to input elements
    var setupPhoneInputFormatting = function(input) {
        if (!input) return;

        input.addEventListener('input', function() {
            var cursorPos = input.selectionStart;
            var value = input.value;

            // Count digits before cursor in raw input
            var digitsBeforeCursor = value.slice(0, cursorPos).replace(/\D/g, '').length;

            // Extract all digits, limit to 10
            var digits = value.replace(/\D/g, '').slice(0, 10);

            // Build formatted string piece by piece
            var formatted = '';
            for (var i = 0; i < digits.length; i++) {
                if (i === 0) formatted += '(';
                if (i === 3) formatted += ') ';
                if (i === 6) formatted += '-';
                formatted += digits[i];
            }

            input.value = formatted;

            // Find cursor position: count through formatted string until we've seen digitsBeforeCursor digits
            var newCursorPos = 0;
            var digitsSeen = 0;
            for (var j = 0; j < formatted.length; j++) {
                if (/\d/.test(formatted[j])) {
                    digitsSeen++;
                    if (digitsSeen === digitsBeforeCursor) {
                        newCursorPos = j + 1;
                        break;
                    }
                }
            }

            // Handle edge case: cursor at very start
            if (digitsBeforeCursor === 0) {
                newCursorPos = formatted.length > 0 ? 1 : 0; // After '(' if exists
            }

            input.setSelectionRange(newCursorPos, newCursorPos);
        });
    };

    // === DEVICE DETECTION ===
    var DeviceDetector = {
        isMobile: function() {
            return window.innerWidth <= 1024 || 'ontouchstart' in window;
        },
        isLowEndDevice: function() {
            var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
            }
            return navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
        },
        isLaptopOrLarger: function() {
            return window.innerWidth >= 1024;
        }
    };

    // === NAVIGATION ===
    var Navigation = function() {
        this.nav = $('.navbar');
        if (!this.nav) {
            console.warn('Navbar not found');
            return;
        }
        
        this.hamburger = $('.hamburger');
        this.menu = $('.nav-menu');
        this.links = $$('.nav-link');
        this.sections = null;
        this.isScrolled = false;
        this.scrollTicking = false;
        this.activeLinkTicking = false;
        
        var self = this;
        requestAnimationFrame(function() {
            self.init();
        });
    };

    Navigation.prototype.init = function() {
        this.setupSmoothScroll();
        this.setupMobileMenu();
        this.setupLanguageToggle();

        var self = this;
        setTimeout(function() {
            self.setupScrollEffects();
            self.setupActiveLinks();
        }, 100);
    };

    Navigation.prototype.setupSmoothScroll = function() {
        var self = this;
        var anchors = $$('a[href^="#"]');
        
        for (var i = 0; i < anchors.length; i++) {
            (function(anchor) {
                anchor.addEventListener('click', function(e) {
                    var targetId = anchor.getAttribute('href');
                    if (!targetId || targetId === '#') return;
                    
                    var target = $(targetId);
                    if (target) {
                        e.preventDefault();
                        var navHeight = self.nav ? self.nav.offsetHeight : 0;
                        var targetPosition = target.offsetTop - navHeight;
                        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                        self.closeMobileMenu();
                    }
                });
            })(anchors[i]);
        }
    };

    Navigation.prototype.setupMobileMenu = function() {
        var self = this;
        if (!this.hamburger || !this.menu) return;

        this.hamburger.addEventListener('click', function() {
            self.toggleMobileMenu();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && self.menu && self.menu.classList.contains('active')) {
                self.closeMobileMenu();
            }
        });

        document.addEventListener('click', function(e) {
            if (self.menu && self.menu.classList.contains('active') && 
                !self.menu.contains(e.target) && 
                self.hamburger && !self.hamburger.contains(e.target)) {
                self.closeMobileMenu();
            }
        });
    };

    Navigation.prototype.toggleMobileMenu = function() {
        if (!this.menu || !this.hamburger) return;
        this.menu.classList.toggle('active');
        this.hamburger.classList.toggle('active');
        document.body.style.overflow = this.menu.classList.contains('active') ? 'hidden' : '';
    };

    Navigation.prototype.closeMobileMenu = function() {
        if (!this.menu || !this.hamburger) return;
        this.menu.classList.remove('active');
        this.hamburger.classList.remove('active');
        document.body.style.overflow = '';
    };

    Navigation.prototype.setupScrollEffects = function() {
        var self = this;
        if (!this.nav) return;
        
        var scrollThreshold = 100;
        var hysteresis = 20;
        
        var handleScroll = function() {
            var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
            
            if (!self.isScrolled && scrollY > scrollThreshold) {
                self.isScrolled = true;
                self.nav.classList.add('scrolled');
            } else if (self.isScrolled && scrollY < (scrollThreshold - hysteresis)) {
                self.isScrolled = false;
                self.nav.classList.remove('scrolled');
            }
            self.scrollTicking = false;
        };
        
        var onScroll = function() {
            if (!self.scrollTicking) {
                self.scrollTicking = true;
                requestAnimationFrame(handleScroll);
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        
        var initialScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        if (initialScrollY > scrollThreshold) {
            this.isScrolled = true;
            this.nav.classList.add('scrolled');
        }
    };

    Navigation.prototype.setupActiveLinks = function() {
        var self = this;
        if (!this.links || this.links.length === 0) return;
        
        this.sections = $$('section[id]');
        if (!this.sections || this.sections.length === 0) return;
        
        var updateActiveLink = function() {
            var scrollPosition = window.pageYOffset + window.innerHeight / 2;
            var documentHeight = document.documentElement.scrollHeight;
            var windowHeight = window.innerHeight;
            var current = '';
            
            if (window.pageYOffset + windowHeight >= documentHeight - 50) {
                current = 'contact';
            } else {
                for (var i = 0; i < self.sections.length; i++) {
                    var section = self.sections[i];
                    var sectionTop = section.offsetTop;
                    var sectionHeight = section.offsetHeight;
                    if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                        current = section.getAttribute('id');
                        break;
                    }
                }
            }

            for (var j = 0; j < self.links.length; j++) {
                var link = self.links[j];
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + current) {
                    link.classList.add('active');
                }
            }
            self.activeLinkTicking = false;
        };
        
        var onScrollForLinks = function() {
            if (!self.activeLinkTicking) {
                self.activeLinkTicking = true;
                requestAnimationFrame(updateActiveLink);
            }
        };

        window.addEventListener('scroll', onScrollForLinks, { passive: true });

        setTimeout(updateActiveLink, 200);
    };

    // === LANGUAGE TOGGLE ===
    Navigation.prototype.setupLanguageToggle = function() {
        var langToggle = document.getElementById('langToggle');
        if (!langToggle) return;

        var buttons = langToggle.querySelectorAll('.lang-btn');
        var currentLang = typeof getCurrentLang === 'function' ? getCurrentLang() : 'en';

        // Set initial active state from localStorage
        buttons.forEach(function(btn) {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === currentLang);
        });

        // Apply stored language on load
        this.applyLanguage(currentLang);

        var self = this;
        buttons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var lang = this.getAttribute('data-lang');
                if (typeof setLang === 'function') setLang(lang);

                // Update active state
                buttons.forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');

                // Apply translations
                self.applyLanguage(lang);

                // Update hero rotating text
                if (window.rotatingText && window.rotatingText.switchLanguage) {
                    window.rotatingText.switchLanguage();
                }
            });
        });
    };

    Navigation.prototype.applyLanguage = function(lang) {
        if (typeof t !== 'function') return;

        // Update all elements with data-i18n attribute (textContent)
        var elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(function(el) {
            var key = el.getAttribute('data-i18n');
            var translated = t(key);
            if (translated && translated !== key) {
                // Never destroy char-wrapped rotating text elements
                if (el.classList.contains('rotating-text')) return;
                el.textContent = translated;
            }
        });

        // Update all elements with data-i18n-html attribute (innerHTML)
        var htmlElements = document.querySelectorAll('[data-i18n-html]');
        htmlElements.forEach(function(el) {
            var key = el.getAttribute('data-i18n-html');
            var translated = t(key);
            if (translated && translated !== key) {
                el.innerHTML = translated;
            }
        });

        // Update all elements with data-i18n-placeholder attribute
        var placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(function(el) {
            var key = el.getAttribute('data-i18n-placeholder');
            var translated = t(key);
            if (translated && translated !== key) {
                el.placeholder = translated;
            }
        });

        // Update auth button text — only when logged out (logged-in text is the user's name)
        var authBtn = document.getElementById('authActionBtn');
        var authText = document.getElementById('authStatusText');
        if (authText && authBtn && !authBtn.classList.contains('logged-in')) {
            authText.textContent = t('nav.signIn');
        }
    };

// === ROTATING TEXT ANIMATION - ENHANCED ===
var RotatingText = function() {
    this.wrapper = $('.rotating-text-wrapper');
    if (!this.wrapper) return;

    this.texts = $$('.rotating-text');
    this.currentIndex = 0;

    // Pre-translate hero text if current language is not English
    var lang = typeof getCurrentLang === 'function' ? getCurrentLang() : 'en';
    if (lang !== 'en' && typeof t === 'function') {
        var titleLine = document.querySelector('.hero-title-visual .title-line:first-child');
        if (titleLine) titleLine.textContent = t('hero.titleLine1');
        this.texts.forEach(function(textEl, i) {
            var translated = t('hero.r' + i);
            if (translated) textEl.textContent = translated;
        });
    }

    this.init();
};

RotatingText.prototype.init = function() {
    var self = this;

    // Wrap each text in character spans
    this.texts.forEach(function(textEl) {
        var originalText = textEl.textContent;
        var html = '';

        Array.from(originalText).forEach(function(char) {
            if (char === ' ') {
                html += '<span class="char-space"> </span>';
            } else {
                html += '<span class="char">' + char + '</span>';
            }
        });

        textEl.innerHTML = html;
    });

    // Start rotation after 3 seconds
    setTimeout(function() {
        self.rotate();
    }, 3000);
};

RotatingText.prototype.rotate = function() {
    var self = this;

    setInterval(function() {
        // Remove active class from current
        self.texts[self.currentIndex].classList.remove('active');

        // Move to next index
        self.currentIndex = (self.currentIndex + 1) % self.texts.length;

        // Add active class to next
        self.texts[self.currentIndex].classList.add('active');
    }, 7000);
};

RotatingText.prototype.switchLanguage = function() {
    if (typeof t !== 'function') return;

    // Update hero title line
    var titleLine = document.querySelector('.hero-title-visual .title-line:first-child');
    if (titleLine) titleLine.textContent = t('hero.titleLine1');

    // Rebuild char spans with translated text
    this.texts.forEach(function(textEl, i) {
        var translated = t('hero.r' + i);
        if (translated) {
            var html = '';
            Array.from(translated).forEach(function(char) {
                if (char === ' ') {
                    html += '<span class="char-space"> </span>';
                } else {
                    html += '<span class="char">' + char + '</span>';
                }
            });
            textEl.innerHTML = html;
        }
    });
};

    // === SCROLL ANIMATIONS ===
    var ScrollAnimations = function() {
        this.init();
    };

    ScrollAnimations.prototype.init = function() {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -100px 0px'
        });

        $$('.portfolio-item, .philosophy-card').forEach(function(el) {
            observer.observe(el);
        });
    };

    // === PORTFOLIO HANDLER ===
    var PortfolioHandler = function() {
        this.thumbnails = $$('.portfolio-thumbnail');
        this.isMobile = DeviceDetector.isMobile();
        console.log('Portfolio Handler - Mobile mode:', this.isMobile);
        this.init();
    };

    PortfolioHandler.prototype.init = function() {
        var self = this;
        
        if (this.isMobile) {
            console.log('Mobile: Using thumbnail links only');
            this.thumbnails.forEach(function(thumbnail) {
                thumbnail.addEventListener('click', function() {
                    var url = thumbnail.getAttribute('data-url');
                    if (url) {
                        window.open(url, '_blank');
                    }
                });
            });
        } else {
            console.log('Desktop: Enabling iframe loading');
            this.setupDesktopIframes();
        }
    };

    PortfolioHandler.prototype.setupDesktopIframes = function() {
        var self = this;
        
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    self.loadIframe(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '500px',
            threshold: 0.01
        });

        this.thumbnails.forEach(function(thumbnail) {
            observer.observe(thumbnail);
        });
    };

    PortfolioHandler.prototype.loadIframe = function(thumbnail) {
        var url = thumbnail.getAttribute('data-url');
        
        if (!url) {
            console.error('No URL found for thumbnail');
            return;
        }

        console.log('Loading iframe:', url);

        var iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; display: block;';
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('allowfullscreen', '');

        iframe.addEventListener('load', function() {
            console.log('Iframe loaded:', url);
        });

        iframe.addEventListener('error', function() {
            console.error('Iframe error:', url);
            thumbnail.innerHTML = '<div class="thumbnail-overlay"><span>Failed to load preview</span></div>';
        });

        var parent = thumbnail.parentElement;
        parent.innerHTML = '';
        parent.appendChild(iframe);
    };

    // === FORM HANDLER ===
    var FormHandler = function() {
        this.form = $('.contact-form');
        this.fields = $$('.form-field input, .form-field textarea');
        if (this.form) this.init();
    };

    FormHandler.prototype.init = function() {
        var self = this;
        this.fields.forEach(function(field) {
            field.setAttribute('placeholder', ' ');
        });

        this.form.addEventListener('submit', function(e) {
            e.preventDefault();
            var submitBtn = $('.btn-submit');
            var btnText = $('.btn-text', submitBtn);
            var originalText = btnText.textContent;

            submitBtn.disabled = true;
            btnText.textContent = t('contact.btn.sending');

            setTimeout(function() {
                btnText.textContent = t('contact.btn.sent');
                submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                self.form.reset();

                setTimeout(function() {
                    btnText.textContent = originalText;
                    submitBtn.style.background = '';
                    submitBtn.disabled = false;
                }, 3000);
            }, 1500);
        });
    };

    // === FIREBASE AUTH HANDLER ===
    var FirebaseAuthHandler = function() {
        this.authModal = $('#authModal');
        this.contractModal = $('#contractModal');
        this.currentUser = null;

        // Phone auth properties
        this.recaptchaVerifier = null;
        this.confirmationResult = null;
        this.currentPhoneNumber = '';
        this.lastLoginError = null;  // Stores context for help modal

        if (!this.authModal || !this.contractModal) {
            console.error('Auth or Contract modal not found');
            return;
        }

        this.init();
    };

    FirebaseAuthHandler.prototype.init = function() {
        var self = this;
        
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(function(user) {
                self.handleAuthStateChange(user);
            });
        } else {
            console.error('Firebase is not loaded.');
        }
        
        var authActionBtn = $('#authActionBtn');
        if (authActionBtn) {
            authActionBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (self.currentUser) {
                    if (confirm(t('auth.confirm.signOut'))) {
                        self.handleLogout();
                    }
                } else {
                    self.showAuthModal();
                }
            });
        }
        
        // Handle all contract trigger buttons
        $$('.view-contract-trigger').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                self.checkAuthAndShowContract();
            });
        });
        
        var downloadBtn = $('#downloadTemplateBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                self.checkAuthAndShowContract();
            });
        }
        
        var closeAuthBtn = $('#closeAuthBtn');
        if (closeAuthBtn) {
            closeAuthBtn.addEventListener('click', function() {
                self.closeAuthModal();
            });
        }
        
        var closeModalBtn = $('#closeModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', function() {
                self.closeContractModal();
            });
        }
        
        var loginForm = $('#loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                self.handleLogin();
            });
        }
        
        var authOverlay = $('.auth-overlay', this.authModal);
        if (authOverlay) {
            authOverlay.addEventListener('click', function() {
                self.closeAuthModal();
            });
        }
        
        var modalOverlay = $('.modal-overlay', this.contractModal);
        if (modalOverlay) {
            modalOverlay.addEventListener('click', function() {
                self.closeContractModal();
            });
        }

        // Contact developer buttons for login errors
        var loginContactDevBtn = $('#loginContactDevBtn');
        if (loginContactDevBtn) {
            loginContactDevBtn.addEventListener('click', function() {
                self.openHelpModalWithContext();
            });
        }

        var phoneContactDevBtn = $('#phoneContactDevBtn');
        if (phoneContactDevBtn) {
            phoneContactDevBtn.addEventListener('click', function() {
                self.openHelpModalWithContext();
            });
        }

        var verifyContactDevBtn = $('#verifyContactDevBtn');
        if (verifyContactDevBtn) {
            verifyContactDevBtn.addEventListener('click', function() {
                self.openHelpModalWithContext();
            });
        }

        // Initialize phone authentication
        this.setupTabs();
        this.initPhoneAuth();
    };

    FirebaseAuthHandler.prototype.checkAuthAndShowContract = function() {
        if (this.currentUser) {
            this.showContractModal();
        } else {
            this.showAuthModal();
        }
    };

    FirebaseAuthHandler.prototype.handleAuthStateChange = function(user) {
        var self = this;
        this.currentUser = user;

        var authBtn = $('#authActionBtn');
        var authText = $('#authStatusText');

        if (user) {
            if (authBtn) authBtn.classList.add('logged-in');

            // Display email or formatted phone number
            if (authText) {
                if (user.email) {
                    authText.textContent = user.email.split('@')[0];
                } else if (user.phoneNumber) {
                    // Display last 4 digits of phone
                    authText.textContent = '***' + user.phoneNumber.slice(-4);
                }
            }

            // Save/update user info in Firestore users collection
            this.saveUserToFirestore(user);

            // Auto-open contract modal for developer if SOW URL params are present
            var developerEmail = (window.VITE_DEVELOPER_EMAIL || '').trim().toLowerCase();
            var userEmail = user.email ? user.email.trim().toLowerCase() : '';
            if (userEmail && userEmail === developerEmail) {
                var params = new URLSearchParams(window.location.search);
                var hasSOWParams = params.has('business') || params.has('phone') || params.has('email') || params.has('package');
                if (hasSOWParams) {
                    // Delay slightly to ensure everything is initialized
                    setTimeout(function() {
                        self.showContractModal();
                    }, 300);
                }
            }
        } else {
            console.log('User signed out');
            if (authBtn) authBtn.classList.remove('logged-in');
            if (authText) authText.textContent = t('auth.btn.signIn');
            this.closeContractModal();
        }
    };

    // Save user info to Firestore users collection
    FirebaseAuthHandler.prototype.saveUserToFirestore = function(user) {

        if (!user || !user.uid) {
            console.log('⚠️ No user or uid, skipping save');
            return;
        }

        // Skip developer email - they don't need to be in the users dropdown
        var developerEmail = window.VITE_DEVELOPER_EMAIL || '';
        if (user.email && user.email.toLowerCase() === developerEmail.toLowerCase()) {
            console.log('⚠️ Developer email, skipping save');
            return;
        }

        var userData = {
            uid: user.uid,
            email: user.email || null,
            phoneNumber: user.phoneNumber || null,
            displayName: user.displayName || null,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('💾 Saving user data to Firestore:', userData);

        var usersRef = firebase.firestore().collection('users');

        // Save user data using their Firebase Auth UID
        // Note: Manual record merging (if needed) should be done server-side with Admin SDK
        usersRef.doc(user.uid).set(userData, { merge: true })
            .then(function() {
                console.log('✅ User info saved to Firestore successfully');
            })
            .catch(function(error) {
                console.error('❌ Error saving user to Firestore:', error);
            });
    };

    FirebaseAuthHandler.prototype.showAuthModal = function() {
        if (this.authModal) {
            this.authModal.classList.add('show');
            document.body.style.overflow = 'hidden';
            document.body.classList.add('modal-open');
        }
    };

    FirebaseAuthHandler.prototype.closeAuthModal = function() {
        if (this.authModal) {
            this.authModal.classList.remove('show');
            document.body.style.overflow = '';
            document.body.classList.remove('modal-open');

            // Reset phone auth state when closing
            this.resetPhoneAuthToStep1();
        }
    };

    FirebaseAuthHandler.prototype.showContractModal = function() {
        if (this.contractModal) {
            this.contractModal.classList.add('show');
            document.body.style.overflow = 'hidden';
            document.body.classList.add('modal-open');
            
            // Dispatch event to initialize signature pads after modal is visible
            setTimeout(function() {
                window.dispatchEvent(new CustomEvent('contractModalOpened'));
            }, 150);
        }
    };

    FirebaseAuthHandler.prototype.closeContractModal = function() {
        // Cleanup realtime listeners for user search
        if (window.unsubscribeFromUsers) {
            window.unsubscribeFromUsers();
        }

        if (this.contractModal) {
            this.contractModal.classList.remove('show');
            document.body.style.overflow = '';
            document.body.classList.remove('modal-open');
        }
    };

    FirebaseAuthHandler.prototype.resetContractModalState = function() {
        // Remove developer dashboard from DOM
        var devDashboard = document.getElementById('developerDashboard');
        if (devDashboard) {
            devDashboard.remove();
        }

        // Remove dual signing completed container from DOM
        var dualSigningCompleted = document.getElementById('dualSigningCompleted');
        if (dualSigningCompleted) {
            dualSigningCompleted.remove();
        }

        // Reset close button positioning (client view makes it sticky)
        var closeBtn = document.getElementById('closeModalBtn');
        if (closeBtn) {
            closeBtn.style.display = '';
            closeBtn.style.position = '';
            closeBtn.style.top = '';
            closeBtn.style.alignSelf = '';
            closeBtn.style.marginRight = '';
            closeBtn.style.marginTop = '';
            closeBtn.style.marginBottom = '';
            closeBtn.style.flexShrink = '';
        }

        // Reset modal header visibility (developer view hides it)
        var modalHeader = document.querySelector('.modal-header');
        if (modalHeader) {
            modalHeader.style.display = '';
        }

        // Reset contract form visibility and clear fields
        var contractForm = document.getElementById('contractForm');
        if (contractForm) {
            contractForm.style.display = '';
            contractForm.reset();
        }

        // Reset signature blocks
        var clientSigBlock = document.getElementById('clientSignatureBlock');
        var devSigBlock = document.getElementById('developerSignatureBlock');
        if (clientSigBlock) clientSigBlock.style.display = '';
        if (devSigBlock) devSigBlock.style.display = '';

        // Clear signature canvases
        var clientCanvas = document.getElementById('clientSignaturePad');
        var devCanvas = document.getElementById('devSignaturePad');
        if (clientCanvas) {
            var ctx = clientCanvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
        }
        if (devCanvas) {
            var ctx = devCanvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, devCanvas.width, devCanvas.height);
        }
    };

    FirebaseAuthHandler.prototype.handleLogin = function() {
        var email = $('#loginEmail').value.trim();
        var password = $('#loginPassword').value;
        var errorEl = $('#loginError');
        var helpLinkEl = $('#loginHelpLink');
        var submitBtn = $('#loginForm button[type="submit"]');

        // Hide help link from previous attempt
        if (helpLinkEl) helpLinkEl.style.display = 'none';

        if (!email || !password) {
            this.showError(errorEl, t('auth.err.fillFields'));
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = t('auth.btn.signingIn');

        var self = this;
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then(function(userCredential) {
                console.log('Login successful');
                self.closeAuthModal();
                $('#loginForm').reset();
                setTimeout(function() {
                    self.showContractModal();
                }, 300);
            })
            .catch(function(error) {
                console.error('Login error:', error);
                self.showErrorWithHelpLink(errorEl, helpLinkEl, self.getErrorMessage(error.code), {
                    email: email,
                    errorType: 'account_access'
                });
            })
            .finally(function() {
                submitBtn.disabled = false;
                submitBtn.textContent = t('auth.btn.signIn');
            });
    };

    FirebaseAuthHandler.prototype.handleLogout = function() {
        var self = this;
        firebase.auth().signOut()
            .then(function() {
                console.log('Logged out successfully');
                self.resetContractModalState();
                self.closeContractModal();
            })
            .catch(function(error) {
                console.error('Logout error:', error);
                alert(t('auth.err.signOut'));
            });
    };

    FirebaseAuthHandler.prototype.showError = function(element, message) {
        if (element) {
            element.textContent = message;
            element.classList.add('show');
            
            setTimeout(function() {
                element.classList.remove('show');
            }, 5000);
        }
    };

    FirebaseAuthHandler.prototype.getErrorMessage = function(errorCode) {
        var messages = {
            // Email auth errors
            'auth/configuration-not-found': t('auth.err.configNotFound'),
            'auth/invalid-email': t('auth.err.invalidEmail'),
            'auth/user-not-found': t('auth.err.userNotFound'),
            'auth/wrong-password': t('auth.err.wrongPassword'),
            'auth/too-many-requests': t('auth.err.tooManyRequests'),
            'auth/network-request-failed': t('auth.err.networkFailed'),
            'auth/user-disabled': t('auth.err.userDisabled'),
            'auth/invalid-credential': t('auth.err.invalidCredential'),
            // Phone auth errors
            'auth/invalid-phone-number': t('auth.err.invalidPhone'),
            'auth/missing-phone-number': t('auth.err.missingPhone'),
            'auth/quota-exceeded': t('auth.err.quotaExceeded'),
            'auth/captcha-check-failed': t('auth.err.captchaFailed'),
            'auth/invalid-verification-code': t('auth.err.invalidCode'),
            'auth/code-expired': t('auth.err.codeExpired'),
            'auth/missing-verification-code': t('auth.err.missingCode'),
            'auth/invalid-verification-id': t('auth.err.invalidVerificationId'),
            'auth/session-expired': t('auth.err.sessionExpired'),
            'auth/credential-already-in-use': t('auth.err.credentialInUse'),
            'auth/operation-not-allowed': t('auth.err.operationNotAllowed'),
            'auth/billing-not-enabled': t('auth.err.billingNotEnabled')
        };

        return messages[errorCode] || t('auth.err.default');
    };

    // === CONTACT DEVELOPER HELP LINK METHODS ===

    FirebaseAuthHandler.prototype.showErrorWithHelpLink = function(errorEl, helpLinkEl, message, context) {
        var self = this;

        // Store error context for help modal
        this.lastLoginError = {
            message: message,
            email: context.email || '',
            phone: context.phone || '',
            errorType: context.errorType || 'account_access'
        };

        // Hide any existing help link
        if (helpLinkEl) {
            helpLinkEl.style.display = 'none';
        }

        // Show error message
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');

            // After 5 seconds, hide error and show help link
            setTimeout(function() {
                errorEl.classList.remove('show');

                // Show help link after error hides
                if (helpLinkEl) {
                    helpLinkEl.style.display = 'flex';
                }
            }, 5000);
        }
    };

    FirebaseAuthHandler.prototype.openHelpModalWithContext = function() {
        var helpModal = $('#helpModal');
        var helpContact = $('#helpContact');
        var helpContactLabel = $('#helpContactLabel');
        var helpIssue = $('#helpIssue');
        var helpDetails = $('#helpDetails');
        var contactTabs = $('#contactTabs');
        var successMessage = $('#helpSuccessMessage');
        var formGroups = document.querySelectorAll('#helpRequestForm .form-group');
        var formFooter = document.querySelector('.help-form-footer');

        if (!helpModal || !this.lastLoginError) return;

        // Show modal
        helpModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');

        // Reset form appearance
        if (successMessage) successMessage.classList.remove('show');
        formGroups.forEach(function(group) {
            group.style.display = 'block';
        });
        if (formFooter) formFooter.style.display = 'flex';

        // Pre-fill contact field with the email/phone they tried
        if (helpContact) {
            if (this.lastLoginError.email) {
                helpContact.value = this.lastLoginError.email;
                helpContact.type = 'email';
                helpContact.placeholder = 'your@email.com';
                if (helpContactLabel) helpContactLabel.textContent = t('help.label.email');
                // Hide tabs since we're pre-filling
                if (contactTabs) contactTabs.style.display = 'none';
            } else if (this.lastLoginError.phone) {
                helpContact.value = this.lastLoginError.phone;
                helpContact.type = 'tel';
                helpContact.placeholder = '(555) 123-4567';
                if (helpContactLabel) helpContactLabel.textContent = t('help.label.phone');
                if (contactTabs) contactTabs.style.display = 'none';
            }

            // Make it editable so user can correct if needed
            helpContact.removeAttribute('readonly');
            helpContact.style.opacity = '1';
        }

        // Pre-fill issue type
        if (helpIssue) {
            helpIssue.value = this.lastLoginError.errorType;
        }

        // Leave details field blank for user input
        if (helpDetails) {
            helpDetails.value = '';
        }
    };

    // === PHONE AUTHENTICATION METHODS ===

    FirebaseAuthHandler.prototype.setupTabs = function() {
        var self = this;
        var tabs = $$('.auth-tab', this.authModal);
        var panels = $$('.auth-panel', this.authModal);

        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                var targetTab = this.getAttribute('data-tab');

                // Update tab active states
                tabs.forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');

                // Update panel visibility
                panels.forEach(function(panel) {
                    panel.classList.remove('active');
                });

                var targetPanel = $('#' + targetTab + 'Panel', self.authModal);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }

                // Hide all help links when switching tabs
                var allHelpLinks = $$('.auth-help-link', self.authModal);
                allHelpLinks.forEach(function(link) {
                    link.style.display = 'none';
                });

                // Reset phone auth state when switching to phone tab
                if (targetTab === 'phone') {
                    self.resetPhoneAuthToStep1();
                }
            });
        });
    };

    FirebaseAuthHandler.prototype.initPhoneAuth = function() {
        var self = this;

        var phoneForm = $('#phoneForm');
        var verifyForm = $('#verifyCodeForm');
        var backBtn = $('#backToPhoneBtn');

        if (phoneForm) {
            phoneForm.addEventListener('submit', function(e) {
                e.preventDefault();
                self.handlePhoneSubmit();
            });
        }

        if (verifyForm) {
            verifyForm.addEventListener('submit', function(e) {
                e.preventDefault();
                self.handleCodeVerification();
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', function() {
                self.resetPhoneAuthToStep1();
            });
        }

        // Auto-format phone number input with proper deletion support
        var phoneInput = $('#phoneNumber');
        if (phoneInput) {
            setupPhoneInputFormatting(phoneInput);
        }

        // Auto-filter verification code input to digits only
        var codeInput = $('#verificationCode');
        if (codeInput) {
            codeInput.addEventListener('input', function(e) {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
            });
        }
    };

    // Initialize invisible reCAPTCHA (required by Firebase, but verification is disabled via appVerificationDisabledForTesting)
    FirebaseAuthHandler.prototype.initRecaptcha = function() {
        if (this.recaptchaVerifier) return;

        this.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible'
        });
    };

    FirebaseAuthHandler.prototype.handlePhoneSubmit = function() {
        var self = this;
        var countryCodeEl = $('#countryCode');
        var phoneNumberEl = $('#phoneNumber');
        var countryCode = countryCodeEl ? countryCodeEl.value : '+1';
        var phoneNumber = phoneNumberEl ? phoneNumberEl.value.replace(/\D/g, '') : '';
        var errorEl = $('#phoneError');
        var helpLinkEl = $('#phoneHelpLink');
        var submitBtn = $('#sendCodeBtn');

        // Clear previous errors and hide help link
        if (errorEl) {
            errorEl.classList.remove('show');
            errorEl.textContent = '';
        }
        if (helpLinkEl) helpLinkEl.style.display = 'none';

        // Validate phone number
        if (!phoneNumber || phoneNumber.length < 10) {
            this.showError(errorEl, t('auth.err.validPhone'));
            return;
        }

        // Format full phone number
        var fullPhoneNumber = countryCode + phoneNumber;
        this.currentPhoneNumber = fullPhoneNumber;

        // Reset test phone flag
        this.isTestPhone = false;

        // Show loading state
        this.setPhoneLoadingState(submitBtn, true);

        // Check if this is a test phone number using Cloud Function
        var checkTestPhoneNumber = firebase.functions().httpsCallable('checkTestPhoneNumber');
        checkTestPhoneNumber({ phoneNumber: fullPhoneNumber })
            .then(function(result) {
                if (result.data.isTestPhone) {
                    // This is a test phone number - skip real SMS
                    console.log('Test phone number detected, skipping SMS');
                    self.isTestPhone = true;
                    self.confirmationResult = null; // No real confirmation result for test phones

                    // Update UI to show verification step
                    self.showVerificationStep();

                    // No resend timer for test phones (code is fixed)
                    self.setPhoneLoadingState(submitBtn, false);
                } else {
                    // Not a test phone - show error (no real SMS support)
                    var phoneHelpLink = $('#phoneHelpLink');
                    self.showErrorWithHelpLink(errorEl, phoneHelpLink, t('auth.err.phoneNotRegistered'), {
                        phone: fullPhoneNumber,
                        errorType: 'account_access'
                    });
                    self.setPhoneLoadingState(submitBtn, false);
                }
            })
            .catch(function(error) {
                console.error('Error checking test phone:', error);
                var phoneHelpLink = $('#phoneHelpLink');
                self.showErrorWithHelpLink(errorEl, phoneHelpLink, t('auth.err.phoneVerifyFailed'), {
                    phone: fullPhoneNumber,
                    errorType: 'account_access'
                });
                self.setPhoneLoadingState(submitBtn, false);
            });
    };

    // Helper to proceed with real Firebase Phone Auth
    FirebaseAuthHandler.prototype.proceedWithRealPhoneAuth = function(fullPhoneNumber, errorEl, submitBtn) {
        var self = this;

        // Initialize reCAPTCHA (required by Firebase API, but verification is disabled)
        this.initRecaptcha();

        // Send verification code
        firebase.auth().signInWithPhoneNumber(fullPhoneNumber, this.recaptchaVerifier)
            .then(function(confirmationResult) {
                console.log('SMS sent successfully');
                self.confirmationResult = confirmationResult;

                // Update UI to show verification step
                self.showVerificationStep();
            })
            .catch(function(error) {
                console.error('SMS send error:', error);
                self.showError(errorEl, self.getErrorMessage(error.code));
                // Reset reCAPTCHA verifier so it can be recreated for next attempt
                self.recaptchaVerifier = null;
            })
            .finally(function() {
                self.setPhoneLoadingState(submitBtn, false);
            });
    };

    FirebaseAuthHandler.prototype.handleCodeVerification = function() {
        var self = this;
        var codeInput = $('#verificationCode');
        var code = codeInput ? codeInput.value.trim() : '';
        var errorEl = $('#verifyError');
        var helpLinkEl = $('#verifyHelpLink');
        var submitBtn = $('#verifyCodeBtn');

        // Clear previous errors and hide help link
        if (errorEl) {
            errorEl.classList.remove('show');
            errorEl.textContent = '';
        }
        if (helpLinkEl) helpLinkEl.style.display = 'none';

        // Validate code (4-6 digits for test phones, 6 digits for real)
        var minLength = this.isTestPhone ? 4 : 6;
        var maxLength = 6;
        if (!code || code.length < minLength || code.length > maxLength) {
            var msg = this.isTestPhone ?
                t('auth.err.codeDigits46') :
                t('auth.err.codeDigits6');
            this.showError(errorEl, msg);
            return;
        }

        // Show loading state
        this.setPhoneLoadingState(submitBtn, true);

        // Check if this is a test phone verification
        if (this.isTestPhone) {
            // Use Cloud Function for test phone verification
            this.verifyTestPhone(code, errorEl, submitBtn);
        } else {
            // Normal Firebase verification
            if (!this.confirmationResult) {
                this.showErrorWithHelpLink(errorEl, helpLinkEl, t('auth.err.invalidVerificationId'), {
                    phone: this.currentPhoneNumber,
                    errorType: 'verification_code'
                });
                this.setPhoneLoadingState(submitBtn, false);
                return;
            }

            this.confirmationResult.confirm(code)
                .then(function(result) {
                    console.log('Phone auth successful:', result.user);
                    self.closeAuthModal();
                    self.resetPhoneAuthState();
                    setTimeout(function() {
                        self.showContractModal();
                    }, 300);
                })
                .catch(function(error) {
                    console.error('Code verification error:', error);
                    var verifyHelpLink = $('#verifyHelpLink');
                    self.showErrorWithHelpLink(errorEl, verifyHelpLink, self.getErrorMessage(error.code), {
                        phone: self.currentPhoneNumber,
                        errorType: 'verification_code'
                    });
                })
                .finally(function() {
                    self.setPhoneLoadingState(submitBtn, false);
                });
        }
    };

    // Verify test phone number using Cloud Function
    FirebaseAuthHandler.prototype.verifyTestPhone = function(code, errorEl, submitBtn) {
        var self = this;

        console.log('Verifying test phone:', this.currentPhoneNumber);

        var verifyTestPhoneNumber = firebase.functions().httpsCallable('verifyTestPhoneNumber');

        verifyTestPhoneNumber({
            phoneNumber: this.currentPhoneNumber,
            verificationCode: code
        })
        .then(function(result) {
            if (result.data.success && result.data.customToken) {
                console.log('Test phone verification successful, signing in with custom token');
                // Sign in with the custom token
                return firebase.auth().signInWithCustomToken(result.data.customToken);
            } else {
                throw new Error('Verification failed');
            }
        })
        .then(function(userCredential) {
            console.log('Signed in with custom token:', userCredential.user);
            self.closeAuthModal();
            self.resetPhoneAuthState();
            setTimeout(function() {
                self.showContractModal();
            }, 300);
        })
        .catch(function(error) {
            console.error('Test phone verification error:', error);
            var message = error.message || t('auth.err.invalidCodeGeneric');
            if (error.code === 'functions/invalid-argument') {
                message = t('auth.err.invalidPhoneOrCode');
            } else if (error.code === 'functions/internal') {
                message = t('auth.err.serverError');
            }
            var verifyHelpLink = $('#verifyHelpLink');
            self.showErrorWithHelpLink(errorEl, verifyHelpLink, message, {
                phone: self.currentPhoneNumber,
                errorType: 'verification_code'
            });
        })
        .finally(function() {
            self.setPhoneLoadingState(submitBtn, false);
        });
    };

    FirebaseAuthHandler.prototype.showVerificationStep = function() {
        var phoneForm = $('#phoneForm');
        var verifyForm = $('#verifyCodeForm');

        if (phoneForm) phoneForm.style.display = 'none';
        if (verifyForm) verifyForm.style.display = 'block';

        // Focus on code input
        var codeInput = $('#verificationCode');
        if (codeInput) {
            setTimeout(function() { codeInput.focus(); }, 100);
        }
    };

    FirebaseAuthHandler.prototype.resetPhoneAuthToStep1 = function() {
        var phoneForm = $('#phoneForm');
        var verifyForm = $('#verifyCodeForm');

        if (phoneForm) phoneForm.style.display = 'block';
        if (verifyForm) verifyForm.style.display = 'none';

        // Clear verification code
        var codeInput = $('#verificationCode');
        if (codeInput) codeInput.value = '';

        // Clear errors
        var phoneError = $('#phoneError');
        var verifyError = $('#verifyError');
        if (phoneError) phoneError.classList.remove('show');
        if (verifyError) verifyError.classList.remove('show');

        // Reset loading states on both buttons
        var sendCodeBtn = $('#sendCodeBtn');
        var verifyCodeBtn = $('#verifyCodeBtn');
        this.setPhoneLoadingState(sendCodeBtn, false);
        this.setPhoneLoadingState(verifyCodeBtn, false);

        // Reset reCAPTCHA verifier so a fresh one is created on next attempt
        this.recaptchaVerifier = null;
    };

    FirebaseAuthHandler.prototype.resetPhoneAuthState = function() {
        this.confirmationResult = null;
        this.currentPhoneNumber = '';
        this.isTestPhone = false;
        this.resetPhoneAuthToStep1();

        // Clear phone form
        var phoneForm = $('#phoneForm');
        if (phoneForm) phoneForm.reset();
    };

    FirebaseAuthHandler.prototype.setPhoneLoadingState = function(button, isLoading) {
        if (!button) return;

        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    };

    FirebaseAuthHandler.prototype.formatPhoneDisplay = function(phoneNumber) {
        // Format for display: +1 (555) 123-4567
        if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
            var num = phoneNumber.slice(2);
            return '+1 (' + num.slice(0, 3) + ') ' + num.slice(3, 6) + '-' + num.slice(6);
        }
        return phoneNumber;
    };

    // =====================================================
    // SIGNATURE PAD - SIMPLE WORKING VERSION
    // =====================================================
    function createSignaturePad(canvas) {
        if (!canvas) return null;
        
        var ctx = canvas.getContext('2d');
        var drawing = false;
        var hasContent = false;
        var lastX = 0;
        var lastY = 0;
        
        // Setup canvas size
        function resize() {
            var rect = canvas.getBoundingClientRect();
            var dpr = window.devicePixelRatio || 1;

            // Guard against 0 dimensions - don't resize if canvas isn't visible yet
            if (rect.width <= 0 || rect.height <= 0) {
                console.log('Signature canvas not visible yet, will retry...', rect.width, 'x', rect.height);
                // Schedule a retry after a short delay
                setTimeout(function() {
                    var retryRect = canvas.getBoundingClientRect();
                    if (retryRect.width > 0 && retryRect.height > 0) {
                        resize();
                    }
                }, 100);
                return;
            }

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);

            // Set styles
            ctx.strokeStyle = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            console.log('Signature canvas sized:', rect.width, 'x', rect.height);
        }
        
        // Get coordinates from event - FIXED for canvas scaling
    function getPos(e) {
        var rect = canvas.getBoundingClientRect();
        var clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        // Calculate position relative to canvas
        var x = clientX - rect.left;
        var y = clientY - rect.top;
        
        // Scale coordinates to match internal canvas dimensions
        // This accounts for any CSS scaling vs internal canvas size mismatch
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        
        return {
            x: x * (scaleX / (window.devicePixelRatio || 1)),
            y: y * (scaleY / (window.devicePixelRatio || 1))
        };
    }
        
        // Start drawing
        function startDraw(e) {
            e.preventDefault();
            e.stopPropagation();
            
            drawing = true;
            hasContent = true;
            
            var pos = getPos(e);
            lastX = pos.x;
            lastY = pos.y;
            
            // Draw initial dot
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.fill();
            
            console.log('Sig start:', pos.x.toFixed(0), pos.y.toFixed(0));
        }
        
        // Continue drawing
        function moveDraw(e) {
            if (!drawing) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            var pos = getPos(e);
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            
            lastX = pos.x;
            lastY = pos.y;
        }
        
        // Stop drawing
        function endDraw(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            drawing = false;
        }
        
        // Clear canvas
        function clear() {
            var rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
            hasContent = false;
            console.log('Signature cleared');
        }
        
        // Attach event listeners
        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', moveDraw);
        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseleave', endDraw);
        
        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', moveDraw, { passive: false });
        canvas.addEventListener('touchend', endDraw, { passive: false });
        canvas.addEventListener('touchcancel', endDraw, { passive: false });
        
        // Set touch-action via JS as well
        canvas.style.touchAction = 'none';
        
        // Initial resize
        resize();
        
        console.log('Signature pad created for:', canvas.id);
        
        // Return public interface
        return {
            clear: clear,
            isEmpty: function() { return !hasContent; },
            toDataURL: function() { return canvas.toDataURL('image/png'); },
            resize: resize
        };
    }

    // === CONTRACT FORM HANDLER ===
    var ContractFormHandler = function() {
        this.form = $('#contractForm');
        if (!this.form) {
            console.log('Contract form not found');
            return;
        }
        ContractFormHandler.prototype.fetchHelpRequests = function(callback) {
    firebase.firestore().collection('help_requests')
        .where('status', '==', 'open')
        .orderBy('timestamp', 'desc')
        .get()
        .then(function(snapshot) {
            var helpRequests = [];
            snapshot.forEach(function(doc) {
                var data = doc.data();
                data.id = doc.id;
                helpRequests.push(data);
            });
            if (callback) callback(helpRequests);
        })
        .catch(function(error) {
            console.error('Error fetching help requests:', error);
            if (callback) callback([]);
        });
};

ContractFormHandler.prototype.getIssueTypeLabel = function(issueType) {
    var labels = {
        'contract_not_showing': 'Contract Not Showing',
        'problems_submitting': 'Problems Submitting',
        'signature_issues': 'Signature Issues',
        'account_access': 'Account Access',
        'other': 'Other Issues'
    };
    return labels[issueType] || issueType;
};

ContractFormHandler.prototype.resolveHelpRequest = function(requestId) {
    var self = this;
    
    if (!confirm(t('dash.help.confirmResolve'))) {
        return;
    }
    
    firebase.firestore().collection('help_requests')
        .doc(requestId)
        .update({
            status: 'resolved',
            resolved: true,
            resolvedTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(function() {
            console.log('Help request marked as resolved');
            self.showDeveloperDashboard();
        })
        .catch(function(error) {
            console.error('Error resolving help request:', error);
            alert(t('dash.help.err.resolve') + error.message);
        });
};
ContractFormHandler.prototype.resolveAllHelpRequests = function(helpRequests) {
    var self = this;
    
    if (helpRequests.length === 0) {
        return;
    }
    
    if (!confirm(t('dash.help.confirmResolvePrefix') + helpRequests.length + t('dash.help.confirmResolveSuffix'))) {
        return;
    }
    
    var batch = firebase.firestore().batch();
    var resolvedTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    
    helpRequests.forEach(function(request) {
        var docRef = firebase.firestore().collection('help_requests').doc(request.id);
        batch.update(docRef, {
            status: 'resolved',
            resolved: true,
            resolvedTimestamp: resolvedTimestamp
        });
    });
    
    batch.commit()
        .then(function() {
            console.log('All help requests marked as resolved');
            self.showDeveloperDashboard();
        })
        .catch(function(error) {
            console.error('Error resolving all help requests:', error);
            alert(t('dash.help.err.resolveAll') + error.message);
        });
};
        this.devSignaturePad = null;
        this.clientSignaturePad = null;
        this.isDeveloper = false;
        this.currentContract = null;
        this.currentUserEmail = null;
        
        // Developer email loaded from environment variable (set in .env file)
        // Add VITE_DEVELOPER_EMAIL=your-email@gmail.com to your .env file
        this.DEVELOPER_EMAIL = (window.VITE_DEVELOPER_EMAIL || '').trim().toLowerCase();
        
        this.signaturePadsInitialized = false;
        this.formSetup = false;
        
        console.log('ContractFormHandler created');
        
        this.init();
    };
var HelpRequestHandler = function() {
    this.helpModal = $('#helpModal');
    this.helpForm = $('#helpRequestForm');
    this.currentUser = null;
    
    if (!this.helpModal || !this.helpForm) {
        console.log('Help modal elements not found');
        return;
    }
    
    this.init();
};

HelpRequestHandler.prototype.init = function() {
    var self = this;
    
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function(user) {
            self.currentUser = user;
            if (user) {
                var contactField = $('#helpContact');
                if (contactField && self.helpModal.classList.contains('show')) {
                    contactField.value = user.email || formatPhoneNumber(user.phoneNumber) || '';
                }
            }
        });
    }
    
    var requestHelpBtn = $('#requestHelpBtn');
    if (requestHelpBtn) {
        requestHelpBtn.addEventListener('click', function(e) {
            e.preventDefault();
            self.showHelpModal();
        });
    }
    
    var closeHelpBtn = $('#closeHelpBtn');
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', function() {
            self.closeHelpModal();
        });
    }
    
    var cancelHelpBtn = $('#cancelHelpBtn');
    if (cancelHelpBtn) {
        cancelHelpBtn.addEventListener('click', function() {
            self.closeHelpModal();
        });
    }
    
    var overlay = $('.modal-overlay', this.helpModal);
    if (overlay) {
        overlay.addEventListener('click', function() {
            self.closeHelpModal();
        });
    }
    
    if (this.helpForm) {
        this.helpForm.addEventListener('submit', function(e) {
            e.preventDefault();
            self.submitHelpRequest();
        });
    }
};

HelpRequestHandler.prototype.showHelpModal = function() {
    if (this.helpModal) {
        this.helpModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');

        var successMessage = $('#helpSuccessMessage');
        if (successMessage) successMessage.classList.remove('show');

        var formFields = $('.help-form');
        if (formFields) formFields.style.display = 'block';

        if (this.helpForm) this.helpForm.reset();

        var contactField = $('#helpContact');
        var contactLabel = $('#helpContactLabel');
        var contactHint = $('#helpContactHint');
        var contactTabs = $('#contactTabs');

        if (contactField && this.currentUser) {
            // User is signed in - hide tabs, show their contact info
            if (contactTabs) contactTabs.style.display = 'none';

            var hasEmail = this.currentUser.email;
            var hasPhone = this.currentUser.phoneNumber;

            if (hasEmail) {
                contactField.value = this.currentUser.email;
                contactField.type = 'email';
                contactField.placeholder = 'your@email.com';
                if (contactLabel) contactLabel.textContent = t('help.label.email');
                if (contactHint) contactHint.textContent = t('help.label.contactHint');
            } else if (hasPhone) {
                contactField.value = formatPhoneNumber(this.currentUser.phoneNumber);
                contactField.type = 'tel';
                contactField.placeholder = '(555) 123-4567';
                if (contactLabel) contactLabel.textContent = t('help.label.phone');
                if (contactHint) contactHint.textContent = t('help.label.contactHint');
            }

            contactField.setAttribute('readonly', 'readonly');
            contactField.style.opacity = '0.7';
        } else if (contactField) {
            // User is NOT signed in - show tabs for email/phone selection
            if (contactTabs) {
                contactTabs.style.display = 'flex';
                this.setupContactTabs(contactField, contactLabel, contactHint, contactTabs);
            }

            contactField.removeAttribute('readonly');
            contactField.style.opacity = '1';
            contactField.type = 'email';
            contactField.value = '';
            contactField.placeholder = 'your@email.com';
            if (contactLabel) contactLabel.textContent = t('help.label.email');

            // Reset tabs to email
            var tabs = $$('.contact-tab', contactTabs);
            tabs.forEach(function(tab) {
                tab.classList.toggle('active', tab.dataset.type === 'email');
            });
        }
    }
};

HelpRequestHandler.prototype.setupContactTabs = function(contactField, contactLabel, contactHint, contactTabs) {
    var self = this;
    var tabs = $$('.contact-tab', contactTabs);

    // Remove existing listeners by cloning
    tabs.forEach(function(tab) {
        var newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
    });

    // Re-query after cloning
    tabs = $$('.contact-tab', contactTabs);

    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            var type = this.dataset.type;

            // Update active state
            tabs.forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');

            // Clear the field
            contactField.value = '';

            if (type === 'email') {
                contactField.type = 'email';
                contactField.placeholder = 'your@email.com';
                if (contactLabel) contactLabel.textContent = t('help.label.email');
                if (contactHint) contactHint.textContent = t('help.label.contactHint');
                // Remove phone formatting listener
                self.removePhoneFormatting(contactField);
            } else {
                contactField.type = 'tel';
                contactField.placeholder = '(555) 123-4567';
                if (contactLabel) contactLabel.textContent = t('help.label.phone');
                if (contactHint) contactHint.textContent = t('help.label.contactHint');
                // Add phone formatting
                setupPhoneInputFormatting(contactField);
            }

            contactField.focus();
        });
    });
};

HelpRequestHandler.prototype.removePhoneFormatting = function(input) {
    // Clone and replace to remove all event listeners
    var newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
};

HelpRequestHandler.prototype.closeHelpModal = function() {
    if (this.helpModal) {
        this.helpModal.classList.remove('show');
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
    }
};

HelpRequestHandler.prototype.submitHelpRequest = function() {
    var self = this;
    
    var submitBtn = this.helpForm.querySelector('button[type="submit"]');
    var submitText = $('#helpSubmitText');
    var originalText = submitText ? submitText.textContent : t('help.submitBtn');

    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = t('help.btn.sending');
    
    var helpContact = $('#helpContact').value.trim();
    var helpIssue = $('#helpIssue').value;
    var helpDetails = $('#helpDetails').value.trim();

    if (!helpContact || !helpIssue || !helpDetails) {
        alert(t('help.val.fillRequired'));
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = originalText;
        return;
    }

    // Determine if contact is email or phone
    var isPhone = this.currentUser && this.currentUser.phoneNumber && !this.currentUser.email;
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var phoneRegex = /^\+?[1-9]\d{6,14}$/;

    if (!isPhone && !emailRegex.test(helpContact)) {
        alert(t('help.val.validEmail'));
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = originalText;
        return;
    }

    if (isPhone && !phoneRegex.test(helpContact.replace(/[\s\-\(\)]/g, ''))) {
        alert(t('help.val.validPhone'));
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = originalText;
        return;
    }

    var helpRequestData = {
        userContact: isPhone ? normalizeToE164(helpContact) : helpContact,
        contactType: isPhone ? 'phone' : 'email',
        userEmail: isPhone ? '' : helpContact,
        userPhone: isPhone ? normalizeToE164(helpContact) : '',
        issueType: helpIssue,
        issueDetails: helpDetails,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'open',
        resolved: false,
        isAuthenticated: !!this.currentUser
    };
    
    if (this.currentUser) {
        helpRequestData.userId = this.currentUser.uid;
    }
    
    console.log('Submitting help request:', helpRequestData);
    
    firebase.firestore().collection('help_requests').add(helpRequestData)
        .then(function(docRef) {
            console.log('Help request submitted with ID:', docRef.id);
            self.showSuccessMessage();
            
            setTimeout(function() {
                self.closeHelpModal();
            }, 3000);
        })
        .catch(function(error) {
            console.error('Error submitting help request:', error);
            alert(t('help.err.submitPrefix') + error.message + t('help.err.submitSuffix'));
            
            if (submitBtn) submitBtn.disabled = false;
            if (submitText) submitText.textContent = originalText;
        });
};

HelpRequestHandler.prototype.showSuccessMessage = function() {
    // Hide individual form groups instead of entire form
    var formGroups = $$('.form-group');
    formGroups.forEach(function(group) {
        group.style.display = 'none';
    });
    
    var footer = $('.help-form-footer');
    if (footer) footer.style.display = 'none';
    
    var successMessage = $('#helpSuccessMessage');
    if (successMessage) {
        successMessage.classList.add('show');
        successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};
    ContractFormHandler.prototype.init = function() {
        var self = this;
        
        console.log('Initializing contract form handler');
        
        // Listen for modal open event to initialize signature pads and check role
        window.addEventListener('contractModalOpened', function() {
            console.log('Contract modal opened');
            
            // Re-check user role when modal opens (in case auth state changed)
            var user = firebase.auth().currentUser;
            if (user) {
                // Handle both email and phone auth users
                self.currentUserEmail = user.email ? user.email.trim().toLowerCase() : '';
                self.isDeveloper = self.currentUserEmail && self.currentUserEmail === self.DEVELOPER_EMAIL;
                
               
                // Setup the correct view based on role
                if (self.isDeveloper) {
                    self.setupDeveloperView();
                } else {
                    self.setupClientView();
                }
            }
            
            // Initialize signature pads after view is set up
            setTimeout(function() {
                self.initializeSignaturePads();
            }, 100);

            // Initialize entity type toggle for contract form
            self.initEntityTypeToggle();
        });
        
        // Initial auth state check
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    // Handle both email and phone auth users
                    self.currentUserEmail = user.email ? user.email.trim().toLowerCase() : '';
                    self.isDeveloper = self.currentUserEmail && self.currentUserEmail === self.DEVELOPER_EMAIL;

                    console.log('isDeveloper:', self.isDeveloper);
                    
                    self.setupForm();
                } else {
                    self.currentUserEmail = null;
                    self.isDeveloper = false;
                }
            });
        }
    };
    
    ContractFormHandler.prototype.initializeSignaturePads = function() {
        var self = this;
        
        console.log('Initializing signature pads, isDeveloper:', this.isDeveloper);
        
        var devCanvas = document.getElementById('devSignaturePad');
        var clientCanvas = document.getElementById('clientSignaturePad');
        
        // Initialize the appropriate signature pad based on role
        if (this.isDeveloper) {
            // Developer view - initialize dev signature pad
            if (devCanvas) {
                this.devSignaturePad = createSignaturePad(devCanvas);
                console.log('Dev signature pad created');
            }
        } else {
            // Client view - initialize client signature pad
            if (clientCanvas) {
                this.clientSignaturePad = createSignaturePad(clientCanvas);
                console.log('Client signature pad created');
            }
        }
        
        // Setup clear buttons (only once)
        if (!this.signaturePadsInitialized) {
            $$('.clear-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var canvasId = this.getAttribute('data-canvas');
                    console.log('Clear clicked:', canvasId);
                    
                    if (canvasId === 'devSignaturePad' && self.devSignaturePad) {
                        self.devSignaturePad.clear();
                    } else if (canvasId === 'clientSignaturePad' && self.clientSignaturePad) {
                        self.clientSignaturePad.clear();
                    }
                });
            });
            this.signaturePadsInitialized = true;
        }
        
        console.log('Signature pads initialized');
    };

    // Populate client info from SOW data (read-only display)
    ContractFormHandler.prototype.initEntityTypeToggle = function() {
        // This method now handles populating client info from SOW
        // The old toggle functionality has been removed since SOW is required first
        console.log('Contract form initialized - client info will be populated from SOW');
    };

    // Populate client info display from SOW data
    ContractFormHandler.prototype.populateClientInfoFromSOW = function(sowData) {
        if (!sowData) {
            console.log('No SOW data provided');
            return;
        }

        console.log('Populating client info from SOW:', sowData.clientName);

        // Show the populated section, hide the notice
        var sowRequiredNotice = $('#sowRequiredNotice');
        var clientInfoPopulated = $('#clientInfoPopulated');
        var businessEntityInfo = $('#businessEntityInfo');

        if (sowRequiredNotice) sowRequiredNotice.style.display = 'none';
        if (clientInfoPopulated) clientInfoPopulated.style.display = 'block';

        // Populate the read-only display fields
        var contractClientName = $('#contractClientName');
        var contractEntityType = $('#contractEntityType');
        var contractStateOfFormation = $('#contractStateOfFormation');
        var contractRepName = $('#contractRepName');
        var contractRepTitle = $('#contractRepTitle');
        var contractClientContact = $('#contractClientContact');

        // Set client name
        if (contractClientName) {
            contractClientName.textContent = sowData.isBusinessEntity ? sowData.businessName : sowData.clientName;
        }

        // Show business entity info if applicable
        if (sowData.isBusinessEntity && businessEntityInfo) {
            businessEntityInfo.style.display = 'block';
            if (contractEntityType) contractEntityType.textContent = sowData.entityType || '—';
            if (contractStateOfFormation) contractStateOfFormation.textContent = sowData.stateOfFormation || '—';
            if (contractRepName) contractRepName.textContent = sowData.representativeName || '—';
            if (contractRepTitle) contractRepTitle.textContent = sowData.representativeTitle || '—';
        } else if (businessEntityInfo) {
            businessEntityInfo.style.display = 'none';
        }

        // Set contact info
        if (contractClientContact) {
            contractClientContact.textContent = sowData.clientEmail || sowData.clientPhone || '—';
        }

        // Populate hidden fields for form submission
        var hiddenClientName = $('#clientName');
        var hiddenIsBusinessEntity = $('#isBusinessEntity');
        var hiddenBusinessName = $('#businessName');
        var hiddenEntityType = $('#entityType');
        var hiddenStateOfFormation = $('#stateOfFormation');
        var hiddenRepName = $('#repName');
        var hiddenRepTitle = $('#repTitle');

        if (hiddenClientName) hiddenClientName.value = sowData.isBusinessEntity ? sowData.businessName : sowData.clientName;
        if (hiddenIsBusinessEntity) hiddenIsBusinessEntity.value = sowData.isBusinessEntity ? 'true' : 'false';
        if (hiddenBusinessName) hiddenBusinessName.value = sowData.businessName || '';
        if (hiddenEntityType) hiddenEntityType.value = sowData.entityType || '';
        if (hiddenStateOfFormation) hiddenStateOfFormation.value = sowData.stateOfFormation || '';
        if (hiddenRepName) hiddenRepName.value = sowData.representativeName || '';
        if (hiddenRepTitle) hiddenRepTitle.value = sowData.representativeTitle || '';
    };


    ContractFormHandler.prototype.setupForm = function() {
        var self = this;
        
        // Prevent multiple setups
        if (this.formSetup) {
            console.log('Form already setup, updating view only');
            if (this.isDeveloper) {
                this.setupDeveloperView();
            } else {
                this.setupClientView();
            }
            return;
        }
        
        // Show appropriate sections based on role
        if (this.isDeveloper) {
            this.setupDeveloperView();
        } else {
            this.setupClientView();
        }
        
        // Set today's date
        var today = new Date().toISOString().split('T')[0];
        var devDate = $('#devDate');
        var clientDate = $('#clientDate');
        if (devDate) devDate.value = today;
        if (clientDate) clientDate.value = today;
        
        // Update client name display
        var clientNameInput = $('#clientName');
        var clientNameDisplay = $('#clientNameDisplay');
        if (clientNameInput && clientNameDisplay) {
            clientNameInput.addEventListener('input', function() {
                clientNameDisplay.textContent = this.value || 'Client Name';
            });
        }
        
        // IMPORTANT: Prevent default form submission and handle via button click
        this.form.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Form submit prevented');
            return false;
        });
        
        // Handle submit button click directly
        var submitBtn = $('#submitBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Submit button clicked, isDeveloper:', self.isDeveloper);
                
                if (self.isDeveloper) {
                    self.handleDeveloperSubmit();
                } else {
                    self.handleClientSubmit();
                }
            });
        }
        
        var downloadBtn = $('#downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                self.generatePDF();
            });
        }
        
        this.formSetup = true;
    };

    ContractFormHandler.prototype.setupDeveloperView = function() {
        console.log('Setting up developer view');
        
        // HIDE the entire contract form for developers initially
        var contractForm = $('#contractForm');
        if (contractForm) {
            contractForm.style.display = 'none';
        }
        
        // Show the developer dashboard instead
        this.showDeveloperDashboard();
        
        // Hide all signature blocks initially until a contract is selected
        var devBlock = $('#devSignatureBlock');
        if (devBlock) devBlock.style.display = 'none';
        
        var clientBlock = $('#clientSignatureBlock');
        if (clientBlock) clientBlock.style.display = 'none';
        
        var devPending = $('#devPendingBlock');
        if (devPending) devPending.style.display = 'none';
        
        // Disable all client form fields
        var clientNameField = $('#clientName');
        if (clientNameField) {
            clientNameField.disabled = true;
            clientNameField.removeAttribute('required');
            clientNameField.setAttribute('readonly', 'readonly');
        }
        
        var clientSignerName = $('#clientSignerName');
        if (clientSignerName) {
            clientSignerName.disabled = true;
            clientSignerName.removeAttribute('required');
        }
        
        var clientDate = $('#clientDate');
        if (clientDate) {
            clientDate.disabled = true;
            clientDate.removeAttribute('required');
        }
        
        var acknowledgment = $('#acknowledgment');
        if (acknowledgment) {
            acknowledgment.disabled = true;
            acknowledgment.removeAttribute('required');
            acknowledgment.checked = true;
        }
        
        var ackSection = $('.acknowledgment');
        if (ackSection) ackSection.style.display = 'none';
        
        // Hide submit button until contract is selected
        var submitBtn = $('#submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
        
        var downloadBtn = $('#downloadBtn');
        if (downloadBtn) downloadBtn.style.display = 'none';
    };
    
    ContractFormHandler.prototype.showDeveloperDashboard = function() {
    var self = this;
    
    console.log('Loading developer dashboard...');
    
    // HIDE the contract form when showing dashboard
    var contractForm = $('#contractForm');
    if (contractForm) {
        contractForm.style.display = 'none';
    }
    
    // HIDE the modal header for developer
    var modalHeader = $('.modal-header');
    if (modalHeader) {
        modalHeader.style.display = 'none';
    }
    
    // ✅ HIDE the original modal-close button
    var modalClose = $('.modal-close');
    if (modalClose) {
        modalClose.style.display = 'none';
    }
    
    // Create dashboard container if it doesn't exist
    var dashboard = $('#developerDashboard');
    if (!dashboard) {
        dashboard = document.createElement('div');
        dashboard.id = 'developerDashboard';
        dashboard.className = 'developer-dashboard';
        
        // Insert at the top of the modal content
        var modalContent = $('.modal-content');
        if (modalContent) {
            modalContent.insertBefore(dashboard, modalContent.firstChild);
        }
    }
    
    // Show loading state
    dashboard.innerHTML = '<div class="dashboard-loading"><p>Loading contracts...</p></div>';
    dashboard.style.display = 'block';
    
    // Fetch all contracts
    this.fetchAllContracts();
};
    ContractFormHandler.prototype.renderHelpRequestsSection = function(helpRequests) {
    var self = this;
    var helpContent = $('#helpTabContent');
    var helpBadge = $('#helpCountBadge');
    
    if (!helpContent) return;
    
    // Update badge count
    if (helpBadge) helpBadge.textContent = helpRequests.length;
    
    var html = '<div class="help-tab-header">' +
    '<h3>🆘 ' + t('helpDash.title') + '</h3>' +
    '<div style="display: flex; align-items: center; gap: 10px;">';
    
    if (helpRequests.length > 0) {
        html += '<button class="btn-resolve-all" style="padding: 6px 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600;">✓ ' + t('helpDash.btn.resolveAll') + '</button>';
    }
    
    html += '</div></div>';

    // Category breakdown chips
    if (helpRequests.length > 0) {
        var typeCounts = {};
        helpRequests.forEach(function(r) {
            var t = r.issueType || 'other';
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        var issueTypeColors = {
            'contract_not_showing': '#6366f1',
            'problems_submitting': '#f59e0b',
            'signature_issues': '#ef4444',
            'account_access': '#10b981',
            'other': '#8b5cf6'
        };
        html += '<div class="help-chips">';
        Object.keys(typeCounts).forEach(function(type) {
            var color = issueTypeColors[type] || '#6b7280';
            html += '<span class="help-chip" style="border-color: ' + color + '40; color: ' + color + ';">' +
                self.getIssueTypeLabel(type) +
                '<span class="chip-count">' + typeCounts[type] + '</span>' +
                '</span>';
        });
        html += '</div>';
    }

    if (helpRequests.length === 0) {
        html += '<div class="empty-state">' +
            '<img src="/images/scarlo-logo.png" alt="Scarlo" class="empty-icon">' +
            '<p>' + t('helpDash.empty') + '</p>' +
            '</div>';
    } else {
        var issueTypeColors = {
            'contract_not_showing': '#6366f1',
            'problems_submitting': '#f59e0b',
            'signature_issues': '#ef4444',
            'account_access': '#10b981',
            'other': '#8b5cf6'
        };
        html += '<div class="help-list">';
        helpRequests.forEach(function(request) {
            var requestDate = request.timestamp ?
                (request.timestamp.toDate ? request.timestamp.toDate().toLocaleDateString() : new Date(request.timestamp).toLocaleDateString())
                : 'N/A';

            var authBadge = request.isAuthenticated
                ? '<span class="auth-badge verified">✓ ' + t('helpDash.badge.verified') + '</span>'
                : '<span class="auth-badge anonymous">◎ ' + t('helpDash.badge.anonymous') + '</span>';

            var itemColor = issueTypeColors[request.issueType] || '#f59e0b';
            html += '<div class="help-item" data-request-id="' + request.id + '" style="border-left-color: ' + itemColor + ';">' +
                '<div class="help-icon">❓</div>' +
                '<div class="help-details">' +
                '<div class="help-header">' +
                '<h4>' + (request.userEmail || request.userPhone || t('helpDash.fallback.user')) + '</h4>' +
                authBadge +
                '<span class="help-badge">' + self.getIssueTypeLabel(request.issueType) + '</span>' +
                '</div>' +
                '<p class="help-message">' + (request.issueDetails || t('helpDash.fallback.message')) + '</p>' +
                '<div class="help-meta">' +
                '<span class="meta-item">📅 ' + requestDate + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="help-actions">' +
                '<button class="btn-resolve-help" data-request-id="' + request.id + '" title="Mark as resolved">' +
                '✓ ' + t('helpDash.btn.resolve') +
                '</button>' +
                '</div>' +
                '</div>';
        });
        html += '</div>';
    }
    html += '</div>';
    
    helpContent.innerHTML = html;
    
$$('.btn-resolve-help').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var requestId = this.getAttribute('data-request-id');
            self.resolveHelpRequest(requestId);
        });
    });
    
    // Add Resolve All button listener
    var resolveAllBtn = $('.btn-resolve-all');
    if (resolveAllBtn) {
        resolveAllBtn.addEventListener('click', function(e) {
            e.preventDefault();
            self.resolveAllHelpRequests(helpRequests);
        });
    }
};
    ContractFormHandler.prototype.fetchAllContracts = function() {
        var self = this;

        // Fetch ALL data in parallel for faster loading
        var pendingPromise = firebase.firestore().collection('contracts')
            .where('status', '==', 'pending_developer')
            .get();

        var completedPromise = firebase.firestore().collection('contracts')
            .where('status', '==', 'completed')
            .get();

        var helpPromise = new Promise(function(resolve) {
            self.fetchHelpRequests(function(helpRequests) {
                resolve(helpRequests);
            });
        });

        var sowPromise = firebase.firestore().collection('sow_documents')
            .orderBy('createdAt', 'desc')
            .get();

        var couponsPromise = firebase.firestore().collection('coupons')
            .orderBy('createdAt', 'desc')
            .get();

        Promise.all([pendingPromise, completedPromise, helpPromise, sowPromise, couponsPromise])
            .then(function(results) {
                var pendingSnapshot = results[0];
                var completedSnapshot = results[1];
                var helpRequests = results[2];
                var sowSnapshot = results[3];
                var couponsSnapshot = results[4];

                // Process pending contracts
                var pendingContracts = [];
                pendingSnapshot.forEach(function(doc) {
                    var data = doc.data();
                    data.id = doc.id;
                    data.daysSinceSubmission = self.calculateDaysSince(data.timestamp);
                    pendingContracts.push(data);
                });
                pendingContracts.sort(function(a, b) {
                    return b.daysSinceSubmission - a.daysSinceSubmission;
                });

                // Process completed contracts
                var completedContracts = [];
                completedSnapshot.forEach(function(doc) {
                    var data = doc.data();
                    data.id = doc.id;
                    data.daysSinceSubmission = self.calculateDaysSince(data.timestamp);
                    completedContracts.push(data);
                });
                completedContracts.sort(function(a, b) {
                    var aTime = a.finalizedTimestamp ? a.finalizedTimestamp.toDate().getTime() : 0;
                    var bTime = b.finalizedTimestamp ? b.finalizedTimestamp.toDate().getTime() : 0;
                    return bTime - aTime;
                });

                // Process SOW documents
                var sows = [];
                var changeRequestIds = [];
                sowSnapshot.forEach(function(doc) {
                    var data = doc.data();
                    data.id = doc.id;
                    sows.push(data);
                    if (data.changeRequestId) {
                        changeRequestIds.push(data.changeRequestId);
                    }
                });

                // Process coupons
                var coupons = [];
                couponsSnapshot.forEach(function(doc) {
                    var data = doc.data();
                    data.id = doc.id;
                    coupons.push(data);
                });
                self.coupons = coupons;

                // Render the dashboard (this will show loading states for tabs)
                self.renderDeveloperDashboard(pendingContracts, completedContracts, sows, coupons, helpRequests);

                // Immediately render help requests (already loaded)
                self.renderHelpRequestsSection(helpRequests);

                // Immediately render coupons (already loaded)
                var couponsContainer = document.getElementById('couponsTabContent');
                if (couponsContainer) {
                    var badge = document.getElementById('couponCountBadge');
                    if (badge) badge.textContent = coupons.length;
                    couponsContainer.innerHTML = self.renderCouponsTab(coupons);
                    self.attachCouponEventListeners();
                }

                // Handle SOW documents - fetch lastLogin data first
                self.fetchClientLastLogins(sows).then(function() {
                    if (changeRequestIds.length > 0) {
                        self.fetchChangeRequestsUnreadStatus(changeRequestIds, sows);
                    } else {
                        self.renderSOWTab(sows);
                    }
                });
            })
            .catch(function(error) {
                console.error('Error fetching contracts:', error);
                var dashboard = $('#developerDashboard');
                if (dashboard) {
                    dashboard.innerHTML = '<div class="dashboard-error"><p>Error loading contracts: ' + error.message + '</p></div>';
                }
            });
    };
    
    ContractFormHandler.prototype.calculateDaysSince = function(timestamp) {
        if (!timestamp) return 0;
        
        var submissionDate;
        if (timestamp.toDate) {
            submissionDate = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            submissionDate = timestamp;
        } else {
            submissionDate = new Date(timestamp);
        }
        
        var now = new Date();
        var diffTime = Math.abs(now - submissionDate);
        var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };
    
    ContractFormHandler.prototype.getUrgencyLevel = function(days) {
        if (days >= 7) return { level: 'critical', label: 'URGENT', color: '#ef4444', icon: '🔴' };
        if (days >= 3) return { level: 'high', label: 'ACTION NEEDED', color: '#f59e0b', icon: '🟠' };
        if (days >= 1) return { level: 'medium', label: 'NEW', color: '#3b82f6', icon: '🔵' };
        return { level: 'low', label: 'JUST IN', color: '#10b981', icon: '🟢' };
    };
    
    ContractFormHandler.prototype.formatCurrency = function(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    };

    ContractFormHandler.prototype.timeAgo = function(date) {
        var seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'just now';
        var minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + 'm ago';
        var hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + 'h ago';
        var days = Math.floor(hours / 24);
        if (days < 7) return days + 'd ago';
        var weeks = Math.floor(days / 7);
        if (weeks < 4) return weeks + 'w ago';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    ContractFormHandler.prototype.computeDashboardMetrics = function(pendingContracts, completedContracts, sows, coupons, helpRequests) {
        var self = this;
        var now = new Date();
        var thisMonth = now.getMonth();
        var thisYear = now.getFullYear();

        // Revenue metrics
        var totalRevenue = 0;
        var paidRevenue = 0;
        var sowsByPackage = {};
        var activeProjects = 0;

        sows.forEach(function(sow) {
            if (sow.payment && sow.payment.total) {
                totalRevenue += sow.payment.total;
            }
            var paymentInfo = self.calculatePaymentStatus(sow);
            paidRevenue += paymentInfo.paidAmount;
            var pkg = sow.packageType || 'unknown';
            sowsByPackage[pkg] = (sowsByPackage[pkg] || 0) + 1;
            if (sow.status !== 'approved') {
                activeProjects++;
            }
        });

        // Contract metrics
        var totalContracts = pendingContracts.length + completedContracts.length;
        var completionRate = totalContracts > 0 ? Math.round((completedContracts.length / totalContracts) * 100) : 0;

        var avgResponseDays = 0;
        if (completedContracts.length > 0) {
            var totalDays = 0;
            completedContracts.forEach(function(c) { totalDays += c.daysSinceSubmission || 0; });
            avgResponseDays = Math.round(totalDays / completedContracts.length);
        }

        var urgentCount = pendingContracts.filter(function(c) { return c.daysSinceSubmission >= 7; }).length;

        var thisMonthCompleted = completedContracts.filter(function(c) {
            if (!c.finalizedTimestamp) return false;
            var date = c.finalizedTimestamp.toDate ? c.finalizedTimestamp.toDate() : new Date(c.finalizedTimestamp);
            return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
        }).length;

        // Coupon metrics
        var activeCoupons = coupons.filter(function(c) { return c.active !== false; }).length;
        var totalCouponUsage = 0;
        coupons.forEach(function(c) { totalCouponUsage += (c.usageCount || 0); });

        // Help metrics
        var helpByType = {};
        helpRequests.forEach(function(r) {
            var t = r.issueType || 'other';
            helpByType[t] = (helpByType[t] || 0) + 1;
        });

        // Activity feed (last 5 events across all sources)
        var events = [];
        completedContracts.forEach(function(c) {
            if (c.finalizedTimestamp) {
                var d = c.finalizedTimestamp.toDate ? c.finalizedTimestamp.toDate() : new Date(c.finalizedTimestamp);
                events.push({ type: 'contract_signed', label: 'Contract signed — ' + (c.clientName || 'Unknown'), date: d, color: '#10b981' });
            }
        });
        pendingContracts.forEach(function(c) {
            if (c.timestamp) {
                var d = c.timestamp.toDate ? c.timestamp.toDate() : new Date(c.timestamp);
                events.push({ type: 'contract_received', label: 'Contract received — ' + (c.clientName || 'Unknown'), date: d, color: '#6366f1' });
            }
        });
        sows.forEach(function(s) {
            if (s.createdAt) {
                var d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                events.push({ type: 'sow_created', label: 'SOW created — ' + (s.clientName || 'Unknown'), date: d, color: '#f59e0b' });
            }
        });
        helpRequests.forEach(function(r) {
            if (r.timestamp) {
                var d = r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
                events.push({ type: 'help_request', label: 'Help request — ' + (r.userEmail || r.userPhone || 'Anonymous'), date: d, color: '#ef4444' });
            }
        });
        events.sort(function(a, b) { return b.date - a.date; });
        events = events.slice(0, 5);

        return {
            totalRevenue: totalRevenue,
            paidRevenue: paidRevenue,
            completionRate: completionRate,
            avgResponseDays: avgResponseDays,
            activeProjects: activeProjects,
            totalContracts: totalContracts,
            urgentCount: urgentCount,
            thisMonthCompleted: thisMonthCompleted,
            activeCoupons: activeCoupons,
            totalCouponUsage: totalCouponUsage,
            helpByType: helpByType,
            sowsByPackage: sowsByPackage,
            events: events,
            pending: pendingContracts.length,
            completed: completedContracts.length,
            sowCount: sows.length,
            helpCount: helpRequests.length,
            couponCount: coupons.length
        };
    };

    ContractFormHandler.prototype.renderDeveloperDashboard = function(pendingContracts, completedContracts, sows, coupons, helpRequests) {
    var self = this;
    var dashboard = $('#developerDashboard');

    if (!dashboard) return;

    sows = sows || [];
    coupons = coupons || [];
    helpRequests = helpRequests || [];
    
    // Compute all dashboard metrics
    var metrics = self.computeDashboardMetrics(pendingContracts, completedContracts, sows, coupons, helpRequests);
    var urgentCount = metrics.urgentCount;

    var html = '';
    
    // ✅ ADD CLOSE BUTTON AT THE TOP
    html += '<button class="dashboard-close" onclick="document.querySelector(\'.contract-modal\').classList.remove(\'show\'); document.body.classList.remove(\'modal-open\'); document.body.style.overflow = \'\';">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<line x1="18" y1="6" x2="6" y2="18"></line>' +
        '<line x1="6" y1="6" x2="18" y2="18"></line>' +
        '</svg>' +
        '</button>';
    
    // Header with animated logo
    var logoFramesHtml = '';
    for (var i = 0; i < 20; i++) {
        var pad = i < 10 ? '0' + i : '' + i;
        logoFramesHtml += '<img id="dashLogo' + i + '"' + (i === 0 ? ' class="visible"' : '') + ' src="/images/morph-logo' + pad + '.png"' + (i === 0 ? ' alt="Scarlo Logo"' : ' alt=""') + '>';
    }
    html += '<div class="dashboard-header">' +
        '<div class="header-content">' +
        '<div class="dash-logo-animated">' +
        '<div class="dash-logo-ambient"></div>' +
        '<div class="dash-logo-stack">' + logoFramesHtml + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="header-date">' +
        '<span class="current-date">' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</span>' +
        '</div>' +
        '</div>';
    
    // Alert Banner (if urgent contracts exist)
    if (urgentCount > 0) {
        html += '<div class="alert-banner urgent">' +
            '<div class="alert-icon">⚠️</div>' +
            '<div class="alert-content">' +
            '<strong>' + urgentCount + (urgentCount !== 1 ? t('dash.alert.contractPlural') : t('dash.alert.contractSingular')) + (urgentCount === 1 ? t('dash.alert.needSingular') : t('dash.alert.needPlural')) + ' immediate attention!</strong>' +
            '<p>' + (urgentCount !== 1 ? t('dash.alert.clientPlural') : t('dash.alert.clientSingular')) + (urgentCount !== 1 ? t('dash.alert.havePlural') : t('dash.alert.hasSingular')) + t('dash.alert.waiting7days') + '</p>' +
            '</div>' +
            '</div>';
    } else if (pendingContracts.length === 0 && completedContracts.length > 0) {
        html += '<div class="alert-banner success">' +
            '<div class="alert-icon">🎉</div>' +
            '<div class="alert-content">' +
            '<strong>' + t('dash.alert.allCaughtUp') + '</strong>' +
            '<p>' + t('dash.alert.noPending') + '</p>' +
            '</div>' +
            '</div>';
    }
    
    // ============= ANALYTICS OVERVIEW (2x2 Grid) =============
    html += '<div class="analytics-grid">';

    // Card 1: Total Revenue
    html += '<div class="analytics-card revenue-card">' +
        '<div class="analytics-card-row">' +
        '<span class="analytics-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>' +
        '<div class="analytics-value">' + self.formatCurrency(metrics.totalRevenue) + '</div>' +
        '<span class="analytics-trend">' + self.formatCurrency(metrics.paidRevenue) + ' ' + t('sowTab.stats.collected').toLowerCase() + '</span>' +
        '</div>' +
        '<div class="analytics-bottom">' +
        '<span class="analytics-label">' + t('dash.analytics.totalRevenue') + '</span>' +
        '<div class="analytics-bar-track">' +
        '<div class="analytics-bar-fill revenue-fill" style="width: ' +
            (metrics.totalRevenue > 0 ? Math.round(metrics.paidRevenue / metrics.totalRevenue * 100) : 0) +
        '%;"></div></div></div></div>';

    // Card 2: Completion Rate (SVG progress ring)
    var circumference = (2 * Math.PI * 20).toFixed(1);
    var offset = ((1 - metrics.completionRate / 100) * 2 * Math.PI * 20).toFixed(1);
    html += '<div class="analytics-card completion-card">' +
        '<div class="analytics-card-row">' +
        '<svg class="progress-ring" width="40" height="40" viewBox="0 0 44 44">' +
        '<circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>' +
        '<circle class="progress-ring-fill" cx="22" cy="22" r="20" fill="none" stroke="#10b981" stroke-width="3" ' +
        'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" ' +
        'stroke-linecap="round" transform="rotate(-90 22 22)"/>' +
        '</svg>' +
        '<div class="analytics-value">' + metrics.completionRate + '<span class="analytics-unit">%</span></div>' +
        '<span class="analytics-trend">' + metrics.completed + ' ' + t('dash.analytics.of') + metrics.totalContracts + '</span>' +
        '</div>' +
        '<div class="analytics-bottom"><span class="analytics-label">' + t('dash.analytics.completionRate') + '</span></div>' +
        '</div>';

    // Card 3: Avg Response Time
    html += '<div class="analytics-card response-card">' +
        '<div class="analytics-card-row">' +
        '<span class="analytics-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>' +
        '<div class="analytics-value">' + metrics.avgResponseDays + '<span class="analytics-unit">' + t('dash.analytics.days') + '</span></div>' +
        '<span class="analytics-trend' + (metrics.urgentCount > 0 ? ' trend-warning' : '') + '">' +
            (metrics.urgentCount > 0 ? metrics.urgentCount + ' ' + t('dash.analytics.urgent') : t('dash.analytics.onTrack')) +
        '</span>' +
        '</div>' +
        '<div class="analytics-bottom">' +
        '<span class="analytics-label">' + t('dash.analytics.avgResponse') + '</span>' +
        '<div class="analytics-bar-track">' +
        '<div class="analytics-bar-fill response-fill" style="width: ' +
            Math.min(100, Math.round(metrics.avgResponseDays / 14 * 100)) +
        '%;"></div></div></div></div>';

    // Card 4: Active Projects
    html += '<div class="analytics-card projects-card">' +
        '<div class="analytics-card-row">' +
        '<span class="analytics-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>' +
        '<div class="analytics-value">' + metrics.activeProjects + '</div>' +
        '<span class="analytics-trend">+' + metrics.thisMonthCompleted + ' ' + t('dash.analytics.thisMonth') + '</span>' +
        '</div>' +
        '<div class="analytics-bottom">' +
        '<span class="analytics-label">' + t('dash.analytics.activeProjects') + '</span>' +
        '<div class="analytics-bar-track">' +
        '<div class="analytics-bar-fill projects-fill" style="width: ' +
            (metrics.sowCount > 0 ? Math.round(metrics.activeProjects / metrics.sowCount * 100) : 0) +
        '%;"></div></div></div></div>';

    html += '</div>'; // close .analytics-grid

    // ============= RECENT ACTIVITY FEED =============
    if (metrics.events.length > 0) {
        html += '<div class="activity-feed">' +
            '<div class="activity-feed-header">' +
            '<h3>' + t('dash.analytics.recentActivity') + '</h3>' +
            '</div>' +
            '<div class="activity-feed-list">';

        metrics.events.forEach(function(evt, idx) {
            html += '<div class="activity-item" style="animation-delay: ' + (idx * 0.06) + 's;">' +
                '<div class="activity-dot" style="background: ' + evt.color + '; box-shadow: 0 0 8px ' + evt.color + '40;"></div>' +
                '<div class="activity-info">' +
                '<span class="activity-text">' + evt.label + '</span>' +
                '<span class="activity-time">' + self.timeAgo(evt.date) + '</span>' +
                '</div>' +
                '</div>';
        });

        html += '</div></div>';
    }

    // ============= TABBED INTERFACE =============
html += '<div class="dashboard-tabs">' +
    '<div class="tab-buttons">' +
    '<button class="tab-btn active" data-tab="contracts">' +
    '<span class="tab-icon">📄</span>' +
    '<span class="tab-label">' + t('dash.tab.contracts') + '</span>' +
    '<span class="tab-badge">' + (pendingContracts.length + completedContracts.length) + '</span>' +
    '</button>' +
    '<button class="tab-btn" data-tab="sow">' +
    '<span class="tab-icon">📋</span>' +
    '<span class="tab-label">' + t('dash.tab.sowDocuments') + '</span>' +
    '<span class="tab-badge" id="sowCountBadge">0</span>' +
    '</button>' +
    '<button class="tab-btn" data-tab="coupons">' +
    '<span class="tab-icon">🎟️</span>' +
    '<span class="tab-label">' + t('dash.tab.coupons') + '</span>' +
    '<span class="tab-badge" id="couponCountBadge">0</span>' +
    '</button>' +
    '<button class="tab-btn" data-tab="help">' +
    '<span class="tab-icon">🆘</span>' +
    '<span class="tab-label">' + t('dash.tab.helpRequests') + '</span>' +
    '<span class="tab-badge" id="helpCountBadge">0</span>' +
    '</button>' +
    '</div>' +

        '<div class="tab-content">' +
    // Contracts Tab
    '<div class="tab-pane active" data-tab="contracts">' +
    self.renderContractsTab(pendingContracts, completedContracts) +
    '</div>' +

    // SOW Tab
    '<div class="tab-pane" data-tab="sow">' +
    '<div id="sowTabContent">' +
    '<div class="loading-state">' +
    '<div class="spinner"></div>' +
    '<p>' + t('dash.loading.sow') + '</p>' +
    '</div>' +
    '</div>' +
    '</div>' +

    // Coupons Tab
    '<div class="tab-pane" data-tab="coupons">' +
    '<div id="couponsTabContent">' +
    '<div class="loading-state">' +
    '<div class="spinner"></div>' +
    '<p>' + t('dash.loading.coupons') + '</p>' +
    '</div>' +
    '</div>' +
    '</div>' +

    // Help Requests Tab
    '<div class="tab-pane" data-tab="help">' +
    '<div id="helpTabContent">' +
    '<div class="loading-state">' +
    '<div class="spinner"></div>' +
    '<p>' + t('dash.loading.help') + '</p>' +
    '</div>' +
    '</div>' +
    '</div>' +

    '</div>' +
    '</div>';
    // Close Modal Button
    html += '<div class="dashboard-footer">' +
        '<button class="btn-close-dashboard" onclick="document.querySelector(\'.contract-modal\').classList.remove(\'show\'); document.body.classList.remove(\'modal-open\');">' + t('dash.btn.closeDashboard') + '</button>' +
        '</div>';
    
    dashboard.innerHTML = html;

    // Initialize dashboard logo animation (ping-pong morph)
    (function() {
        var TOTAL = 20;
        var INTERVAL = 120;
        var frames = [];
        for (var i = 0; i < TOTAL; i++) {
            var el = document.getElementById('dashLogo' + i);
            if (el) frames.push(el);
        }
        if (frames.length === 0) return;
        // Hide the logo container until all images are ready
        var logoContainer = frames[0].closest('.dash-logo-animated');
        if (logoContainer) logoContainer.style.visibility = 'hidden';
        var idx = 0;
        var dir = 1;
        var lastTime = performance.now();
        var rafId = null;
        function animate(now) {
            if (now - lastTime >= INTERVAL) {
                frames[idx].classList.remove('visible');
                idx += dir;
                if (idx >= frames.length - 1) { idx = frames.length - 1; dir = -1; }
                else if (idx <= 0) { idx = 0; dir = 1; }
                frames[idx].classList.add('visible');
                lastTime = now;
            }
            rafId = requestAnimationFrame(animate);
        }
        // Wait for all images to load and decode before starting animation
        Promise.all(frames.map(function(img) {
            var loaded = img.complete
                ? Promise.resolve()
                : new Promise(function(resolve) { img.onload = resolve; img.onerror = resolve; });
            return loaded.then(function() { return img.decode ? img.decode().catch(function() {}) : Promise.resolve(); });
        })).then(function() {
            if (logoContainer) logoContainer.style.visibility = '';
            lastTime = performance.now();
            rafId = requestAnimationFrame(animate);
        });
        // Stop when dashboard is removed
        var observer = new MutationObserver(function() {
            if (!document.getElementById('dashLogo0')) {
                cancelAnimationFrame(rafId);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    })();

    // Add event listeners for sign buttons
    $$('.btn-sign-contract').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var contractId = this.getAttribute('data-contract-id');
            self.selectContractToSign(contractId, pendingContracts);
        });
    });
    
    // Add event listeners for download buttons
    $$('.btn-download').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var contractId = this.getAttribute('data-contract-id');
            self.viewCompletedContract(contractId, completedContracts);
        });
    });
    
    // Tab switching
    $$('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tabName = this.getAttribute('data-tab');
            self.switchTab(tabName);
        });
    });

    // Note: SOW documents, coupons, and help requests are now loaded in parallel
    // via fetchAllContracts() for faster dashboard loading
};

// New function to render contracts tab content
ContractFormHandler.prototype.renderContractsTab = function(pendingContracts, completedContracts) {
    var self = this;
    var html = '';

    // Pipeline Summary Strip
    var signedCount = completedContracts.length;
    var pendingCount = pendingContracts.length;
    var totalPipeline = signedCount + pendingCount;

    html += '<div class="pipeline-strip">' +
        '<div class="pipeline-stage">' +
        '<span class="pipeline-count">' + pendingCount + '</span>' +
        '<span class="pipeline-label">' + t('contracts.stage.pending') + '</span>' +
        '</div>' +
        '<div class="pipeline-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>' +
        '<div class="pipeline-stage">' +
        '<span class="pipeline-count">' + signedCount + '</span>' +
        '<span class="pipeline-label">' + t('contracts.stage.completed') + '</span>' +
        '</div>' +
        '<div class="pipeline-bar-track">' +
        '<div class="pipeline-bar-fill" style="width: ' +
            (totalPipeline > 0 ? Math.round(signedCount / totalPipeline * 100) : 0) +
        '%;"></div>' +
        '</div>' +
        '</div>';

    // Action Required Section (Pending Contracts)
    html += '<div class="dashboard-section action-section">' +
        '<div class="section-header">' +
        '<h3>' + t('contracts.section.actionRequired') + '</h3>' +
        '<span class="section-badge">' + pendingContracts.length + t('contracts.badge.pending') + '</span>' +
        '</div>';

    if (pendingContracts.length === 0) {
        html += '<div class="empty-state success-state">' +
            '<img src="/images/scarlo-logo.png" alt="Scarlo" class="empty-icon">' +
            '<p>' + t('contracts.empty.noPending') + '</p>' +
            '</div>';
    } else {
        html += '<div class="action-list">';
        pendingContracts.forEach(function(contract) {
            var urgency = self.getUrgencyLevel(contract.daysSinceSubmission);
            var submissionDate = contract.timestamp ?
                (contract.timestamp.toDate ? contract.timestamp.toDate().toLocaleDateString() : new Date(contract.timestamp).toLocaleDateString())
                : 'N/A';

            html += '<div class="action-item" data-contract-id="' + contract.id + '">' +
                '<div class="client-avatar" style="border-color: ' + urgency.color + ';">' +
                '<span>' + (contract.clientName || 'U').charAt(0).toUpperCase() + '</span>' +
                '</div>' +
                '<div class="action-priority-bar" style="background: ' + urgency.color + ';"></div>' +
                '<div class="action-details">' +
                '<div class="action-client">' +
                '<h4>' + (contract.clientName || 'Unknown Client') + '</h4>' +
                '<span class="urgency-tag" style="background: ' + urgency.color + '22; color: ' + urgency.color + ';">' +
                    urgency.icon + ' ' + urgency.label + '</span>' +
                '</div>' +
                '<div class="action-meta-grid">' +
                '<div class="meta-cell"><span class="meta-key">' + t('contracts.meta.email') + '</span><span class="meta-val">' +
                    (contract.clientEmail || 'N/A') + '</span></div>' +
                '<div class="meta-cell"><span class="meta-key">' + t('contracts.meta.received') + '</span><span class="meta-val">' +
                    submissionDate + '</span></div>' +
                '<div class="meta-cell"><span class="meta-key">' + t('contracts.meta.waiting') + '</span><span class="meta-val ' +
                    (contract.daysSinceSubmission >= 7 ? 'meta-urgent' : '') + '">' +
                    contract.daysSinceSubmission + ' ' + (contract.daysSinceSubmission !== 1 ? t('contracts.meta.dayPlural') : t('contracts.meta.daySingular')) +
                '</span></div>' +
                '<div class="meta-cell"><span class="meta-key">' + t('contracts.meta.phone') + '</span><span class="meta-val">' +
                    (contract.clientPhone ? formatPhoneNumber(contract.clientPhone) : 'N/A') + '</span></div>' +
                '</div>' +
                '</div>' +
                '<div class="action-cta">' +
                '<button class="btn-sign-contract" data-contract-id="' + contract.id + '">' +
                '<span class="btn-icon">✍️</span>' +
                '<span class="btn-text">' + t('contracts.btn.sign') + '</span>' +
                '</button>' +
                '</div>' +
                '</div>';
        });
        html += '</div>';
    }
    html += '</div>';

    // Completed Contracts Section
    html += '<div class="dashboard-section history-section">' +
        '<div class="section-header">' +
        '<h3>' + t('contracts.section.completed') + '</h3>' +
        '<span class="section-badge success">' + completedContracts.length + t('contracts.badge.total') + '</span>' +
        '</div>';

    if (completedContracts.length === 0) {
        html += '<div class="empty-state">' +
            '<img src="/images/scarlo-logo.png" alt="Scarlo" class="empty-icon">' +
            '<p>' + t('contracts.empty.noCompleted') + '</p>' +
            '</div>';
    } else {
        html += '<div class="history-table">';
        completedContracts.forEach(function(contract) {
            var finalizedDate = contract.finalizedTimestamp ?
                (contract.finalizedTimestamp.toDate ? contract.finalizedTimestamp.toDate().toLocaleDateString() : new Date(contract.finalizedTimestamp).toLocaleDateString())
                : 'N/A';

            html += '<div class="history-row" data-contract-id="' + contract.id + '">' +
                '<div class="history-status"><span class="status-check">&#10003;</span></div>' +
                '<div class="history-name">' + (contract.clientName || 'Unknown Client') + '</div>' +
                '<div class="history-date">' + finalizedDate + '</div>' +
                '<div class="history-action">' +
                '<button class="btn-download" data-contract-id="' + contract.id + '" title="Download PDF">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ' + t('contracts.btn.pdf') + '</button>' +
                '</div>' +
                '</div>';
        });
        html += '</div>';
    }
    html += '</div>';

    return html;
};

// New function to switch tabs
ContractFormHandler.prototype.switchTab = function(tabName) {
    // Update buttons
    $$('.tab-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Update content
    $$('.tab-pane').forEach(function(pane) {
        pane.classList.remove('active');
        if (pane.getAttribute('data-tab') === tabName) {
            pane.classList.add('active');
        }
    });
};

// ============================================
// COUPON MANAGEMENT SYSTEM
// ============================================

// Load coupons from Firebase
ContractFormHandler.prototype.loadCoupons = function() {
    var self = this;
    var container = document.getElementById('couponsTabContent');
    if (!container) return;

    firebase.firestore().collection('coupons')
        .orderBy('createdAt', 'desc')
        .get()
        .then(function(snapshot) {
            var coupons = [];
            snapshot.forEach(function(doc) {
                var data = doc.data();
                data.id = doc.id;
                coupons.push(data);
            });

            // Update badge count
            var badge = document.getElementById('couponCountBadge');
            if (badge) badge.textContent = coupons.length;

            // Store coupons for later use
            self.coupons = coupons;

            // Render the coupons tab
            container.innerHTML = self.renderCouponsTab(coupons);

            // Attach event listeners
            self.attachCouponEventListeners();
        })
        .catch(function(error) {
            console.error('Error loading coupons:', error);
            container.innerHTML = '<div class="error-state"><p>Error loading coupons: ' + error.message + '</p></div>';
        });
};

// Create the default WELCOME10 coupon
ContractFormHandler.prototype.createWelcomeCoupon = function() {
    var welcomeCoupon = {
        code: 'WELCOME10',
        description: 'Welcome discount for new clients - 10% off your first project',
        discountType: 'percentage',
        discountValue: 10,
        minPurchase: 0,
        usageLimit: 0, // Unlimited
        usageCount: 0,
        expirationDate: null, // Never expires
        tierRestrictions: [], // All tiers
        oneTimeUse: false, // Reusable
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    return firebase.firestore().collection('coupons')
        .add(welcomeCoupon)
        .then(function(docRef) {
            console.log('WELCOME10 coupon created with ID:', docRef.id);
        })
        .catch(function(error) {
            console.error('Error creating WELCOME10 coupon:', error);
        });
};

// Render the coupons tab content
ContractFormHandler.prototype.renderCouponsTab = function(coupons) {
    var self = this;
    var html = '';

    // Header with Create button
    html += '<div class="coupons-header">' +
        '<div class="coupons-title">' +
        '</div>' +
        '<button class="btn-create-coupon" id="btnCreateCoupon">' +
        '<span class="btn-icon">+</span>' +
        '<span class="btn-text">' + t('couponTab.btn.create') + '</span>' +
        '</button>' +
        '</div>';

    // Coupon Creator Form (hidden by default)
    html += '<div id="couponCreatorForm" class="coupon-creator-form" style="display: none;">' +
        '<div class="coupon-form-header">' +
        '<h4 id="couponFormTitle">' + t('couponTab.form.title') + '</h4>' +
        '<button class="btn-close-form" id="btnCloseCouponForm">×</button>' +
        '</div>' +
        '<div class="coupon-form-body">' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label>' + t('couponTab.form.codeLabel') + '</label>' +
        '<input type="text" id="couponCode" placeholder="' + t('couponTab.form.codePlaceholder') + '" class="coupon-input" style="text-transform: uppercase;">' +
        '<small>' + t('couponTab.form.codeHelper') + '</small>' +
        '</div>' +
        '<div class="form-group">' +
        '<label>' + t('couponTab.form.typeLabel') + '</label>' +
        '<select id="couponType" class="coupon-select">' +
        '<option value="percentage">' + t('couponTab.form.typePercent') + '</option>' +
        '<option value="fixed">' + t('couponTab.form.typeFixed') + '</option>' +
        '</select>' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label>' + t('couponTab.form.valueLabel') + '</label>' +
        '<input type="number" id="couponValue" placeholder="' + t('couponTab.form.valuePlaceholder') + '" class="coupon-input" min="0" step="0.01">' +
        '<small id="couponValueHint">' + t('couponTab.form.valueHelper') + '</small>' +
        '</div>' +
        '<div class="form-group">' +
        '<label>' + t('couponTab.form.usageLabel') + '</label>' +
        '<input type="number" id="couponUsageLimit" placeholder="' + t('couponTab.form.usagePlaceholder') + '" class="coupon-input" min="0">' +
        '<small>' + t('couponTab.form.usageHelper') + '</small>' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label>' + t('couponTab.form.minPurchaseLabel') + '</label>' +
        '<input type="number" id="couponMinPurchase" placeholder="0" class="coupon-input" min="0" step="0.01">' +
        '<small>' + t('couponTab.form.minPurchaseHelper') + '</small>' +
        '</div>' +
        '<div class="form-group">' +
        '<label>' + t('couponTab.form.expirationLabel') + '</label>' +
        '<input type="date" id="couponExpiration" class="coupon-input">' +
        '<small>' + t('couponTab.form.expirationHelper') + '</small>' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group full-width">' +
        '<label>' + t('couponTab.form.tierLabel') + '</label>' +
        '<div class="tier-checkboxes">' +
        '<label class="tier-checkbox"><input type="checkbox" value="essential" checked> ' + t('couponTab.form.tierEssential') + '</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="starter" checked> ' + t('couponTab.form.tierStarter') + '</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="growth" checked> ' + t('couponTab.form.tierGrowth') + '</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="professional" checked> ' + t('couponTab.form.tierProfessional') + '</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="enterprise" checked> ' + t('couponTab.form.tierEnterprise') + '</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="custom" checked> ' + t('couponTab.form.tierCustom') + '</label>' +
        '</div>' +
        '<small>' + t('couponTab.form.tierHelper') + '</small>' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group full-width">' +
        '<label>' + t('couponTab.form.descLabel') + '</label>' +
        '<input type="text" id="couponDescription" placeholder="' + t('couponTab.form.descPlaceholder') + '" class="coupon-input">' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label class="checkbox-label">' +
        '<input type="checkbox" id="couponActive" checked>' +
        '<span>' + t('couponTab.form.activeLabel') + '</span>' +
        '</label>' +
        '</div>' +
        '</div>' +
        '<input type="hidden" id="couponEditId" value="">' +
        '<div class="form-actions">' +
        '<button class="btn-cancel" id="btnCancelCoupon">' + t('couponTab.form.cancelBtn') + '</button>' +
        '<button class="btn-save-coupon" id="btnSaveCoupon">' + t('couponTab.form.saveBtn') + '</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    // Coupons List
    if (coupons.length === 0) {
        html += '<div class="empty-state">' +
            '<div class="empty-icon">🎟️</div>' +
            '<h4>' + t('couponTab.empty.title') + '</h4>' +
            '<p>' + t('couponTab.empty.text') + '</p>' +
            '</div>';
    } else {
        html += '<div class="coupons-list">';

        // Active coupons
        var activeCoupons = coupons.filter(function(c) { return c.active !== false; });
        var inactiveCoupons = coupons.filter(function(c) { return c.active === false; });

        if (activeCoupons.length > 0) {
            html += '<div class="coupons-section">' +
                '<h4 class="section-label">' + t('couponTab.section.active') + ' (' + activeCoupons.length + ')</h4>';
            activeCoupons.forEach(function(coupon) {
                html += self.renderCouponCard(coupon);
            });
            html += '</div>';
        }

        if (inactiveCoupons.length > 0) {
            html += '<div class="coupons-section inactive-section">' +
                '<h4 class="section-label">' + t('couponTab.section.inactive') + ' (' + inactiveCoupons.length + ')</h4>';
            inactiveCoupons.forEach(function(coupon) {
                html += self.renderCouponCard(coupon);
            });
            html += '</div>';
        }

        html += '</div>';
    }

    return html;
};

// Render a single coupon card
ContractFormHandler.prototype.renderCouponCard = function(coupon) {
    var self = this;
    var isExpired = coupon.expirationDate && new Date(coupon.expirationDate) < new Date();
    var isUsedUp = coupon.usageLimit && coupon.usageCount >= coupon.usageLimit;
    var statusClass = (!coupon.active || isExpired || isUsedUp) ? 'coupon-inactive' : 'coupon-active';

    var discountDisplay = coupon.discountType === 'percentage'
        ? coupon.discountValue + '% OFF'
        : '$' + parseFloat(coupon.discountValue || 0).toFixed(0) + ' OFF';

    var statusBadge = '';
    if (!coupon.active) {
        statusBadge = '<span class="status-badge inactive">Disabled</span>';
    } else if (isExpired) {
        statusBadge = '<span class="status-badge expired">Expired</span>';
    } else if (isUsedUp) {
        statusBadge = '<span class="status-badge used-up">Limit Reached</span>';
    } else {
        statusBadge = '<span class="status-badge active">Active</span>';
    }

    var html = '<div class="coupon-card ' + statusClass + '" data-coupon-id="' + coupon.id + '">' +
        '<div class="coupon-card-header">' +
        '<div class="coupon-code-display">' +
        '<span class="coupon-code">' + coupon.code + '</span>' +
        '<button class="btn-copy-code" data-code="' + coupon.code + '" title="Copy code">📋</button>' +
        '</div>' +
        statusBadge +
        '</div>' +
        '<div class="coupon-card-body">' +
        '<div class="coupon-discount">' + discountDisplay + '</div>' +
        '<div class="coupon-details">';

    if (coupon.description) {
        html += '<div class="detail-row"><span class="detail-label">Description:</span> ' + coupon.description + '</div>';
    }
    if (coupon.minPurchase && coupon.minPurchase > 0) {
        html += '<div class="detail-row"><span class="detail-label">Min. Purchase:</span> $' + parseFloat(coupon.minPurchase).toFixed(0) + '</div>';
    }
    if (coupon.usageLimit) {
        html += '<div class="detail-row"><span class="detail-label">Usage:</span> ' + (coupon.usageCount || 0) + ' / ' + coupon.usageLimit + '</div>';
    } else {
        html += '<div class="detail-row"><span class="detail-label">Usage:</span> ' + (coupon.usageCount || 0) + ' (unlimited)</div>';
    }
    if (coupon.expirationDate) {
        var expDate = new Date(coupon.expirationDate).toLocaleDateString();
        html += '<div class="detail-row"><span class="detail-label">Expires:</span> ' + expDate + '</div>';
    }
    if (coupon.allowedTiers && coupon.allowedTiers.length < 5) {
        html += '<div class="detail-row"><span class="detail-label">Tiers:</span> ' + coupon.allowedTiers.join(', ') + '</div>';
    }

    html += '</div>' +
        '</div>' +
        '<div class="coupon-card-footer">' +
        '<button class="btn-edit-coupon" data-coupon-id="' + coupon.id + '">Edit</button>' +
        '<button class="btn-delete-coupon" data-coupon-id="' + coupon.id + '">Delete</button>' +
        '</div>' +
        '</div>';

    return html;
};

// Attach event listeners for coupon functionality
ContractFormHandler.prototype.attachCouponEventListeners = function() {
    var self = this;

    // Create button
    var createBtn = document.getElementById('btnCreateCoupon');
    if (createBtn) {
        createBtn.addEventListener('click', function() {
            self.showCouponForm();
        });
    }

    // Close form button
    var closeBtn = document.getElementById('btnCloseCouponForm');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            self.hideCouponForm();
        });
    }

    // Cancel button
    var cancelBtn = document.getElementById('btnCancelCoupon');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            self.hideCouponForm();
        });
    }

    // Save button
    var saveBtn = document.getElementById('btnSaveCoupon');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            self.saveCoupon();
        });
    }

    // Discount type change
    var typeSelect = document.getElementById('couponType');
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            var hint = document.getElementById('couponValueHint');
            if (this.value === 'percentage') {
                hint.textContent = t('coupon.hint.percentage');
            } else {
                hint.textContent = t('coupon.hint.dollar');
            }
        });
    }

    // Code input - uppercase
    var codeInput = document.getElementById('couponCode');
    if (codeInput) {
        codeInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }

    // Edit buttons
    $$('.btn-edit-coupon').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var couponId = this.getAttribute('data-coupon-id');
            self.editCoupon(couponId);
        });
    });

    // Delete buttons
    $$('.btn-delete-coupon').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var couponId = this.getAttribute('data-coupon-id');
            self.deleteCoupon(couponId);
        });
    });

    // Copy code buttons
    $$('.btn-copy-code').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var code = this.getAttribute('data-code');
            navigator.clipboard.writeText(code).then(function() {
                alert('Coupon code copied: ' + code);
            });
        });
    });
};

// Show coupon form
ContractFormHandler.prototype.showCouponForm = function(editData) {
    var form = document.getElementById('couponCreatorForm');
    var title = document.getElementById('couponFormTitle');
    if (!form) return;

    // Reset form
    document.getElementById('couponCode').value = '';
    document.getElementById('couponType').value = 'percentage';
    document.getElementById('couponValue').value = '';
    document.getElementById('couponUsageLimit').value = '';
    document.getElementById('couponMinPurchase').value = '';
    document.getElementById('couponExpiration').value = '';
    document.getElementById('couponDescription').value = '';
    document.getElementById('couponActive').checked = true;
    document.getElementById('couponEditId').value = '';

    // Reset tier checkboxes
    $$('.tier-checkboxes input[type="checkbox"]').forEach(function(cb) {
        cb.checked = true;
    });

    if (editData) {
        title.textContent = t('coupon.title.edit');
        document.getElementById('couponCode').value = editData.code || '';
        document.getElementById('couponType').value = editData.discountType || 'percentage';
        document.getElementById('couponValue').value = editData.discountValue || '';
        document.getElementById('couponUsageLimit').value = editData.usageLimit || '';
        document.getElementById('couponMinPurchase').value = editData.minPurchase || '';
        document.getElementById('couponExpiration').value = editData.expirationDate || '';
        document.getElementById('couponDescription').value = editData.description || '';
        document.getElementById('couponActive').checked = editData.active !== false;
        document.getElementById('couponEditId').value = editData.id;

        // Set tier checkboxes
        if (editData.allowedTiers) {
            $$('.tier-checkboxes input[type="checkbox"]').forEach(function(cb) {
                cb.checked = editData.allowedTiers.indexOf(cb.value) !== -1;
            });
        }
    } else {
        title.textContent = t('coupon.title.create');
    }

    form.style.display = 'block';
    document.getElementById('couponCode').focus();
};

// Hide coupon form
ContractFormHandler.prototype.hideCouponForm = function() {
    var form = document.getElementById('couponCreatorForm');
    if (form) form.style.display = 'none';
};

// Save coupon to Firebase
ContractFormHandler.prototype.saveCoupon = function() {
    var self = this;
    var editId = document.getElementById('couponEditId').value;
    var code = document.getElementById('couponCode').value.trim().toUpperCase();
    var type = document.getElementById('couponType').value;
    var value = parseFloat(document.getElementById('couponValue').value);
    var usageLimit = document.getElementById('couponUsageLimit').value ? parseInt(document.getElementById('couponUsageLimit').value) : null;
    var minPurchase = parseFloat(document.getElementById('couponMinPurchase').value) || 0;
    var expirationDate = document.getElementById('couponExpiration').value || null;
    var description = document.getElementById('couponDescription').value.trim();
    var active = document.getElementById('couponActive').checked;

    // Get allowed tiers
    var allowedTiers = [];
    $$('.tier-checkboxes input[type="checkbox"]:checked').forEach(function(cb) {
        allowedTiers.push(cb.value);
    });

    // Validation
    if (!code) {
        alert(t('coupon.val.enterCode'));
        return;
    }
    if (isNaN(value) || value <= 0) {
        alert(t('coupon.val.validDiscount'));
        return;
    }
    if (type === 'percentage' && value > 100) {
        alert(t('coupon.val.percentMax'));
        return;
    }
    if (allowedTiers.length === 0) {
        alert(t('coupon.val.selectTier'));
        return;
    }

    var couponData = {
        code: code,
        discountType: type,
        discountValue: value,
        usageLimit: usageLimit,
        minPurchase: minPurchase,
        expirationDate: expirationDate,
        description: description,
        active: active,
        allowedTiers: allowedTiers,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    var savePromise;
    if (editId) {
        // Update existing
        savePromise = firebase.firestore().collection('coupons').doc(editId).update(couponData);
    } else {
        // Create new
        couponData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        couponData.usageCount = 0;

        // Check if code already exists
        savePromise = firebase.firestore().collection('coupons')
            .where('code', '==', code)
            .get()
            .then(function(snapshot) {
                if (!snapshot.empty) {
                    throw new Error('A coupon with this code already exists');
                }
                return firebase.firestore().collection('coupons').add(couponData);
            });
    }

    savePromise
        .then(function() {
            alert(t('coupon.msg.saveSuccess'));
            self.hideCouponForm();
            self.loadCoupons();
        })
        .catch(function(error) {
            console.error('Error saving coupon:', error);
            alert(t('coupon.err.save') + error.message);
        });
};

// Edit coupon
ContractFormHandler.prototype.editCoupon = function(couponId) {
    var self = this;
    var coupon = this.coupons.find(function(c) { return c.id === couponId; });
    if (coupon) {
        this.showCouponForm(coupon);
    }
};

// Delete coupon
ContractFormHandler.prototype.deleteCoupon = function(couponId) {
    var self = this;
    var coupon = this.coupons.find(function(c) { return c.id === couponId; });
    if (!coupon) return;

    if (!confirm(t('coupon.confirm.deletePrefix') + coupon.code + t('coupon.confirm.deleteSuffix'))) {
        return;
    }

    firebase.firestore().collection('coupons').doc(couponId).delete()
        .then(function() {
            alert(t('coupon.msg.deleteSuccess'));
            self.loadCoupons();
        })
        .catch(function(error) {
            console.error('Error deleting coupon:', error);
            alert(t('coupon.err.delete') + error.message);
        });
};

// Validate and get coupon by code (used when applying in SOW)
ContractFormHandler.prototype.validateCoupon = function(code, packageType, orderTotal) {
    var coupon = this.coupons ? this.coupons.find(function(c) {
        return c.code === code.toUpperCase() && c.active !== false;
    }) : null;

    if (!coupon) {
        return { valid: false, error: t('coupon.val.invalidCode') };
    }

    // Check expiration
    if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) {
        return { valid: false, error: t('coupon.val.expired') };
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return { valid: false, error: t('coupon.val.usageLimit') };
    }

    // Check minimum purchase
    if (coupon.minPurchase && orderTotal < coupon.minPurchase) {
        return { valid: false, error: t('coupon.val.minPurchasePrefix') + coupon.minPurchase.toFixed(0) + t('coupon.val.minPurchaseSuffix') };
    }

    // Check tier restriction
    if (coupon.allowedTiers && coupon.allowedTiers.length > 0 && packageType) {
        if (coupon.allowedTiers.indexOf(packageType) === -1) {
            return { valid: false, error: t('coupon.val.tierInvalidPrefix') + packageType + t('coupon.val.tierInvalidSuffix') };
        }
    }

    // Calculate discount
    var discount = 0;
    if (coupon.discountType === 'percentage') {
        discount = orderTotal * (coupon.discountValue / 100);
    } else {
        discount = Math.min(coupon.discountValue, orderTotal); // Don't exceed order total
    }

    return {
        valid: true,
        coupon: coupon,
        discount: discount,
        discountDisplay: coupon.discountType === 'percentage' ? coupon.discountValue + '%' : '$' + coupon.discountValue.toFixed(0)
    };
};

// ============================================
// END COUPON MANAGEMENT SYSTEM
// ============================================

// Fetch client lastLogin data for SOWs
ContractFormHandler.prototype.fetchClientLastLogins = function(sows) {
    if (!sows || sows.length === 0) return Promise.resolve();

    // Collect unique client emails (preserve original casing for query)
    var emailsSet = {};
    sows.forEach(function(sow) {
        if (sow.clientEmail) {
            emailsSet[sow.clientEmail.toLowerCase()] = sow.clientEmail;
        }
    });
    var emails = Object.values(emailsSet);

    if (emails.length === 0) return Promise.resolve();

    // Query users by email (chunk if needed for Firestore limit)
    var chunks = [];
    for (var i = 0; i < emails.length; i += 10) {
        chunks.push(emails.slice(i, i + 10));
    }

    var userLastLogins = {};
    var promises = chunks.map(function(chunk) {
        return firebase.firestore().collection('users')
            .where('email', 'in', chunk)
            .get()
            .then(function(snapshot) {
                console.log('👥 Found', snapshot.size, 'users for lastLogin lookup');
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    if (data.email) {
                        userLastLogins[data.email.toLowerCase()] = data.lastLogin;
                    }
                });
            });
    });

    return Promise.all(promises).then(function() {
        // Attach lastLogin to each SOW
        sows.forEach(function(sow) {
            if (sow.clientEmail) {
                sow.clientLastLogin = userLastLogins[sow.clientEmail.toLowerCase()] || null;
            }
        });
    });
};

// New function to load SOW documents
ContractFormHandler.prototype.loadSOWDocuments = function() {
    var self = this;

    firebase.firestore().collection('sow_documents')
        .orderBy('createdAt', 'desc')
        .get()
        .then(function(snapshot) {
            var sows = [];
            var changeRequestIds = [];

            snapshot.forEach(function(doc) {
                var data = doc.data();
                data.id = doc.id;
                sows.push(data);

                // Collect change request IDs
                if (data.changeRequestId) {
                    changeRequestIds.push(data.changeRequestId);
                }
            });

            // Fetch user lastLogin data for all SOWs
            return self.fetchClientLastLogins(sows).then(function() {
                // If there are change requests, fetch them to check for unread messages
                if (changeRequestIds.length > 0) {
                    self.fetchChangeRequestsUnreadStatus(changeRequestIds, sows);
                } else {
                    self.renderSOWTab(sows);
                }
            });
        })
        .catch(function(error) {
            console.error('Error loading SOWs:', error);
            var sowContent = $('#sowTabContent');
            if (sowContent) {
                sowContent.innerHTML = '<div class="error-state">' +
                    '<p>Error loading SOW documents</p>' +
                    '<button class="btn-create-sow" onclick="location.reload()">Retry</button>' +
                    '</div>';
            }
        });
};

// Fetch change requests to check for unread messages
ContractFormHandler.prototype.fetchChangeRequestsUnreadStatus = function(changeRequestIds, sows) {
    var self = this;
    var viewerType = self.isDeveloper ? 'developer' : 'client';
    var lastViewedField = self.isDeveloper ? 'developerLastViewed' : 'clientLastViewed';

    // Firestore doesn't support 'in' queries with more than 10 items, so chunk them
    var chunks = [];
    for (var i = 0; i < changeRequestIds.length; i += 10) {
        chunks.push(changeRequestIds.slice(i, i + 10));
    }

    var changeRequestsMap = {};
    var promises = chunks.map(function(chunk) {
        return firebase.firestore().collection('change_requests')
            .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
            .get()
            .then(function(snapshot) {
                snapshot.forEach(function(doc) {
                    var data = doc.data();
                    data.id = doc.id;

                    // Check if there are unread messages
                    var hasUnread = false;
                    if (data.lastMessageBy && data.lastMessageBy !== viewerType && data.lastMessageAt) {
                        var lastViewed = data[lastViewedField];
                        if (!lastViewed || data.lastMessageAt.toMillis() > lastViewed.toMillis()) {
                            hasUnread = true;
                        }
                    }
                    data.hasUnreadMessages = hasUnread;
                    changeRequestsMap[doc.id] = data;
                });
            });
    });

    Promise.all(promises)
        .then(function() {
            // Attach change request data to SOWs
            sows.forEach(function(sow) {
                if (sow.changeRequestId && changeRequestsMap[sow.changeRequestId]) {
                    sow.changeRequestData = changeRequestsMap[sow.changeRequestId];
                }
            });
            self.renderSOWTab(sows);
        })
        .catch(function(error) {
            console.error('Error fetching change requests:', error);
            // Still render SOWs even if change request fetch fails
            self.renderSOWTab(sows);
        });
};

// New function to render SOW tab
// ============= COMPLETE REPLACEMENT: renderSOWTab =============
ContractFormHandler.prototype.renderSOWTab = function(sows) {
    var self = this;
    var sowContent = $('#sowTabContent');
    var sowBadge = $('#sowCountBadge');
    
    if (!sowContent) return;
    
    // Update badge count
    if (sowBadge) sowBadge.textContent = sows.length;
    
    var html = '<div class="sow-tab-header">' +
        '<button class="btn-create-sow" onclick="window.contractFormHandler.showSOWCreator()">' +
        '<span class="btn-icon">+</span> ' + t('sowTab.btn.createSow') +
        '</button>' +
        '</div>';

    if (sows.length === 0) {
        html += '<div class="empty-state">' +
            '<img src="/images/scarlo-logo.png" alt="Scarlo" class="empty-icon">' +
            '<h4>' + t('sowTab.empty.title') + '</h4>' +
            '<p>' + t('sowTab.empty.text') + '</p>' +
            '<button class="btn-create-sow" onclick="window.contractFormHandler.showSOWCreator()" style="margin-top: 20px;">' +
            '<span class="btn-icon">+</span> ' + t('sowTab.btn.createSow') +
            '</button>' +
            '</div>';
    } else {
        // Revenue Summary Bar
        var sowTotalRevenue = 0;
        var sowPaidRevenue = 0;
        var packageCounts = {};
        sows.forEach(function(s) {
            if (s.payment && s.payment.total) sowTotalRevenue += s.payment.total;
            var pi = self.calculatePaymentStatus(s);
            sowPaidRevenue += pi.paidAmount;
            var pkg = s.packageType || 'unknown';
            packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
        });
        var avgProjectValue = sows.length > 0 ? sowTotalRevenue / sows.length : 0;

        html += '<div class="sow-revenue-bar">' +
            '<div class="sow-revenue-stat">' +
            '<span class="revenue-val">' + self.formatCurrency(sowTotalRevenue) + '</span>' +
            '<span class="revenue-label">' + t('sowTab.stats.totalRevenue') + '</span>' +
            '</div>' +
            '<div class="sow-revenue-stat">' +
            '<span class="revenue-val">' + self.formatCurrency(avgProjectValue) + '</span>' +
            '<span class="revenue-label">' + t('sowTab.stats.avgProject') + '</span>' +
            '</div>' +
            '<div class="sow-revenue-stat">' +
            '<span class="revenue-val">' + self.formatCurrency(sowPaidRevenue) + '</span>' +
            '<span class="revenue-label">' + t('sowTab.stats.collected') + '</span>' +
            '</div>' +
            '</div>';

        // Package Distribution Bar
        var packageColors = {
            'essential': '#6366f1', 'starter': '#8b5cf6', 'growth': '#10b981',
            'professional': '#f59e0b', 'enterprise': '#ef4444', 'custom': '#ec4899'
        };
        html += '<div class="package-distribution">' +
            '<div class="package-bar">';
        var packageKeys = Object.keys(packageCounts);
        packageKeys.forEach(function(pkg) {
            var pct = (packageCounts[pkg] / sows.length * 100).toFixed(1);
            html += '<div class="package-segment" style="width: ' + pct + '%; background: ' +
                (packageColors[pkg] || '#6b7280') + ';" title="' + pkg + ': ' + packageCounts[pkg] + '"></div>';
        });
        html += '</div>' +
            '<div class="package-legend">';
        packageKeys.forEach(function(pkg) {
            html += '<span class="legend-item">' +
                '<span class="legend-dot" style="background: ' + (packageColors[pkg] || '#6b7280') + ';"></span>' +
                pkg.charAt(0).toUpperCase() + pkg.slice(1) + ' (' + packageCounts[pkg] + ')' +
                '</span>';
        });
        html += '</div></div>';

        html += '<div class="sow-list">';
        sows.forEach(function(sow) {
            var createdDate = sow.createdAt ?
                (sow.createdAt.toDate ? sow.createdAt.toDate().toLocaleDateString() : new Date(sow.createdAt).toLocaleDateString())
                : 'N/A';

            var packageNames = {
                'essential': t('sowTab.pkg.essential'),
                'starter': t('sowTab.pkg.tier1'),
                'growth': t('sowTab.pkg.tier2'),
                'professional': t('sowTab.pkg.tier3'),
                'enterprise': t('sowTab.pkg.tier4'),
                'custom': t('sowTab.pkg.custom')
            };
            
            var statusColors = {
                'draft': { bg: '#374151', color: '#9ca3af', icon: '📝' },
                'sent': { bg: '#1e40af', color: '#60a5fa', icon: '📤' },
                'approved': { bg: '#065f46', color: '#34d399', icon: '✅' }
            };
            
            var status = sow.status || 'draft';
            var statusStyle = statusColors[status] || statusColors['draft'];

            // 🔥 Enhanced status with signature info
            var statusText = status.toUpperCase();
            if (status === 'pending_developer' || status === 'sent') {
                if (sow.clientSignature && !sow.devSignature) {
                    statusText = '⏳ ' + t('sowTab.status.awaitingDev');
                } else if (!sow.clientSignature) {
                    statusText = '📤 ' + t('sowTab.status.awaitingClient');
                }
            } else if (status === 'approved' && sow.clientSignature && sow.devSignature) {
                statusText = '✅ ' + t('sowTab.status.fullySigned');
            }
            
           // Store SOW data in window for inline handlers to access
            var sowDataId = 'sowData_' + sow.id.replace(/[^a-zA-Z0-9]/g, '_');
            window[sowDataId] = sow;
            
                        // Contract status is now handled inline in the header
           
            // Change request badge with unread indicator
            var changeRequestBadge = '';
            if (sow.hasChangeRequest && sow.changeRequestStatus) {
                var crStyles = {
                    'pending': { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', text: '📝 ' + t('sowTab.cr.requested') },
                    'approved': { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', text: '✅ ' + t('sowTab.cr.approved') },
                    'rejected': { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', text: '❌ ' + t('sowTab.cr.rejected') },
                    'change_order': { bg: 'rgba(99, 102, 241, 0.2)', color: '#6366f1', text: '📋 ' + t('sowTab.cr.order') }
                };
                var crStyle = crStyles[sow.changeRequestStatus] || crStyles.pending;

                // Check for unread messages
                var unreadBadge = '';
                if (sow.changeRequestData && sow.changeRequestData.hasUnreadMessages) {
                    unreadBadge = '<span class="unread-badge">' + t('sowTab.badge.new') + '</span>';
                }

                changeRequestBadge = '<div style="font-size: 0.75rem; color: ' + crStyle.color + '; background: ' + crStyle.bg + '; padding: 4px 8px; border-radius: 4px; white-space: nowrap; cursor: pointer; display: flex; align-items: center;" onclick="window.contractFormHandler.viewChangeRequest(\'' + sow.changeRequestId + '\')">' +
                    crStyle.text + unreadBadge +
                    '</div>';
            }

            html += '<div class="sow-item" data-sow-id="' + sow.id + '">' +
                '<div class="sow-item-header">' +
                '<div class="sow-client-info">' +
                '<h4>' + (sow.clientName || 'Unknown Client') + '</h4>' +
                '<p class="sow-package">' + (packageNames[sow.packageType] || sow.packageType) + '</p>' +
                '<p style="margin: 0.25rem 0 0; font-size: 0.7rem; color: #6b7280; opacity: 0.8;">Last sign in: ' + (sow.clientLastLogin ? (sow.clientLastLogin.toDate ? sow.clientLastLogin.toDate().toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) : new Date(sow.clientLastLogin).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})) : 'Never') + '</p>' +
                '</div>' +
                '<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">' +
                '<span class="sow-status" style="background: ' + statusStyle.bg + '; color: ' + statusStyle.color + ';">' +
                statusStyle.icon + ' ' + statusText +
                '</span>' +
                (sow.linkedContract ?
                    '<div style="font-size: 0.75rem; color: #10b981; background: rgba(16, 185, 129, 0.15); padding: 4px 8px; border-radius: 4px; white-space: nowrap;">' +
                    '🔗 ' + t('sowTab.badge.linkedContract') +
                    '</div>'
                : '') +
                changeRequestBadge +
                '<div class="sow-signatures">' +
                '<span class="sig-icon ' + (sow.devSignature ? 'signed' : 'pending') + '">' +
                    (sow.devSignature ? '&#10003;' : '&#9202;') + ' ' + t('sowTab.sig.dev') + '</span>' +
                '<span class="sig-icon ' + (sow.clientSignature ? 'signed' : 'pending') + '">' +
                    (sow.clientSignature ? '&#10003;' : '&#9202;') + ' ' + t('sowTab.sig.client') + '</span>' +
                '</div>' +
                '</div>' +
                '</div>' +

                '<div class="sow-item-details">' +
                '<div class="sow-detail-grid">' +
                '<div class="sow-detail-row">' +
                '<span class="detail-label">' + (sow.clientEmail ? '📧 ' + t('sowTab.detail.email') : '📱 ' + t('sowTab.detail.phone')) + '</span>' +
                '<span class="detail-value">' + (sow.clientEmail || (sow.clientPhone ? formatPhoneNumber(sow.clientPhone) : 'N/A')) + '</span>' +
                '</div>' +
                '<div class="sow-detail-row">' +
                '<span class="detail-label">💰 ' + t('sowTab.detail.total') + '</span>' +
                '<span class="detail-value">' + self.formatCurrency((sow.payment && sow.payment.total) ? sow.payment.total : 0) + '</span>' +
                '</div>' +
                '<div class="sow-detail-row">' +
                '<span class="detail-label">⏱️ ' + t('sowTab.detail.timeline') + '</span>' +
                '<span class="detail-value">' + (sow.estimatedWeeks || 'TBD') + ' ' + (sow.devDurationUnit || t('sowTab.detail.weeks')) + '</span>' +
                '</div>' +
                '<div class="sow-detail-row">' +
                '<span class="detail-label">📅 ' + t('sowTab.detail.created') + '</span>' +
                '<span class="detail-value">' + createdDate + '</span>' +
                '</div>' +
                '</div>' +
                '</div>' +

// Change Request Card (if pending)
(sow.hasChangeRequest && sow.changeRequestStatus === 'pending' ?
    '<div class="change-request-card" style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 0.75rem; margin-bottom: 0.75rem;">' +
    '<div>' +
    '<p style="margin: 0; font-weight: 600; color: #fbbf24; font-size: 0.9rem; display: flex; align-items: center;">📝 ' + t('sowTab.cr.clientRequested') +
    (sow.changeRequestData && sow.changeRequestData.hasUnreadMessages ? '<span class="unread-badge">' + t('sowTab.badge.new') + '</span>' : '') +
    '</p>' +
    '<p style="margin: 0.25rem 0 0; font-size: 0.8rem; opacity: 0.8;">' + t('sowTab.cr.reviewText') + '</p>' +
    '</div>' +
    '</div>'
: '') +

                '<div class="sow-item-actions">' +
// Sign button (if not fully signed)
((!sow.clientSignature || !sow.devSignature) ?
    '<button class="sow-action-icon" onclick="window.contractFormHandler.showSOWSigningModal(\'' + sow.id + '\')" title="' + t('sowTab.btn.signSow') + '">✍️</button>' : '') +

// View Change Request button (if there's a change request)
(sow.hasChangeRequest && sow.changeRequestId ?
    '<button class="sow-action-icon has-badge" onclick="window.contractFormHandler.viewChangeRequest(\'' + sow.changeRequestId + '\')" title="' + t('sowTab.btn.viewChangeRequest') + '">' +
    '💬' + (sow.changeRequestData && sow.changeRequestData.hasUnreadMessages ? '<span class="action-badge"></span>' : '') +
    '</button>' : '') +

'<button class="sow-action-icon" onclick="window.contractFormHandler.showPaymentManager(\'' + sow.id + '\')" title="' + t('sowTab.btn.managePayments') + '">💳</button>' +
'<button class="sow-action-icon" onclick="window.contractFormHandler.editSOW(window.' + sowDataId + ')" title="' + t('sowTab.btn.editSow') + '">✏️</button>' +
'<button class="sow-action-icon" onclick="window.contractFormHandler.generateSOWPDF(window.' + sowDataId + ')" title="' + t('sowTab.btn.downloadPdf') + '">📄</button>' +
'<button class="sow-action-icon delete" onclick="window.contractFormHandler.deleteSOW(\'' + sow.id + '\')" title="' + t('sowTab.btn.deleteSow') + '">🗑️</button>' +
'</div>' +
                '</div>';
        });
        html += '</div>';
    }
    
    // SOW Creator Container
    html += '<div id="sowCreatorContainer" style="display: none;"></div>';

    sowContent.innerHTML = html;

    console.log('✓ SOW tab rendered with', sows.length, 'items');

    // Check for SOW URL parameters and auto-open SOW creator (now that container exists)
    checkSOWURLParams();
};

// Helper function to view SOW details
ContractFormHandler.prototype.viewSOWDetails = function(sow) {
    alert('SOW Details for: ' + sow.clientName + '\n\n' +
        'Package: ' + sow.packageType + '\n' +
        'Total: $' + (sow.payment ? sow.payment.total.toFixed(0) : '0') + '\n' +
        'Timeline: ' + (sow.estimatedWeeks || 'TBD') + ' weeks\n' +
        'Features: ' + (sow.features ? sow.features.length : 0) + ' selected');
};

// Helper function to generate PDF from saved SOW data
ContractFormHandler.prototype.generateSOWPDFFromData = function(sow) {
    // Temporarily populate the form with SOW data
    var clientNameField = $('#sowClientName');
    var clientEmailField = $('#sowClientEmail');
    var packageField = $('#sowPackage');
    var weeksField = $('#sowWeeks');
    var notesField = $('#sowNotes');
    var maintenanceField = $('#sowMaintenance');
    
    if (clientNameField) clientNameField.value = sow.clientName || '';
    if (clientEmailField) clientEmailField.value = sow.clientEmail || '';
    if (packageField) packageField.value = sow.packageType || '';
    if (weeksField) weeksField.value = sow.estimatedWeeks || '';
    if (notesField) notesField.value = sow.notes || '';
    if (maintenanceField) maintenanceField.value = sow.maintenancePlan || 'none';
    
    // Generate PDF
    this.generateSOWPDF();
};

// Helper function to delete SOW
ContractFormHandler.prototype.deleteSOW = function(sowId) {
    if (!confirm(t('sow.confirm.delete'))) {
        return;
    }

    var self = this;

    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .delete()
        .then(function() {
            console.log('SOW deleted successfully');
            alert(t('sow.msg.deleteSuccess'));
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error deleting SOW:', error);
            alert(t('sow.err.delete') + error.message);
        });
};

// ============= PAYMENT MANAGEMENT FUNCTIONS =============

ContractFormHandler.prototype.showPaymentManager = function(sowId) {
    var self = this;

    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .get()
        .then(function(doc) {
            if (!doc.exists) {
                alert(t('sow.err.notFound'));
                return;
            }

            var sowData = doc.data();
            sowData.id = doc.id;
            self.renderPaymentManagerModal(sowData);
        })
        .catch(function(error) {
            console.error('Error loading SOW:', error);
            alert(t('sow.err.load') + error.message);
        });
};

ContractFormHandler.prototype.renderPaymentManagerModal = function(sowData) {
    var self = this;

    // Remove existing modal if present
    var existingModal = document.getElementById('paymentManagerModal');
    if (existingModal) existingModal.remove();

    // Calculate payment info
    var paymentInfo = self.calculatePaymentStatus(sowData);

    // Build payment rows HTML
    var paymentRowsHtml = '';
    paymentInfo.payments.forEach(function(payment, index) {
        var statusClass = payment.paid ? 'paid' : 'pending';
        var checkedAttr = payment.paid ? 'checked' : '';

        paymentRowsHtml += '<div class="admin-payment-row ' + statusClass + '" data-index="' + index + '">' +
            '<div class="payment-row-checkbox">' +
            '<input type="checkbox" id="payment_' + index + '" ' + checkedAttr + ' class="payment-checkbox" data-index="' + index + '">' +
            '<label for="payment_' + index + '"></label>' +
            '</div>' +
            '<div class="payment-row-info">' +
            '<span class="payment-row-name">' + payment.name + '</span>' +
            '<span class="payment-row-amount">$' + payment.amount.toFixed(2) + '</span>' +
            '</div>' +
            '<div class="payment-row-meta">';

        if (payment.dueDate) {
            paymentRowsHtml += '<span class="payment-row-due">' + t('payMgr.label.due') + payment.dueDate + '</span>';
        }

        paymentRowsHtml += '<span class="payment-row-status ' + statusClass + '">' +
            (payment.paid ? '✅ ' + t('payMgr.status.paid') + (payment.paidDate ? t('payMgr.status.paidOn') + payment.paidDate : '') : '⏳ ' + t('payMgr.status.pending')) +
            '</span>' +
            '</div>' +
            '</div>';
    });

    // Progress stats
    var progressPercent = paymentInfo.totalCount > 0
        ? Math.round((paymentInfo.paidCount / paymentInfo.totalCount) * 100)
        : 0;

    var modalHtml = '<div id="paymentManagerModal" class="payment-manager-modal">' +
        '<div class="payment-manager-overlay" onclick="window.contractFormHandler.closePaymentManager()"></div>' +
        '<div class="payment-manager-content">' +
        '<div class="payment-manager-header">' +
        '<h2>💳 ' + t('payMgr.title') + '</h2>' +
        '<button class="payment-manager-close" onclick="window.contractFormHandler.closePaymentManager()">&times;</button>' +
        '</div>' +

        '<div class="payment-manager-client">' +
        '<h3>' + (sowData.clientName || t('payMgr.fallback.client')) + '</h3>' +
        '<p>' + (sowData.packageType || 'N/A') + ' • ' + t('payMgr.label.total') + ' $' + (sowData.payment ? sowData.payment.total.toFixed(2) : '0') + '</p>' +
        '</div>' +

        '<div class="payment-manager-summary">' +
        '<div class="summary-progress">' +
        '<div class="summary-progress-bar">' +
        '<div class="summary-progress-fill" style="width: ' + progressPercent + '%;"></div>' +
        '</div>' +
        '<span class="summary-progress-text">' + paymentInfo.paidCount + t('payMgr.summary.of') + paymentInfo.totalCount + t('payMgr.summary.completed') + '</span>' +
        '</div>' +
        '<div class="summary-amounts">' +
        '<div class="summary-amount paid">' +
        '<span class="amount-label">' + t('payMgr.summary.paid') + '</span>' +
        '<span class="amount-value">$' + paymentInfo.paidAmount.toFixed(2) + '</span>' +
        '</div>' +
        '<div class="summary-amount owed">' +
        '<span class="amount-label">' + t('payMgr.summary.owed') + '</span>' +
        '<span class="amount-value">$' + paymentInfo.owedAmount.toFixed(2) + '</span>' +
        '</div>' +
        '</div>' +
        '</div>' +

        '<div class="payment-manager-list">' +
        '<h4>' + t('payMgr.section.schedule') + '</h4>' +
        '<p class="payment-manager-hint">' + t('payMgr.helper.checkBox') + '</p>' +
        '<div class="payment-grid">' +
        paymentRowsHtml +
        '</div>' +
        '</div>' +

        '<div class="payment-manager-actions">' +
        '<button class="btn btn-secondary" onclick="window.contractFormHandler.closePaymentManager()">' + t('payMgr.btn.cancel') + '</button>' +
        '<button class="btn btn-primary" onclick="window.contractFormHandler.savePaymentStatus(\'' + sowData.id + '\')">' + t('payMgr.btn.save') + '</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Store current SOW data for saving
    self.currentPaymentSOW = sowData;

    // Make entire payment row clickable
    var paymentRows = document.querySelectorAll('.admin-payment-row');
    paymentRows.forEach(function(row) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function(e) {
            // Don't toggle if clicking directly on checkbox
            if (e.target.type === 'checkbox') return;
            var checkbox = row.querySelector('.payment-checkbox');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });

    // Real-time calculation updates
    var checkboxes = document.querySelectorAll('.payment-checkbox');
    checkboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            var row = checkbox.closest('.admin-payment-row');
            var index = parseInt(checkbox.dataset.index);

            // Update row styling
            if (checkbox.checked) {
                row.classList.add('paid');
                row.classList.remove('pending');
            } else {
                row.classList.remove('paid');
                row.classList.add('pending');
            }

            // Recalculate totals
            var paidAmount = 0;
            var paidCount = 0;
            var totalAmount = 0;
            var totalCount = paymentInfo.payments.length;

            paymentInfo.payments.forEach(function(payment, i) {
                var cb = document.querySelector('.payment-checkbox[data-index="' + i + '"]');
                totalAmount += payment.amount;
                if (cb && cb.checked) {
                    paidAmount += payment.amount;
                    paidCount++;
                }
            });

            var owedAmount = totalAmount - paidAmount;
            var progressPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

            // Update UI
            var paidValueEl = document.querySelector('.summary-amount.paid .amount-value');
            var owedValueEl = document.querySelector('.summary-amount.owed .amount-value');
            var progressFillEl = document.querySelector('.summary-progress-fill');
            var progressTextEl = document.querySelector('.summary-progress-text');

            if (paidValueEl) paidValueEl.textContent = '$' + paidAmount.toFixed(2);
            if (owedValueEl) owedValueEl.textContent = '$' + owedAmount.toFixed(2);
            if (progressFillEl) progressFillEl.style.width = progressPercent + '%';
            if (progressTextEl) progressTextEl.textContent = paidCount + t('dash.payment.of') + totalCount + t('dash.payment.completed');
        });
    });
};

ContractFormHandler.prototype.closePaymentManager = function() {
    var modal = document.getElementById('paymentManagerModal');
    if (modal) modal.remove();
    this.currentPaymentSOW = null;
};

ContractFormHandler.prototype.savePaymentStatus = function(sowId) {
    var self = this;
    var sowData = self.currentPaymentSOW;

    if (!sowData || !sowData.payment) {
        alert(t('sow.err.dataNotFound'));
        return;
    }

    var payment = sowData.payment;
    var tracking = payment.tracking || {};
    var isDeferred = payment.deferred && payment.deferred.enabled;

    // Get current checkbox states
    var checkboxes = document.querySelectorAll('#paymentManagerModal .payment-checkbox');
    var today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (isDeferred && payment.deferred.customSchedule && payment.deferred.customSchedule.length > 0) {
        // Update deferred payments tracking
        var deferredPayments = tracking.deferredPayments || [];

        checkboxes.forEach(function(checkbox, index) {
            var isPaid = checkbox.checked;
            var existingPayment = deferredPayments[index] || {};

            deferredPayments[index] = {
                paid: isPaid,
                paidDate: isPaid ? (existingPayment.paidDate || today) : null
            };
        });

        tracking.deferredPayments = deferredPayments;
    } else {
        // Update standard milestone tracking
        var milestoneKeys = ['deposit', 'milestone1', 'final'];

        checkboxes.forEach(function(checkbox, index) {
            var key = milestoneKeys[index];
            if (key) {
                var isPaid = checkbox.checked;
                var existingPaidDate = tracking[key + 'PaidDate'];

                tracking[key + 'Paid'] = isPaid;
                tracking[key + 'PaidDate'] = isPaid ? (existingPaidDate || today) : null;
            }
        });
    }

    // Save to Firestore
    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .update({
            'payment.tracking': tracking,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(function() {
            console.log('Payment status updated successfully');
            alert(t('dash.payment.msg.saveSuccess'));
            self.closePaymentManager();
            self.loadSOWDocuments(); // Refresh the list
        })
        .catch(function(error) {
            console.error('Error saving payment status:', error);
            alert(t('dash.payment.err.save') + error.message);
        });
};

// ============= CHANGE REQUEST FUNCTIONS =============

ContractFormHandler.prototype.showChangeRequestModal = function(sowData) {
    var self = this;

    // Store SOW data for the request
    this.currentChangeRequestSOW = sowData;

    // SOW sections that can be changed
    var sections = [
        { id: 'package', label: t('changeModal.section.packageTier'), desc: t('changeModal.section.packageTierDesc') },
        { id: 'features', label: t('changeModal.section.features'), desc: t('changeModal.section.featuresDesc') },
        { id: 'timeline', label: t('changeModal.section.timeline'), desc: t('changeModal.section.timelineDesc') },
        { id: 'payment', label: t('changeModal.section.payment'), desc: t('changeModal.section.paymentDesc') },
        { id: 'maintenance', label: t('changeModal.section.maintenance'), desc: t('changeModal.section.maintenanceDesc') },
        { id: 'other', label: t('changeModal.section.other'), desc: t('changeModal.section.otherDesc') }
    ];

    var sectionsHtml = sections.map(function(section) {
        return '<label class="change-section-option">' +
            '<input type="checkbox" name="changeSections" value="' + section.id + '" />' +
            '<div class="section-option-content">' +
            '<span class="section-option-label">' + section.label + '</span>' +
            '<span class="section-option-desc">' + section.desc + '</span>' +
            '</div>' +
            '</label>';
    }).join('');

    var modalHtml = '<div id="changeRequestModal" class="modal-overlay" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 10000; justify-content: center; align-items: center; padding: 1rem;">' +
        '<div class="modal-content change-request-modal-content" style="max-width: 720px; width: 100%; padding: 0; background: linear-gradient(165deg, rgba(30, 30, 30, 0.95) 0%, rgba(18, 18, 18, 0.98) 100%); border: 1px solid rgba(228, 216, 196, 0.15); border-radius: 20px; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(228, 216, 196, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.05); overflow: hidden;">' +
        '<div class="modal-header" style="position: relative; padding: 1rem 1.5rem; border-bottom: 1px solid rgba(228, 216, 196, 0.1); background: linear-gradient(180deg, rgba(228, 216, 196, 0.03) 0%, transparent 100%);">' +
        '<h2 style="margin: 0; font-size: 1.25rem; color: #fff; font-weight: 600; letter-spacing: -0.02em;">' + t('changeModal.title') + '</h2>' +
        '<button type="button" class="modal-close" onclick="window.contractFormHandler.closeChangeRequestModal()" style="position: absolute; top: 0.75rem; right: 1rem; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.08); width: 32px; height: 32px; border-radius: 50%; color: rgba(255,255,255,0.7); font-size: 1.25rem; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: all 0.2s ease;">×</button>' +
        '</div>' +
        '<div class="modal-body" style="color: #fff; padding: 1.25rem 1.5rem; max-height: 65vh; overflow-y: auto;">' +

        '<div class="change-request-info" style="background: linear-gradient(135deg, rgba(228, 216, 196, 0.08) 0%, rgba(228, 216, 196, 0.03) 100%); border: 1px solid rgba(228, 216, 196, 0.15); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; gap: 2rem; align-items: center;">' +
        '<p style="margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.9);"><span style="color: rgba(228, 216, 196, 0.7); font-weight: 500;">' + t('changeModal.label.sow') + '</span> <strong style="color: #E4D8C4; margin-left: 0.5rem;">' + (sowData.packageType || 'N/A') + ' Package</strong></p>' +
        '<p style="margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.9);"><span style="color: rgba(228, 216, 196, 0.7); font-weight: 500;">' + t('changeModal.label.currentTotal') + '</span> <strong style="color: #E4D8C4; margin-left: 0.5rem;">$' + (sowData.payment ? sowData.payment.total.toFixed(0) : '0') + '</strong></p>' +
        '</div>' +

        '<div class="form-group" style="margin: 0;">' +
        '<label class="form-label" style="display: block; margin-bottom: 0.6rem; font-weight: 500; font-size: 0.9rem; color: rgba(255,255,255,0.9);">' + t('changeModal.label.whichSections') + '</label>' +
        '<div class="change-sections-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">' +
        sectionsHtml +
        '</div>' +
        '</div>' +

        '<div class="form-group" style="margin: 1rem 0 0;">' +
        '<label class="form-label" style="display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 0.9rem; color: rgba(255,255,255,0.9);">' + t('changeModal.label.describeChanges') + '</label>' +
        '<textarea id="changeRequestDescription" class="form-input" rows="3" placeholder="' + t('changeModal.placeholder.describe') + '" style="width: 100%; resize: vertical; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0.75rem; color: #fff; font-size: 0.9rem; transition: all 0.2s ease; outline: none;"></textarea>' +
        '</div>' +

        '<div class="form-group" style="margin: 0.75rem 0 0;">' +
        '<label class="form-label" style="display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 0.9rem; color: rgba(255,255,255,0.9);">' + t('changeModal.label.priority') + '</label>' +
        '<select id="changeRequestPriority" class="form-input" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0.75rem; color: #fff; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; outline: none;">' +
        '<option value="normal" style="background: #1a1a1a; color: #fff;">' + t('changeModal.priority.normal') + '</option>' +
        '<option value="high" style="background: #1a1a1a; color: #fff;">' + t('changeModal.priority.high') + '</option>' +
        '<option value="urgent" style="background: #1a1a1a; color: #fff;">' + t('changeModal.priority.urgent') + '</option>' +
        '</select>' +
        '</div>' +

        '</div>' +
        '<div class="modal-footer" style="display: flex; gap: 0.75rem; justify-content: flex-end; padding: 1rem 1.5rem; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05);">' +
        '<button type="button" class="btn btn-secondary" onclick="window.contractFormHandler.closeChangeRequestModal()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); padding: 0.6rem 1.25rem; border-radius: 10px; cursor: pointer; font-weight: 500; font-size: 0.85rem; transition: all 0.2s ease;">' + t('changeModal.btn.cancel') + '</button>' +
        '<button type="button" class="btn btn-primary" onclick="window.contractFormHandler.submitChangeRequest()" style="background: linear-gradient(135deg, rgba(228, 216, 196, 0.9) 0%, rgba(228, 216, 196, 0.7) 100%); border: none; color: #121212; padding: 0.6rem 1.25rem; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s ease;">' + t('changeModal.btn.submit') + '</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    // Add modal styles if not already present
    if (!document.getElementById('changeRequestStyles')) {
        var styleEl = document.createElement('style');
        styleEl.id = 'changeRequestStyles';
        styleEl.textContent = '#changeRequestModal .modal-content { height: auto; max-height: 90vh; }' +
            '#changeRequestModal .modal-footer { margin-top: 0; }' +
            '.change-section-option { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.6rem 0.75rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer; transition: all 0.25s ease; position: relative; overflow: hidden; }' +
            '.change-section-option::before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(228, 216, 196, 0.06) 0%, transparent 100%); opacity: 0; transition: opacity 0.25s ease; border-radius: 12px; pointer-events: none; }' +
            '.change-section-option:hover { background: rgba(228, 216, 196, 0.05); border-color: rgba(228, 216, 196, 0.2); }' +
            '.change-section-option:hover::before { opacity: 1; }' +
            '.change-section-option input[type="checkbox"] { margin-top: 2px; accent-color: #E4D8C4; width: 16px; height: 16px; flex-shrink: 0; }' +
            '.change-section-option input[type="checkbox"]:checked + .section-option-content .section-option-label { color: #E4D8C4; }' +
            '.change-section-option:has(input:checked) { border-color: rgba(228, 216, 196, 0.3); background: rgba(228, 216, 196, 0.06); }' +
            '.section-option-content { display: flex; flex-direction: column; gap: 2px; }' +
            '.section-option-label { font-weight: 600; font-size: 0.85rem; color: rgba(255,255,255,0.95); transition: color 0.2s ease; }' +
            '.section-option-desc { font-size: 0.75rem; color: rgba(255,255,255,0.4); line-height: 1.3; }' +
            '.change-request-modal-content .modal-body::-webkit-scrollbar { width: 4px; }' +
            '.change-request-modal-content .modal-body::-webkit-scrollbar-track { background: transparent; }' +
            '.change-request-modal-content .modal-body::-webkit-scrollbar-thumb { background: rgba(228, 216, 196, 0.15); border-radius: 4px; }' +
            '.change-request-modal-content .modal-body::-webkit-scrollbar-thumb:hover { background: rgba(228, 216, 196, 0.3); }' +
            '.change-request-modal-content textarea:focus, .change-request-modal-content select:focus { border-color: rgba(228, 216, 196, 0.3); box-shadow: 0 0 0 3px rgba(228, 216, 196, 0.05); }' +
            '.change-request-modal-content .btn-secondary:hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.2) !important; }' +
            '.change-request-modal-content .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(228, 216, 196, 0.2); }' +
            '@media (max-width: 600px) { .change-sections-grid { grid-template-columns: 1fr !important; } .change-request-info { flex-direction: column; gap: 0.5rem !important; } }' +
            '.change-request-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }' +
            '.change-request-badge.pending { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }' +
            '.change-request-badge.approved { background: rgba(16, 185, 129, 0.2); color: #10b981; }' +
            '.change-request-badge.rejected { background: rgba(239, 68, 68, 0.2); color: #ef4444; }' +
            '.change-request-badge.change-order { background: rgba(99, 102, 241, 0.2); color: #6366f1; }' +
            '.change-request-badge.completed { background: rgba(16, 185, 129, 0.2); color: #10b981; }' +
            '.change-request-card { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 1rem; margin-top: 1rem; }' +
            '.change-request-card.approved { background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); }' +
            '.change-request-card.rejected { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }' +
            '.btn-change-request { cursor: pointer !important; pointer-events: auto !important; }' +
            '.btn-change-request:hover { background: linear-gradient(135deg, rgba(228, 216, 196, 0.3) 0%, rgba(228, 216, 196, 0.15) 100%) !important; border-color: rgba(228, 216, 196, 0.5) !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(228, 216, 196, 0.15); }';
        document.head.appendChild(styleEl);
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

ContractFormHandler.prototype.closeChangeRequestModal = function() {
    var modal = document.getElementById('changeRequestModal');
    if (modal) modal.remove();
    this.currentChangeRequestSOW = null;
};

// ============================================================
// PRICING COMPARISON MODAL
// ============================================================
ContractFormHandler.prototype.showPricingComparisonModal = function() {
    // Remove existing modal if any
    var existingModal = document.getElementById('pricingComparisonModal');
    if (existingModal) existingModal.remove();

    // Create modal overlay
    var overlay = document.createElement('div');
    overlay.id = 'pricingComparisonModal';
    overlay.className = 'pricing-comparison-modal-overlay';
    overlay.innerHTML =
        '<div class="pricing-comparison-modal">' +
            '<div class="pricing-comparison-modal-header">' +
                '<h3>2025 Web Development Pricing Guide</h3>' +
                '<button class="pricing-comparison-modal-close" id="closePricingModal">&times;</button>' +
            '</div>' +
            '<div class="pricing-comparison-modal-body">' +
                '<iframe src="/pricing/index.html" title="Industry Pricing Comparison"></iframe>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(function() {
        overlay.classList.add('active');
    });

    // Close button handler
    var closeBtn = document.getElementById('closePricingModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            overlay.classList.remove('active');
            setTimeout(function() {
                overlay.remove();
            }, 300);
        });
    }

    // Click outside to close
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            setTimeout(function() {
                overlay.remove();
            }, 300);
        }
    });

    // Escape key to close
    var escHandler = function(e) {
        if (e.key === 'Escape') {
            overlay.classList.remove('active');
            setTimeout(function() {
                overlay.remove();
            }, 300);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
};

ContractFormHandler.prototype.submitChangeRequest = function() {
    var self = this;
    var sowData = this.currentChangeRequestSOW;

    if (!sowData) {
        alert(t('sow.err.dataNotFound'));
        return;
    }

    // Get selected sections
    var selectedSections = [];
    document.querySelectorAll('input[name="changeSections"]:checked').forEach(function(checkbox) {
        selectedSections.push(checkbox.value);
    });

    if (selectedSections.length === 0) {
        alert(t('change.val.selectSection'));
        return;
    }

    var description = document.getElementById('changeRequestDescription').value.trim();
    if (!description) {
        alert(t('change.val.describeChanges'));
        return;
    }

    var priority = document.getElementById('changeRequestPriority').value;

    // Create change request object
    var changeRequest = {
        sowId: sowData.id,
        sowData: {
            clientName: sowData.clientName,
            clientEmail: sowData.clientEmail,
            clientPhone: sowData.clientPhone,
            packageType: sowData.packageType,
            payment: sowData.payment,
            estimatedWeeks: sowData.estimatedWeeks
        },
        sections: selectedSections,
        description: description,
        priority: priority,
        status: 'pending',
        clientEmail: sowData.clientEmail,
        clientPhone: sowData.clientPhone || '',
        clientName: sowData.clientName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firebase
    var changeRequestId = null;
    firebase.firestore().collection('change_requests')
        .add(changeRequest)
        .then(function(docRef) {
            console.log('Change request submitted:', docRef.id);
            changeRequestId = docRef.id;

            // Update SOW document to flag it has a pending change request
            return firebase.firestore().collection('sow_documents')
                .doc(sowData.id)
                .update({
                    hasChangeRequest: true,
                    changeRequestId: docRef.id,
                    changeRequestStatus: 'pending'
                });
        })
        .then(function() {
            // Update the button in real-time to show "View Request"
            var btn = document.getElementById('changeRequestBtn-' + sowData.id);
            if (btn) {
                btn.className = 'sow-action-btn';
                btn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.innerHTML = t('change.btn.viewRequest');
                btn.onclick = function() {
                    window.contractFormHandler.viewChangeRequest(changeRequestId);
                };
            }

            // Update the global sowData object so it reflects the change
            var sowDataKey = 'sowData_' + sowData.id.replace(/[^a-zA-Z0-9]/g, '_');
            if (window[sowDataKey]) {
                window[sowDataKey].hasChangeRequest = true;
                window[sowDataKey].changeRequestId = changeRequestId;
                window[sowDataKey].changeRequestStatus = 'pending';
            }

            self.closeChangeRequestModal();
            alert(t('change.msg.submitSuccess'));
        })
        .catch(function(error) {
            console.error('Error submitting change request:', error);
            alert(t('change.err.submit') + error.message);
        });
};

// Developer functions for handling change requests
ContractFormHandler.prototype.viewChangeRequest = function(changeRequestId) {
    var self = this;

    firebase.firestore().collection('change_requests')
        .doc(changeRequestId)
        .get()
        .then(function(doc) {
            if (!doc.exists) {
                alert(t('change.err.notFound'));
                return;
            }

            var request = doc.data();
            request.id = doc.id;

            // Fetch fresh SOW data to show current totals
            return firebase.firestore().collection('sow_documents')
                .doc(request.sowId)
                .get()
                .then(function(sowDoc) {
                    if (sowDoc.exists) {
                        request.sowData = sowDoc.data();
                        request.sowData.id = sowDoc.id;
                    }
                    self.showChangeRequestDetailModal(request);
                });
        })
        .catch(function(error) {
            console.error('Error loading change request:', error);
            alert(t('change.err.load') + error.message);
        });
};

ContractFormHandler.prototype.showChangeRequestDetailModal = function(request) {
    var self = this;

    // Store request for message sending
    this.currentChangeRequest = request;

    var sectionLabels = {
        'package': t('changeOrder.section.package'),
        'features': t('changeOrder.section.features'),
        'timeline': t('changeOrder.section.timeline'),
        'payment': t('changeOrder.section.payment'),
        'maintenance': t('changeOrder.section.maintenance'),
        'other': t('changeOrder.section.other')
    };

    var priorityStyles = {
        'normal': { bg: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', label: t('changeOrder.priority.normal') },
        'high': { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', label: t('changeOrder.priority.high') },
        'urgent': { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', label: t('changeOrder.priority.urgent') }
    };

    var statusStyles = {
        'pending': { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', label: t('changeOrder.status.pending') },
        'approved': { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', label: t('changeOrder.status.approved') },
        'rejected': { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', label: t('changeOrder.status.rejected') },
        'change_order': { bg: 'rgba(99, 102, 241, 0.2)', color: '#6366f1', label: t('changeOrder.status.change_order') },
        'completed': { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', label: t('changeOrder.status.completed') }
    };

    var sectionsHtml = request.sections.map(function(sectionId) {
        return '<span style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem;">' +
            (sectionLabels[sectionId] || sectionId) + '</span>';
    }).join(' ');

    var priorityStyle = priorityStyles[request.priority] || priorityStyles.normal;
    var statusStyle = statusStyles[request.status] || statusStyles.pending;

    var createdDate = request.createdAt ? new Date(request.createdAt.toDate()).toLocaleString() : 'N/A';

    // Build conversation thread HTML
    var conversationHtml = self.renderConversationThread(request.messages || []);

    var actionsHtml = '';
if (self.isDeveloper && request.status === 'pending') {
    actionsHtml = '<div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">' +
        '<button class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="window.contractFormHandler.approveChangeRequest(\'' + request.id + '\')">✅ Approve</button>' +
        '<button class="btn" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: rgba(239, 68, 68, 0.2); color: #ef4444;" onclick="window.contractFormHandler.rejectChangeRequest(\'' + request.id + '\')">❌ Reject</button>' +
        '<button class="btn" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: rgba(99, 102, 241, 0.2); color: #6366f1;" onclick="window.contractFormHandler.createChangeOrderFromRequest(\'' + request.id + '\')">📋 Change Order</button>' +
    '</div>';
} else if (self.isDeveloper && (request.status === 'approved' || request.status === 'change_order')) {
    actionsHtml = '<div style="display: flex; gap: 0.5rem; justify-content: center;">' +
        '<button class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="window.contractFormHandler.editSOWFromChangeRequest(\'' + request.sowId + '\')">✏️ Edit SOW</button>' +
    '</div>';
}

    var modalHtml = '<div id="changeRequestDetailModal" class="modal-overlay-fixed">' +
        '<div class="modal-content" style="max-width: 700px;">' +
        '<div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">' +
        '<h2 style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;"><img src="/images/morph-logo14.png" alt="Logo" style="height: 2rem; width: auto;"> Change Request Details</h2>' +
        '<button style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.1)\'" onclick="window.contractFormHandler.closeChangeRequestDetailModal()">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="max-height: 70vh; overflow-y: auto; padding: .8rem;">' +

        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">' +
        '<div>' +
        '<h3 style="margin: 0;">' + request.clientName + '</h3>' +
        '<p style="margin: 0.25rem 0 0; opacity: 0.7; font-size: 0.9rem;">' + request.clientEmail + '</p>' +
        '</div>' +
        '<span style="background: ' + statusStyle.bg + '; color: ' + statusStyle.color + '; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 0.85rem;">' + statusStyle.label + '</span>' +
        '</div>' +

        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">' +
        '<div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">' +
        '<p style="margin: 0; font-size: 0.8rem; opacity: 0.7;">PACKAGE</p>' +
        '<p style="margin: 0.25rem 0 0; font-weight: 600;">' + (request.sowData.packageType || 'N/A') + '</p>' +
        '</div>' +
        '<div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">' +
        '<p style="margin: 0; font-size: 0.8rem; opacity: 0.7;">CURRENT TOTAL</p>' +
        '<p style="margin: 0.25rem 0 0; font-weight: 600;">$' + (request.sowData.payment ? request.sowData.payment.total.toFixed(0) : '0') + '</p>' +
        '</div>' +
        '</div>' +

        '<div style="margin-bottom: 1.5rem;">' +
        '<p style="margin: 0 0 0.5rem; font-weight: 600;">Sections to Modify:</p>' +
        '<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">' + sectionsHtml + '</div>' +
        '</div>' +

        '<div style="margin-bottom: 1.5rem;">' +
        '<p style="margin: 0 0 0.5rem; font-weight: 600;">Description:</p>' +
        '<div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; white-space: pre-wrap;">' + request.description + '</div>' +
        '</div>' +

        '<div style="display: flex; gap: 2rem; margin-bottom: 1.5rem;">' +
        '<div>' +
        '<p style="margin: 0; font-size: 0.8rem; opacity: 0.7;">PRIORITY</p>' +
        '<span style="background: ' + priorityStyle.bg + '; color: ' + priorityStyle.color + '; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem;">' + priorityStyle.label + '</span>' +
        '</div>' +
        '<div>' +
        '<p style="margin: 0; font-size: 0.8rem; opacity: 0.7;">SUBMITTED</p>' +
        '<p style="margin: 0.25rem 0 0;">' + createdDate + '</p>' +
        '</div>' +
        '</div>' +

        // Conversation Section
        '<div class="conversation-section">' +
        '<h4>💬 Conversation</h4>' +
        '<div id="conversationThread" class="conversation-thread">' +
        conversationHtml +
        '</div>' +
        '<div class="conversation-input-wrapper">' +
        '<textarea id="conversationInput" class="conversation-input" placeholder="Type your message..." rows="1"></textarea>' +
        '<button class="conversation-send-btn" onclick="window.contractFormHandler.sendChangeRequestMessage(\'' + request.id + '\')">Send</button>' +
        '</div>' +
        '</div>' +

        '</div>' +
        '<div class="modal-footer" style="padding: 0rem; border-top: 0px solid rgba(255, 255, 255, 0);">' +
        actionsHtml +
        '</div>' +
        '</div>' +
        '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Scroll conversation to bottom
    var thread = document.getElementById('conversationThread');
    if (thread) {
        thread.scrollTop = thread.scrollHeight;
    }

    // Auto-resize textarea as user types
    var conversationInput = document.getElementById('conversationInput');
    if (conversationInput) {
        conversationInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.overflowY = 'hidden';
            if (this.scrollHeight > 150) {
                this.style.height = '150px';
                this.style.overflowY = 'auto';
            } else {
                this.style.height = this.scrollHeight + 'px';
            }
        });
    }

    // Update last viewed timestamp for current user
    self.updateChangeRequestLastViewed(request.id);

    // Set up real-time listener for conversation updates
    self.conversationUnsubscribe = firebase.firestore().collection('change_requests')
        .doc(request.id)
        .onSnapshot(function(doc) {
            if (!doc.exists) return;

            var updatedRequest = doc.data();
            var messages = updatedRequest.messages || [];

            // Update the conversation thread
            var threadEl = document.getElementById('conversationThread');
            if (threadEl) {
                threadEl.innerHTML = self.renderConversationThread(messages);
                threadEl.scrollTop = threadEl.scrollHeight;
            }

            // Update stored request with latest messages
            self.currentChangeRequest.messages = messages;
        }, function(error) {
            console.error('Error listening to conversation:', error);
        });
};

// Close change request detail modal and clean up listener
ContractFormHandler.prototype.closeChangeRequestDetailModal = function() {
    // Unsubscribe from real-time listener
    if (this.conversationUnsubscribe) {
        this.conversationUnsubscribe();
        this.conversationUnsubscribe = null;
    }

    // Clear current request
    this.currentChangeRequest = null;

    // Remove modal
    var modal = document.getElementById('changeRequestDetailModal');
    if (modal) {
        modal.remove();
    }
};

// Render conversation thread HTML
ContractFormHandler.prototype.renderConversationThread = function(messages) {
    var self = this;

    if (!messages || messages.length === 0) {
        return '<div class="conversation-empty">No messages yet. Start the conversation!</div>';
    }

    return messages.map(function(msg) {
        // Handle both Firestore timestamps and ISO strings
        var timestamp = '';
        if (msg.timestamp) {
            if (msg.timestamp.toDate) {
                timestamp = new Date(msg.timestamp.toDate()).toLocaleString();
            } else {
                timestamp = new Date(msg.timestamp).toLocaleString();
            }
        }
        // Determine if this is the current user's message (show on right) or other party's (show on left)
        var isOwnMessage = (self.isDeveloper && msg.sender === 'developer') || (!self.isDeveloper && msg.sender === 'client');
        var senderClass = isOwnMessage ? 'self' : 'other';
        return '<div class="conversation-message ' + senderClass + '">' +
            '<div class="message-sender">' + (msg.senderName || msg.sender) + '</div>' +
            '<div class="message-text">' + msg.text + '</div>' +
            '<div class="message-time">' + timestamp + '</div>' +
            '</div>';
    }).join('');
};

// Send a message in the change request conversation
ContractFormHandler.prototype.sendChangeRequestMessage = function(changeRequestId) {
    var self = this;
    var input = document.getElementById('conversationInput');
    var text = input.value.trim();

    if (!text) return;

    var senderType = self.isDeveloper ? 'developer' : 'client';
    var senderName = self.isDeveloper ? 'Carlos (Developer)' : (self.currentChangeRequest.clientName || 'Client');

    // Use ISO string for timestamp (serverTimestamp not allowed in arrayUnion)
    var newMessage = {
        sender: senderType,
        senderName: senderName,
        text: text,
        timestamp: new Date().toISOString()
    };

    // Disable send button while sending
    var sendBtn = document.querySelector('.conversation-send-btn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = t('change.btn.sending');
    }

    firebase.firestore().collection('change_requests')
        .doc(changeRequestId)
        .update({
            messages: firebase.firestore.FieldValue.arrayUnion(newMessage),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageBy: senderType
        })
        .then(function() {
            // Clear input
            input.value = '';

            // Add message to UI immediately (optimistic update)
            var thread = document.getElementById('conversationThread');
            if (thread) {
                // Remove empty state if present
                var emptyState = thread.querySelector('.conversation-empty');
                if (emptyState) {
                    emptyState.remove();
                }

                var msgHtml = '<div class="conversation-message self">' +
                    '<div class="message-sender">' + senderName + '</div>' +
                    '<div class="message-text">' + text + '</div>' +
                    '<div class="message-time">' + t('change.time.justNow') + '</div>' +
                    '</div>';
                thread.insertAdjacentHTML('beforeend', msgHtml);
                thread.scrollTop = thread.scrollHeight;
            }

            // Re-enable send button
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = t('change.btn.send');
            }
        })
        .catch(function(error) {
            console.error('Error sending message:', error);
            alert(t('change.err.sendFailed'));
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = t('change.btn.send');
            }
        });
};

// Update last viewed timestamp for tracking unread messages
ContractFormHandler.prototype.updateChangeRequestLastViewed = function(changeRequestId) {
    var self = this;
    var field = self.isDeveloper ? 'developerLastViewed' : 'clientLastViewed';

    firebase.firestore().collection('change_requests')
        .doc(changeRequestId)
        .update({
            [field]: firebase.firestore.FieldValue.serverTimestamp()
        })
        .catch(function(error) {
            console.error('Error updating last viewed:', error);
        });
};

ContractFormHandler.prototype.approveChangeRequest = function(changeRequestId) {
    var self = this;

    if (!confirm(t('change.confirm.approve'))) {
        return;
    }

    // Add a system message to the conversation (use ISO string for arrayUnion)
    var approvalMessage = {
        sender: 'developer',
        senderName: 'Carlos (Developer)',
        text: t('change.msg.approveSystem'),
        timestamp: new Date().toISOString()
    };

    firebase.firestore().collection('change_requests')
        .doc(changeRequestId)
        .update({
            status: 'approved',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            messages: firebase.firestore.FieldValue.arrayUnion(approvalMessage),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageBy: 'developer'
        })
        .then(function() {
            // Get the change request to update the SOW
            return firebase.firestore().collection('change_requests').doc(changeRequestId).get();
        })
        .then(function(doc) {
            var request = doc.data();
            // Update SOW status
            return firebase.firestore().collection('sow_documents')
                .doc(request.sowId)
                .update({
                    changeRequestStatus: 'approved'
                });
        })
        .then(function() {
            self.closeChangeRequestDetailModal();
            alert(t('change.msg.approved'));
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error approving change request:', error);
            alert(t('contract.err.prefix') + error.message);
        });
};

ContractFormHandler.prototype.rejectChangeRequest = function(changeRequestId) {
    var self = this;

    if (!confirm(t('change.confirm.reject'))) {
        return;
    }

    // Add a system message to the conversation (use ISO string for arrayUnion)
    var rejectionMessage = {
        sender: 'developer',
        senderName: 'Carlos (Developer)',
        text: t('change.msg.rejectSystem'),
        timestamp: new Date().toISOString()
    };

    firebase.firestore().collection('change_requests')
        .doc(changeRequestId)
        .update({
            status: 'rejected',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            messages: firebase.firestore.FieldValue.arrayUnion(rejectionMessage),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageBy: 'developer'
        })
        .then(function() {
            return firebase.firestore().collection('change_requests').doc(changeRequestId).get();
        })
        .then(function(doc) {
            var request = doc.data();
            return firebase.firestore().collection('sow_documents')
                .doc(request.sowId)
                .update({
                    changeRequestStatus: 'rejected',
                    hasChangeRequest: false
                });
        })
        .then(function() {
            self.closeChangeRequestDetailModal();
            alert(t('change.msg.rejected'));
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error rejecting change request:', error);
            alert(t('contract.err.prefix') + error.message);
        });
};

ContractFormHandler.prototype.createChangeOrderFromRequest = function(changeRequestId) {
    var self = this;

    firebase.firestore().collection('change_requests')
        .doc(changeRequestId)
        .get()
        .then(function(doc) {
            if (!doc.exists) {
                alert(t('change.err.notFound'));
                return;
            }

            var request = doc.data();
            request.id = doc.id;

            // Close the detail modal
            var detailModal = document.getElementById('changeRequestDetailModal');
            if (detailModal) detailModal.remove();

            // Update change request status to 'change_order'
            return firebase.firestore().collection('change_requests')
                .doc(changeRequestId)
                .update({
                    status: 'change_order',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                })
                .then(function() {
                    // Update SOW status
                    return firebase.firestore().collection('sow_documents')
                        .doc(request.sowId)
                        .update({
                            changeRequestStatus: 'change_order',
                            hasChangeOrder: true
                        });
                })
                .then(function() {
                    // Load the SOW and open editor
                    return firebase.firestore().collection('sow_documents')
                        .doc(request.sowId)
                        .get();
                })
                .then(function(sowDoc) {
                    if (sowDoc.exists) {
                        var sowData = sowDoc.data();
                        sowData.id = sowDoc.id;
                        // Store reference to change request for context
                        sowData.editingFromChangeRequest = {
                            id: changeRequestId,
                            description: request.description,
                            sections: request.sections,
                            clientName: request.clientName
                        };
                        self.editSOW(sowData);
                    } else {
                        alert(t('sow.err.notFound'));
                    }
                });
        })
        .catch(function(error) {
            console.error('Error creating change order:', error);
            alert(t('contract.err.prefix') + error.message);
        });
};

ContractFormHandler.prototype.showChangeOrderModal = function(changeRequest) {
    var self = this;

    var sectionLabels = {
        'package': t('changeOrder.section.package'),
        'features': t('changeOrder.section.features'),
        'timeline': t('changeOrder.section.timeline'),
        'payment': t('changeOrder.section.payment'),
        'maintenance': t('changeOrder.section.maintenance'),
        'other': t('changeOrder.section.other')
    };

    var sectionsText = changeRequest.sections.map(function(s) { return sectionLabels[s] || s; }).join(', ');

    var modalHtml = '<div id="changeOrderModal" class="modal-overlay-fixed">' +
        '<div class="modal-content" style="max-width: 600px;">' +
        '<div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">' +
        '<h2 style="margin: 0; font-size: 1.25rem;">' + t('changeOrder.createTitle') + '</h2>' +
        '<button style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.1)\'" onclick="document.getElementById(\'changeOrderModal\').remove()">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="padding: 1.5rem;">' +

        '<div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">' +
        '<p style="margin: 0; font-size: 0.9rem;"><strong>' + t('changeOrder.label.client') + '</strong> ' + changeRequest.clientName + '</p>' +
        '<p style="margin: 0.5rem 0 0; font-size: 0.9rem;"><strong>' + t('changeOrder.label.sections') + '</strong> ' + sectionsText + '</p>' +
        '<p style="margin: 0.5rem 0 0; font-size: 0.9rem;"><strong>' + t('changeOrder.label.request') + '</strong> ' + changeRequest.description.substring(0, 100) + (changeRequest.description.length > 100 ? '...' : '') + '</p>' +
        '</div>' +

        '<div class="form-group">' +
        '<label class="form-label">' + t('changeOrder.label.description') + '</label>' +
        '<textarea id="changeOrderDescription" class="form-input" rows="4" placeholder="' + t('changeOrder.descPlaceholder') + '" style="width: 100%; resize: vertical;">' + changeRequest.description + '</textarea>' +
        '</div>' +

        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">' +
        '<div class="form-group">' +
        '<label class="form-label">Price Adjustment ($):</label>' +
        '<input type="number" id="changeOrderPrice" class="form-input" value="0" step="50" style="width: 100%;" />' +
        '<p style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.25rem;">Use negative for discounts</p>' +
        '</div>' +
        '<div class="form-group">' +
        '<label class="form-label">Timeline Adjustment (weeks):</label>' +
        '<input type="number" id="changeOrderTimeline" class="form-input" value="0" step="1" style="width: 100%;" />' +
        '<p style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.25rem;">Use negative to reduce</p>' +
        '</div>' +
        '</div>' +

        '<div class="form-group" style="margin-top: 1rem;">' +
        '<label class="form-label">Notes for Client:</label>' +
        '<textarea id="changeOrderNotes" class="form-input" rows="2" placeholder="Any additional notes..." style="width: 100%; resize: vertical;"></textarea>' +
        '</div>' +

        '</div>' +
        '<div class="modal-footer" style="display: flex; gap: 1rem; justify-content: flex-end; padding: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'changeOrderModal\').remove()">' + t('changeOrder.btn.cancel') + '</button>' +
        '<button class="btn btn-primary" onclick="window.contractFormHandler.saveChangeOrder(\'' + changeRequest.id + '\', \'' + changeRequest.sowId + '\')">' + t('changeOrder.btn.create') + '</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

ContractFormHandler.prototype.saveChangeOrder = function(changeRequestId, sowId) {
    var self = this;

    var description = document.getElementById('changeOrderDescription').value.trim();
    var priceAdjustment = parseFloat(document.getElementById('changeOrderPrice').value) || 0;
    var timelineAdjustment = parseInt(document.getElementById('changeOrderTimeline').value) || 0;
    var notes = document.getElementById('changeOrderNotes').value.trim();

    if (!description) {
        alert(t('changeOrder.val.description'));
        return;
    }

    // Get the current SOW data
    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .get()
        .then(function(doc) {
            if (!doc.exists) {
                throw new Error('SOW not found');
            }

            var sowData = doc.data();
            var currentTotal = sowData.payment ? sowData.payment.total : 0;
            var currentTimeline = sowData.estimatedWeeks || 0;

            // Create change order document
            var changeOrder = {
                sowId: sowId,
                changeRequestId: changeRequestId,
                clientName: sowData.clientName,
                clientEmail: sowData.clientEmail,
                description: description,
                priceAdjustment: priceAdjustment,
                timelineAdjustment: timelineAdjustment,
                notes: notes,
                previousTotal: currentTotal,
                newTotal: currentTotal + priceAdjustment,
                previousTimeline: currentTimeline,
                newTimeline: currentTimeline + timelineAdjustment,
                status: 'pending_approval',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: firebase.auth().currentUser.email
            };

            return firebase.firestore().collection('change_orders').add(changeOrder);
        })
        .then(function(docRef) {
            // Update change request status
            return firebase.firestore().collection('change_requests')
                .doc(changeRequestId)
                .update({
                    status: 'change_order',
                    changeOrderId: docRef.id,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
        })
        .then(function() {
            // Update SOW with change order reference
            return firebase.firestore().collection('sow_documents')
                .doc(sowId)
                .update({
                    changeRequestStatus: 'change_order',
                    hasChangeOrder: true
                });
        })
        .then(function() {
            document.getElementById('changeOrderModal').remove();
            alert(t('changeOrder.msg.success'));
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error creating change order:', error);
            alert(t('contract.err.prefix') + error.message);
        });
};

ContractFormHandler.prototype.editSOWFromChangeRequest = function(sowId) {
    var self = this;

    // Close the modal first
    var modal = document.getElementById('changeRequestDetailModal');
    if (modal) modal.remove();

    // Load the SOW and open editor
    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .get()
        .then(function(doc) {
            if (doc.exists) {
                var sowData = doc.data();
                sowData.id = doc.id;
                self.editSOW(sowData);
            }
        })
        .catch(function(error) {
            console.error('Error loading SOW:', error);
            alert(t('sow.err.load') + error.message);
        });
};

    // ============= SOW CREATOR FUNCTIONS =============

ContractFormHandler.prototype.showSOWCreator = function() {
    var container = $('#sowCreatorContainer');
    if (!container) return;
    
    var html = '<div class="sow-creator-form">' +
        '<div class="sow-form-header">' +
        '<h4 style="display: flex; align-items: center; gap: 0.5rem;"><img src="/images/morph-logo14.png" alt="Logo" style="height: 2rem; width: auto;"> ' + t('sowCreator.title') + '</h4>' +
        '<button class="btn-close-sow">×</button>' +
        '</div>' +
        
        // Client Information
        '<div class="sow-form-section client-info-section">' +
        '<h5><span class="section-icon">👤</span> ' + t('sowCreator.section.clientInfo') + '</h5>' +

        // Searchable User Dropdown (users without SOW)
        '<div class="sow-user-search-container">' +
        '<label class="sow-search-label">' + t('sowCreator.quickSelect') + '</label>' +
        '<div class="sow-search-wrapper">' +
        '<input type="text" id="sowUserSearch" placeholder="' + t('sowCreator.searchPlaceholder') + '" class="sow-input sow-search-input" autocomplete="off" />' +
        '<div class="sow-search-icon">🔍</div>' +
        '<div id="sowUserDropdown" class="sow-user-dropdown" style="display: none;"></div>' +
        '</div>' +
        '<div class="sow-search-actions">' +
        '<p class="sow-search-hint">' + t('sowCreator.manualEntry') + '</p>' +
        '<button type="button" id="btnAddUser" class="btn-add-user">' + t('sowCreator.btn.addUser') + '</button>' +
        '</div>' +
        // Add User inline form (hidden by default)
        '<div id="addUserForm" class="add-user-form" style="display: none;">' +
        '<div class="add-user-form-inner">' +
        '<input type="text" id="addUserName" placeholder="' + t('sowCreator.label.displayName') + '" class="sow-input" />' +
        '<div class="add-user-auth-section">' +
        '<div class="add-user-auth-row">' +
        '<input type="email" id="addUserEmail" placeholder="' + t('sowCreator.label.email') + '" class="sow-input" oninput="window.toggleAuthFields()" />' +
        '<input type="password" id="addUserPassword" placeholder="' + t('sowCreator.label.password') + '" class="sow-input" style="display: none;" />' +
        '</div>' +
        '<div class="add-user-auth-divider"><span>' + t('sowCreator.label.or') + '</span></div>' +
        '<div class="add-user-auth-row">' +
        '<div class="phone-input-wrapper sow-phone-wrapper">' +
        '<select id="addUserPhoneCountryCode" class="country-code-select sow-country-code">' +
        '<option value="+1" selected>US +1</option>' +
        '<option value="+1">CA +1</option>' +
        '<option value="+44">UK +44</option>' +
        '<option value="+91">IN +91</option>' +
        '<option value="+61">AU +61</option>' +
        '<option value="+81">JP +81</option>' +
        '<option value="+49">DE +49</option>' +
        '<option value="+33">FR +33</option>' +
        '<option value="+86">CN +86</option>' +
        '<option value="+52">MX +52</option>' +
        '<option value="+55">BR +55</option>' +
        '</select>' +
        '<input type="tel" id="addUserPhone" placeholder="' + t('sowCreator.label.phone') + '" class="sow-input" oninput="window.toggleAuthFields()" />' +
        '</div>' +
        '<input type="text" id="addUserCode" placeholder="' + t('sowCreator.label.verificationCode') + '" class="sow-input" style="display: none;" maxlength="6" />' +
        '</div>' +
        '</div>' +
        '<div class="add-user-buttons">' +
        '<button type="button" id="btnSaveUser" class="btn-save-user">' + t('sowCreator.btn.saveUser') + '</button>' +
        '<button type="button" id="btnCancelAddUser" class="btn-cancel-add-user">' + t('sowCreator.btn.cancel') + '</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +

        // Combined toggles row (Email/Phone + Individual/Business)
        '<div class="toggles-row">' +
        '<div class="client-id-toggle">' +
        '<span class="toggle-label" id="emailToggleLabel">' + t('sowCreator.toggle.email') + '</span>' +
        '<label class="toggle-switch">' +
        '<input type="checkbox" id="clientIdTypeToggle" />' +
        '<span class="toggle-slider"></span>' +
        '</label>' +
        '<span class="toggle-label" id="phoneToggleLabel">' + t('sowCreator.toggle.phone') + '</span>' +
        '</div>' +
        '<div class="entity-type-toggle">' +
        '<span class="toggle-label active" id="sowIndividualLabel">' + t('sowCreator.toggle.individual') + '</span>' +
        '<label class="toggle-switch">' +
        '<input type="checkbox" id="sowEntityTypeToggle" />' +
        '<span class="toggle-slider"></span>' +
        '</label>' +
        '<span class="toggle-label" id="sowBusinessLabel">' + t('sowCreator.toggle.business') + '</span>' +
        '</div>' +
        '</div>' +

        // Individual client fields (shown by default)
        '<div id="sowIndividualFields">' +
        '<div class="sow-input-group client-inputs-row">' +
        '<input type="text" id="sowClientName" placeholder="' + t('sowCreator.label.clientName') + '" class="sow-input" required />' +
        '<div id="sowClientEmailWrapper" class="sow-input-wrapper-single">' +
        '<input type="email" id="sowClientEmail" placeholder="' + t('sowCreator.label.clientEmail') + '" class="sow-input" />' +
        '</div>' +
        '<div id="sowClientPhoneWrapper" class="phone-input-wrapper sow-phone-wrapper" style="display: none;">' +
        '<select id="sowClientPhoneCountryCode" class="country-code-select sow-country-code">' +
        '<option value="+1" selected>US +1</option>' +
        '<option value="+1">CA +1</option>' +
        '<option value="+44">UK +44</option>' +
        '<option value="+91">IN +91</option>' +
        '<option value="+61">AU +61</option>' +
        '<option value="+81">JP +81</option>' +
        '<option value="+49">DE +49</option>' +
        '<option value="+33">FR +33</option>' +
        '<option value="+86">CN +86</option>' +
        '<option value="+52">MX +52</option>' +
        '<option value="+55">BR +55</option>' +
        '</select>' +
        '<input type="tel" id="sowClientPhone" placeholder="' + t('sowCreator.label.clientPhone') + '" class="sow-input" />' +
        '</div>' +
        '</div>' +
        '</div>' +

        // Business entity fields (hidden by default)
        '<div id="sowBusinessFields" style="display: none;">' +
        '<div class="sow-input-group">' +
        '<input type="text" id="sowBusinessName" placeholder="' + t('sowCreator.label.businessName') + '" class="sow-input" />' +
        '<select id="sowEntityType" class="sow-select" style="flex: 1;">' +
        '<option value="">' + t('sowCreator.label.entityType') + '</option>' +
        '<option value="LLC">' + t('sowCreator.entity.llc') + '</option>' +
        '<option value="Corporation">' + t('sowCreator.entity.corp') + '</option>' +
        '<option value="Partnership">' + t('sowCreator.entity.partnership') + '</option>' +
        '<option value="Sole Proprietorship">' + t('sowCreator.entity.sole') + '</option>' +
        '</select>' +
        '</div>' +
        '<div class="sow-input-group">' +
        '<input type="text" id="sowStateOfFormation" placeholder="' + t('sowCreator.label.stateFormation') + '" class="sow-input" />' +
        '<div id="sowBusinessEmailWrapper" class="sow-input-wrapper-single">' +
        '<input type="email" id="sowBusinessEmail" placeholder="' + t('sowCreator.label.businessEmail') + '" class="sow-input" />' +
        '</div>' +
        '<div id="sowBusinessPhoneWrapper" class="phone-input-wrapper sow-phone-wrapper" style="display: none;">' +
        '<select id="sowBusinessPhoneCountryCode" class="country-code-select sow-country-code">' +
        '<option value="+1" selected>US +1</option>' +
        '<option value="+1">CA +1</option>' +
        '<option value="+44">UK +44</option>' +
        '<option value="+91">IN +91</option>' +
        '<option value="+61">AU +61</option>' +
        '<option value="+81">JP +81</option>' +
        '<option value="+49">DE +49</option>' +
        '<option value="+33">FR +33</option>' +
        '<option value="+86">CN +86</option>' +
        '<option value="+52">MX +52</option>' +
        '<option value="+55">BR +55</option>' +
        '</select>' +
        '<input type="tel" id="sowBusinessPhone" placeholder="' + t('sowCreator.label.businessPhone') + '" class="sow-input" />' +
        '</div>' +
        '</div>' +
        '<div class="sow-input-group">' +
        '<input type="text" id="sowRepName" placeholder="' + t('sowCreator.label.repName') + '" class="sow-input" />' +
        '<input type="text" id="sowRepTitle" placeholder="' + t('sowCreator.label.repTitle') + '" class="sow-input" />' +
        '</div>' +
        '</div>' +
        '</div>' +
        
        // Package Selection
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">📦</span> ' + t('sowCreator.section.package') + '</h5>' +
        '<select id="sowPackage" class="sow-select" onchange="setTimeout(syncDeferredWithTotal, 50)">' +
        '<option value="">' + t('sowCreator.pkg.select') + '</option>' +
        '<option value="essential">' + t('sowCreator.pkg.essential') + '</option>' +
        '<option value="starter">' + t('sowCreator.pkg.tier1') + '</option>' +
        '<option value="growth">' + t('sowCreator.pkg.tier2') + '</option>' +
        '<option value="professional">' + t('sowCreator.pkg.tier3') + '</option>' +
        '<option value="enterprise">' + t('sowCreator.pkg.tier4') + '</option>' +
        '<option value="custom">' + t('sowCreator.pkg.custom') + '</option>' +
        '</select>' +
        
        // Custom pricing (only shown if custom selected)
        '<div id="customPricingSection" style="display: none; margin-top: 15px;">' +
        '<input type="number" id="sowCustomPrice" placeholder="Enter custom total price" class="sow-input" step="0.01" min="0" oninput="setTimeout(syncDeferredWithTotal, 50)" />' +
        '</div>' +
        '</div>' +
        
        // Project Timeline
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">⏱️</span> ' + t('sowCreator.section.timeline') + '</h5>' +
        '<label class="sow-checkbox retroactive-toggle" style="margin-bottom: 10px; padding: 8px 12px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.3);">' +
        '<input type="checkbox" id="sowRetroactive" onchange="toggleRetroactiveFields()" />' +
        '<span style="color: #f59e0b; font-weight: 500;">' + t('sowCreator.timeline.retroactive') + '</span>' +
        '<span style="font-size: 0.8em; color: #888; margin-left: 8px;">' + t('sowCreator.timeline.retroactiveDesc') + '</span>' +
        '</label>' +
        '<div class="sow-input-group">' +
        '<input type="number" id="sowWeeks" placeholder="' + t('sowCreator.timeline.estWeeks') + '" class="sow-input" min="1" max="52" required />' +
        '<input type="date" id="sowStartDate" class="sow-input" title="' + t('sowCreator.timeline.targetDate') + '" />' +
        '</div>' +
        '<div id="retroactiveDurationFields" style="display: none; margin-top: 10px; padding: 10px; background: rgba(245, 158, 11, 0.05); border-radius: 6px; border: 1px dashed rgba(245, 158, 11, 0.3);">' +
        '<label style="font-size: 0.85em; color: #f59e0b; margin-bottom: 5px; display: block;">' + t('sowCreator.timeline.devDuration') + '</label>' +
        '<div class="sow-input-group">' +
        '<input type="number" id="sowDevDuration" placeholder="' + t('sowCreator.timeline.duration') + '" class="sow-input" min="1" max="52" style="flex: 1;" />' +
        '<select id="sowDevDurationUnit" class="sow-input" style="flex: 1;">' +
        '<option value="weeks">' + t('sowCreator.timeline.weeks') + '</option>' +
        '<option value="months">' + t('sowCreator.timeline.months') + '</option>' +
        '</select>' +
        '</div>' +
        '<label style="font-size: 0.85em; color: #f59e0b; margin-bottom: 5px; margin-top: 10px; display: block;">' + t('sowCreator.timeline.estFinalRevision') + '</label>' +
        '<input type="date" id="sowRetroactiveEndDate" class="sow-input" title="' + t('sowCreator.timeline.estFinalRevisionDate') + '" />' +
        '</div>' +
        '</div>' +
        
        // Features & Deliverables
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">✨</span> ' + t('sowCreator.section.features') + '</h5>' +
        '<div class="sow-checkboxes">' +

        // Standard Features
        '<div class="feature-group">' +
        '<p class="feature-group-title">' + t('sowCreator.features.standard') + '</p>' +
        '<label class="sow-checkbox"><input type="checkbox" value="responsive_design" /> ' + t('sowCreator.features.crossDevice') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="custom_ui" /> ' + t('sowCreator.features.brandDesign') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="animations" /> ' + t('sowCreator.features.scrollInteractions') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="seo_optimization" /> ' + t('sowCreator.features.seoSetup') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="analytics" /> ' + t('sowCreator.features.ga4') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="contact_forms" /> ' + t('sowCreator.features.contactForms') + '</label>' +
        '</div>' +

        // Premium Add-ons
        '<div class="feature-group">' +
        '<p class="feature-group-title">' + t('sowCreator.features.premium') + '</p>' +
        '<label class="sow-checkbox"><input type="checkbox" value="firebase_auth" /> ' + t('sowCreator.features.authSystem') + ' <span class="third-party-note">' + t('sowCreator.features.firebaseCosts') + '</span></label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="firebase_db" /> ' + t('sowCreator.features.database') + ' <span class="third-party-note">' + t('sowCreator.features.firebaseCosts') + '</span></label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="user_profiles" /> ' + t('sowCreator.features.clientPortal') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="file_storage" /> ' + t('sowCreator.features.mediaUpload') + ' <span class="third-party-note">' + t('sowCreator.features.firebaseCosts') + '</span></label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="api_integration" /> ' + t('sowCreator.features.thirdParty') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="email_integration" /> ' + t('sowCreator.features.emailNotif') + ' <span class="third-party-note">' + t('sowCreator.features.sendgridCosts') + '</span></label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="music_media" /> ' + t('sowCreator.features.audioVideo') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="booking_basic" /> ' + t('sowCreator.features.scheduling') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="newsletter" /> ' + t('sowCreator.features.newsletter') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="social_feed" /> ' + t('sowCreator.features.socialMedia') + '</label>' +
        '</div>' +

        // Enterprise Features
        '<div class="feature-group">' +
        '<p class="feature-group-title">' + t('sowCreator.features.enterprise') + '</p>' +
        '<label class="sow-checkbox"><input type="checkbox" value="user_roles" /> ' + t('sowCreator.features.rbac') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="cms_integration" /> ' + t('sowCreator.features.cms') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="booking_system" /> ' + t('sowCreator.features.advBooking') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="blog" /> ' + t('sowCreator.features.blog') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="gallery" /> ' + t('sowCreator.features.gallery') + '</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="notifications" /> ' + t('sowCreator.features.inAppNotif') + '</label>' +
        '</div>' +

        // E-Commerce Options
        '<div class="feature-group">' +
        '<p class="feature-group-title">' + t('sowCreator.features.ecommerce') + '</p>' +
        '<div class="ecommerce-radio-group">' +
        '<label class="sow-radio"><input type="radio" name="ecommerce_option" value="none" checked /> ' + t('sowCreator.features.noEcommerce') + '</label>' +
        '<label class="sow-radio"><input type="radio" name="ecommerce_option" value="basic_cart" /> ' + t('sowCreator.features.basicEcommerce') + ' <span class="third-party-note">' + t('sowCreator.features.stripeCosts') + '</span></label>' +
        '<label class="sow-radio"><input type="radio" name="ecommerce_option" value="full_store" /> ' + t('sowCreator.features.fullEcommerce') + ' <span class="third-party-note">' + t('sowCreator.features.stripeCosts') + '</span></label>' +
        '</div>' +
        '</div>' +

        '</div>' +
        '</div>' +
        
        // Additional Requirements
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">📝</span> ' + t('sowCreator.section.additionalReqs') + '</h5>' +
        '<textarea id="sowNotes" placeholder="' + t('sowCreator.additionalReqs.placeholder') + '" class="sow-textarea" rows="4"></textarea>' +
        '</div>' +
        
        // Ongoing Maintenance
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">🔧</span> ' + t('sowCreator.section.maintenance') + '</h5>' +
        '<select id="sowMaintenance" class="sow-select" required>' +
        '<option value="">' + t('sowCreator.maint.select') + '</option>' +
        '<option value="none">' + t('sowCreator.maint.none') + '</option>' +
        '<option value="basic" selected>' + t('sowCreator.maint.basic') + '</option>' +
        '<option value="professional">' + t('sowCreator.maint.professional') + '</option>' +
        '<option value="premium">' + t('sowCreator.maint.premium') + '</option>' +
        '</select>' +
        '</div>' +

        // Deferred Payment Section
        '<div class="sow-form-section" id="deferredPaymentSection">' +
        '<h5><span class="section-icon">🔄</span> ' + t('sowCreator.section.deferred') + '</h5>' +

        '<label class="sow-checkbox deferred-toggle" style="margin-bottom: 10px; padding: 8px 12px; background: rgba(99, 102, 241, 0.1); border-radius: 6px; border: 1px solid rgba(99, 102, 241, 0.3);">' +
        '<input type="checkbox" id="sowDeferredPayment" onchange="toggleDeferredPaymentFields()" />' +
        '<span style="color: #6366f1; font-weight: 500;">' + t('sowCreator.deferred.enable') + '</span>' +
        '<span style="font-size: 0.8em; color: #888; margin-left: 8px;">' + t('sowCreator.deferred.enableDesc') + '</span>' +
        '</label>' +

        '<div id="deferredPaymentFields" style="display: none; margin-top: 10px; padding: 15px; background: rgba(99, 102, 241, 0.05); border-radius: 8px; border: 1px dashed rgba(99, 102, 241, 0.3);">' +

        '<div class="deferred-split-type">' +
        '<label style="font-size: 0.9em; color: #94a3b8; margin-bottom: 8px; display: block;">' + t('sowCreator.deferred.paymentType') + '</label>' +
        '<div class="deferred-radio-group" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">' +
        '<label class="sow-radio deferred-type-card" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;">' +
        '<input type="radio" name="deferred_split" value="lump_sum" checked onchange="toggleDeferredSplitType()" style="display: none;" />' +
        '<span style="font-size: 1.5em;">💵</span>' +
        '<span style="font-weight: 500; font-size: 0.85em;">' + t('sowCreator.deferred.lumpSum') + '</span>' +
        '<span style="font-size: 0.7em; color: #94a3b8; text-align: center;">' + t('sowCreator.deferred.lumpSumDesc') + '</span>' +
        '</label>' +
        '<label class="sow-radio deferred-type-card" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;">' +
        '<input type="radio" name="deferred_split" value="recurring" onchange="toggleDeferredSplitType()" style="display: none;" />' +
        '<span style="font-size: 1.5em;">📅</span>' +
        '<span style="font-weight: 500; font-size: 0.85em;">' + t('sowCreator.deferred.paymentPlan') + '</span>' +
        '<span style="font-size: 0.7em; color: #94a3b8; text-align: center;">' + t('sowCreator.deferred.paymentPlanDesc') + '</span>' +
        '</label>' +
        '<label class="sow-radio deferred-type-card" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;">' +
        '<input type="radio" name="deferred_split" value="custom" onchange="toggleDeferredSplitType()" style="display: none;" />' +
        '<span style="font-size: 1.5em;">✏️</span>' +
        '<span style="font-weight: 500; font-size: 0.85em;">' + t('sowCreator.deferred.custom') + '</span>' +
        '<span style="font-size: 0.7em; color: #94a3b8; text-align: center;">' + t('sowCreator.deferred.customDesc') + '</span>' +
        '</label>' +
        '</div>' +
        '</div>' +

        '<div id="lumpSumFields" style="margin-top: 15px;">' +
        '<div class="sow-input-group" style="display: flex; gap: 10px;">' +
        '<div style="flex: 1;">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.amountToDefer') + '</label>' +
        '<input type="number" id="sowDeferredAmount" placeholder="' + t('sowCreator.deferred.amountLabel') + '" class="sow-input" min="0" step="0.01" onchange="calculateLateFee()" oninput="calculateLateFee()" />' +
        '</div>' +
        '<div style="flex: 1;">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.dueDate') + '</label>' +
        '<input type="date" id="sowDeferredDueDate" class="sow-input" />' +
        '</div>' +
        '</div>' +
        '</div>' +

        '<div id="recurringFields" style="display: none; margin-top: 15px;">' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">' +
        '<div>' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.totalAmount') + '</label>' +
        '<input type="number" id="sowRecurringTotalAmount" placeholder="' + t('sowCreator.deferred.totalLabel') + '" class="sow-input" min="0" step="0.01" onchange="updateRecurringSchedule()" oninput="updateRecurringSchedule()" />' +
        '</div>' +
        '<div>' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.firstPayment') + '</label>' +
        '<input type="date" id="sowRecurringStartDate" class="sow-input" onchange="updateRecurringSchedule()" />' +
        '</div>' +
        '</div>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">' +
        '<div>' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.frequency') + '</label>' +
        '<select id="sowRecurringFrequency" class="sow-select" onchange="updateRecurringSchedule()" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff;">' +
        '<option value="weekly">' + t('sowCreator.deferred.weekly') + '</option>' +
        '<option value="biweekly" selected>' + t('sowCreator.deferred.biweekly') + '</option>' +
        '<option value="semimonthly">' + t('sowCreator.deferred.semimonthly') + '</option>' +
        '<option value="monthly">' + t('sowCreator.deferred.monthly') + '</option>' +
        '<option value="bimonthly">' + t('sowCreator.deferred.bimonthly') + '</option>' +
        '</select>' +
        '</div>' +
        '<div>' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.calculateBy') + '</label>' +
        '<select id="sowRecurringCalcMode" class="sow-select" onchange="toggleRecurringCalcMode(); updateRecurringSchedule();" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff;">' +
        '<option value="amount">' + t('sowCreator.deferred.fixedAmount') + '</option>' +
        '<option value="count">' + t('sowCreator.deferred.numPayments') + '</option>' +
        '</select>' +
        '</div>' +
        '</div>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">' +
        '<div id="recurringAmountField">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.amountPerPayment') + '</label>' +
        '<input type="number" id="sowRecurringPaymentAmount" placeholder="' + t('sowCreator.deferred.amountPerPaymentPlaceholder') + '" class="sow-input" min="1" step="0.01" onchange="updateRecurringSchedule()" oninput="updateRecurringSchedule()" />' +
        '</div>' +
        '<div id="recurringCountField" style="display: none;">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.numPayments') + '</label>' +
        '<input type="number" id="sowRecurringPaymentCount" placeholder="' + t('sowCreator.deferred.numPaymentsPlaceholder') + '" class="sow-input" min="2" max="52" onchange="updateRecurringSchedule()" oninput="updateRecurringSchedule()" />' +
        '</div>' +
        '<div id="recurringCalcResult" style="display: flex; align-items: flex-end;">' +
        '<div style="padding: 10px 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; width: 100%;">' +
        '<span style="font-size: 0.75em; color: #10b981; display: block;">' + t('sowCreator.deferred.calculated') + '</span>' +
        '<span id="recurringCalcDisplay" style="font-size: 1.1em; font-weight: 600; color: #10b981;">--</span>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div id="recurringSchedulePreview" style="display: none; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 12px; max-height: 200px; overflow-y: auto;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">' +
        '<span style="font-size: 0.85em; font-weight: 500; color: #6366f1;">' + t('sowCreator.deferred.schedulePreview') + '</span>' +
        '<span id="recurringScheduleSummary" style="font-size: 0.75em; color: #94a3b8;"></span>' +
        '</div>' +
        '<div id="recurringScheduleList" style="display: grid; gap: 6px;"></div>' +
        '</div>' +
        '</div>' +

        '<div id="customSplitFields" style="display: none; margin-top: 15px;">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">' + t('sowCreator.deferred.customSchedule') + '</label>' +
        '<div id="customPaymentsList" class="custom-payments-list"></div>' +
        '<button type="button" class="btn-add-payment" onclick="addCustomPaymentRow()" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 8px 16px; background: rgba(99, 102, 241, 0.15); border: 1px dashed rgba(99, 102, 241, 0.4); border-radius: 6px; color: #818cf8; cursor: pointer; font-size: 0.9em;">' +
        '<span>' + t('sowCreator.deferred.addPayment') + '</span>' +
        '</button>' +
        '</div>' +

        '<div class="late-fee-section" style="margin-top: 15px; padding: 12px; background: rgba(245, 158, 11, 0.08); border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.2);">' +
        '<div style="display: flex; justify-content: space-between; align-items: center;">' +
        '<div>' +
        '<span style="color: #f59e0b; font-weight: 500;">' + t('sowCreator.deferred.lateFee') + '</span>' +
        '<span id="lateFeeDisplay" style="color: #fff; margin-left: 8px;">$0</span>' +
        '<span style="font-size: 0.75em; color: #94a3b8; margin-left: 6px;">' + t('sowCreator.deferred.lateFeeDesc') + '</span>' +
        '</div>' +
        '<label class="sow-checkbox" style="margin: 0; display: flex; align-items: center; gap: 6px;">' +
        '<input type="checkbox" id="sowWaiveLateFee" onchange="calculateLateFee()" />' +
        '<span style="font-size: 0.85em; color: #f59e0b;">' + t('sowCreator.deferred.waiveLateFee') + '</span>' +
        '</label>' +
        '</div>' +
        '<div style="margin-top: 8px;">' +
        '<span style="color: #94a3b8; font-size: 0.85em;">' + t('sowCreator.deferred.totalDeferred') + '</span>' +
        '<span id="totalDeferredDisplay" style="color: #10b981; font-weight: 600; margin-left: 8px;">$0</span>' +
        '</div>' +
        '</div>' +

        '<div class="deferred-options" style="margin-top: 15px;">' +
        '<label class="sow-checkbox" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">' +
        '<input type="checkbox" id="sowAllowPartialPayments" checked />' +
        '<span>' + t('sowCreator.deferred.allowPartial') + '</span>' +
        '</label>' +
        '<label class="sow-checkbox" style="display: flex; align-items: center; gap: 8px;">' +
        '<input type="checkbox" id="sowMaintenanceDuringDeferral" checked />' +
        '<span>' + t('sowCreator.deferred.maintDuringDeferral') + '</span>' +
        '</label>' +
        '</div>' +

        '</div>' +
        '</div>' +

        // Coupon / Discount Code
        '<div class="sow-form-section coupon-section">' +
        '<h5><span class="section-icon">🎟️</span> ' + t('sowCreator.section.discount') + '</h5>' +
        '<div class="coupon-input-group">' +
        '<select id="sowCouponSelect" class="sow-select coupon-select" onchange="setTimeout(syncDeferredWithTotal, 50)">' +
        '<option value="">' + t('sowCreator.discount.noDiscount') + '</option>' +
        '</select>' +
        '<div id="couponValidationMessage" class="coupon-validation-message"></div>' +
        '</div>' +
        '</div>' +

        // Pricing Summary
        '<div class="sow-form-section pricing-summary">' +
        '<h5><span class="section-icon">💰</span> ' + t('sowCreator.section.pricing') + '</h5>' +

        // Itemized breakdown
        '<div class="pricing-itemized-container">' +
        '<div id="pricingItemizedList" class="pricing-itemized-list">' +
        '</div>' +
        '</div>' +

        '<div class="pricing-breakdown">' +
        '<div class="pricing-divider"></div>' +
        '<div class="pricing-row total-row">' +
        '<span><strong>' + t('sowCreator.pricing.projectTotal') + '</strong></span>' +
        '<span id="sowTotalPrice" class="price-value total-value">$0.00</span>' +
        '</div>' +
        '<div class="pricing-row deposit-row">' +
        '<span>' + t('sowCreator.pricing.deposit') + '</span>' +
        '<span id="sowDepositCalc" class="price-value">$0.00</span>' +
        '</div>' +
        '<div class="pricing-row">' +
        '<span>' + t('sowCreator.pricing.milestone') + '</span>' +
        '<span id="sowMilestone1Calc" class="price-value">$0.00</span>' +
        '</div>' +
        '<div class="pricing-row">' +
        '<span>' + t('sowCreator.pricing.finalPayment') + '</span>' +
        '<span id="sowFinalCalc" class="price-value">$0.00</span>' +
        '</div>' +
        '<div class="pricing-divider"></div>' +
        '<div class="pricing-row maintenance-row" id="maintenanceRow">' +
        '<span>' + t('sowCreator.pricing.monthlyMaint') + '</span>' +
        '<span id="sowMaintenanceCalc" class="price-value">$167/month</span>' +
        '</div>' +
        '</div>' +
        '</div>' +

        // Action Buttons
        '<div class="sow-form-actions">' +
        '<button class="btn-cancel-sow btn-secondary">' + t('sowCreator.btn.cancelSow') + '</button>' +
        '<button class="btn-save-sow btn-primary"><span class="btn-icon">💾</span> ' + t('sowCreator.btn.saveSow') + '</button>' +
        '<button class="btn-generate-sow-pdf btn-primary"><span class="btn-icon">📄</span> ' + t('sowCreator.btn.generatePdf') + '</button>' +
        '</div>' +
        
        '</div>';
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    var self = this;
    
    // Package pricing map (2025 Scarlo Pricing Guide - Revised)
    var packagePricing = {
        'essential': { min: 1000, max: 3000, default: 2000 },
        'starter': { min: 3000, max: 6000, default: 4500 },
        'growth': { min: 6000, max: 12000, default: 9000 },
        'professional': { min: 12000, max: 25000, default: 18500 },
        'enterprise': { min: 25000, max: 50000, default: 37500 }
    };

    var maintenancePricing = {
        'none': 0,
        'basic': 167,      // $110-$225/mo avg
        'professional': 335, // $220-$450/mo avg
        'premium': 670      // $440-$900/mo avg
    };

    // Feature pricing based on complexity (Fresno, CA market rates)
    var featurePricing = {
        // Standard Features (included in tiers)
        'responsive_design': { default: 200, thirdParty: false },
        'custom_ui': { default: 450, thirdParty: false },
        'animations': { default: 275, thirdParty: false },
        'seo_optimization': { default: 200, thirdParty: false },
        'analytics': { default: 175, thirdParty: false },
        'contact_forms': { default: 250, thirdParty: false },
        // Backend Features (included in higher tiers)
        'firebase_auth': { default: 350, thirdParty: true, note: 'Firebase costs' },
        'firebase_db': { default: 425, thirdParty: true, note: 'Firebase costs' },
        'user_profiles': { default: 550, thirdParty: false },
        'file_storage': { default: 300, thirdParty: true, note: 'Firebase costs' },
        'api_integration': { default: 450, thirdParty: false },
        'email_integration': { default: 325, thirdParty: true, note: 'SendGrid costs' },
        'newsletter': { default: 200, thirdParty: false, addon: true },
        'user_roles': { default: 450, thirdParty: false },
        'notifications': { default: 400, thirdParty: false },
        // Add-on Features (available to any tier)
        'booking_basic': { default: 450, thirdParty: false, addon: true },
        'booking_system': { default: 1100, thirdParty: false, addon: true },
        'blog': { default: 400, thirdParty: false, addon: true },
        'cms_integration': { default: 600, thirdParty: false, addon: true },
        'gallery': { default: 325, thirdParty: false, addon: true },
        'music_media': { default: 275, thirdParty: false, addon: true },
        'social_feed': { default: 250, thirdParty: false, addon: true }
    };

    // E-Commerce radio options (2025 Scarlo Pricing Guide)
    var ecommercePricing = {
        'none': { price: 0, label: t('ecommerce.none') },
        'basic_cart': { price: 5500, label: t('ecommerce.basicCart'), thirdParty: true, note: 'Stripe fees' },  // $3,000-$8,000
        'full_store': { price: 14000, label: t('ecommerce.fullStore'), thirdParty: true, note: 'Stripe fees' }    // $8,000-$20,000
    };

    // Package-feature mapping (what's included in each package)
    // Note: hosting, ssl, domain are now included free in all packages (not listed as features)
    // Add-ons (booking, blog, cms, gallery, music, social_feed, newsletter) available separately for any tier
    var packageIncludedFeatures = {
        'essential': ['responsive_design', 'contact_forms'],
        'starter': ['responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'contact_forms'],
        'growth': ['responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'firebase_auth', 'contact_forms'],
        'professional': ['responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'firebase_auth', 'firebase_db', 'user_profiles', 'file_storage', 'api_integration', 'contact_forms', 'email_integration', 'newsletter'],
        'enterprise': ['responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'firebase_auth', 'firebase_db', 'user_profiles', 'user_roles', 'file_storage', 'api_integration', 'contact_forms', 'email_integration', 'notifications', 'newsletter'],
        'custom': []
    };

    // Helper to update pricing with all required data
    var updatePricing = function() {
        self.updateSOWPricing(packagePricing, maintenancePricing, featurePricing, ecommercePricing, packageIncludedFeatures);
    };

    // Update pricing when package changes
    var packageSelect = $('#sowPackage');
    var customPricingSection = $('#customPricingSection');
    var customPriceInput = $('#sowCustomPrice');

    if (packageSelect) {
        packageSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                customPricingSection.style.display = 'block';
                // Clear all feature checkboxes for custom
                self.autoCheckPackageFeatures('custom', packageIncludedFeatures);
            } else {
                customPricingSection.style.display = 'none';
                // Auto-check features included in selected package
                self.autoCheckPackageFeatures(this.value, packageIncludedFeatures);
            }
            updatePricing();
        });
    }

    // Update pricing when custom price changes
    if (customPriceInput) {
        customPriceInput.addEventListener('input', function() {
            updatePricing();
        });
    }

    // Update maintenance pricing
    var maintenanceSelect = $('#sowMaintenance');
    if (maintenanceSelect) {
        maintenanceSelect.addEventListener('change', function() {
            updatePricing();
        });
    }

    // Update pricing when feature checkboxes change
    var featureCheckboxes = document.querySelectorAll('.sow-checkboxes input[type="checkbox"]');
    featureCheckboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            updatePricing();
        });
    });

    // Update pricing when e-commerce radio changes
    var ecommerceRadios = document.querySelectorAll('input[name="ecommerce_option"]');
    ecommerceRadios.forEach(function(radio) {
        radio.addEventListener('change', function() {
            updatePricing();
        });
    });

    // Toggle retroactive project duration fields
    window.toggleRetroactiveFields = function() {
        var checkbox = $('#sowRetroactive');
        var durationFields = $('#retroactiveDurationFields');
        var weeksInput = $('#sowWeeks');
        var standardInputGroup = weeksInput ? weeksInput.parentElement : null;

        if (checkbox && checkbox.checked) {
            // Retroactive: hide standard weeks/date, show development duration
            if (durationFields) durationFields.style.display = 'block';
            if (standardInputGroup) standardInputGroup.style.display = 'none';
        } else {
            // Standard: show weeks/date, hide development duration
            if (durationFields) durationFields.style.display = 'none';
            if (standardInputGroup) standardInputGroup.style.display = 'flex';
        }

        // For retroactive projects, hide deposit/milestone breakdown and show only total + maintenance
        var depositRow = document.querySelector('.deposit-row');
        var milestoneRow = $('#sowMilestone1Calc');
        var finalRow = $('#sowFinalCalc');

        if (checkbox && checkbox.checked) {
            // Hide deposit, milestone, and final payment rows
            if (depositRow) depositRow.style.display = 'none';
            if (milestoneRow && milestoneRow.parentElement) milestoneRow.parentElement.style.display = 'none';
            if (finalRow && finalRow.parentElement) finalRow.parentElement.style.display = 'none';
        } else {
            // Show all payment rows
            if (depositRow) depositRow.style.display = 'flex';
            if (milestoneRow && milestoneRow.parentElement) milestoneRow.parentElement.style.display = 'flex';
            if (finalRow && finalRow.parentElement) finalRow.parentElement.style.display = 'flex';
        }
    };

    // Toggle deferred payment fields visibility
    window.toggleDeferredPaymentFields = function() {
        var checkbox = $('#sowDeferredPayment');
        var fieldsContainer = $('#deferredPaymentFields');

        if (checkbox && checkbox.checked) {
            if (fieldsContainer) fieldsContainer.style.display = 'block';
            // Auto-populate deferred amount with total price if empty
            var totalPriceEl = $('#sowTotalPrice');
            if (totalPriceEl) {
                var totalAmount = parseFloat(totalPriceEl.textContent.replace(/[^0-9.-]/g, '')) || 0;
                var deferredAmountInput = $('#sowDeferredAmount');
                var recurringTotalInput = $('#sowRecurringTotalAmount');
                if (deferredAmountInput && !deferredAmountInput.value) {
                    deferredAmountInput.value = totalAmount;
                }
                if (recurringTotalInput && !recurringTotalInput.value) {
                    recurringTotalInput.value = totalAmount;
                }
            }
            // Initialize card styling
            var cards = document.querySelectorAll('.deferred-type-card');
            cards.forEach(function(card) {
                var radio = card.querySelector('input[type="radio"]');
                if (radio && radio.checked) {
                    card.style.borderColor = '#6366f1';
                    card.style.background = 'rgba(99, 102, 241, 0.15)';
                } else {
                    card.style.borderColor = 'transparent';
                    card.style.background = 'rgba(255, 255, 255, 0.03)';
                }
            });
            calculateLateFee();
        } else {
            if (fieldsContainer) fieldsContainer.style.display = 'none';
        }
    };

    // Toggle between lump sum, recurring, and custom split
    window.toggleDeferredSplitType = function() {
        var splitType = document.querySelector('input[name="deferred_split"]:checked');
        var lumpSumFields = $('#lumpSumFields');
        var recurringFields = $('#recurringFields');
        var customSplitFields = $('#customSplitFields');

        // Update card styling
        var cards = document.querySelectorAll('.deferred-type-card');
        cards.forEach(function(card) {
            var radio = card.querySelector('input[type="radio"]');
            if (radio && radio.checked) {
                card.style.borderColor = '#6366f1';
                card.style.background = 'rgba(99, 102, 241, 0.15)';
            } else {
                card.style.borderColor = 'transparent';
                card.style.background = 'rgba(255, 255, 255, 0.03)';
            }
        });

        // Hide all field sections first
        if (lumpSumFields) lumpSumFields.style.display = 'none';
        if (recurringFields) recurringFields.style.display = 'none';
        if (customSplitFields) customSplitFields.style.display = 'none';

        if (splitType) {
            if (splitType.value === 'lump_sum') {
                if (lumpSumFields) lumpSumFields.style.display = 'block';
            } else if (splitType.value === 'recurring') {
                if (recurringFields) recurringFields.style.display = 'block';
                // Auto-populate total amount if empty
                var totalPriceEl = $('#sowTotalPrice');
                var recurringTotalInput = $('#sowRecurringTotalAmount');
                if (totalPriceEl && recurringTotalInput && !recurringTotalInput.value) {
                    var totalAmount = parseFloat(totalPriceEl.textContent.replace(/[^0-9.-]/g, '')) || 0;
                    recurringTotalInput.value = totalAmount;
                }
                updateRecurringSchedule();
            } else if (splitType.value === 'custom') {
                if (customSplitFields) customSplitFields.style.display = 'block';
                // Initialize with one payment row if empty
                var list = $('#customPaymentsList');
                if (list && list.children.length === 0) {
                    addCustomPaymentRow();
                }
            }
        }
        calculateLateFee();
    };

    // Toggle recurring calculation mode (by amount vs by count)
    window.toggleRecurringCalcMode = function() {
        var calcMode = $('#sowRecurringCalcMode');
        var amountField = $('#recurringAmountField');
        var countField = $('#recurringCountField');

        if (calcMode && calcMode.value === 'count') {
            if (amountField) amountField.style.display = 'none';
            if (countField) countField.style.display = 'block';
        } else {
            if (amountField) amountField.style.display = 'block';
            if (countField) countField.style.display = 'none';
        }
    };

    // Generate recurring payment schedule
    window.generateRecurringSchedule = function(totalAmount, startDate, frequency, calcMode, amountOrCount) {
        var schedule = [];
        if (!totalAmount || totalAmount <= 0 || !startDate) return schedule;

        var currentDate = new Date(startDate);
        var remaining = totalAmount;
        var paymentAmount, numPayments;

        if (calcMode === 'amount') {
            paymentAmount = parseFloat(amountOrCount) || 0;
            if (paymentAmount <= 0) return schedule;
            numPayments = Math.ceil(totalAmount / paymentAmount);
        } else {
            numPayments = parseInt(amountOrCount) || 0;
            if (numPayments <= 0) return schedule;
            paymentAmount = Math.ceil(totalAmount / numPayments);
        }

        // Limit to reasonable number of payments
        if (numPayments > 52) numPayments = 52;

        for (var i = 0; i < numPayments; i++) {
            var thisPayment = Math.min(paymentAmount, remaining);
            if (thisPayment <= 0) break;

            schedule.push({
                amount: thisPayment,
                dueDate: currentDate.toISOString().split('T')[0]
            });

            remaining -= thisPayment;

            // Calculate next date based on frequency
            switch (frequency) {
                case 'weekly':
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'biweekly':
                    currentDate.setDate(currentDate.getDate() + 14);
                    break;
                case 'semimonthly':
                    // 1st and 15th of each month
                    if (currentDate.getDate() < 15) {
                        currentDate.setDate(15);
                    } else {
                        currentDate.setMonth(currentDate.getMonth() + 1);
                        currentDate.setDate(1);
                    }
                    break;
                case 'monthly':
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    break;
                case 'bimonthly':
                    currentDate.setMonth(currentDate.getMonth() + 2);
                    break;
                default:
                    currentDate.setDate(currentDate.getDate() + 14);
            }
        }

        return schedule;
    };

    // Update recurring schedule preview
    window.updateRecurringSchedule = function() {
        var totalAmount = parseFloat($('#sowRecurringTotalAmount') ? $('#sowRecurringTotalAmount').value : 0) || 0;
        var startDate = $('#sowRecurringStartDate') ? $('#sowRecurringStartDate').value : null;
        var frequency = $('#sowRecurringFrequency') ? $('#sowRecurringFrequency').value : 'biweekly';
        var calcMode = $('#sowRecurringCalcMode') ? $('#sowRecurringCalcMode').value : 'amount';
        var amountOrCount = calcMode === 'amount'
            ? ($('#sowRecurringPaymentAmount') ? $('#sowRecurringPaymentAmount').value : 0)
            : ($('#sowRecurringPaymentCount') ? $('#sowRecurringPaymentCount').value : 0);

        var calcDisplay = $('#recurringCalcDisplay');
        var previewContainer = $('#recurringSchedulePreview');
        var scheduleList = $('#recurringScheduleList');
        var scheduleSummary = $('#recurringScheduleSummary');

        // Validate inputs
        if (!totalAmount || !startDate || !amountOrCount) {
            if (calcDisplay) calcDisplay.textContent = '--';
            if (previewContainer) previewContainer.style.display = 'none';
            calculateLateFee();
            return;
        }

        var schedule = generateRecurringSchedule(totalAmount, startDate, frequency, calcMode, amountOrCount);

        if (schedule.length === 0) {
            if (calcDisplay) calcDisplay.textContent = '--';
            if (previewContainer) previewContainer.style.display = 'none';
            calculateLateFee();
            return;
        }

        // Update calculated display
        if (calcMode === 'amount') {
            if (calcDisplay) calcDisplay.textContent = schedule.length + ' payments';
        } else {
            var perPayment = schedule.length > 0 ? schedule[0].amount : 0;
            if (calcDisplay) calcDisplay.textContent = '$' + perPayment.toLocaleString() + '/payment';
        }

        // Frequency labels
        var freqLabels = {
            'weekly': 'Weekly',
            'biweekly': 'Bi-Weekly',
            'semimonthly': 'Semi-Monthly',
            'monthly': 'Monthly',
            'bimonthly': 'Bi-Monthly'
        };

        // Update summary
        if (scheduleSummary) {
            var lastDate = schedule[schedule.length - 1].dueDate;
            scheduleSummary.textContent = freqLabels[frequency] + ' • Final payment: ' + new Date(lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        // Show preview
        if (previewContainer) previewContainer.style.display = 'block';

        // Build schedule list
        if (scheduleList) {
            var html = '';
            schedule.forEach(function(payment, index) {
                var formattedDate = new Date(payment.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: 4px;">' +
                    '<span style="font-size: 0.8em; color: #94a3b8;">#' + (index + 1) + '</span>' +
                    '<span style="font-size: 0.85em; color: #e2e8f0;">' + formattedDate + '</span>' +
                    '<span style="font-size: 0.9em; font-weight: 600; color: #10b981;">$' + payment.amount.toLocaleString() + '</span>' +
                    '</div>';
            });
            scheduleList.innerHTML = html;
        }

        calculateLateFee();
    };

    // Sync deferred amount with current total price (for lump sum and recurring modes)
    window.syncDeferredWithTotal = function() {
        var deferredCheckbox = $('#sowDeferredPayment');
        var deferredFieldsContainer = $('#deferredPaymentFields');
        var isDeferredEnabled = (deferredCheckbox && deferredCheckbox.checked) ||
                                (deferredFieldsContainer && deferredFieldsContainer.style.display === 'block');

        if (!isDeferredEnabled) return;

        // Only sync for lump sum and recurring modes, not custom split
        var splitType = document.querySelector('input[name="deferred_split"]:checked');
        if (splitType && splitType.value === 'custom') return;

        // Get current total from the pricing display
        var totalPriceEl = $('#sowTotalPrice');
        if (totalPriceEl) {
            var totalPrice = parseFloat(totalPriceEl.textContent.replace(/[^0-9.-]/g, '')) || 0;

            if (splitType && splitType.value === 'recurring') {
                var recurringTotalInput = $('#sowRecurringTotalAmount');
                if (recurringTotalInput && totalPrice > 0) {
                    recurringTotalInput.value = totalPrice;
                    updateRecurringSchedule();
                }
            } else {
                var deferredAmountInput = $('#sowDeferredAmount');
                if (deferredAmountInput && totalPrice > 0) {
                    deferredAmountInput.value = totalPrice;
                    calculateLateFee();
                }
            }
        }
    };

    // Set up MutationObserver to watch for total price changes
    var setupTotalPriceObserver = function() {
        var totalPriceEl = $('#sowTotalPrice');
        if (!totalPriceEl) return;

        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    syncDeferredWithTotal();
                }
            });
        });

        observer.observe(totalPriceEl, {
            childList: true,
            characterData: true,
            subtree: true
        });
    };

    // Initialize observer when SOW form is ready
    setTimeout(setupTotalPriceObserver, 500);

    // Calculate and display late fee (applied only if payment is late)
    window.calculateLateFee = function() {
        var splitType = document.querySelector('input[name="deferred_split"]:checked');
        var waiveCheckbox = $('#sowWaiveLateFee');
        var feeWaived = waiveCheckbox && waiveCheckbox.checked;

        var deferredAmount = 0;

        if (splitType && splitType.value === 'custom') {
            // Sum all custom payment amounts
            var customInputs = document.querySelectorAll('.custom-payment-amount');
            customInputs.forEach(function(input) {
                deferredAmount += parseFloat(input.value) || 0;
            });
        } else if (splitType && splitType.value === 'recurring') {
            // Get recurring total amount
            var recurringTotalInput = $('#sowRecurringTotalAmount');
            deferredAmount = parseFloat(recurringTotalInput ? recurringTotalInput.value : 0) || 0;
        } else {
            var amountInput = $('#sowDeferredAmount');
            deferredAmount = parseFloat(amountInput ? amountInput.value : 0) || 0;
        }

        var lateFee = feeWaived ? 0 : (deferredAmount * 0.10);

        var feeDisplay = $('#lateFeeDisplay');
        var totalDisplay = $('#totalDeferredDisplay');

        if (feeDisplay) {
            feeDisplay.textContent = '$' + lateFee.toFixed(0);
            feeDisplay.style.textDecoration = feeWaived ? 'line-through' : 'none';
        }
        if (totalDisplay) {
            totalDisplay.textContent = '$' + deferredAmount.toFixed(0);
        }
    };

    // Add custom payment row
    window.addCustomPaymentRow = function() {
        var list = $('#customPaymentsList');
        if (!list) return;

        var row = document.createElement('div');
        row.className = 'custom-payment-row';
        row.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
        row.innerHTML =
            '<input type="number" class="sow-input custom-payment-amount" placeholder="Amount $" style="flex: 1;" onchange="calculateLateFee()" oninput="calculateLateFee()" />' +
            '<input type="date" class="sow-input custom-payment-date" style="flex: 1;" />' +
            '<button type="button" onclick="removeCustomPaymentRow(this)" style="padding: 8px 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; color: #ef4444; cursor: pointer; font-size: 1em;">✕</button>';
        list.appendChild(row);
    };

    // Remove custom payment row
    window.removeCustomPaymentRow = function(button) {
        var row = button.parentElement;
        row.remove();
        calculateLateFee();
    };

    // Populate coupon dropdown with available coupons
    var couponSelect = $('#sowCouponSelect');
    if (couponSelect && self.coupons) {
        var activeCoupons = self.coupons.filter(function(c) {
            var isExpired = c.expirationDate && new Date(c.expirationDate) < new Date();
            var isUsedUp = c.usageLimit && c.usageCount >= c.usageLimit;
            return c.active !== false && !isExpired && !isUsedUp;
        });

        activeCoupons.forEach(function(coupon) {
            var discountText = coupon.discountType === 'percentage'
                ? coupon.discountValue + '% off'
                : '$' + (coupon.discountValue || 0).toFixed(0) + ' off';
            var option = document.createElement('option');
            option.value = coupon.code;
            option.textContent = coupon.code + ' — ' + discountText;
            if (coupon.description) {
                option.textContent += ' (' + coupon.description + ')';
            }
            couponSelect.appendChild(option);
        });

        // Coupon selection change handler
        couponSelect.addEventListener('change', function() {
            updatePricing();
        });
    }

    // Auto-sync weeks and date fields
    var weeksInput = $('#sowWeeks');
    var dateInput = $('#sowStartDate');

    // When weeks changes, update the date (today + weeks)
    if (weeksInput) {
        weeksInput.addEventListener('input', function() {
            var weeks = parseInt(this.value);
            if (weeks && weeks > 0 && dateInput) {
                var endDate = new Date();
                endDate.setDate(endDate.getDate() + (weeks * 7));
                dateInput.value = endDate.toISOString().split('T')[0];
            }
        });
    }

    // When date changes, update the weeks (date - today)
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            var selectedDate = new Date(this.value);
            var today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate && selectedDate > today && weeksInput) {
                var diffTime = selectedDate - today;
                var diffDays = diffTime / (1000 * 60 * 60 * 24);
                var weeks = Math.round(diffDays / 7);
                weeksInput.value = Math.max(1, Math.min(52, weeks));
            }
        });
    }

    // Close button
    var closeBtn = $('.btn-close-sow');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            container.style.display = 'none';
        });
    }
    
    // Cancel button
    var cancelBtn = $('.btn-cancel-sow');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            container.style.display = 'none';
        });
    }

    // Client ID type toggle (Email/Phone)
    var clientIdToggle = $('#clientIdTypeToggle');
    var emailInput = $('#sowClientEmail');
    var phoneInput = $('#sowClientPhone');
    var emailWrapper = $('#sowClientEmailWrapper');
    var phoneWrapper = $('#sowClientPhoneWrapper');
    var emailLabel = $('#emailToggleLabel');
    var phoneLabel = $('#phoneToggleLabel');

    if (clientIdToggle) {
        clientIdToggle.addEventListener('change', function() {
            if (this.checked) {
                // Phone mode
                if (emailWrapper) emailWrapper.style.display = 'none';
                if (emailInput) emailInput.value = '';
                if (phoneWrapper) phoneWrapper.style.display = 'flex';
                emailLabel.classList.remove('active');
                phoneLabel.classList.add('active');
            } else {
                // Email mode
                if (phoneWrapper) phoneWrapper.style.display = 'none';
                if (phoneInput) phoneInput.value = '';
                if (emailWrapper) emailWrapper.style.display = 'block';
                phoneLabel.classList.remove('active');
                emailLabel.classList.add('active');
            }
        });
        // Set initial state
        emailLabel.classList.add('active');
    }

    // Entity Type toggle (Individual/Business)
    var entityTypeToggle = $('#sowEntityTypeToggle');
    var individualFields = $('#sowIndividualFields');
    var businessFields = $('#sowBusinessFields');
    var individualLabel = $('#sowIndividualLabel');
    var businessLabel = $('#sowBusinessLabel');
    var businessEmailInput = $('#sowBusinessEmail');
    var businessPhoneInput = $('#sowBusinessPhone');
    var businessEmailWrapper = $('#sowBusinessEmailWrapper');
    var businessPhoneWrapper = $('#sowBusinessPhoneWrapper');

    if (entityTypeToggle) {
        entityTypeToggle.addEventListener('change', function() {
            if (this.checked) {
                // Business Entity mode
                if (individualFields) individualFields.style.display = 'none';
                if (businessFields) businessFields.style.display = 'block';
                if (individualLabel) individualLabel.classList.remove('active');
                if (businessLabel) businessLabel.classList.add('active');
                // Sync email/phone visibility for business fields based on clientIdToggle
                if (clientIdToggle && clientIdToggle.checked) {
                    if (businessEmailWrapper) businessEmailWrapper.style.display = 'none';
                    if (businessPhoneWrapper) businessPhoneWrapper.style.display = 'flex';
                } else {
                    if (businessEmailWrapper) businessEmailWrapper.style.display = 'block';
                    if (businessPhoneWrapper) businessPhoneWrapper.style.display = 'none';
                }
            } else {
                // Individual mode
                if (businessFields) businessFields.style.display = 'none';
                if (individualFields) individualFields.style.display = 'block';
                if (businessLabel) businessLabel.classList.remove('active');
                if (individualLabel) individualLabel.classList.add('active');
            }
        });
        // Set initial state
        if (individualLabel) individualLabel.classList.add('active');
    }

    // Update Email/Phone toggle to also sync business entity fields
    if (clientIdToggle) {
        clientIdToggle.addEventListener('change', function() {
            // Also sync business entity email/phone fields if visible
            if (entityTypeToggle && entityTypeToggle.checked) {
                if (this.checked) {
                    // Phone mode for business
                    if (businessEmailWrapper) businessEmailWrapper.style.display = 'none';
                    if (businessEmailInput) businessEmailInput.value = '';
                    if (businessPhoneWrapper) businessPhoneWrapper.style.display = 'flex';
                } else {
                    // Email mode for business
                    if (businessPhoneWrapper) businessPhoneWrapper.style.display = 'none';
                    if (businessPhoneInput) businessPhoneInput.value = '';
                    if (businessEmailWrapper) businessEmailWrapper.style.display = 'block';
                }
            }
        });
    }

    // Format phone number for business phone as user types
    if (businessPhoneInput) {
        businessPhoneInput.setAttribute('maxlength', '17');
        businessPhoneInput.addEventListener('input', function() {
            var formatted = formatPhoneNumber(this.value);
            if (formatted !== this.value) {
                this.value = formatted;
            }
        });
    }

    // Format phone number as user types
    if (phoneInput) {
        phoneInput.setAttribute('maxlength', '17'); // +1 (xxx) xxx-xxxx = 17 chars
        phoneInput.addEventListener('input', function() {
            var formatted = formatPhoneNumber(this.value);
            if (formatted !== this.value) {
                this.value = formatted;
            }
        });
    }

    // ============================================
    // SEARCHABLE USER DROPDOWN LOGIC
    // ============================================

    var userSearchInput = $('#sowUserSearch');
    var userDropdown = $('#sowUserDropdown');
    var usersWithoutSOW = []; // Cache for fetched users
    var unsubscribeUsers = null; // Realtime listener cleanup
    var unsubscribeSows = null;  // Realtime listener cleanup
    var cachedUsersSnapshot = null; // Cache for recalculation
    var cachedSowsSnapshot = null;  // Cache for recalculation

    // Subscribe to users without SOW in realtime (using Firestore onSnapshot)
    var subscribeToUsersWithoutSOW = function() {
        console.log('🔄 Starting realtime subscription for users without SOW...');

        // Show loading state
        if (userSearchInput) {
            userSearchInput.placeholder = t('dash.search.loading');
            userSearchInput.disabled = true;
        }

        // Process users without SOW when either collection updates
        var processUsersWithoutSOW = function() {
            if (!cachedUsersSnapshot || !cachedSowsSnapshot) return;

            // Build sets of emails and phones that have SOWs
            var sowEmails = new Set();
            var sowPhones = new Set();

            cachedSowsSnapshot.forEach(function(doc) {
                var data = doc.data();
                if (data.clientEmail) {
                    sowEmails.add(data.clientEmail.toLowerCase().trim());
                }
                if (data.clientPhone) {
                    sowPhones.add(normalizeToE164(data.clientPhone));
                }
            });

            // Filter users who don't have a SOW
            usersWithoutSOW = [];
            cachedUsersSnapshot.forEach(function(doc) {
                var user = doc.data();
                var userEmail = user.email ? user.email.toLowerCase().trim() : null;
                var userPhone = user.phoneNumber ? normalizeToE164(user.phoneNumber) : null;

                // Check if user has a SOW (by email OR phone)
                var hasSOWByEmail = userEmail && sowEmails.has(userEmail);
                var hasSOWByPhone = userPhone && sowPhones.has(userPhone);

                if (!hasSOWByEmail && !hasSOWByPhone) {
                    usersWithoutSOW.push({
                        uid: user.uid,
                        email: user.email || null,
                        phoneNumber: user.phoneNumber || null,
                        displayName: user.displayName || null
                    });
                }
            });

            if (userSearchInput) {
                userSearchInput.placeholder = t('dash.search.placeholder');
                userSearchInput.disabled = false;
            }
            console.log('Realtime: Loaded ' + usersWithoutSOW.length + ' users without SOW');

            // Refresh dropdown if visible
            if (userDropdown && userDropdown.style.display === 'block') {
                filterUsers(userSearchInput ? userSearchInput.value : '');
            }
        };

        // Subscribe to users collection
        console.log('📡 Subscribing to users collection...');
        unsubscribeUsers = firebase.firestore().collection('users')
            .onSnapshot(function(snapshot) {
                console.log('👥 Users snapshot received:', snapshot.size, 'users');
                cachedUsersSnapshot = snapshot;
                processUsersWithoutSOW();
            }, function(error) {
                console.error('❌ Error listening to users:', error);
                if (userSearchInput) {
                    userSearchInput.placeholder = t('dash.search.unavailable');
                    userSearchInput.disabled = false;
                }
            });

        // Subscribe to sow_documents collection
        console.log('📡 Subscribing to sow_documents collection...');
        unsubscribeSows = firebase.firestore().collection('sow_documents')
            .onSnapshot(function(snapshot) {
                console.log('📄 SOW documents snapshot received:', snapshot.size, 'documents');
                cachedSowsSnapshot = snapshot;
                processUsersWithoutSOW();
            }, function(error) {
                console.error('❌ Error listening to SOWs:', error);
            });
    };

    // Cleanup function to unsubscribe from realtime listeners
    var unsubscribeFromUsers = function() {
        if (unsubscribeUsers) {
            unsubscribeUsers();
            unsubscribeUsers = null;
        }
        if (unsubscribeSows) {
            unsubscribeSows();
            unsubscribeSows = null;
        }
        cachedUsersSnapshot = null;
        cachedSowsSnapshot = null;
    };

    // Toggle password/code fields based on email/phone input
    var toggleAuthFields = function() {
        var emailInput = $('#addUserEmail');
        var passwordInput = $('#addUserPassword');
        var phoneInput = $('#addUserPhone');
        var codeInput = $('#addUserCode');
        var countryCodeSelect = $('#addUserPhoneCountryCode');

        if (emailInput && passwordInput) {
            var hasEmail = emailInput.value && emailInput.value.trim().length > 0;
            passwordInput.style.display = hasEmail ? 'block' : 'none';
            if (hasEmail) {
                passwordInput.required = true;
            } else {
                passwordInput.required = false;
                passwordInput.value = '';
            }
        }

        if (phoneInput && codeInput) {
            var countryCode = countryCodeSelect ? countryCodeSelect.value : '+1';
            var config = countryCodeConfig[countryCode] || countryCodeConfig['+1'];
            var digitCount = phoneInput.value.replace(/\D/g, '').length;
            var hasPhone = phoneInput.value && digitCount >= config.maxDigits;
            codeInput.style.display = hasPhone ? 'block' : 'none';
            if (hasPhone) {
                codeInput.required = true;
            } else {
                codeInput.required = false;
                codeInput.value = '';
            }
        }
    };

    // Expose toggleAuthFields globally for oninput handlers
    window.toggleAuthFields = toggleAuthFields;

    // Function to add a user via Cloud Function (creates Firebase Auth user)
    var addUserToFirestore = function(displayName, email, password, phone, verificationCode) {
        // Validate - need at least email+password OR phone+code
        var hasEmail = email && email.trim();
        var hasPhone = phone && phone.trim();

        if (!hasEmail && !hasPhone) {
            alert(t('dash.user.val.emailOrPhone'));
            return Promise.reject('No email or phone provided');
        }

        if (hasEmail && (!password || password.length < 6)) {
            alert(t('dash.user.val.passwordLength'));
            return Promise.reject('Password too short');
        }

        if (hasPhone && (!verificationCode || !/^\d{4,6}$/.test(verificationCode))) {
            alert(t('dash.user.val.codeFormat'));
            return Promise.reject('Invalid verification code');
        }

        console.log('Adding user via Cloud Function...');

        var addAuthUser = firebase.functions().httpsCallable('addAuthUser');

        return addAuthUser({
            displayName: displayName ? displayName.trim() : null,
            email: hasEmail ? email.trim() : null,
            password: hasEmail ? password : null,
            phoneNumber: hasPhone ? phone.trim() : null,
            verificationCode: hasPhone ? verificationCode : null
        })
        .then(function(result) {
            console.log('User added successfully:', result.data);
            return result.data;
        })
        .catch(function(error) {
            console.error('Error adding user:', error);
            throw error;
        });
    };

    // Expose cleanup function globally for modal close
    window.unsubscribeFromUsers = unsubscribeFromUsers;

    // Filter and display matching users (show all if no search term)
    var filterUsers = function(searchTerm) {
        var matches;

        if (!searchTerm || searchTerm.length === 0) {
            // Show all users when no search term
            matches = usersWithoutSOW;
        } else {
            // Filter by search term
            var term = searchTerm.toLowerCase();
            matches = usersWithoutSOW.filter(function(user) {
                var nameMatch = user.displayName && user.displayName.toLowerCase().includes(term);
                var emailMatch = user.email && user.email.toLowerCase().includes(term);
                var phoneMatch = user.phoneNumber && user.phoneNumber.includes(term);
                return nameMatch || emailMatch || phoneMatch;
            });
        }

        if (matches.length === 0) {
            userDropdown.innerHTML = '<div class="sow-dropdown-empty">' + t('sowCreator.noUsersFound') + '</div>';
            userDropdown.style.display = 'block';
            return;
        }

        var html = matches.slice(0, 10).map(function(user) {
            var displayText = user.displayName || 'Unknown';
            var subText = user.email || (user.phoneNumber ? formatPhoneNumber(user.phoneNumber) : '') || '';
            var hasEmail = !!user.email;
            var hasPhone = !!user.phoneNumber;

            return '<div class="sow-dropdown-item" ' +
                   'data-email="' + (user.email || '') + '" ' +
                   'data-phone="' + (user.phoneNumber || '') + '" ' +
                   'data-name="' + (user.displayName || '') + '">' +
                   '<span class="sow-dropdown-name">' + displayText + '</span>' +
                   '<span class="sow-dropdown-contact">' + subText + '</span>' +
                   '<span class="sow-dropdown-badges">' +
                   (hasEmail ? '<span class="badge-email">' + t('sowCreator.badge.email') + '</span>' : '') +
                   (hasPhone ? '<span class="badge-phone">' + t('sowCreator.badge.phone') + '</span>' : '') +
                   '</span>' +
                   '</div>';
        }).join('');

        userDropdown.innerHTML = html;
        userDropdown.style.display = 'block';
    };

    // Handle user selection
    var selectUser = function(item) {
        var email = item.getAttribute('data-email');
        var phone = item.getAttribute('data-phone');
        var name = item.getAttribute('data-name');

        // Fill in Client Name if available
        var clientNameInput = $('#sowClientName');
        if (clientNameInput && name) {
            clientNameInput.value = name;
        }

        // Decide whether to use email or phone
        // Priority: email if available, otherwise phone
        if (email) {
            // Set to email mode
            clientIdToggle.checked = false;
            if (emailWrapper) emailWrapper.style.display = 'block';
            if (phoneWrapper) phoneWrapper.style.display = 'none';
            if (emailInput) emailInput.value = email;
            if (phoneInput) phoneInput.value = '';
            emailLabel.classList.add('active');
            phoneLabel.classList.remove('active');
        } else if (phone) {
            // Set to phone mode
            clientIdToggle.checked = true;
            if (phoneWrapper) phoneWrapper.style.display = 'flex';
            if (emailWrapper) emailWrapper.style.display = 'none';
            if (phoneInput) {
                var countryCode = $('#sowClientPhoneCountryCode') ? $('#sowClientPhoneCountryCode').value : '+1';
                phoneInput.value = formatPhoneNumber(phone, countryCode);
            }
            if (emailInput) emailInput.value = '';
            phoneLabel.classList.add('active');
            emailLabel.classList.remove('active');
        }

        // Clear search and hide dropdown
        userSearchInput.value = '';
        userDropdown.style.display = 'none';
    };

    // Event listeners for search
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function() {
            filterUsers(this.value);
        });

        userSearchInput.addEventListener('focus', function() {
            // Show all users when focused (or filter if there's text)
            filterUsers(this.value);
        });
    }

    // Event delegation for dropdown clicks
    if (userDropdown) {
        userDropdown.addEventListener('click', function(e) {
            var item = e.target.closest('.sow-dropdown-item');
            if (item) {
                selectUser(item);
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (userDropdown && !e.target.closest('.sow-search-wrapper')) {
            userDropdown.style.display = 'none';
        }
    });

    // Fetch users when form opens
    subscribeToUsersWithoutSOW();

    // Add User button handlers
    var btnAddUser = $('#btnAddUser');
    var addUserForm = $('#addUserForm');
    var btnSaveUser = $('#btnSaveUser');
    var btnCancelAddUser = $('#btnCancelAddUser');
    var addUserName = $('#addUserName');
    var addUserEmail = $('#addUserEmail');
    var addUserPassword = $('#addUserPassword');
    var addUserPhone = $('#addUserPhone');
    var addUserCode = $('#addUserCode');

    if (btnAddUser) {
        btnAddUser.addEventListener('click', function() {
            addUserForm.style.display = 'block';
            btnAddUser.style.display = 'none';
            addUserEmail.focus();
        });
    }

    if (btnCancelAddUser) {
        btnCancelAddUser.addEventListener('click', function() {
            addUserForm.style.display = 'none';
            btnAddUser.style.display = 'inline-block';
            // Clear form
            addUserName.value = '';
            addUserEmail.value = '';
            addUserPassword.value = '';
            addUserPhone.value = '';
            addUserCode.value = '';
            // Reset field visibility
            addUserPassword.style.display = 'none';
            addUserCode.style.display = 'none';
        });
    }

    if (btnSaveUser) {
        btnSaveUser.addEventListener('click', function() {
            var name = addUserName.value.trim();
            var email = addUserEmail.value.trim();
            var password = addUserPassword.value;
            var phone = addUserPhone.value.trim();
            var verificationCode = addUserCode.value.trim();

            // Disable button while saving
            btnSaveUser.disabled = true;
            btnSaveUser.textContent = t('dash.user.btn.saving');

            addUserToFirestore(name, email, password, phone, verificationCode)
                .then(function(userData) {
                    // Clear and hide form
                    addUserName.value = '';
                    addUserEmail.value = '';
                    addUserPassword.value = '';
                    addUserPhone.value = '';
                    addUserCode.value = '';
                    addUserPassword.style.display = 'none';
                    addUserCode.style.display = 'none';
                    addUserForm.style.display = 'none';
                    btnAddUser.style.display = 'inline-block';

                    // Reset button
                    btnSaveUser.disabled = false;
                    btnSaveUser.textContent = t('dash.user.btn.save');

                    // The realtime listener will automatically update the dropdown
                    alert(t('dash.user.msg.success'));
                })
                .catch(function(error) {
                    // Reset button
                    btnSaveUser.disabled = false;
                    btnSaveUser.textContent = t('dash.user.btn.save');

                    if (error !== 'No email or phone provided' && error !== 'Password too short' && error !== 'Invalid verification code') {
                        alert(t('dash.user.err.add') + (error.message || error));
                    }
                });
        });
    }

    // Format phone number in add user form
    var addUserPhoneCountryCode = $('#addUserPhoneCountryCode');
    if (addUserPhone) {
        var formatAddUserPhone = function() {
            var countryCode = addUserPhoneCountryCode ? addUserPhoneCountryCode.value : '+1';
            var formatted = formatPhoneNumber(addUserPhone.value, countryCode);
            if (formatted !== addUserPhone.value) {
                addUserPhone.value = formatted;
            }
        };

        addUserPhone.addEventListener('input', formatAddUserPhone);

        if (addUserPhoneCountryCode) {
            addUserPhoneCountryCode.addEventListener('change', formatAddUserPhone);
        }
    }

    // Format client phone number
    var sowClientPhone = $('#sowClientPhone');
    var sowClientPhoneCountryCode = $('#sowClientPhoneCountryCode');
    if (sowClientPhone) {
        var formatClientPhone = function() {
            var countryCode = sowClientPhoneCountryCode ? sowClientPhoneCountryCode.value : '+1';
            var formatted = formatPhoneNumber(sowClientPhone.value, countryCode);
            if (formatted !== sowClientPhone.value) {
                sowClientPhone.value = formatted;
            }
        };

        sowClientPhone.addEventListener('input', formatClientPhone);

        if (sowClientPhoneCountryCode) {
            sowClientPhoneCountryCode.addEventListener('change', formatClientPhone);
        }
    }

    // Format business phone number
    var sowBusinessPhone = $('#sowBusinessPhone');
    var sowBusinessPhoneCountryCode = $('#sowBusinessPhoneCountryCode');
    if (sowBusinessPhone) {
        var formatBusinessPhone = function() {
            var countryCode = sowBusinessPhoneCountryCode ? sowBusinessPhoneCountryCode.value : '+1';
            var formatted = formatPhoneNumber(sowBusinessPhone.value, countryCode);
            if (formatted !== sowBusinessPhone.value) {
                sowBusinessPhone.value = formatted;
            }
        };

        sowBusinessPhone.addEventListener('input', formatBusinessPhone);

        if (sowBusinessPhoneCountryCode) {
            sowBusinessPhoneCountryCode.addEventListener('change', formatBusinessPhone);
        }
    }

    // Save button
    var saveBtn = $('.btn-save-sow');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            self.saveSOW();
        });
    }
    
    // Generate PDF button
    var pdfBtn = $('.btn-generate-sow-pdf');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', function() {
            self.generateSOWPDF();
        });
    }

    // Prefill SOW form from URL parameters
    prefillSOWFromURL();
};

// Prefill SOW form from URL parameters
// Usage: scarlo.dev/sow?business=BusinessName&phone=5551234567&email=test@email.com&package=essential&features=responsive_design,analytics,firebase_auth&ecommerce=basic_cart&maintenance=basic
function prefillSOWFromURL() {
    var params = new URLSearchParams(window.location.search);

    var business = params.get('business');
    var phone = params.get('phone');
    var email = params.get('email');
    var pkg = params.get('package');
    var features = params.get('features');
    var ecommerce = params.get('ecommerce');
    var maintenance = params.get('maintenance');

    // Validate against allowed values
    var validPackages = ['essential', 'starter', 'growth', 'professional', 'enterprise', 'custom'];
    var validFeatures = [
        // Standard Features
        'responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'contact_forms',
        // Premium Add-ons
        'firebase_auth', 'firebase_db', 'user_profiles', 'file_storage', 'api_integration',
        'email_integration', 'music_media', 'booking_basic', 'newsletter', 'social_feed',
        // Enterprise Features
        'user_roles', 'cms_integration', 'booking_system', 'blog', 'gallery', 'notifications'
    ];
    var validEcommerce = ['none', 'basic_cart', 'full_store'];
    var validMaintenance = ['none', 'basic', 'professional', 'premium'];

    if (business) {
        var businessNameField = document.getElementById('sowBusinessName');
        var clientNameField = document.getElementById('sowClientName');
        if (businessNameField) businessNameField.value = business;
        if (clientNameField) clientNameField.value = business;
    }
    if (phone) {
        var clientPhoneField = document.getElementById('sowClientPhone');
        var businessPhoneField = document.getElementById('sowBusinessPhone');
        var addUserPhoneField = document.getElementById('addUserPhone');
        if (clientPhoneField) clientPhoneField.value = phone;
        if (businessPhoneField) businessPhoneField.value = phone;
        if (addUserPhoneField) addUserPhoneField.value = phone;
    }
    if (email) {
        var clientEmailField = document.getElementById('sowClientEmail');
        var businessEmailField = document.getElementById('sowBusinessEmail');
        var addUserEmailField = document.getElementById('addUserEmail');
        if (clientEmailField) clientEmailField.value = email;
        if (businessEmailField) businessEmailField.value = email;
        if (addUserEmailField) addUserEmailField.value = email;
    }

    // Show Add User form if email or phone is provided
    if (email || phone) {
        var addUserForm = document.getElementById('addUserForm');
        if (addUserForm) addUserForm.style.display = 'block';

        // Set client ID toggle to correct mode (email vs phone)
        var clientIdToggle = document.getElementById('clientIdTypeToggle');
        var sowClientEmailWrapper = document.getElementById('sowClientEmailWrapper');
        var sowClientPhoneWrapper = document.getElementById('sowClientPhoneWrapper');
        var emailLabel = document.getElementById('emailToggleLabel');
        var phoneLabel = document.getElementById('phoneToggleLabel');

        if (phone && !email) {
            // Phone mode
            if (clientIdToggle) clientIdToggle.checked = true;
            if (sowClientEmailWrapper) sowClientEmailWrapper.style.display = 'none';
            if (sowClientPhoneWrapper) sowClientPhoneWrapper.style.display = 'flex';
            if (emailLabel) emailLabel.classList.remove('active');
            if (phoneLabel) phoneLabel.classList.add('active');
        } else if (email) {
            // Email mode (default)
            if (clientIdToggle) clientIdToggle.checked = false;
            if (sowClientPhoneWrapper) sowClientPhoneWrapper.style.display = 'none';
            if (sowClientEmailWrapper) sowClientEmailWrapper.style.display = 'block';
            if (phoneLabel) phoneLabel.classList.remove('active');
            if (emailLabel) emailLabel.classList.add('active');
        }
    }

    if (pkg && validPackages.indexOf(pkg) !== -1) {
        var packageSelect = document.getElementById('sowPackage');
        if (packageSelect) {
            packageSelect.value = pkg;
            // Trigger change event to update pricing
            var event = new Event('change', { bubbles: true });
            packageSelect.dispatchEvent(event);
        }
    }

    // Check feature checkboxes from comma-separated list
    if (features) {
        var featureList = features.split(',').map(function(f) { return f.trim().toLowerCase(); });
        featureList.forEach(function(featureValue) {
            if (validFeatures.indexOf(featureValue) !== -1) {
                var checkbox = document.querySelector('.sow-checkboxes input[type="checkbox"][value="' + featureValue + '"]');
                if (checkbox) {
                    checkbox.checked = true;
                    // Trigger change event for pricing update
                    var event = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(event);
                }
            }
        });
    }

    // Set e-commerce option (radio button)
    if (ecommerce && validEcommerce.indexOf(ecommerce) !== -1) {
        var ecommerceRadio = document.querySelector('input[name="ecommerce_option"][value="' + ecommerce + '"]');
        if (ecommerceRadio) {
            ecommerceRadio.checked = true;
            var event = new Event('change', { bubbles: true });
            ecommerceRadio.dispatchEvent(event);
        }
    }

    // Set maintenance plan
    if (maintenance && validMaintenance.indexOf(maintenance) !== -1) {
        var maintenanceSelect = document.getElementById('sowMaintenance');
        if (maintenanceSelect) {
            maintenanceSelect.value = maintenance;
            var event = new Event('change', { bubbles: true });
            maintenanceSelect.dispatchEvent(event);
        }
    }
}

// Auto-open SOW creator if URL has SOW parameters
function checkSOWURLParams() {
    var params = new URLSearchParams(window.location.search);
    var hasSOWParams = params.has('business') || params.has('phone') || params.has('email') || params.has('package');

    if (hasSOWParams && window.contractFormHandler && typeof window.contractFormHandler.showSOWCreator === 'function') {
        // Switch to SOW tab first
        if (typeof window.contractFormHandler.switchTab === 'function') {
            window.contractFormHandler.switchTab('sow');
        }
        // Small delay to ensure tab is visible before opening creator
        setTimeout(function() {
            window.contractFormHandler.showSOWCreator();
        }, 100);
    }
}

// Feature-based pricing calculation
ContractFormHandler.prototype.calculateFeatureBasedPricing = function(packagePricing, featurePricing, ecommercePricing, packageIncludedFeatures) {
    var packageSelect = $('#sowPackage');
    var customPriceInput = $('#sowCustomPrice');
    var packageType = packageSelect ? packageSelect.value : '';

    var result = {
        basePrice: 0,
        packageType: packageType,
        addOns: [],
        discounts: [],
        ecommerceOption: 'none',
        ecommercePrice: 0,
        total: 0
    };

    if (!packageType) return result;

    // Get base package price
    if (packageType === 'custom') {
        result.basePrice = parseFloat(customPriceInput.value) || 0;
    } else if (packagePricing[packageType]) {
        result.basePrice = packagePricing[packageType].default;
    }

    var includedFeatures = packageIncludedFeatures[packageType] || [];

    // Check each feature checkbox
    var checkboxes = document.querySelectorAll('.sow-checkboxes input[type="checkbox"]');
    checkboxes.forEach(function(checkbox) {
        var featureKey = checkbox.value;
        var isChecked = checkbox.checked;
        var isIncluded = includedFeatures.indexOf(featureKey) !== -1;
        var pricing = featurePricing[featureKey];

        if (!pricing) return;

        // Get feature label text
        var labelText = checkbox.parentElement.textContent.trim();
        // Remove third-party note from label
        var thirdPartyNote = checkbox.parentElement.querySelector('.third-party-note');
        if (thirdPartyNote) {
            labelText = labelText.replace(thirdPartyNote.textContent, '').trim();
        }

        if (isChecked && !isIncluded) {
            // Add-on: checked but not included in package
            // For custom quotes: list feature but with $0 price (custom price already includes everything)
            result.addOns.push({
                key: featureKey,
                label: labelText,
                price: packageType === 'custom' ? 0 : pricing.default,
                thirdParty: pricing.thirdParty,
                note: pricing.note || ''
            });
        } else if (!isChecked && isIncluded && packageType !== 'custom') {
            // Discount: unchecked but included in package (50% refund)
            result.discounts.push({
                key: featureKey,
                label: labelText,
                price: Math.round(pricing.default * 0.5)
            });
        }
    });

    // E-Commerce radio selection
    var ecommerceRadio = document.querySelector('input[name="ecommerce_option"]:checked');
    if (ecommerceRadio) {
        result.ecommerceOption = ecommerceRadio.value;
        if (ecommercePricing[result.ecommerceOption]) {
            result.ecommercePrice = ecommercePricing[result.ecommerceOption].price;
            if (result.ecommercePrice > 0) {
                // For custom quotes: list e-commerce but with $0 price (custom price already includes everything)
                result.addOns.push({
                    key: 'ecommerce_' + result.ecommerceOption,
                    label: ecommercePricing[result.ecommerceOption].label,
                    price: packageType === 'custom' ? 0 : result.ecommercePrice,
                    thirdParty: ecommercePricing[result.ecommerceOption].thirdParty,
                    note: ecommercePricing[result.ecommerceOption].note || ''
                });
            }
        }
    }

    // Calculate total
    var addOnTotal = result.addOns.reduce(function(sum, item) { return sum + item.price; }, 0);
    var discountTotal = result.discounts.reduce(function(sum, item) { return sum + item.price; }, 0);

    result.total = Math.max(0, result.basePrice + addOnTotal - discountTotal);

    return result;
};

// Render itemized pricing breakdown
ContractFormHandler.prototype.renderItemizedPricing = function(pricingData, packagePricing, packageIncludedFeatures) {
    var container = document.getElementById('pricingItemizedList');
    if (!container) {
        console.warn('pricingItemizedList container not found');
        return;
    }

    // Feature display labels for nice formatting (translated)
    var featureLabels = {
        'responsive_design': t('feature.responsive_design'),
        'custom_ui': t('feature.custom_ui'),
        'animations': t('feature.animations'),
        'seo_optimization': t('feature.seo_optimization'),
        'analytics': t('feature.analytics'),
        'contact_forms': t('feature.contact_forms'),
        'firebase_auth': t('feature.firebase_auth'),
        'firebase_db': t('feature.firebase_db'),
        'user_profiles': t('feature.user_profiles'),
        'file_storage': t('feature.file_storage'),
        'api_integration': t('feature.api_integration'),
        'email_integration': t('feature.email_integration'),
        'newsletter': t('feature.newsletter'),
        'user_roles': t('feature.user_roles'),
        'notifications': t('feature.notifications'),
        'booking_basic': t('feature.booking_basic'),
        'booking_system': t('feature.booking_system'),
        'blog': t('feature.blog'),
        'cms_integration': t('feature.cms_integration'),
        'gallery': t('feature.gallery'),
        'music_media': t('feature.music_media'),
        'social_feed': t('feature.social_feed')
    };

    // Package tier display names (translated)
    var packageTierNames = {
        'essential': t('pkg.essential'),
        'starter': t('pkg.starter'),
        'growth': t('pkg.growth'),
        'professional': t('pkg.professional'),
        'enterprise': t('pkg.enterprise'),
        'custom': t('pkg.custom')
    };

    var html = '';
    var packageType = pricingData.packageType;

    // Show placeholder if no package selected
    if (!packageType) {
        html = '<div class="pricing-empty-state">' + t('pricing.selectPackage') + '</div>';
        container.innerHTML = html;
        return;
    }

    // Package header with tier name
    var packageLabel = packageTierNames[packageType] || (packageType.charAt(0).toUpperCase() + packageType.slice(1) + ' Package');
    html += '<div class="pricing-package-header">' +
        '<span class="package-name">' + packageLabel + '</span>' +
        '<span class="package-price">$' + pricingData.basePrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</span>' +
        '</div>';

    // Get included features for this package
    var includedFeatures = packageIncludedFeatures ? (packageIncludedFeatures[packageType] || []) : [];

    // Show included features
    if (includedFeatures.length > 0 && packageType !== 'custom') {
        html += '<div class="pricing-section-header">' + t('pricing.includedInPackage') + '</div>';
        html += '<div class="pricing-included-features">';
        includedFeatures.forEach(function(featureKey) {
            var label = featureLabels[featureKey] || featureKey.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
            html += '<div class="pricing-feature-item included">' +
                '<span class="feature-check">✓</span>' +
                '<span class="feature-name">' + label + '</span>' +
                '</div>';
        });
        html += '</div>';
    }

    // Add-ons (excluding e-commerce, show it separately)
    var nonEcommerceAddOns = pricingData.addOns.filter(function(item) {
        return item.key.indexOf('ecommerce_') !== 0;
    });
    var ecommerceAddOn = pricingData.addOns.find(function(item) {
        return item.key.indexOf('ecommerce_') === 0;
    });

    if (nonEcommerceAddOns.length > 0) {
        // For custom quotes, show as "Included Features" instead of "Add-Ons"
        html += '<div class="pricing-section-header">' + (packageType === 'custom' ? t('pricing.includedFeatures') : t('pricing.addOns')) + '</div>';
        nonEcommerceAddOns.forEach(function(item) {
            var label = featureLabels[item.key] || item.label;
            var priceDisplay = item.price === 0 ?
                '<span class="included-badge">' + t('pricing.included') + '</span>' :
                '+$' + item.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
            html += '<div class="pricing-line-item add-on">' +
                '<span class="item-label">' + label +
                (item.thirdParty ? ' <span class="third-party-note">+ ' + item.note + '</span>' : '') +
                '</span>' +
                '<span class="item-price">' + priceDisplay + '</span>' +
                '</div>';
        });
    }

    // E-commerce (if selected)
    if (ecommerceAddOn) {
        if (nonEcommerceAddOns.length === 0) {
            html += '<div class="pricing-section-header">' + (packageType === 'custom' ? t('pricing.includedFeatures') : t('pricing.addOns')) + '</div>';
        }
        var ecommercePriceDisplay = ecommerceAddOn.price === 0 ?
            '<span class="included-badge">' + t('pricing.included') + '</span>' :
            '+$' + ecommerceAddOn.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        html += '<div class="pricing-line-item add-on ecommerce-item">' +
            '<span class="item-label">' + ecommerceAddOn.label +
            (ecommerceAddOn.thirdParty ? ' <span class="third-party-note">+ ' + ecommerceAddOn.note + '</span>' : '') +
            '</span>' +
            '<span class="item-price">' + ecommercePriceDisplay + '</span>' +
            '</div>';
    }

    // Discounts
    if (pricingData.discounts.length > 0) {
        html += '<div class="pricing-section-header">' + t('pricing.removedFeatures') + '</div>';
        pricingData.discounts.forEach(function(item) {
            var label = featureLabels[item.key] || item.label;
            html += '<div class="pricing-line-item discount">' +
                '<span class="item-label">' + label + '</span>' +
                '<span class="item-price discount-value">-$' + item.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</span>' +
                '</div>';
        });
    }

    // Coupon Discount
    if (pricingData.coupon && pricingData.couponDiscount > 0) {
        var coupon = pricingData.coupon;
        var discountLabel = coupon.code;
        if (coupon.discountType === 'percentage') {
            discountLabel += ' (' + coupon.discountValue + t('pricing.percentOff') + ')';
        } else {
            discountLabel += ' ($' + coupon.discountValue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + t('pricing.dollarOff') + ')';
        }
        html += '<div class="pricing-section-header coupon-header">' + t('pricing.discountApplied') + '</div>';
        html += '<div class="pricing-line-item coupon-discount">' +
            '<span class="item-label"><span class="coupon-icon">🎟️</span> ' + discountLabel + '</span>' +
            '<span class="item-price coupon-value">-$' + pricingData.couponDiscount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</span>' +
            '</div>';
    }

    container.innerHTML = html;
};

// Auto-check features when package is selected
ContractFormHandler.prototype.autoCheckPackageFeatures = function(packageType, packageIncludedFeatures) {
    var includedFeatures = packageIncludedFeatures[packageType] || [];

    var checkboxes = document.querySelectorAll('.sow-checkboxes input[type="checkbox"]');
    checkboxes.forEach(function(checkbox) {
        var featureKey = checkbox.value;
        var isIncluded = includedFeatures.indexOf(featureKey) !== -1;

        checkbox.checked = isIncluded;

        // Mark as "included" visually
        var label = checkbox.parentElement;
        if (isIncluded) {
            label.classList.add('feature-included');
        } else {
            label.classList.remove('feature-included');
        }
    });

    // Reset e-commerce to none
    var ecommerceNone = document.querySelector('input[name="ecommerce_option"][value="none"]');
    if (ecommerceNone) ecommerceNone.checked = true;
};

// New function to update pricing calculations
ContractFormHandler.prototype.updateSOWPricing = function(packagePricing, maintenancePricing, featurePricing, ecommercePricing, packageIncludedFeatures) {
    var maintenanceSelect = $('#sowMaintenance');
    var couponSelect = $('#sowCouponSelect');
    var couponMessage = $('#couponValidationMessage');

    // Calculate feature-based pricing
    var pricingData = this.calculateFeatureBasedPricing(packagePricing, featurePricing, ecommercePricing, packageIncludedFeatures);

    // Apply coupon discount if selected
    var selectedCouponCode = couponSelect ? couponSelect.value : '';
    pricingData.coupon = null;
    pricingData.couponDiscount = 0;

    // Store original base price before any coupon modifications
    // This ensures basePrice is NEVER changed by coupon logic
    var originalBasePrice = pricingData.basePrice;

    if (selectedCouponCode && this.coupons) {
        // For custom quotes, calculate coupon based on the entered price (basePrice), not total
        // This prevents double-discounting if something modified total
        var couponBase = pricingData.packageType === 'custom' ? pricingData.basePrice : pricingData.total;
        var validation = this.validateCoupon(selectedCouponCode, pricingData.packageType, couponBase);
        if (validation.valid) {
            pricingData.coupon = validation.coupon;
            pricingData.couponDiscount = validation.discount;
            pricingData.total = Math.max(0, pricingData.total - validation.discount);
            // Ensure basePrice remains the original entered value
            pricingData.basePrice = originalBasePrice;

            // Show success message
            if (couponMessage) {
                couponMessage.className = 'coupon-validation-message success';
                couponMessage.innerHTML = t('coupon.msg.discountAppliedPrefix') + validation.discountDisplay + t('coupon.msg.discountAppliedSuffix');
            }
        } else {
            // Show error message
            if (couponMessage) {
                couponMessage.className = 'coupon-validation-message error';
                couponMessage.innerHTML = '✗ ' + validation.error;
            }
        }
    } else {
        // Clear message
        if (couponMessage) {
            couponMessage.className = 'coupon-validation-message';
            couponMessage.innerHTML = '';
        }
    }

    // Render itemized breakdown
    this.renderItemizedPricing(pricingData, packagePricing, packageIncludedFeatures);

    var totalPrice = pricingData.total;
    var deposit = totalPrice * 0.50;
    var milestone1 = totalPrice * 0.25;
    var finalPayment = totalPrice * 0.25;

    var maintenanceCost = maintenancePricing[maintenanceSelect.value] || 0;

    // Update DOM
    var totalPriceEl = $('#sowTotalPrice');
    var depositEl = $('#sowDepositCalc');
    var milestone1El = $('#sowMilestone1Calc');
    var finalEl = $('#sowFinalCalc');
    var maintenanceEl = $('#sowMaintenanceCalc');
    var maintenanceRow = $('#maintenanceRow');

    if (totalPriceEl) totalPriceEl.textContent = '$' + totalPrice.toFixed(0);
    if (depositEl) depositEl.textContent = '$' + deposit.toFixed(0);
    if (milestone1El) milestone1El.textContent = '$' + milestone1.toFixed(0);
    if (finalEl) finalEl.textContent = '$' + finalPayment.toFixed(0);

    // Always show maintenance row (maintenance is required)
    if (maintenanceRow) maintenanceRow.style.display = 'flex';
    if (maintenanceSelect.value && maintenanceSelect.value !== '') {
        if (maintenanceEl) maintenanceEl.textContent = '$' + maintenanceCost + '/month';
    } else {
        if (maintenanceEl) maintenanceEl.textContent = 'Select plan';
    }

    // Update deferred amount if deferred payment is enabled
    var deferredCheckbox = $('#sowDeferredPayment');
    var deferredFieldsContainer = $('#deferredPaymentFields');
    var isDeferredEnabled = (deferredCheckbox && deferredCheckbox.checked) ||
                            (deferredFieldsContainer && deferredFieldsContainer.style.display === 'block');

    if (isDeferredEnabled) {
        // Only update lump sum amount (not custom split)
        var splitType = document.querySelector('input[name="deferred_split"]:checked');
        if (!splitType || splitType.value !== 'custom') {
            var deferredAmountInput = $('#sowDeferredAmount');
            if (deferredAmountInput) {
                deferredAmountInput.value = totalPrice;
            }
        }
        calculateLateFee();
    }

    // Store pricing data for save
    this.currentPricingData = pricingData;
};

ContractFormHandler.prototype.saveSOW = function() {
    // Check if business entity mode
    var isBusinessEntity = $('#sowEntityTypeToggle') && $('#sowEntityTypeToggle').checked;

    // Individual client fields
    var clientName = $('#sowClientName').value.trim();
    var clientEmail = $('#sowClientEmail').value.trim();
    var clientPhoneRaw = $('#sowClientPhone').value.trim();

    // Business entity fields
    var businessName = $('#sowBusinessName') ? $('#sowBusinessName').value.trim() : '';
    var entityType = $('#sowEntityType') ? $('#sowEntityType').value : '';
    var stateOfFormation = $('#sowStateOfFormation') ? $('#sowStateOfFormation').value.trim() : '';
    var repName = $('#sowRepName') ? $('#sowRepName').value.trim() : '';
    var repTitle = $('#sowRepTitle') ? $('#sowRepTitle').value.trim() : '';
    var businessEmail = $('#sowBusinessEmail') ? $('#sowBusinessEmail').value.trim() : '';
    var businessPhoneRaw = $('#sowBusinessPhone') ? $('#sowBusinessPhone').value.trim() : '';

    var packageType = $('#sowPackage').value;
    var weeks = $('#sowWeeks').value;
    var startDate = $('#sowStartDate').value;
    var notes = $('#sowNotes').value.trim();
    var maintenancePlan = $('#sowMaintenance').value;

    // Check if retroactive project (weeks not required if retroactive)
    var isRetroactive = $('#sowRetroactive') && $('#sowRetroactive').checked;
    var devDuration = $('#sowDevDuration') ? $('#sowDevDuration').value : '';
    var retroactiveEndDate = $('#sowRetroactiveEndDate') ? $('#sowRetroactiveEndDate').value : '';

    // Normalize phone to E.164 format (+1XXXXXXXXXX) for Firebase Auth matching
    var clientPhone = '';
    if (clientPhoneRaw) {
        var digits = clientPhoneRaw.replace(/\D/g, '');
        if (digits.length === 10) {
            clientPhone = '+1' + digits;
        } else if (digits.length === 11 && digits.startsWith('1')) {
            clientPhone = '+' + digits;
        } else {
            clientPhone = clientPhoneRaw; // Keep as-is if unusual format
        }
    }

    // Normalize business phone to E.164 format
    var businessPhone = '';
    if (businessPhoneRaw) {
        var bizDigits = businessPhoneRaw.replace(/\D/g, '');
        if (bizDigits.length === 10) {
            businessPhone = '+1' + bizDigits;
        } else if (bizDigits.length === 11 && bizDigits.startsWith('1')) {
            businessPhone = '+' + bizDigits;
        } else {
            businessPhone = businessPhoneRaw;
        }
    }

    // Validate required fields based on entity type
    var missingFields = [];

    if (isBusinessEntity) {
        // Validate business entity fields
        if (!businessName) missingFields.push('Business Legal Name');
        if (!entityType) missingFields.push('Entity Type');
        if (!repName) missingFields.push('Representative Name');
        if (!repTitle) missingFields.push('Representative Title');
        if (!packageType) missingFields.push('Package Tier');
        // For retroactive projects, check devDuration instead of weeks
        if (isRetroactive) {
            if (!devDuration) missingFields.push('Development Duration');
        } else {
            if (!weeks) missingFields.push('Estimated Weeks');
        }

        if (missingFields.length > 0) {
            alert(t('sow.val.fillRequired') + missingFields.join('\n- '));
            return;
        }
        if (!businessEmail && !businessPhone) {
            alert(t('sow.val.businessEmailOrPhone'));
            return;
        }
    } else {
        // Validate individual fields
        if (!clientName) missingFields.push('Client Name');
        if (!packageType) missingFields.push('Package Tier');
        // For retroactive projects, check devDuration instead of weeks
        if (isRetroactive) {
            if (!devDuration) missingFields.push('Development Duration');
        } else {
            if (!weeks) missingFields.push('Estimated Weeks');
        }

        if (missingFields.length > 0) {
            alert(t('sow.val.fillRequired') + missingFields.join('\n- '));
            return;
        }
        if (!clientEmail && !clientPhone) {
            alert(t('sow.val.clientEmailOrPhone'));
            return;
        }
    }

    // Get selected features
    var features = [];
    var checkboxes = document.querySelectorAll('.sow-checkboxes input[type="checkbox"]:checked');
    checkboxes.forEach(function(checkbox) {
        var label = checkbox.parentElement.textContent.trim();
        // Remove third-party note from label
        var thirdPartyNote = checkbox.parentElement.querySelector('.third-party-note');
        if (thirdPartyNote) {
            label = label.replace(thirdPartyNote.textContent, '').trim();
        }
        features.push(label);
    });

    // Get e-commerce selection
    var ecommerceRadio = document.querySelector('input[name="ecommerce_option"]:checked');
    var ecommerceOption = ecommerceRadio ? ecommerceRadio.value : 'none';

    // Use stored pricing data from real-time calculation
    var pricingData = this.currentPricingData || {
        basePrice: 0,
        packageType: packageType,
        addOns: [],
        discounts: [],
        ecommerceOption: ecommerceOption,
        ecommercePrice: 0,
        total: 0
    };

    var totalPrice = pricingData.total;

    // Get selected coupon
    var couponSelect = $('#sowCouponSelect');
    var selectedCouponCode = couponSelect ? couponSelect.value : '';

    // Get retroactive duration unit (isRetroactive and devDuration already declared above)
    var devDurationUnit = $('#sowDevDurationUnit') ? $('#sowDevDurationUnit').value : 'weeks';
    var devDurationParsed = devDuration ? parseInt(devDuration) || null : null;

    // Get deferred payment settings
    var deferredEnabled = $('#sowDeferredPayment') && $('#sowDeferredPayment').checked;
    var deferredData = {
        enabled: deferredEnabled,
        splitType: 'lump_sum',
        dueDate: null,
        deferredAmount: 0,
        lateFee: 0,
        lateFeeWaived: false,
        allowPartialPayments: true,
        maintenanceDuringDeferral: true,
        customSchedule: [],
        // Recurring payment plan fields
        frequency: null,
        startDate: null,
        calculationMode: null,
        amountPerPayment: null,
        numberOfPayments: null,
        acknowledgmentSigned: false,
        acknowledgmentDate: null
    };

    if (deferredEnabled) {
        var splitTypeRadio = document.querySelector('input[name="deferred_split"]:checked');
        deferredData.splitType = splitTypeRadio ? splitTypeRadio.value : 'lump_sum';
        deferredData.lateFeeWaived = $('#sowWaiveLateFee') && $('#sowWaiveLateFee').checked;
        deferredData.allowPartialPayments = $('#sowAllowPartialPayments') ? $('#sowAllowPartialPayments').checked : true;
        deferredData.maintenanceDuringDeferral = $('#sowMaintenanceDuringDeferral') ? $('#sowMaintenanceDuringDeferral').checked : true;

        if (deferredData.splitType === 'custom') {
            var schedule = [];
            var customRows = document.querySelectorAll('.custom-payment-row');
            customRows.forEach(function(row) {
                var amountInput = row.querySelector('.custom-payment-amount');
                var dateInput = row.querySelector('.custom-payment-date');
                var amount = parseFloat(amountInput ? amountInput.value : 0) || 0;
                var date = dateInput ? dateInput.value : null;
                if (amount > 0) {
                    schedule.push({ amount: amount, dueDate: date });
                }
            });
            deferredData.customSchedule = schedule;
            deferredData.deferredAmount = schedule.reduce(function(sum, item) { return sum + item.amount; }, 0);
        } else if (deferredData.splitType === 'recurring') {
            // Recurring payment plan
            deferredData.deferredAmount = parseFloat($('#sowRecurringTotalAmount') ? $('#sowRecurringTotalAmount').value : 0) || 0;
            deferredData.startDate = $('#sowRecurringStartDate') ? $('#sowRecurringStartDate').value : null;
            deferredData.frequency = $('#sowRecurringFrequency') ? $('#sowRecurringFrequency').value : 'biweekly';
            deferredData.calculationMode = $('#sowRecurringCalcMode') ? $('#sowRecurringCalcMode').value : 'amount';

            if (deferredData.calculationMode === 'amount') {
                deferredData.amountPerPayment = parseFloat($('#sowRecurringPaymentAmount') ? $('#sowRecurringPaymentAmount').value : 0) || 0;
            } else {
                deferredData.numberOfPayments = parseInt($('#sowRecurringPaymentCount') ? $('#sowRecurringPaymentCount').value : 0) || 0;
            }

            // Generate the schedule using the same function used for preview
            var amountOrCount = deferredData.calculationMode === 'amount' ? deferredData.amountPerPayment : deferredData.numberOfPayments;
            deferredData.customSchedule = generateRecurringSchedule(
                deferredData.deferredAmount,
                deferredData.startDate,
                deferredData.frequency,
                deferredData.calculationMode,
                amountOrCount
            );
        } else {
            // Lump sum
            deferredData.deferredAmount = parseFloat($('#sowDeferredAmount') ? $('#sowDeferredAmount').value : 0) || 0;
            deferredData.dueDate = $('#sowDeferredDueDate') ? $('#sowDeferredDueDate').value : null;
        }

        // Late fee only applies if payment is late (stored for PDF terms)
        deferredData.lateFee = deferredData.lateFeeWaived ? 0 : (deferredData.deferredAmount * 0.10);

        // Validation
        if (deferredData.deferredAmount <= 0) {
            alert(t('sow.val.deferredAmount'));
            return;
        }
        if (deferredData.splitType === 'lump_sum' && !deferredData.dueDate) {
            alert(t('sow.val.deferredDueDate'));
            return;
        }
        if (deferredData.splitType === 'custom' && deferredData.customSchedule.length === 0) {
            alert(t('sow.val.customSchedule'));
            return;
        }
        if (deferredData.splitType === 'recurring') {
            if (!deferredData.startDate) {
                alert(t('sow.val.firstPaymentDate'));
                return;
            }
            if (deferredData.calculationMode === 'amount' && (!deferredData.amountPerPayment || deferredData.amountPerPayment <= 0)) {
                alert(t('sow.val.paymentAmount'));
                return;
            }
            if (deferredData.calculationMode === 'count' && (!deferredData.numberOfPayments || deferredData.numberOfPayments < 2)) {
                alert(t('sow.val.paymentCount'));
                return;
            }
            if (deferredData.customSchedule.length === 0) {
                alert(t('sow.val.scheduleError'));
                return;
            }
        }
        if (deferredData.deferredAmount > totalPrice) {
            alert(t('sow.val.deferredExceedsTotal'));
            return;
        }
    }

    var sowData = {
        // Use business name as primary if business entity, otherwise individual name
        clientName: isBusinessEntity ? businessName : clientName,
        clientEmail: isBusinessEntity ? (businessEmail || '') : (clientEmail || ''),
        clientPhone: isBusinessEntity ? (normalizeToE164(businessPhone) || '') : (normalizeToE164(clientPhone) || ''),
        packageType: packageType,
        estimatedWeeks: isRetroactive ? (devDurationParsed || null) : parseInt(weeks),
        startDate: isRetroactive ? (retroactiveEndDate || null) : (startDate || null),
        features: features,
        notes: notes,
        maintenancePlan: maintenancePlan,
        isRetroactive: isRetroactive,
        devDuration: devDurationParsed,
        devDurationUnit: devDurationUnit,
        retroactiveEndDate: isRetroactive ? (retroactiveEndDate || null) : null,
        couponCode: selectedCouponCode || null,
        // Business entity information
        isBusinessEntity: isBusinessEntity,
        businessName: isBusinessEntity ? businessName : '',
        entityType: isBusinessEntity ? entityType : '',
        stateOfFormation: isBusinessEntity ? stateOfFormation : '',
        representativeName: isBusinessEntity ? repName : '',
        representativeTitle: isBusinessEntity ? repTitle : '',
        payment: {
            total: totalPrice,
            deposit: totalPrice * 0.50,
            milestone1: totalPrice * 0.25,
            final: totalPrice * 0.25,
            breakdown: {
                basePrice: pricingData.basePrice,
                addOns: pricingData.addOns,
                discounts: pricingData.discounts,
                ecommerceOption: pricingData.ecommerceOption,
                ecommercePrice: pricingData.ecommercePrice,
                couponCode: selectedCouponCode || null,
                couponDiscount: pricingData.couponDiscount || 0
            },
            deferred: deferredData,
            tracking: {
                depositPaid: false,
                depositPaidDate: null,
                milestone1Paid: false,
                milestone1PaidDate: null,
                finalPaid: false,
                finalPaidDate: null,
                deferredPayments: []
            }
        },
        createdBy: firebase.auth().currentUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'draft'
    };

    var self = this;

    firebase.firestore().collection('sow_documents').add(sowData)
        .then(function(docRef) {
            console.log('SOW saved with ID:', docRef.id);
            alert(t('sow.msg.saveSuccess'));
            $('#sowCreatorContainer').style.display = 'none';
            
            // Refresh the SOW list
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error saving SOW:', error);
            alert(t('sow.err.save') + error.message);
        });
};

ContractFormHandler.prototype.showSOWSigningModal = function(sowId) {
    var self = this;
    
    console.log('Opening SOW for signing:', sowId);
    
    // Fetch the SOW
    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .get()
        .then(function(doc) {
            if (!doc.exists) {
                alert(t('sow.err.notFound'));
                return;
            }
            
            var sowData = doc.data();
            sowData.id = doc.id;
            
            // Check if already signed
            if (sowData.clientSignature && sowData.devSignature) {
                alert(t('sow.msg.alreadySigned'));
                self.generateSOWPDF(sowData);
                return;
            }
            
            // Show signing modal
            self.renderSOWSigningModal(sowData);
        })
        .catch(function(error) {
            console.error('Error loading SOW:', error);
            alert(t('sow.err.load') + error.message);
        });
};

ContractFormHandler.prototype.renderSOWSigningModal = function(sowData) {
    var self = this;
    
    // Check user role
    var currentUser = firebase.auth().currentUser;
    var userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
    var userPhone = currentUser.phoneNumber || '';
    var isDeveloper = userEmail === this.DEVELOPER_EMAIL;
    var isClient = (userEmail && sowData.clientEmail && userEmail === sowData.clientEmail.toLowerCase()) ||
                   (userPhone && sowData.clientPhone && userPhone === sowData.clientPhone);

    if (!isDeveloper && !isClient) {
        alert(t('sow.msg.noPermission'));
        return;
    }
    
    // Create modal
    var modal = document.createElement('div');
    modal.id = 'sowSigningModal';
    modal.className = 'contract-modal show';
    
    var html = '<div class="modal-overlay"></div>' +
        '<div class="modal-content">' +
        '<button class="modal-close" id="closeSOWSigningModal">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<line x1="18" y1="6" x2="6" y2="18"></line>' +
        '<line x1="6" y1="6" x2="18" y2="18"></line>' +
        '</svg>' +
        '</button>' +
        
        '<div class="modal-header">' +
        '<h1>📋 ' + t('sowSign.title') + '</h1>' +
        '<p class="modal-subtitle">' + sowData.clientName + ' | ' + sowData.packageType.toUpperCase() + '</p>' +
        '</div>' +
        
        '<div class="contract-form" ">' +
        
        // SOW Summary
        '<div class="contract-section-inner">' +
        '<h2>' + t('sowSign.summary') + '</h2>' +
        '<p><strong>' + t('sowSign.label.client') + '</strong> ' + sowData.clientName + '</p>' +
        '<p><strong>' + t('sowSign.label.package') + '</strong> ' + sowData.packageType + '</p>' +
        '<p><strong>' + t('sowSign.label.totalCost') + '</strong> $' + (sowData.payment ? sowData.payment.total.toFixed(0) : '0') + '</p>' +
        '<p><strong>' + t('sowSign.label.timeline') + '</strong> ' + (sowData.estimatedWeeks || 'TBD') + ' ' + t('sowTab.detail.weeks') + '</p>' +
        '<p><strong>' + t('sowSign.label.features') + '</strong> ' + (sowData.features ? sowData.features.length : 0) + ' ' + t('sowSign.label.selected') + '</p>' +
        '</div>' +
        
        // Signature Sections
        '<div class="signatures">' +
        '<div class="signature-grid">';
    
    // CLIENT SIGNATURE BLOCK
    html += '<div class="signature-block" id="sowClientSignatureBlock">' +
        '<h3>' + t('sowSign.clientSig') + sowData.clientName + '</h3>';

    if (sowData.clientSignature) {
        // Already signed
        html += '<div class="pending-notice">' +
            '<p><strong>✓ ' + t('sowSign.clientSigned') + '</strong></p>' +
            '<p>' + t('sowSign.signedOn') + (sowData.clientSignedDate || 'N/A') + '</p>' +
            '</div>' +
            '<div class="signature-pad-container">' +
            '<canvas id="sowClientSigPad" class="signature-pad"></canvas>' +
            '</div>';
    } else if (isClient) {
        // Client needs to sign
        html += '<div class="form-row">' +
            '<div class="form-group">' +
            '<label>' + t('sowSign.nameLabel') + '</label>' +
            '<input type="text" id="sowClientSignerName" value="' + sowData.clientName + '" required />' +
            '</div>' +
            '<div class="form-group">' +
            '<label>' + t('sowSign.dateLabel') + '</label>' +
            '<input type="date" id="sowClientSignDate" required />' +
            '</div>' +
            '</div>' +
            '<div class="form-group">' +
            '<label>' + t('sowSign.signatureLabel') + '</label>' +
            '<div class="signature-pad-container">' +
            '<canvas id="sowClientSigPad" class="signature-pad"></canvas>' +
            '<button class="clear-btn" data-canvas="sowClientSigPad">' + t('sowSign.btn.clear') + '</button>' +
            '</div>' +
            '</div>';
    } else {
        // Developer viewing - client hasn't signed yet
        html += '<div class="pending-notice">' +
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>' +
            '<p><strong>' + t('sowSign.awaitingClient') + '</strong></p>' +
            '<p>' + t('sowSign.awaitingClientText') + '</p>' +
            '</div>';
    }
    
    html += '</div>'; // Close client signature block
    
    // DEVELOPER SIGNATURE BLOCK
    html += '<div class="signature-block" id="sowDevSignatureBlock">' +
        '<h3>' + t('sowSign.devSig') + '</h3>';

    if (sowData.devSignature) {
        // Already signed
        html += '<div class="pending-notice">' +
            '<p><strong>✓ ' + t('sowSign.devSigned') + '</strong></p>' +
            '<p>' + t('sowSign.signedOn') + (sowData.devSignedDate || 'N/A') + '</p>' +
            '</div>' +
            '<div class="signature-pad-container">' +
            '<canvas id="sowDevSigPad" class="signature-pad"></canvas>' +
            '</div>';
    } else if (isDeveloper) {
        // Developer needs to sign
        html += '<div class="form-row">' +
            '<div class="form-group">' +
            '<label>' + t('sowSign.devNameLabel') + '</label>' +
            '<input type="text" id="sowDevSignerName" value="Carlos Martin" required />' +
            '</div>' +
            '<div class="form-group">' +
            '<label>' + t('sowSign.devDateLabel') + '</label>' +
            '<input type="date" id="sowDevSignDate" required />' +
            '</div>' +
            '</div>' +
            '<div class="form-group">' +
            '<label>' + t('sowSign.devSignatureLabel') + '</label>' +
            '<div class="signature-pad-container">' +
            '<canvas id="sowDevSigPad" class="signature-pad"></canvas>' +
            '<button class="clear-btn" data-canvas="sowDevSigPad">' + t('sowSign.btn.clear') + '</button>' +
            '</div>' +
            '</div>';
    } else {
        // Client viewing - developer hasn't signed yet
        html += '<div class="pending-notice">' +
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>' +
            '<p><strong>' + t('sowSign.awaitingDev') + '</strong></p>' +
            '<p>' + t('sowSign.awaitingDevText') + '</p>' +
            '</div>';
    }
    
    html += '</div>'; // Close dev signature block
    html += '</div></div>'; // Close signature-grid and signatures
    
    // Action Buttons
    html += '<div class="action-buttons">';
    
    if (sowData.clientSignature && sowData.devSignature) {
        // Both signed - show download
        html += '<button class="btn btn-primary" id="downloadSOWBtn">' +
            '<span>📄 ' + t('sowSign.btn.downloadSigned') + '</span>' +
            '</button>';
    } else if (isClient && !sowData.clientSignature) {
        // Client can sign
        html += '<button class="btn btn-primary" id="submitSOWClientSig">' +
            '<span>✍️ ' + t('sowSign.btn.submitSignature') + '</span>' +
            '</button>';
    } else if (isDeveloper && !sowData.devSignature && sowData.clientSignature) {
        // Developer can sign (only if client signed first)
        html += '<button class="btn btn-primary" id="submitSOWDevSig">' +
            '<span>✍️ ' + t('sowSign.btn.signSow') + '</span>' +
            '</button>';
    }
    
    html += '</div></div></div>'; // Close action-buttons, contract-form, modal-content
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    
    // Initialize signature pads and event listeners
    setTimeout(function() {
        self.initSOWSignaturePads(sowData, isDeveloper, isClient);
    }, 100);
};

ContractFormHandler.prototype.initSOWSignaturePads = function(sowData, isDeveloper, isClient) {
    var self = this;
    
    // Initialize pads
    var clientCanvas = document.getElementById('sowClientSigPad');
    var devCanvas = document.getElementById('sowDevSigPad');
    
    var clientPad = null;
    var devPad = null;
    
    if (clientCanvas) {
        if (sowData.clientSignature) {
            // Draw existing signature
            this.drawSignatureOnCanvas(clientCanvas, sowData.clientSignature);
        } else if (isClient) {
            // Create pad for signing
            clientPad = createSignaturePad(clientCanvas);
            
            // Set today's date
            var clientDateField = document.getElementById('sowClientSignDate');
            if (clientDateField) {
                clientDateField.value = new Date().toISOString().split('T')[0];
            }
        }
    }
    
    if (devCanvas) {
        if (sowData.devSignature) {
            // Draw existing signature
            this.drawSignatureOnCanvas(devCanvas, sowData.devSignature);
        } else if (isDeveloper) {
            // Create pad for signing
            devPad = createSignaturePad(devCanvas);
            
            // Set today's date
            var devDateField = document.getElementById('sowDevSignDate');
            if (devDateField) {
                devDateField.value = new Date().toISOString().split('T')[0];
            }
        }
    }
    
    // Clear button handlers
    var clearBtns = document.querySelectorAll('.clear-btn');
    clearBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var canvasId = this.getAttribute('data-canvas');
            if (canvasId === 'sowClientSigPad' && clientPad) {
                clientPad.clear();
            } else if (canvasId === 'sowDevSigPad' && devPad) {
                devPad.clear();
            }
        });
    });
    
    // Close button
    var closeBtn = document.getElementById('closeSOWSigningModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            var modal = document.getElementById('sowSigningModal');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        });
    }
    
    // Submit client signature
    var clientSubmitBtn = document.getElementById('submitSOWClientSig');
    if (clientSubmitBtn) {
        clientSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            self.submitSOWClientSignature(sowData.id, clientPad);
        });
    }
    
    // Submit developer signature
    var devSubmitBtn = document.getElementById('submitSOWDevSig');
    if (devSubmitBtn) {
        devSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            self.submitSOWDeveloperSignature(sowData.id, devPad);
        });
    }
    
    // Download button
    var downloadBtn = document.getElementById('downloadSOWBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            self.generateSOWPDF(sowData);
        });
    }
};

ContractFormHandler.prototype.submitSOWClientSignature = function(sowId, signaturePad) {
    var self = this;

    if (!signaturePad || signaturePad.isEmpty()) {
        alert(t('sow.val.signature'));
        return;
    }

    var signerName = document.getElementById('sowClientSignerName').value.trim();
    var signDate = document.getElementById('sowClientSignDate').value;

    if (!signerName || !signDate) {
        alert(t('sow.val.fillAllFields'));
        return;
    }

    var submitBtn = document.getElementById('submitSOWClientSig');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>' + t('sow.btn.submitting') + '</span>';
    }
    
    var updateData = {
        clientSignature: signaturePad.toDataURL(),
        clientSignerName: signerName,
        clientSignedDate: signDate,
        clientSignedTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending_developer'
    };
    
    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .update(updateData)
        .then(function() {
            console.log('✓ Client signed SOW');
            alert(t('sow.msg.clientSignSuccess'));
            
            var modal = document.getElementById('sowSigningModal');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        })
        .catch(function(error) {
            console.error('Error signing SOW:', error);
            alert(t('sow.err.sign') + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>' + t('sow.btn.submitSignature') + '</span>';
            }
        });
};

ContractFormHandler.prototype.submitSOWDeveloperSignature = function(sowId, signaturePad) {
    var self = this;

    if (!signaturePad || signaturePad.isEmpty()) {
        alert(t('sow.val.signature'));
        return;
    }

    var signerName = document.getElementById('sowDevSignerName').value.trim();
    var signDate = document.getElementById('sowDevSignDate').value;

    if (!signerName || !signDate) {
        alert(t('sow.val.fillAllFields'));
        return;
    }

    var submitBtn = document.getElementById('submitSOWDevSig');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>' + t('sow.btn.signing') + '</span>';
    }
    
    var updateData = {
        devSignature: signaturePad.toDataURL(),
        devSignerName: signerName,
        devSignedDate: signDate,
        devSignedTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'approved'
    };
    
    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .update(updateData)
        .then(function() {
            console.log('✓ Developer signed SOW');
            alert(t('sow.msg.fullySigned'));
            
            var modal = document.getElementById('sowSigningModal');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
            
            // Refresh dashboard if open
            if (self.isDeveloper) {
                self.showDeveloperDashboard();
            }
        })
        .catch(function(error) {
            console.error('Error signing SOW:', error);
            alert(t('sow.err.sign') + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>' + t('sow.btn.signSow') + '</span>';
            }
        });
};

// ============================================================
// CALIFORNIA LAW COMPLIANT SOW PDF GENERATION
// ============================================================
ContractFormHandler.prototype.generateSOWPDF = function(sowData) {
    var self = this;

    // If sowData is provided, use it; otherwise read from form
    var clientName, clientContact, packageType, estimatedWeeks, startDate, notes, maintenancePlan, features, sowId;
    var clientSignature, clientSignerName, clientSignedDate, devSignature, devSignerName, devSignedDate;

    if (sowData) {
        // Using saved data
        clientName = sowData.clientName || 'Client Name';
        clientContact = sowData.clientEmail || sowData.clientPhone || 'N/A';
        packageType = sowData.packageType || 'professional';
        estimatedWeeks = sowData.estimatedWeeks || 'TBD';
        startDate = sowData.startDate || null;
        notes = sowData.notes || '';
        maintenancePlan = sowData.maintenancePlan || 'none';
        features = sowData.features || [];
        sowId = sowData.id || 'DRAFT';
        // Signatures
        clientSignature = sowData.clientSignature || '';
        clientSignerName = sowData.clientSignerName || clientName;
        clientSignedDate = sowData.clientSignedDate || '';
        devSignature = sowData.devSignature || '';
        devSignerName = sowData.devSignerName || 'Carlos Martin';
        devSignedDate = sowData.devSignedDate || '';
    } else {
        // Reading from form
        var entityToggleForm = $('#sowEntityTypeToggle');
        var isBusinessEntityForm = entityToggleForm && entityToggleForm.checked;

        var clientNameField = $('#sowClientName');
        var clientEmailField = $('#sowClientEmail');
        var clientPhoneField = $('#sowClientPhone');
        var businessNameField = $('#sowBusinessName');
        var businessEmailField = $('#sowBusinessEmail');
        var businessPhoneField = $('#sowBusinessPhone');
        var packageField = $('#sowPackage');
        var weeksField = $('#sowWeeks');
        var startDateField = $('#sowStartDate');
        var notesField = $('#sowNotes');
        var maintenanceField = $('#sowMaintenance');

        if (!packageField) {
            alert(t('sow.val.selectPackage'));
            return;
        }

        // Get client name based on entity type
        if (isBusinessEntityForm) {
            clientName = businessNameField ? businessNameField.value.trim() : '';
            var bizEmailVal = businessEmailField ? businessEmailField.value.trim() : '';
            var bizPhoneVal = businessPhoneField ? businessPhoneField.value.trim() : '';
            clientContact = bizEmailVal || bizPhoneVal || 'N/A';
        } else {
            clientName = clientNameField ? clientNameField.value.trim() : '';
            var emailVal = clientEmailField ? clientEmailField.value.trim() : '';
            var phoneVal = clientPhoneField ? clientPhoneField.value.trim() : '';
            clientContact = emailVal || phoneVal || 'N/A';
        }

        if (!clientName) {
            alert((isBusinessEntityForm ? t('sow.val.fillBusinessName') : t('sow.val.fillClientName')));
            return;
        }

        packageType = packageField.value || 'professional';
        estimatedWeeks = weeksField ? weeksField.value : 'TBD';
        startDate = startDateField ? startDateField.value : null;
        notes = notesField ? notesField.value.trim() : '';
        maintenancePlan = maintenanceField ? maintenanceField.value : 'none';
        sowId = 'DRAFT';
        clientSignature = '';
        clientSignerName = isBusinessEntityForm ? ($('#sowRepName') ? $('#sowRepName').value.trim() : clientName) : clientName;
        clientSignedDate = '';
        devSignature = '';
        devSignerName = 'Carlos Martin';
        devSignedDate = '';

        // Get selected features from checkboxes
        features = [];
        $$('.sow-checkboxes input[type="checkbox"]:checked').forEach(function(checkbox) {
            var label = checkbox.parentElement.textContent.trim();
            features.push(label);
        });
    }

    // For backward compatibility, also set clientEmail
    var clientEmail = clientContact;

    // Check if retroactive project (from saved data or form)
    var isRetroactive = false;
    var devDuration = null;
    var devDurationUnit = 'weeks';
    if (sowData && sowData.isRetroactive !== undefined) {
        isRetroactive = sowData.isRetroactive;
        devDuration = sowData.devDuration || null;
        devDurationUnit = sowData.devDurationUnit || 'weeks';
    } else {
        var retroactiveCheckbox = $('#sowRetroactive');
        isRetroactive = retroactiveCheckbox && retroactiveCheckbox.checked;
        devDuration = $('#sowDevDuration') ? parseInt($('#sowDevDuration').value) || null : null;
        devDurationUnit = $('#sowDevDurationUnit') ? $('#sowDevDurationUnit').value : 'weeks';
    }

    // Business entity fields
    var isBusinessEntity = false;
    var businessName = '';
    var entityType = '';
    var stateOfFormation = '';
    var representativeName = '';
    var representativeTitle = '';

    if (sowData) {
        isBusinessEntity = sowData.isBusinessEntity || false;
        businessName = sowData.businessName || '';
        entityType = sowData.entityType || '';
        stateOfFormation = sowData.stateOfFormation || '';
        representativeName = sowData.representativeName || '';
        representativeTitle = sowData.representativeTitle || '';
    } else {
        var entityToggle = $('#sowEntityTypeToggle');
        isBusinessEntity = entityToggle && entityToggle.checked;
        if (isBusinessEntity) {
            businessName = $('#sowBusinessName') ? $('#sowBusinessName').value.trim() : '';
            entityType = $('#sowEntityType') ? $('#sowEntityType').value : '';
            stateOfFormation = $('#sowStateOfFormation') ? $('#sowStateOfFormation').value.trim() : '';
            representativeName = $('#sowRepName') ? $('#sowRepName').value.trim() : '';
            representativeTitle = $('#sowRepTitle') ? $('#sowRepTitle').value.trim() : '';
        }
    }

    // Validation already done above when reading from form
    if (!clientName || !packageType) {
        alert((isBusinessEntity ? 'Business Name' : 'Client Name') + ' and Package Tier are required to generate PDF');
        return;
    }

    // Package definitions (comprehensive) - 2025 Revised Structure (translated)
    var packageDefinitions = {
        'essential': {
            name: t('pkgDef.essential.name'),
            priceRange: t('pkgDef.essential.priceRange'),
            defaultPrice: 2000,
            timeline: t('pkgDef.essential.timeline'),
            description: t('pkgDef.essential.desc'),
            includes: [
                t('pkgDef.essential.i1'), t('pkgDef.essential.i2'), t('pkgDef.essential.i3'),
                t('pkgDef.essential.i4'), t('pkgDef.essential.i5'), t('pkgDef.essential.i6'),
                t('pkgDef.essential.i7')
            ],
            notIncluded: [
                t('pkgDef.essential.ni1'), t('pkgDef.essential.ni2'), t('pkgDef.essential.ni3'),
                t('pkgDef.essential.ni4'), t('pkgDef.essential.ni5')
            ]
        },
        'starter': {
            name: t('pkgDef.starter.name'),
            priceRange: t('pkgDef.starter.priceRange'),
            defaultPrice: 4500,
            timeline: t('pkgDef.starter.timeline'),
            description: t('pkgDef.starter.desc'),
            includes: [
                t('pkgDef.starter.i1'), t('pkgDef.starter.i2'), t('pkgDef.starter.i3'),
                t('pkgDef.starter.i4'), t('pkgDef.starter.i5'), t('pkgDef.starter.i6'),
                t('pkgDef.starter.i7'), t('pkgDef.starter.i8'), t('pkgDef.starter.i9'),
                t('pkgDef.starter.i10')
            ],
            notIncluded: [
                t('pkgDef.starter.ni1'), t('pkgDef.starter.ni2'), t('pkgDef.starter.ni3'),
                t('pkgDef.starter.ni4')
            ]
        },
        'growth': {
            name: t('pkgDef.growth.name'),
            priceRange: t('pkgDef.growth.priceRange'),
            defaultPrice: 9000,
            timeline: t('pkgDef.growth.timeline'),
            description: t('pkgDef.growth.desc'),
            includes: [
                t('pkgDef.growth.i1'), t('pkgDef.growth.i2'), t('pkgDef.growth.i3'),
                t('pkgDef.growth.i4'), t('pkgDef.growth.i5'), t('pkgDef.growth.i6'),
                t('pkgDef.growth.i7'), t('pkgDef.growth.i8')
            ],
            notIncluded: [
                t('pkgDef.growth.ni1'), t('pkgDef.growth.ni2'), t('pkgDef.growth.ni3'),
                t('pkgDef.growth.ni4')
            ]
        },
        'professional': {
            name: t('pkgDef.professional.name'),
            priceRange: t('pkgDef.professional.priceRange'),
            defaultPrice: 18500,
            timeline: t('pkgDef.professional.timeline'),
            description: t('pkgDef.professional.desc'),
            includes: [
                t('pkgDef.professional.i1'), t('pkgDef.professional.i2'), t('pkgDef.professional.i3'),
                t('pkgDef.professional.i4'), t('pkgDef.professional.i5'), t('pkgDef.professional.i6'),
                t('pkgDef.professional.i7'), t('pkgDef.professional.i8'), t('pkgDef.professional.i9'),
                t('pkgDef.professional.i10'), t('pkgDef.professional.i11')
            ],
            notIncluded: [
                t('pkgDef.professional.ni1'), t('pkgDef.professional.ni2'), t('pkgDef.professional.ni3'),
                t('pkgDef.professional.ni4')
            ]
        },
        'enterprise': {
            name: t('pkgDef.enterprise.name'),
            priceRange: t('pkgDef.enterprise.priceRange'),
            defaultPrice: 37500,
            timeline: t('pkgDef.enterprise.timeline'),
            description: t('pkgDef.enterprise.desc'),
            includes: [
                t('pkgDef.enterprise.i1'), t('pkgDef.enterprise.i2'), t('pkgDef.enterprise.i3'),
                t('pkgDef.enterprise.i4'), t('pkgDef.enterprise.i5'), t('pkgDef.enterprise.i6'),
                t('pkgDef.enterprise.i7'), t('pkgDef.enterprise.i8'), t('pkgDef.enterprise.i9'),
                t('pkgDef.enterprise.i10'), t('pkgDef.enterprise.i11'), t('pkgDef.enterprise.i12'),
                t('pkgDef.enterprise.i13')
            ],
            notIncluded: [
                t('pkgDef.enterprise.ni1'), t('pkgDef.enterprise.ni2'), t('pkgDef.enterprise.ni3')
            ]
        },
        'custom': {
            name: t('pkgDef.custom.name'),
            priceRange: t('pkgDef.custom.priceRange'),
            defaultPrice: 0,
            timeline: t('pkgDef.custom.timeline'),
            description: t('pkgDef.custom.desc'),
            includes: [t('pkgDef.custom.i1')],
            notIncluded: []
        }
    };

    var maintenanceDefinitions = {
        'none': {
            name: t('maint.none.name'),
            price: '$0/month',
            description: t('maint.none.desc'),
            includes: []
        },
        'basic': {
            name: t('maint.basic.name'),
            price: t('maint.basic.price'),
            description: t('maint.basic.desc'),
            includes: [
                t('maint.basic.i1'), t('maint.basic.i2'), t('maint.basic.i3'),
                t('maint.basic.i4'), t('maint.basic.i5'), t('maint.basic.i6')
            ]
        },
        'professional': {
            name: t('maint.professional.name'),
            price: t('maint.professional.price'),
            description: t('maint.professional.desc'),
            includes: [
                t('maint.professional.i1'), t('maint.professional.i2'), t('maint.professional.i3'),
                t('maint.professional.i4'), t('maint.professional.i5'), t('maint.professional.i6'),
                t('maint.professional.i7'), t('maint.professional.i8')
            ]
        },
        'premium': {
            name: t('maint.premium.name'),
            price: t('maint.premium.price'),
            description: t('maint.premium.desc'),
            includes: [
                t('maint.premium.i1'), t('maint.premium.i2'), t('maint.premium.i3'),
                t('maint.premium.i4'), t('maint.premium.i5'), t('maint.premium.i6'),
                t('maint.premium.i7'), t('maint.premium.i8'), t('maint.premium.i9'),
                t('maint.premium.i10')
            ]
        }
    };

    // Get package and maintenance info
    var packageInfo = packageDefinitions[packageType] || packageDefinitions['custom'];
    var maintenanceInfo = maintenanceDefinitions[maintenancePlan] || maintenanceDefinitions['none'];

    // Calculate pricing
    var totalPrice = 0;
    if (sowData && sowData.payment && sowData.payment.total) {
        totalPrice = sowData.payment.total;
    } else if (packageType === 'custom' && sowData && sowData.customPrice) {
        totalPrice = parseFloat(sowData.customPrice) || 0;
    } else if (packageType === 'custom') {
        var customPriceField = $('#sowCustomPrice');
        totalPrice = customPriceField ? parseFloat(customPriceField.value) || 0 : 0;
    } else {
        totalPrice = packageInfo.defaultPrice;
    }

    var deposit = totalPrice * 0.50;
    var milestone1 = totalPrice * 0.25;
    var finalPayment = totalPrice * 0.25;

    // Extract pricing breakdown if available
    var breakdown = (sowData && sowData.payment && sowData.payment.breakdown) ? sowData.payment.breakdown : null;
    var basePrice = breakdown ? breakdown.basePrice : totalPrice;
    var addOns = breakdown ? breakdown.addOns : [];
    var discounts = breakdown ? breakdown.discounts : [];
    var ecommerceOption = breakdown ? breakdown.ecommerceOption : null;
    var ecommercePrice = breakdown ? breakdown.ecommercePrice : 0;
    var couponCode = breakdown ? breakdown.couponCode : null;
    var couponDiscount = breakdown ? breakdown.couponDiscount : 0;

    // Format dates
    var dateLocale = typeof getCurrentLang === 'function' && getCurrentLang() === 'es' ? 'es-MX' : 'en-US';
    var generatedDate = new Date().toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    var formattedStartDate = startDate ?
        new Date(startDate).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' }) :
        t('pdf.sow.toBeDeterm');

    // Build HTML first, then open window with Blob URL
    var htmlContent = '<!DOCTYPE html>' +
    '<html><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=1024">' +
    '<title>Statement of Work - ' + clientName + '</title>' +
    '<link rel="icon" type="image/png" href="https://scarlo.dev/favicons/favicon-96x96.png">' +
    '<style>' +
    '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; text-size-adjust: 100%; }' +
    'body { font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.35; color: #000; background: #fff; padding: 0.5in 0.75in; }' +
    '.sow-container { max-width: 900px; margin: 0 auto; }' +
    'h1 { font-size: 18pt; text-align: center; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }' +
    'h2 { font-size: 10pt; margin-top: 12px; margin-bottom: 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #000; padding-bottom: 2px; }' +
    'h3 { font-size: 10pt; margin-top: 8px; margin-bottom: 4px; font-weight: bold; }' +
    'p { margin-bottom: 6px; text-align: justify; }' +
    'ul, ol { margin-left: 20px; margin-bottom: 6px; }' +
    'li { margin-bottom: 2px; }' +
    '.header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #000; }' +
    '.subtitle { font-size: 11pt; margin-top: 6px; font-style: italic; }' +
    '.meta-date { font-size: 9pt; margin-top: 6px; font-style: italic; }' +
    '.info-box { padding: 8px 12px; border: 1px solid #000; border-left: 3px solid #000; margin: 8px 0; page-break-inside: avoid; break-inside: avoid; }' +
    '.info-box h3 { margin-top: 0; }' +
    '.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-top: 6px; }' +
    '.info-item { font-size: 9pt; word-wrap: break-word; overflow-wrap: break-word; }' +
    '.section { margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }' +
    '.deferred-terms { page-break-inside: avoid; break-inside: avoid; }' +
    '.section-compact { page-break-inside: avoid; break-inside: avoid; }' +
    '.package-box { border: 1px solid #000; padding: 8px 12px; margin: 8px 0; page-break-inside: avoid; break-inside: avoid; }' +
    '.package-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #000; }' +
    '.package-name { font-size: 11pt; font-weight: bold; }' +
    '.package-price { font-size: 10pt; font-weight: bold; }' +
    '.feature-list { columns: 2; column-gap: 20px; font-size: 9pt; }' +
    '.feature-list li { break-inside: avoid; margin-bottom: 1px; }' +
    '.not-included { border-left: 3px solid #000; }' +
    '.not-included h3 { font-style: italic; }' +
    '.payment-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9pt; page-break-inside: avoid; break-inside: avoid; }' +
    '.payment-table th, .payment-table td { border: 1px solid #000; padding: 5px 8px; text-align: left; }' +
    '.payment-table th { font-weight: bold; background: #f5f5f5; }' +
    '.payment-table .total-row { font-weight: bold; font-size: 10pt; border-top: 2px solid #000; }' +
    '.timeline-box { border: 1px solid #000; padding: 8px 12px; margin: 8px 0; page-break-inside: avoid; break-inside: avoid; }' +
    '.timeline-header { font-weight: bold; margin-bottom: 8px; font-size: 10pt; border-bottom: 1px solid #000; padding-bottom: 4px; }' +
    '.milestone { margin-bottom: 6px; padding-left: 8px; border-left: 2px solid #000; }' +
    '.milestone:last-child { margin-bottom: 0; }' +
    '.milestone-title { font-weight: bold; font-size: 9pt; }' +
    '.milestone-desc { font-size: 9pt; }' +
    '.assumptions-box { border: 1px solid #000; border-left: 3px solid #000; padding: 8px 12px; margin: 8px 0; page-break-inside: avoid; break-inside: avoid; }' +
    '.assumptions-box h3 { margin-top: 0; font-size: 9pt; }' +
    '.assumptions-box li { font-size: 9pt; }' +
    '.legal-notice { border: 1px solid #000; padding: 8px 12px; margin: 10px 0; font-size: 9pt; }' +
    '.signature-section { margin-top: 20px; page-break-before: always; }' +
    '.signature-grid { display: flex; justify-content: space-between; gap: 30px; margin-top: 15px; }' +
    '.signature-block { flex: 1; }' +
    '.signature-block h3 { font-size: 9pt; margin-bottom: 6px; }' +
    '.signature-line { border-bottom: 1px solid #000; height: 50px; margin: 6px 0; display: flex; align-items: flex-end; justify-content: center; }' +
    '.signature-line img { max-height: 45px; max-width: 100%; filter: invert(1) grayscale(1); }' +
    '.signature-label { font-size: 8pt; font-style: italic; margin-top: 3px; }' +
    '.signature-name { font-weight: bold; margin-top: 6px; font-size: 9pt; }' +
    '.signature-date { font-size: 9pt; margin-top: 3px; }' +
    '.footer { margin-top: 20px; text-align: center; font-size: 8pt; border-top: 1px solid #000; padding-top: 10px; }' +
    '.sow-id { font-size: 7pt; margin-top: 4px; font-style: italic; }' +
    '.highlight { font-weight: bold; }' +
    '.maintenance-box { border: 1px solid #000; padding: 8px 12px; margin: 8px 0; page-break-inside: avoid; break-inside: avoid; }' +
    '.maintenance-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 1px solid #000; margin-bottom: 6px; }' +
    '.maintenance-name { font-weight: bold; font-size: 10pt; }' +
    '.maintenance-price { font-weight: bold; }' +
    '.logo { max-width: 180px; max-height: 60px; margin-bottom: 15px; }' +
    '@media print { body { padding: 0; margin: 0; orphans: 3; widows: 3; } .sow-container { max-width: 100%; } .info-box, .package-box, .timeline-box, .maintenance-box, .legal-notice, .deferred-terms, .assumptions-box, .section-compact { page-break-inside: avoid !important; break-inside: avoid !important; } }' +
    '@page { margin: 0.5in 0.6in; size: letter; }' +
    '</style>' +
    '</head><body>' +
    '<div class="sow-container">' +

    // HEADER
    '<div class="header">' +
    '<img src="' + getLogoForPDF() + '" alt="Scarlo Logo" class="logo" />' +
    '<h1>' + t('pdf.sow.title') + '</h1>' +
    '<div class="subtitle">' + t('pdf.sow.subtitle') + '</div>' +
    '<div class="meta-date">' + t('pdf.sow.generated') + ' ' + generatedDate + '</div>' +
    '</div>' +

    // LEGAL INCORPORATION
    '<div class="legal-notice">' +
    '<strong>' + t('pdf.sow.incorporation') + '</strong> ' + t('pdf.sow.incorporationText') + ' ' + clientName + t('pdf.sow.incorporationText2') +
    '</div>' +

    // CLIENT INFORMATION
    '<div class="section">' +
    '<h2>' + t('pdf.sow.clientInfo') + '</h2>' +
    '<div class="info-box">' +
    '<div class="info-grid">' +
    (isBusinessEntity
        ? '<div class="info-item"><strong>' + t('pdf.sow.businessName') + '</strong> ' + businessName + '</div>' +
          '<div class="info-item"><strong>' + t('pdf.sow.entityType') + '</strong> ' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</div>' +
          '<div class="info-item"><strong>' + t('pdf.sow.representative') + '</strong> ' + representativeName + ', ' + representativeTitle + '</div>'
        : '<div class="info-item"><strong>' + t('pdf.sow.clientName') + '</strong> ' + clientName + '</div>') +
    '<div class="info-item"><strong>' + t('pdf.sow.contact') + '</strong> ' + clientEmail + '</div>' +
    '<div class="info-item"><strong>' + t('pdf.sow.packageSelected') + '</strong> ' + packageInfo.name + '</div>' +
    (isRetroactive
        ? '<div class="info-item"><strong>' + t('pdf.sow.devDuration') + '</strong> ' + (devDuration || estimatedWeeks) + ' ' + devDurationUnit + '</div>'
        : '<div class="info-item"><strong>' + t('pdf.sow.estimatedTimeline') + '</strong> ' + estimatedWeeks + ' ' + t('sow.weeks') + '</div>') +
    '<div class="info-item"><strong>' + t('pdf.sow.estimatedFinalRevision') + '</strong> ' + formattedStartDate + '</div>' +
    '<div class="info-item"><strong>' + t('pdf.sow.sowReference') + '</strong> ' + sowId + '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +

    // PROJECT OVERVIEW
    '<div class="section">' +
    '<h2>' + t('pdf.sow.projectOverview') + '</h2>' +
    '<div class="package-box">' +
    '<div class="package-header">' +
    '<span class="package-name">' + packageInfo.name + '</span>' +
    '<span class="package-price">' + packageInfo.priceRange + '</span>' +
    '</div>' +
    '<p style="font-size: 9pt; margin-bottom: 10px;">' + packageInfo.description + '</p>' +
    '<h3 style="font-size: 9pt; margin-top: 10px;">' + t('pdf.sow.includedInPackage') + '</h3>' +
    '<ul class="feature-list">';

    // For custom quotes, show selected features; for packages, show package includes
    if (packageType === 'custom' && addOns && addOns.length > 0) {
        addOns.forEach(function(addon) {
            var addonLabel = addon.key ? translateAddonByKey(addon.key, addon.label) : translateStoredFeature(addon.label);
            htmlContent += '<li>' + addonLabel + '</li>';
        });
    } else {
        packageInfo.includes.forEach(function(item) {
            htmlContent += '<li>' + item + '</li>';
        });
    }

    htmlContent += '</ul></div></div>';

    // ADDITIONAL FEATURES - Only show true add-ons (priced items not included in base package)
    // For custom quotes, all features are included in the custom price, so skip this section
    var trueAddOns = (addOns && packageType !== 'custom') ? addOns.filter(function(addon) {
        return addon.price > 0;
    }) : [];

    if (trueAddOns.length > 0) {
        htmlContent += '<div class="section">' +
        '<h2>3. ' + t('pdf.sow.additionalFeatures').replace(/^\d+\.\s*/, '') + '</h2>' +
        '<div class="info-box">' +
        '<ul class="feature-list">';
        trueAddOns.forEach(function(addon) {
            var addonLabel = addon.key ? translateAddonByKey(addon.key, addon.label) : translateStoredFeature(addon.label);
            htmlContent += '<li>' + addonLabel + '</li>';
        });
        htmlContent += '</ul></div></div>';
    }

    // SPECIAL REQUIREMENTS
    if (notes && notes.trim()) {
        htmlContent += '<div class="section">' +
        '<h2>' + (trueAddOns.length > 0 ? '4' : '3') + '. ' + t('pdf.sow.specialRequirements') + '</h2>' +
        '<div class="info-box">' +
        '<p style="font-size: 9pt; margin-bottom: 0;">' + notes + '</p>' +
        '</div>' +
        '</div>';
    }

    var sectionNum = 3 + (trueAddOns.length > 0 ? 1 : 0) + (notes && notes.trim() ? 1 : 0);

    // PROJECT TIMELINE (hidden for retroactive projects)
    if (!isRetroactive) {
        htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. ' + t('pdf.sow.projectTimeline') + '</h2>' +
        '<div class="timeline-box">' +
        '<div class="timeline-header">' + t('pdf.sow.estimatedDuration') + ' ' + estimatedWeeks + ' ' + t('pdf.sow.weeks') + '</div>' +

        '<div class="milestone">' +
        '<div class="milestone-title">' + t('pdf.sow.phase1Title') + '</div>' +
        '<div class="milestone-desc">' + t('pdf.sow.phase1Desc') + '</div>' +
        '</div>' +

        '<div class="milestone">' +
        '<div class="milestone-title">' + t('pdf.sow.phase2Title') + '</div>' +
        '<div class="milestone-desc">' + t('pdf.sow.phase2Desc') + ' <strong>' + t('pdf.sow.phase2Payment') + '</strong></div>' +
        '</div>' +

        '<div class="milestone">' +
        '<div class="milestone-title">' + t('pdf.sow.phase3Title') + Math.max(4, parseInt(estimatedWeeks) - 2 || 4) + ')</div>' +
        '<div class="milestone-desc">' + t('pdf.sow.phase3Desc') + '</div>' +
        '</div>' +

        '<div class="milestone">' +
        '<div class="milestone-title">' + t('pdf.sow.phase4Title') + '</div>' +
        '<div class="milestone-desc">' + t('pdf.sow.phase4Desc') + ' <strong>' + t('pdf.sow.phase4Payment') + '</strong></div>' +
        '</div>' +

        '</div>' +
        '<p style="font-size: 9pt; font-style: italic; margin-top: 6px;">' + t('pdf.sow.timelineNote') + '</p>' +
        '</div>';

        sectionNum++;
    }

    // PRICING SUMMARY (individualized breakdown)
    htmlContent += '<div class="section">' +
    '<h2>' + sectionNum + '. ' + t('pdf.sow.pricingSummary') + '</h2>' +
    '<table class="payment-table" style="width: 100%;">' +
    '<tbody>';

    // Base package
    htmlContent += '<tr>' +
    '<td style="width: 70%;"><strong>' + packageInfo.name + '</strong></td>' +
    '<td style="width: 30%; text-align: right;"><strong>$' + basePrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
    '</tr>';

    // Add-ons / Included Features (for custom quotes, show as "Included" instead of price)
    if (addOns && addOns.length > 0) {
        addOns.forEach(function(addon) {
            var addonLabel = addon.key ? translateAddonByKey(addon.key, addon.label) : translateStoredFeature(addon.label);
            var priceDisplay = addon.price === 0 ?
                '<span style="color: #2e7d32; font-style: italic;">' + t('pdf.sow.included') + '</span>' :
                '<span style="color: #2e7d32;">+$' + addon.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</span>';
            htmlContent += '<tr>' +
            '<td>' + addonLabel + '</td>' +
            '<td style="text-align: right;">' + priceDisplay + '</td>' +
            '</tr>';
        });
    }

    // Discounts (removed features)
    if (discounts && discounts.length > 0) {
        discounts.forEach(function(discount) {
            var discountLabel = discount.key ? translateAddonByKey(discount.key, discount.label) : translateStoredFeature(discount.label);
            htmlContent += '<tr>' +
            '<td>' + discountLabel + ' <span style="font-size: 8pt; color: #666;">' + t('pdf.sow.removed') + '</span></td>' +
            '<td style="text-align: right; color: #c62828;">-$' + discount.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</td>' +
            '</tr>';
        });
    }

    // Coupon discount
    if (couponCode && couponDiscount > 0) {
        htmlContent += '<tr>' +
        '<td>' + t('pdf.sow.coupon') + ' ' + couponCode + '</td>' +
        '<td style="text-align: right; color: #c62828;">-$' + couponDiscount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</td>' +
        '</tr>';
    }

    // Total row
    htmlContent += '<tr style="border-top: 2px solid #333;">' +
    '<td><strong>' + t('pdf.sow.total') + '</strong></td>' +
    '<td style="text-align: right;"><strong>$' + totalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
    '</tr>' +
    '</tbody>' +
    '</table>' +
    '</div>';

    sectionNum++;

    // YOUR VALUE SUMMARY - Personalized, compact, high-impact
    var marketRates = {
        'essential': { local: '$1,500 - $4,000', localHigh: 4000 },
        'starter': { local: '$4,000 - $8,000', localHigh: 8000 },
        'growth': { local: '$8,000 - $15,000', localHigh: 15000 },
        'professional': { local: '$15,000 - $35,000', localHigh: 35000 },
        'enterprise': { local: '$35,000 - $80,000', localHigh: 80000 }
    };

    // For custom quotes, match to the closest tier based on the actual price
    var tierRates;
    if (packageType === 'custom') {
        if (totalPrice <= 3000) {
            tierRates = marketRates['essential'];
        } else if (totalPrice <= 6000) {
            tierRates = marketRates['starter'];
        } else if (totalPrice <= 12000) {
            tierRates = marketRates['growth'];
        } else if (totalPrice <= 25000) {
            tierRates = marketRates['professional'];
        } else {
            tierRates = marketRates['enterprise'];
        }
    } else {
        tierRates = marketRates[packageType] || marketRates['starter'];
    }
    var potentialSavings = Math.max(0, tierRates.localHigh - totalPrice);

    htmlContent += '<div class="section" style="page-break-inside: avoid;">' +
    '<h2>' + sectionNum + '. ' + t('pdf.sow.valueSummary') + '</h2>' +

    '<div style="border: 2px solid #000; padding: 12px 15px; margin: 8px 0;">' +

    // Price comparison - anchored
    '<div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #ccc; margin-bottom: 10px;">' +
    '<div style="font-size: 9pt;">' +
    '<div style="color: #666; margin-bottom: 2px;">' + t('pdf.sow.marketRatesIntro') + '</div>' +
    '<div style="font-size: 11pt; font-weight: bold;">' + tierRates.local + '</div>' +
    '</div>' +
    '<div style="text-align: right;">' +
    '<div style="color: #666; font-size: 9pt; margin-bottom: 2px;">' + t('pdf.sow.yourQuote') + '</div>' +
    '<div style="font-size: 14pt; font-weight: bold;">$' + totalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>' +
    '</div>' +
    '</div>' +

    // Savings callout
    (potentialSavings > 500 ?
    '<div style="background: #f0f7f0; padding: 8px 12px; margin-bottom: 10px; text-align: center; border-left: 3px solid #2e7d32;">' +
    '<span style="font-size: 9pt; color: #666;">' + t('pdf.sow.potentialSavings') + ' </span>' +
    '<strong style="font-size: 11pt; color: #2e7d32;">' + t('pdf.sow.upTo') + ' $' + potentialSavings.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong>' +
    '</div>' : '') +

    // Value propositions
    '<div style="font-size: 9pt;">' +
    '<div style="margin-bottom: 4px;"><strong style="color: #2e7d32;">✓</strong> <strong>' + t('pdf.sow.valueProp1') + '</strong> ' + t('pdf.sow.valueProp1Desc') + '</div>' +
    '<div style="margin-bottom: 4px;"><strong style="color: #2e7d32;">✓</strong> <strong>' + t('pdf.sow.valueProp2') + '</strong> ' + t('pdf.sow.valueProp2Desc') + '</div>' +
    '<div><strong style="color: #2e7d32;">✓</strong> <strong>' + t('pdf.sow.valueProp3') + '</strong> ' + t('pdf.sow.valueProp3Desc') + '</div>' +
    '</div>' +

    '</div>' +

    '<p style="font-size: 7pt; color: #888; margin-top: 4px; margin-bottom: 0;">' + t('pdf.sow.marketNote') + ' <a href="https://scarlo.dev/pricing" target="_blank" style="color: #2e7d32; text-decoration: underline;">scarlo.dev/pricing</a></p>' +
    '</div>';

    sectionNum++;

    // PAYMENT STRUCTURE (simplified for retroactive projects)
    if (isRetroactive) {
        // Simple total for retroactive projects
        htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. ' + t('pdf.sow.paymentSummary') + '</h2>' +
        '<div class="info-box" style="text-align: center; padding: 15px;">' +
        '<div style="font-size: 10pt; color: #666; margin-bottom: 5px;">' + t('pdf.sow.totalProjectCost') + '</div>' +
        '<div style="font-size: 16pt; font-weight: bold;">$' + totalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>' +
        '</div>' +
        '<p style="font-size: 9pt; font-style: italic;">' + t('pdf.sow.paymentTermsNote') + '</p>' +
        '</div>';
    } else {
        // Full payment structure for new projects
        htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. ' + t('pdf.sow.paymentStructure') + '</h2>' +

        '<table class="payment-table">' +
        '<thead>' +
        '<tr>' +
        '<th style="width: 25%;">' + t('pdf.sow.payment') + '</th>' +
        '<th style="width: 45%;">' + t('pdf.sow.description') + '</th>' +
        '<th style="width: 15%;">' + t('pdf.sow.percentage') + '</th>' +
        '<th style="width: 15%;">' + t('pdf.sow.amount') + '</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '<tr>' +
        '<td><strong>' + t('pdf.sow.deposit') + '</strong></td>' +
        '<td>' + t('pdf.sow.beforeWorkBegins') + '</td>' +
        '<td>50%</td>' +
        '<td><strong>$' + deposit.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>' + t('pdf.sow.milestone') + '</strong></td>' +
        '<td>' + t('pdf.sow.uponDesignApproval') + '</td>' +
        '<td>25%</td>' +
        '<td><strong>$' + milestone1.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>' + t('pdf.sow.final') + '</strong></td>' +
        '<td>' + t('pdf.sow.priorToDeployment') + '</td>' +
        '<td>25%</td>' +
        '<td><strong>$' + finalPayment.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>' +
        '<tr class="total-row">' +
        '<td colspan="2"><strong>' + t('pdf.sow.totalProjectCostLabel') + '</strong></td>' +
        '<td><strong>100%</strong></td>' +
        '<td><strong>$' + totalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>' +
        '</tbody>' +
        '</table>' +

        '<p style="font-size: 9pt; font-style: italic;">' + t('pdf.sow.latePaymentsNote') + '</p>' +
        '</div>';
    }

    sectionNum++;

    // DEFERRED PAYMENT AGREEMENT (if enabled)
    if (sowData.payment && sowData.payment.deferred && sowData.payment.deferred.enabled) {
        var deferred = sowData.payment.deferred;

        htmlContent += '<div class="section" style="page-break-inside: auto; break-inside: auto;">' +
        '<div style="page-break-inside: avoid; break-inside: avoid;">' +
        '<h2>' + sectionNum + '. ' + t('pdf.sow.deferredPaymentAgreement') + '</h2>' +

        '<div style="background: #fff8e6; border: 2px solid #f59e0b; padding: 10px; margin-bottom: 10px;">' +
        '<p style="font-size: 9pt; margin: 0 0 5px; color: #92400e; font-weight: bold;">' + t('pdf.sow.deferredPaymentTerms') + '</p>' +
        '<p style="font-size: 8pt; margin: 0; color: #78350f;">' + t('pdf.sow.deferredPaymentIntro') + '</p>' +
        '</div>' +
        '</div>' +

        '<table class="payment-table">' +
        '<thead>' +
        '<tr>' +
        '<th style="width: 50%;">' + t('pdf.sow.description') + '</th>' +
        '<th style="width: 25%;">' + t('pdf.sow.dueDate') + '</th>' +
        '<th style="width: 25%;">' + t('pdf.sow.amount') + '</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>';

        // Frequency labels for recurring payments
        var freqLabels = {
            'weekly': t('freq.weekly'),
            'biweekly': t('freq.biweekly'),
            'semimonthly': t('freq.semimonthly'),
            'monthly': t('freq.monthly'),
            'bimonthly': t('freq.bimonthly')
        };

        if ((deferred.splitType === 'custom' || deferred.splitType === 'recurring') && deferred.customSchedule && deferred.customSchedule.length > 0) {
            // Show payment plan summary for recurring type
            if (deferred.splitType === 'recurring' && deferred.frequency) {
                var freqLabel = freqLabels[deferred.frequency] || deferred.frequency;
                htmlContent += '<tr style="background: #e0f2fe;">' +
                '<td colspan="3" style="font-size: 8pt; color: #0369a1; padding: 6px 8px;">' +
                '<strong>' + t('pdf.sow.paymentPlan') + '</strong> ' + deferred.customSchedule.length + ' ' + freqLabel.toLowerCase() + ' ' + t('pdf.sow.paymentsOf') + ' $' +
                (deferred.customSchedule[0].amount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) +
                '</td></tr>';
            }
            deferred.customSchedule.forEach(function(payment, index) {
                var formattedDate = payment.dueDate ? new Date(payment.dueDate).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' }) : t('common.tbd');
                htmlContent += '<tr>' +
                '<td>' + t('pdf.sow.paymentNum') + ' ' + (index + 1) + '</td>' +
                '<td>' + formattedDate + '</td>' +
                '<td><strong>$' + (payment.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
                '</tr>';
            });
        } else {
            var formattedDueDate = deferred.dueDate ? new Date(deferred.dueDate).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' }) : t('common.tbd');
            htmlContent += '<tr>' +
            '<td>' + t('pdf.sow.deferredLumpSum') + '</td>' +
            '<td>' + formattedDueDate + '</td>' +
            '<td><strong>$' + (deferred.deferredAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
            '</tr>';
        }

        // Total deferred amount row
        htmlContent += '<tr class="total-row">' +
        '<td colspan="2"><strong>' + t('pdf.sow.totalDeferredAmount') + '</strong></td>' +
        '<td><strong>$' + (deferred.deferredAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>';

        // Late fee row (only applies if payment is late)
        var lateFeeWaived = deferred.lateFeeWaived || deferred.feeWaived;
        var lateFeeAmount = deferred.deferredAmount * 0.10;
        htmlContent += '<tr style="background: #fef3c7;">' +
        '<td>' + t('pdf.sow.lateFee10') + (lateFeeWaived ? ' <em style="color:#666;">(' + t('pdf.sow.waived') + ')</em>' : '') + '</td>' +
        '<td style="font-size: 8pt; color: #92400e;">' + t('pdf.sow.ifPaymentLate') + '</td>' +
        '<td>' + (lateFeeWaived ? '<s>$' + lateFeeAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</s> $0' : '<strong>$' + lateFeeAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong>') + '</td>' +
        '</tr>' +
        '</tbody></table>';

        // Terms and conditions
        var isRecurringPlan = deferred.splitType === 'recurring' || (deferred.splitType === 'custom' && deferred.customSchedule && deferred.customSchedule.length > 1);
        var lateFeeText = lateFeeWaived ? t('pdf.sow.term.lateFeeWaived') :
            (isRecurringPlan ?
                t('pdf.sow.term.lateFeeRecurring') :
                t('pdf.sow.term.lateFeeLump1') + '$' + lateFeeAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + t('pdf.sow.term.lateFeeLump2'));

        htmlContent += '<div class="deferred-terms">' +
        '<h3 style="font-size: 9pt; margin-top: 10px; margin-bottom: 5px;">' + t('pdf.sow.termsAndConditions') + '</h3>' +
        '<ol style="font-size: 8pt; margin: 5px 0; padding-left: 18px; line-height: 1.3;">' +
        '<li><strong>' + t('pdf.sow.term.dueDateTitle') + '</strong> ' + t('pdf.sow.term.dueDateText') + '</li>' +
        '<li><strong>' + t('pdf.sow.term.lateFeeTitle') + '</strong> ' + lateFeeText + '</li>' +
        '<li><strong>' + t('pdf.sow.term.interestTitle') + '</strong> ' + t('pdf.sow.term.interestText') + '</li>' +
        '<li><strong>' + t('pdf.sow.term.suspensionTitle') + '</strong> ' + t('pdf.sow.term.suspensionText') + '</li>' +
        '<li><strong>' + t('pdf.sow.term.collectionTitle') + '</strong> ' + t('pdf.sow.term.collectionText') + '</li>' +
        '<li><strong>' + t('pdf.sow.term.ipRightsTitle') + '</strong> ' + t('pdf.sow.term.ipRightsText') + '</li>' +
        '<li><strong>' + t('pdf.sow.term.defaultTitle') + '</strong> ' + t('pdf.sow.term.defaultText') + '</li>';

        if (deferred.allowPartialPayments) {
            htmlContent += '<li><strong>' + t('pdf.sow.term.partialTitle') + '</strong> ' + t('pdf.sow.term.partialText') + '</li>';
        }

        if (deferred.maintenanceDuringDeferral) {
            htmlContent += '<li><strong>' + t('pdf.sow.term.maintTitle') + '</strong> ' + t('pdf.sow.term.maintDuringText') + '</li>';
        } else {
            htmlContent += '<li><strong>' + t('pdf.sow.term.maintTitle') + '</strong> ' + t('pdf.sow.term.maintDeferredText') + '</li>';
        }

        htmlContent += '<li><strong>' + t('pdf.sow.term.noticeTitle') + '</strong> ' + t('pdf.sow.term.noticeText') + '</li>' +
        '</ol>' +
        '</div>' +
        '</div>';

        sectionNum++;
    }

    // MAINTENANCE PLAN (Required for all projects)
    htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. ' + t('pdf.sow.ongoingMaintenance') + '</h2>' +
        '<div class="maintenance-box">' +
        '<div class="maintenance-header">' +
        '<span class="maintenance-name">' + maintenanceInfo.name + '</span>' +
        '<span class="maintenance-price">' + maintenanceInfo.price + '</span>' +
        '</div>' +
        '<p style="font-size: 9pt; margin: 10px 0;">' + maintenanceInfo.description + '</p>';

        // Show warning box for No Maintenance selection
        if (maintenancePlan === 'none') {
            htmlContent += '<div style="background: #fff3cd; border: 2px solid #856404; padding: 12px; margin: 10px 0; border-radius: 4px;">' +
                '<p style="font-size: 9pt; margin: 0; color: #856404; font-weight: bold;">' + t('pdf.sow.importantNotice') + '</p>' +
                '<p style="font-size: 9pt; margin: 5px 0 0; color: #856404;">' + t('pdf.sow.noMaintenanceWarning') + '</p>' +
                '</div>';
        }

        if (maintenanceInfo.includes && maintenanceInfo.includes.length > 0) {
            htmlContent += '<h3 style="font-size: 9pt; margin-top: 10px;">' + t('pdf.sow.maintenanceIncludes') + '</h3>' +
            '<ul>';
            maintenanceInfo.includes.forEach(function(item) {
                htmlContent += '<li>' + item + '</li>';
            });
            htmlContent += '</ul>';
        }

        htmlContent += '</div>';

    // Different footer text based on maintenance selection
    if (maintenancePlan === 'none') {
        htmlContent += '<p style="font-size: 8pt; font-style: italic;">' + t('pdf.sow.maintFooterNone') + '</p>';
    } else {
        htmlContent += '<p style="font-size: 8pt; font-style: italic;">' + t('pdf.sow.maintFooterActive') + '</p>';
    }
    htmlContent += '</div>';

    sectionNum++;

    // ASSUMPTIONS
    htmlContent += '<div class="section">' +
    '<h2>' + sectionNum + '. ' + t('pdf.sow.assumptionsDeps') + '</h2>' +
    '<div class="assumptions-box">' +
    '<ul>' +
    '<li><strong>' + t('pdf.sow.assume.contentTitle') + '</strong> ' + t('pdf.sow.assume.contentText') + '</li>' +
    '<li><strong>' + t('pdf.sow.assume.feedbackTitle') + '</strong> ' + t('pdf.sow.assume.feedbackText') + '</li>' +
    '<li><strong>' + t('pdf.sow.assume.contactTitle') + '</strong> ' + t('pdf.sow.assume.contactText') + '</li>' +
    '<li><strong>' + t('pdf.sow.assume.thirdPartyTitle') + '</strong> ' + t('pdf.sow.assume.thirdPartyText') + '</li>' +
    '<li><strong>' + t('pdf.sow.assume.domainTitle') + '</strong> ' + t('pdf.sow.assume.domainText') + '</li>' +
    '<li><strong>' + t('pdf.sow.assume.rightsTitle') + '</strong> ' + t('pdf.sow.assume.rightsText') + '</li>' +
    '<li><strong>' + t('pdf.sow.assume.scopeTitle') + '</strong> ' + t('pdf.sow.assume.scopeText') + '</li>' +
    '</ul>' +
    '<p style="font-size: 8pt; margin-bottom: 0; margin-top: 6px;">' + t('pdf.sow.assume.footer') + '</p>' +
    '</div>' +
    '</div>';

    sectionNum++;

    // ACCEPTANCE CRITERIA
    htmlContent += '<div class="section">' +
    '<h2>' + sectionNum + '. ' + t('pdf.sow.acceptanceCriteria') + '</h2>' +
    '<div class="info-box">' +
    '<p style="font-size: 9pt; margin-bottom: 4px;"><strong>' + t('pdf.sow.accept.processTitle') + '</strong> ' + t('pdf.sow.accept.processText') + '</p>' +
    '<p style="font-size: 9pt; margin-bottom: 0;"><strong>' + t('pdf.sow.accept.criteriaTitle') + '</strong> ' + t('pdf.sow.accept.criteriaText') + '</p>' +
    '</div>' +
    '</div>';

    sectionNum++;

    // CHANGE ORDER PROCESS
    htmlContent += '<div class="section">' +
    '<h2>' + sectionNum + '. ' + t('pdf.sow.scopeChanges') + '</h2>' +
    '<div class="info-box">' +
    '<p style="font-size: 9pt; margin-bottom: 4px;">' + t('pdf.sow.scopeChangesIntro') + '</p>' +
    '<p style="font-size: 9pt; margin-bottom: 0;"><strong>' + t('pdf.sow.scopeChangesProcessTitle') + '</strong> ' + t('pdf.sow.scopeChangesProcessText') + '</p>' +
    '</div>' +
    '</div>';

    // SIGNATURES
    htmlContent += '<div class="signature-section">' +
    '<h2>' + t('pdf.sow.signatures') + '</h2>' +
    '<p style="font-size: 9pt;">' + t('pdf.sow.signaturesIntro') + '</p>' +

    '<div class="signature-grid">' +

    // Developer Signature
    '<div class="signature-block">' +
    '<h3>' + t('pdf.sow.developerLabel') + ' Scarlo</h3>' +
    (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 8px;">&nbsp;</p>' : '') +
    '<div class="signature-line">' +
    (devSignature ? '<img src="' + devSignature + '" alt="Developer Signature" />' : '<span style="font-style: italic;">' + t('pdf.sow.awaitingSignature') + '</span>') +
    '</div>' +
    '<div class="signature-label">' + t('pdf.sow.authorizedSignature') + '</div>' +
    '<div class="signature-name">' + devSignerName + '</div>' +
    '<div class="signature-date">' + t('common.date') + ' ' + (devSignedDate || '_______________') + '</div>' +
    '</div>' +

    // Client Signature
    '<div class="signature-block">' +
    '<h3>' + t('pdf.sow.clientLabel') + ' ' + (isBusinessEntity ? businessName : clientName) + '</h3>' +
    (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 8px;">' + entityType + (stateOfFormation ? ', ' + stateOfFormation : '') + '</p>' : '') +
    '<div class="signature-line">' +
    (clientSignature ? '<img src="' + clientSignature + '" alt="Client Signature" />' : '<span style="font-style: italic;">' + t('pdf.sow.awaitingSignature') + '</span>') +
    '</div>' +
    '<div class="signature-label">' + t('pdf.sow.authorizedSignature') + '</div>' +
    '<div class="signature-name">' + (isBusinessEntity ? t('common.by') + ' ' + representativeName + ', ' + representativeTitle : clientSignerName) + '</div>' +
    '<div class="signature-date">' + t('common.date') + ' ' + (clientSignedDate || '_______________') + '</div>' +
    '</div>' +

    '</div>' +
    '</div>';

    // DEFERRED PAYMENT ACKNOWLEDGMENT (if enabled)
    if (sowData.payment && sowData.payment.deferred && sowData.payment.deferred.enabled) {
        var deferred = sowData.payment.deferred;
        var lateFeeWaivedAck = deferred.lateFeeWaived || deferred.feeWaived;
        var lateFeeAmountAck = deferred.deferredAmount * 0.10;
        var monthlyInterest = deferred.deferredAmount * 0.015;

        htmlContent += '<div class="signature-section" style="margin-top: 15px; border-top: 2px solid #f59e0b; padding-top: 10px;">' +
        '<h2 style="color: #92400e; font-size: 11pt; margin-bottom: 8px;">' + t('pdf.sow.deferredAckTitle') + '</h2>' +
        '<div style="background: #fff8e6; padding: 10px; margin-bottom: 10px; border: 1px solid #f59e0b;">' +
        '<p style="font-size: 8pt; margin: 0 0 5px; font-weight: bold;">' + t('pdf.sow.ack.bySigningBelow') + '</p>' +
        '<ul style="font-size: 8pt; margin: 0; padding-left: 18px; line-height: 1.4;">' +
        '<li><strong>' + t('pdf.sow.ack.deferredLabel') + '</strong> $' + (deferred.deferredAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ' ' + t('pdf.sow.ack.perSchedule') + '</li>' +
        '<li><strong>' + t('pdf.sow.ack.lateFeeLabel') + '</strong> ' + (lateFeeWaivedAck ? t('pdf.sow.waived') : '10% ($' + lateFeeAmountAck.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ') ' + t('pdf.sow.ack.if5DaysLate')) + '</li>' +
        '<li><strong>' + t('pdf.sow.ack.interestLabel') + '</strong> 1.5%/' + t('pdf.sow.ack.month') + ' (~$' + monthlyInterest.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '/' + t('pdf.sow.ack.mo') + ') ' + t('pdf.sow.ack.after30Days') + '</li>' +
        '<li><strong>' + t('pdf.sow.ack.suspensionLabel') + '</strong> ' + t('pdf.sow.ack.suspensionText') + '</li>' +
        '<li><strong>' + t('pdf.sow.ack.collectionLabel') + '</strong> ' + t('pdf.sow.ack.collectionText') + '</li>' +
        '<li><strong>' + t('pdf.sow.ack.ipRightsLabel') + '</strong> ' + t('pdf.sow.ack.ipRightsText') + '</li>' +
        '</ul>' +
        '</div>' +

        '<div class="signature-grid">' +
        '<div class="signature-block">' +
        '<h3>' + t('pdf.sow.clientAcknowledgment') + '</h3>' +
        '<div class="signature-line">' +
        (deferred.acknowledgmentSigned && clientSignature ? '<img src="' + clientSignature + '" alt="Client Acknowledgment" />' : '<span style="font-style: italic;">' + t('pdf.sow.awaitingAcknowledgment') + '</span>') +
        '</div>' +
        '<div class="signature-label">' + t('pdf.sow.clientSignatureLabel') + '</div>' +
        '<div class="signature-name">' + (isBusinessEntity ? t('common.by') + ' ' + representativeName : clientSignerName) + '</div>' +
        '<div class="signature-date">' + t('common.date') + ' ' + (deferred.acknowledgmentDate || '_______________') + '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    // FOOTER
    htmlContent += '<div class="footer">' +
    '<p><strong>© ' + new Date().getFullYear() + ' Scarlo</strong> — ' + t('pdf.sow.footerTagline') + '</p>' +
    '<p class="sow-id">SOW: ' + sowId + ' | ' + t('pdf.sow.footerGenerated') + ' ' + new Date().toLocaleString(dateLocale) + '</p>' +
    '<p style="font-size: 7pt; font-style: italic;">' + t('pdf.sow.footerValid') + '</p>' +
    '</div>' +

    '</div>' + // Close sow-container

    '<script>' +
    'window.onload = function() {' +
    '  var images = document.images;' +
    '  var loaded = 0;' +
    '  var total = images.length;' +
    '  if (total === 0) { setTimeout(function() { window.print(); }, 300); return; }' +
    '  for (var i = 0; i < total; i++) {' +
    '    if (images[i].complete) { loaded++; }' +
    '    else { images[i].onload = images[i].onerror = function() { loaded++; if (loaded >= total) setTimeout(function() { window.print(); }, 300); }; }' +
    '  }' +
    '  if (loaded >= total) setTimeout(function() { window.print(); }, 300);' +
    '};' +
    '</script>' +
    '</body></html>';

    // Create Blob URL for cleaner print footer (with UTF-8 charset for special characters)
    var blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    var blobUrl = URL.createObjectURL(blob);
    var printWindow = window.open(blobUrl, '_blank');

    if (!printWindow) {
        URL.revokeObjectURL(blobUrl);
        alert(t('alert.allowPopups'));
        return;
    }

    // Clean up blob URL after window loads
    printWindow.onload = function() {
        URL.revokeObjectURL(blobUrl);
    };
};

// ============= FIXED: generateSOWPDFFromData - now passes data directly =============
ContractFormHandler.prototype.generateSOWPDFFromData = function(sow) {
    console.log('Generating PDF from saved SOW data:', sow.clientName);
    // Simply pass the SOW data to generateSOWPDF
    this.generateSOWPDF(sow);
};

// ============= NEW: Edit SOW functionality =============
// ============= EDIT SOW FUNCTIONALITY =============
ContractFormHandler.prototype.editSOW = function(sow) {
    var self = this;
    
    console.log('✏️ Opening editor for SOW:', sow.id, '-', sow.clientName);
    
    // Show the SOW creator form
    this.showSOWCreator();
    
    // Wait for form to be rendered
    setTimeout(function() {
        console.log('Populating form fields...');
        
        // Get all form fields
        var fields = {
            clientName: $('#sowClientName'),
            clientEmail: $('#sowClientEmail'),
            clientPhone: $('#sowClientPhone'),
            clientIdToggle: $('#clientIdTypeToggle'),
            emailLabel: $('#emailToggleLabel'),
            phoneLabel: $('#phoneToggleLabel'),
            package: $('#sowPackage'),
            weeks: $('#sowWeeks'),
            startDate: $('#sowStartDate'),
            notes: $('#sowNotes'),
            maintenance: $('#sowMaintenance'),
            customPrice: $('#sowCustomPrice'),
            customSection: $('#customPricingSection')
        };

        // Populate basic fields
        if (fields.clientName) fields.clientName.value = sow.clientName || '';

        // Handle email/phone toggle - check which one has data
        if (sow.clientPhone && !sow.clientEmail) {
            // Phone mode
            if (fields.clientIdToggle) fields.clientIdToggle.checked = true;
            if (fields.clientEmail) fields.clientEmail.style.display = 'none';
            if (fields.clientPhone) {
                fields.clientPhone.style.display = 'block';
                fields.clientPhone.value = formatPhoneNumber(sow.clientPhone);
            }
            if (fields.emailLabel) fields.emailLabel.classList.remove('active');
            if (fields.phoneLabel) fields.phoneLabel.classList.add('active');
        } else {
            // Email mode (default)
            if (fields.clientIdToggle) fields.clientIdToggle.checked = false;
            if (fields.clientPhone) fields.clientPhone.style.display = 'none';
            if (fields.clientEmail) {
                fields.clientEmail.style.display = 'block';
                fields.clientEmail.value = sow.clientEmail || '';
            }
            if (fields.phoneLabel) fields.phoneLabel.classList.remove('active');
            if (fields.emailLabel) fields.emailLabel.classList.add('active');
        }
        if (fields.weeks) fields.weeks.value = sow.estimatedWeeks || '';
        if (fields.startDate) fields.startDate.value = sow.startDate || '';
        if (fields.notes) fields.notes.value = sow.notes || '';
        
        // Set package and show custom pricing if needed
        if (fields.package) {
            fields.package.value = sow.packageType || '';
            
            if (sow.packageType === 'custom') {
                if (fields.customSection) fields.customSection.style.display = 'block';
                if (fields.customPrice && sow.payment) {
                    // Use original basePrice from breakdown, NOT the discounted total
                    var originalPrice = (sow.payment.breakdown && sow.payment.breakdown.basePrice)
                        ? sow.payment.breakdown.basePrice
                        : sow.payment.total;
                    fields.customPrice.value = originalPrice || '';
                }
            }
        }
        
        // Set maintenance plan
        if (fields.maintenance) {
            fields.maintenance.value = sow.maintenancePlan || 'none';
        }

        // Set retroactive project fields
        var retroactiveCheckbox = $('#sowRetroactive');
        var devDurationField = $('#sowDevDuration');
        var devDurationUnitField = $('#sowDevDurationUnit');
        var retroactiveDurationFields = $('#retroactiveDurationFields');
        var retroactiveEndDateField = $('#sowRetroactiveEndDate');
        var weeksInput = $('#sowWeeks');
        var standardInputGroup = weeksInput ? weeksInput.parentElement : null;

        if (retroactiveCheckbox && sow.isRetroactive) {
            retroactiveCheckbox.checked = true;
            if (retroactiveDurationFields) retroactiveDurationFields.style.display = 'block';
            if (standardInputGroup) standardInputGroup.style.display = 'none';
            if (devDurationField && sow.devDuration) devDurationField.value = sow.devDuration;
            if (devDurationUnitField && sow.devDurationUnit) devDurationUnitField.value = sow.devDurationUnit;
            if (retroactiveEndDateField && (sow.retroactiveEndDate || sow.startDate)) {
                retroactiveEndDateField.value = sow.retroactiveEndDate || sow.startDate;
            }
            // Also hide deposit/milestone/final payment rows
            if (typeof toggleRetroactiveFields === 'function') {
                toggleRetroactiveFields();
            }
        }

        // Populate business entity fields
        var entityTypeToggle = $('#sowEntityTypeToggle');
        var individualFields = $('#sowIndividualFields');
        var businessFields = $('#sowBusinessFields');
        var individualLabel = $('#sowIndividualLabel');
        var businessLabel = $('#sowBusinessLabel');
        var businessNameField = $('#sowBusinessName');
        var entityTypeField = $('#sowEntityType');
        var stateOfFormationField = $('#sowStateOfFormation');
        var repNameField = $('#sowRepName');
        var repTitleField = $('#sowRepTitle');
        var businessEmailField = $('#sowBusinessEmail');
        var businessPhoneField = $('#sowBusinessPhone');

        if (sow.isBusinessEntity && entityTypeToggle) {
            entityTypeToggle.checked = true;
            if (individualFields) individualFields.style.display = 'none';
            if (businessFields) businessFields.style.display = 'block';
            if (individualLabel) individualLabel.classList.remove('active');
            if (businessLabel) businessLabel.classList.add('active');

            // Populate business fields
            if (businessNameField) businessNameField.value = sow.businessName || '';
            if (entityTypeField) entityTypeField.value = sow.entityType || '';
            if (stateOfFormationField) stateOfFormationField.value = sow.stateOfFormation || '';
            if (repNameField) repNameField.value = sow.representativeName || '';
            if (repTitleField) repTitleField.value = sow.representativeTitle || '';

            // Handle business email/phone based on clientIdToggle
            if (sow.clientPhone && !sow.clientEmail) {
                if (businessEmailField) businessEmailField.style.display = 'none';
                if (businessPhoneField) {
                    businessPhoneField.style.display = 'block';
                    businessPhoneField.value = formatPhoneNumber(sow.clientPhone);
                }
            } else {
                if (businessPhoneField) businessPhoneField.style.display = 'none';
                if (businessEmailField) {
                    businessEmailField.style.display = 'block';
                    businessEmailField.value = sow.clientEmail || '';
                }
            }
        } else if (entityTypeToggle) {
            // Individual mode (default)
            entityTypeToggle.checked = false;
            if (businessFields) businessFields.style.display = 'none';
            if (individualFields) individualFields.style.display = 'block';
            if (businessLabel) businessLabel.classList.remove('active');
            if (individualLabel) individualLabel.classList.add('active');
        }

        // Populate deferred payment fields
        if (sow.payment && sow.payment.deferred && sow.payment.deferred.enabled) {
            var deferred = sow.payment.deferred;
            var deferredCheckbox = $('#sowDeferredPayment');
            var deferredFields = $('#deferredPaymentFields');

            if (deferredCheckbox) {
                deferredCheckbox.checked = true;
                if (deferredFields) deferredFields.style.display = 'block';

                // Set split type
                var splitRadio = document.querySelector('input[name="deferred_split"][value="' + deferred.splitType + '"]');
                if (splitRadio) splitRadio.checked = true;

                // Hide all field sections first
                var lumpSumFields = $('#lumpSumFields');
                var recurringFields = $('#recurringFields');
                var customSplitFields = $('#customSplitFields');
                if (lumpSumFields) lumpSumFields.style.display = 'none';
                if (recurringFields) recurringFields.style.display = 'none';
                if (customSplitFields) customSplitFields.style.display = 'none';

                if (deferred.splitType === 'custom') {
                    if (customSplitFields) customSplitFields.style.display = 'block';

                    // Populate custom schedule
                    var list = $('#customPaymentsList');
                    if (list && deferred.customSchedule && deferred.customSchedule.length > 0) {
                        list.innerHTML = '';
                        deferred.customSchedule.forEach(function(payment) {
                            if (typeof addCustomPaymentRow === 'function') {
                                addCustomPaymentRow();
                                var lastRow = list.lastElementChild;
                                if (lastRow) {
                                    var amountInput = lastRow.querySelector('.custom-payment-amount');
                                    var dateInput = lastRow.querySelector('.custom-payment-date');
                                    if (amountInput) amountInput.value = payment.amount || '';
                                    if (dateInput) dateInput.value = payment.dueDate || '';
                                }
                            }
                        });
                    }
                } else if (deferred.splitType === 'recurring') {
                    if (recurringFields) recurringFields.style.display = 'block';

                    // Populate recurring fields
                    var recurringTotalField = $('#sowRecurringTotalAmount');
                    var recurringStartField = $('#sowRecurringStartDate');
                    var recurringFrequencyField = $('#sowRecurringFrequency');
                    var recurringCalcModeField = $('#sowRecurringCalcMode');
                    var recurringAmountField = $('#sowRecurringPaymentAmount');
                    var recurringCountField = $('#sowRecurringPaymentCount');

                    if (recurringTotalField) recurringTotalField.value = deferred.deferredAmount || '';
                    if (recurringStartField) recurringStartField.value = deferred.startDate || '';
                    if (recurringFrequencyField) recurringFrequencyField.value = deferred.frequency || 'biweekly';
                    if (recurringCalcModeField) recurringCalcModeField.value = deferred.calculationMode || 'amount';

                    // Toggle calc mode fields
                    if (typeof toggleRecurringCalcMode === 'function') {
                        toggleRecurringCalcMode();
                    }

                    if (deferred.calculationMode === 'amount') {
                        if (recurringAmountField) recurringAmountField.value = deferred.amountPerPayment || '';
                    } else {
                        if (recurringCountField) recurringCountField.value = deferred.numberOfPayments || '';
                    }

                    // Update schedule preview
                    if (typeof updateRecurringSchedule === 'function') {
                        updateRecurringSchedule();
                    }
                } else {
                    // Lump sum
                    if (lumpSumFields) lumpSumFields.style.display = 'block';
                    var deferredAmountField = $('#sowDeferredAmount');
                    var deferredDueDateField = $('#sowDeferredDueDate');
                    if (deferredAmountField) deferredAmountField.value = deferred.deferredAmount || '';
                    if (deferredDueDateField) deferredDueDateField.value = deferred.dueDate || '';
                }

                // Update card styling for selected type
                var cards = document.querySelectorAll('.deferred-type-card');
                cards.forEach(function(card) {
                    var radio = card.querySelector('input[type="radio"]');
                    if (radio && radio.checked) {
                        card.style.borderColor = '#6366f1';
                        card.style.background = 'rgba(99, 102, 241, 0.15)';
                    } else {
                        card.style.borderColor = 'transparent';
                        card.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                });

                // Set options
                var waiveLateFeeCheckbox = $('#sowWaiveLateFee');
                var allowPartialCheckbox = $('#sowAllowPartialPayments');
                var maintenanceDuringCheckbox = $('#sowMaintenanceDuringDeferral');

                if (waiveLateFeeCheckbox) waiveLateFeeCheckbox.checked = deferred.lateFeeWaived || deferred.feeWaived || false;
                if (allowPartialCheckbox) allowPartialCheckbox.checked = deferred.allowPartialPayments !== false;
                if (maintenanceDuringCheckbox) maintenanceDuringCheckbox.checked = deferred.maintenanceDuringDeferral !== false;

                // Recalculate display
                if (typeof calculateLateFee === 'function') {
                    calculateLateFee();
                }
            }
        }

        // Pricing data structures (2025 Scarlo Pricing Guide - Revised)
        var packagePricing = {
            'essential': { min: 1000, max: 3000, default: 2000 },
            'starter': { min: 3000, max: 6000, default: 4500 },
            'growth': { min: 6000, max: 12000, default: 9000 },
            'professional': { min: 12000, max: 25000, default: 18500 },
            'enterprise': { min: 25000, max: 50000, default: 37500 }
        };
        var maintenancePricing = {
            'none': 0,
            'basic': 167,       // $110-$225/mo avg
            'professional': 335, // $220-$450/mo avg
            'premium': 670       // $440-$900/mo avg
        };
        // Feature pricing based on complexity (Fresno, CA market rates)
        var featurePricing = {
            // Standard Features (included in tiers)
            'responsive_design': { default: 200, thirdParty: false },
            'custom_ui': { default: 450, thirdParty: false },
            'animations': { default: 275, thirdParty: false },
            'seo_optimization': { default: 200, thirdParty: false },
            'analytics': { default: 175, thirdParty: false },
            'contact_forms': { default: 250, thirdParty: false },
            // Backend Features (included in higher tiers)
            'firebase_auth': { default: 350, thirdParty: true, note: 'Firebase costs' },
            'firebase_db': { default: 425, thirdParty: true, note: 'Firebase costs' },
            'user_profiles': { default: 550, thirdParty: false },
            'file_storage': { default: 300, thirdParty: true, note: 'Firebase costs' },
            'api_integration': { default: 450, thirdParty: false },
            'email_integration': { default: 325, thirdParty: true, note: 'SendGrid costs' },
            'newsletter': { default: 200, thirdParty: false, addon: true },
            'user_roles': { default: 450, thirdParty: false },
            'notifications': { default: 400, thirdParty: false },
            // Add-on Features (available to any tier)
            'booking_basic': { default: 450, thirdParty: false, addon: true },
            'booking_system': { default: 1100, thirdParty: false, addon: true },
            'blog': { default: 400, thirdParty: false, addon: true },
            'cms_integration': { default: 600, thirdParty: false, addon: true },
            'gallery': { default: 325, thirdParty: false, addon: true },
            'music_media': { default: 275, thirdParty: false, addon: true },
            'social_feed': { default: 250, thirdParty: false, addon: true }
        };
        // E-Commerce radio options (2025 Scarlo Pricing Guide)
        var ecommercePricing = {
            'none': { price: 0, label: t('ecommerce.none') },
            'basic_cart': { price: 5500, label: t('ecommerce.basicCart'), thirdParty: true, note: 'Stripe fees' },  // $3,000-$8,000
            'full_store': { price: 14000, label: t('ecommerce.fullStore'), thirdParty: true, note: 'Stripe fees' }    // $8,000-$20,000
        };
        // Package-feature mapping (hosting, ssl, domain included free in all packages)
        // Add-ons (booking, blog, cms, gallery, music, social_feed, newsletter) available separately for any tier
        var packageIncludedFeatures = {
            'essential': ['responsive_design', 'contact_forms'],
            'starter': ['responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'contact_forms'],
            'growth': ['responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'firebase_auth', 'contact_forms'],
            'professional': ['responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'firebase_auth', 'firebase_db', 'user_profiles', 'file_storage', 'api_integration', 'contact_forms', 'email_integration', 'newsletter'],
            'enterprise': ['responsive_design', 'custom_ui', 'animations', 'seo_optimization', 'analytics', 'firebase_auth', 'firebase_db', 'user_profiles', 'user_roles', 'file_storage', 'api_integration', 'contact_forms', 'email_integration', 'notifications', 'newsletter'],
            'custom': []
        };

        // Check selected features and apply included markers
        var packageType = sow.packageType || '';
        var includedFeatures = packageIncludedFeatures[packageType] || [];

        if (sow.features && sow.features.length > 0) {
            console.log('Checking', sow.features.length, 'features');
            var checkboxes = document.querySelectorAll('.sow-checkboxes input[type="checkbox"]');
            checkboxes.forEach(function(checkbox) {
                checkbox.checked = false; // Uncheck all first
                checkbox.parentElement.classList.remove('feature-included');

                var label = checkbox.parentElement.textContent.trim();
                // Remove third-party note from label for comparison
                var thirdPartyNote = checkbox.parentElement.querySelector('.third-party-note');
                if (thirdPartyNote) {
                    label = label.replace(thirdPartyNote.textContent, '').trim();
                }

                if (sow.features.some(function(f) { return f.indexOf(label) !== -1 || label.indexOf(f) !== -1; })) {
                    checkbox.checked = true;
                }

                // Mark as included if in package
                if (includedFeatures.indexOf(checkbox.value) !== -1) {
                    checkbox.parentElement.classList.add('feature-included');
                }
            });
        }

        // Restore e-commerce selection
        var ecommerceOption = 'none';
        if (sow.payment && sow.payment.breakdown && sow.payment.breakdown.ecommerceOption) {
            ecommerceOption = sow.payment.breakdown.ecommerceOption;
        }
        var ecommerceRadio = document.querySelector('input[name="ecommerce_option"][value="' + ecommerceOption + '"]');
        if (ecommerceRadio) ecommerceRadio.checked = true;

        // Restore coupon selection
        var couponSelect = $('#sowCouponSelect');
        if (couponSelect && sow.couponCode) {
            couponSelect.value = sow.couponCode;
        }

        // Update pricing display with all parameters
        setTimeout(function() {
            self.updateSOWPricing(packagePricing, maintenancePricing, featurePricing, ecommercePricing, packageIncludedFeatures);
        }, 100);
        
        // Update form title
        var formHeader = $('.sow-form-header h4');
        if (formHeader) {
            formHeader.innerHTML = '✏️ Edit Statement of Work';
        }

        // Add change request context banner if editing from a change request
        if (sow.editingFromChangeRequest) {
            var changeReq = sow.editingFromChangeRequest;
            var sectionLabels = {
                'package': t('changeOrder.section.package'),
                'features': t('changeOrder.section.features'),
                'timeline': t('changeOrder.section.timeline'),
                'payment': t('changeOrder.section.payment'),
                'maintenance': t('changeOrder.section.maintenance'),
                'other': t('changeOrder.section.other')
            };
            var sectionsHtml = changeReq.sections.map(function(s) {
                return '<span style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px;">' + (sectionLabels[s] || s) + '</span>';
            }).join('');

            var bannerHtml = '<div id="changeRequestBanner" style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%); border: 1px solid rgba(251, 191, 36, 0.4); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">' +
                '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">' +
                '<h5 style="margin: 0; color: #fbbf24; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">📝 Change Request from ' + changeReq.clientName + '</h5>' +
                '<button onclick="document.getElementById(\'changeRequestBanner\').remove()" style="background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1.25rem; line-height: 1; padding: 0;">&times;</button>' +
                '</div>' +
                '<div style="margin-bottom: 0.75rem;">' + sectionsHtml + '</div>' +
                '<div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 0.75rem; max-height: 120px; overflow-y: auto;">' +
                '<p style="margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.9); white-space: pre-wrap; line-height: 1.5;">' + changeReq.description + '</p>' +
                '</div>' +
                '</div>';

            var formBody = document.querySelector('.sow-creator-form');
            if (formBody) {
                var firstSection = formBody.querySelector('.sow-form-section');
                if (firstSection) {
                    firstSection.insertAdjacentHTML('beforebegin', bannerHtml);
                }
            }

            // Store change request ID for later status update
            self.currentEditChangeRequestId = changeReq.id;
        }
        
        // Replace save button with update button
        var saveBtn = $('.btn-save-sow');
        if (saveBtn) {
            var newBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newBtn, saveBtn);
            
            newBtn.innerHTML = '<span class="btn-icon">💾</span> Update SOW';
            newBtn.onclick = function(e) {
                e.preventDefault();
                self.updateSOW(sow.id);
            };
        }
        
        console.log('✓ Form populated for editing');
    }, 250);
};

// ============= NEW: Update SOW (instead of create new) =============
ContractFormHandler.prototype.updateSOW = function(sowId) {
    // Check if business entity mode
    var isBusinessEntity = $('#sowEntityTypeToggle') && $('#sowEntityTypeToggle').checked;

    // Individual client fields
    var clientName = $('#sowClientName').value.trim();
    var clientEmail = $('#sowClientEmail').value.trim();
    var clientPhoneRaw = $('#sowClientPhone').value.trim();

    // Business entity fields
    var businessName = $('#sowBusinessName') ? $('#sowBusinessName').value.trim() : '';
    var entityType = $('#sowEntityType') ? $('#sowEntityType').value : '';
    var stateOfFormation = $('#sowStateOfFormation') ? $('#sowStateOfFormation').value.trim() : '';
    var repName = $('#sowRepName') ? $('#sowRepName').value.trim() : '';
    var repTitle = $('#sowRepTitle') ? $('#sowRepTitle').value.trim() : '';
    var businessEmail = $('#sowBusinessEmail') ? $('#sowBusinessEmail').value.trim() : '';
    var businessPhoneRaw = $('#sowBusinessPhone') ? $('#sowBusinessPhone').value.trim() : '';

    var packageType = $('#sowPackage').value;
    var weeks = $('#sowWeeks').value;
    var startDate = $('#sowStartDate').value;
    var notes = $('#sowNotes').value.trim();
    var maintenancePlan = $('#sowMaintenance').value;

    // Check if retroactive project (weeks not required if retroactive)
    var isRetroactive = $('#sowRetroactive') && $('#sowRetroactive').checked;
    var devDuration = $('#sowDevDuration') ? $('#sowDevDuration').value : '';
    var retroactiveEndDate = $('#sowRetroactiveEndDate') ? $('#sowRetroactiveEndDate').value : '';

    // Normalize phone to E.164 format (+1XXXXXXXXXX) for Firebase Auth matching
    var clientPhone = '';
    if (clientPhoneRaw) {
        var digits = clientPhoneRaw.replace(/\D/g, '');
        if (digits.length === 10) {
            clientPhone = '+1' + digits;
        } else if (digits.length === 11 && digits.startsWith('1')) {
            clientPhone = '+' + digits;
        } else {
            clientPhone = clientPhoneRaw; // Keep as-is if unusual format
        }
    }

    // Normalize business phone to E.164 format
    var businessPhone = '';
    if (businessPhoneRaw) {
        var bizDigits = businessPhoneRaw.replace(/\D/g, '');
        if (bizDigits.length === 10) {
            businessPhone = '+1' + bizDigits;
        } else if (bizDigits.length === 11 && bizDigits.startsWith('1')) {
            businessPhone = '+' + bizDigits;
        } else {
            businessPhone = businessPhoneRaw;
        }
    }

    // Validate required fields based on entity type
    var missingFields = [];

    if (isBusinessEntity) {
        // Validate business entity fields
        if (!businessName) missingFields.push('Business Legal Name');
        if (!entityType) missingFields.push('Entity Type');
        if (!repName) missingFields.push('Representative Name');
        if (!repTitle) missingFields.push('Representative Title');
        if (!packageType) missingFields.push('Package Tier');
        // For retroactive projects, check devDuration instead of weeks
        if (isRetroactive) {
            if (!devDuration) missingFields.push('Development Duration');
        } else {
            if (!weeks) missingFields.push('Estimated Weeks');
        }

        if (missingFields.length > 0) {
            alert(t('sow.val.fillRequired') + missingFields.join('\n- '));
            return;
        }
        if (!businessEmail && !businessPhone) {
            alert(t('sow.val.businessEmailOrPhone'));
            return;
        }
    } else {
        // Validate individual fields
        if (!clientName) missingFields.push('Client Name');
        if (!packageType) missingFields.push('Package Tier');
        // For retroactive projects, check devDuration instead of weeks
        if (isRetroactive) {
            if (!devDuration) missingFields.push('Development Duration');
        } else {
            if (!weeks) missingFields.push('Estimated Weeks');
        }

        if (missingFields.length > 0) {
            alert(t('sow.val.fillRequired') + missingFields.join('\n- '));
            return;
        }
        if (!clientEmail && !clientPhone) {
            alert(t('sow.val.clientEmailOrPhone'));
            return;
        }
    }

    // Get selected features
    var features = [];
    var checkboxes = document.querySelectorAll('.sow-checkboxes input[type="checkbox"]:checked');
    checkboxes.forEach(function(checkbox) {
        var label = checkbox.parentElement.textContent.trim();
        // Remove third-party note from label
        var thirdPartyNote = checkbox.parentElement.querySelector('.third-party-note');
        if (thirdPartyNote) {
            label = label.replace(thirdPartyNote.textContent, '').trim();
        }
        features.push(label);
    });

    // Get e-commerce selection
    var ecommerceRadio = document.querySelector('input[name="ecommerce_option"]:checked');
    var ecommerceOption = ecommerceRadio ? ecommerceRadio.value : 'none';

    // Use stored pricing data from real-time calculation
    var pricingData = this.currentPricingData || {
        basePrice: 0,
        packageType: packageType,
        addOns: [],
        discounts: [],
        ecommerceOption: ecommerceOption,
        ecommercePrice: 0,
        total: 0
    };

    var totalPrice = pricingData.total;

    // Get selected coupon
    var couponSelect = $('#sowCouponSelect');
    var selectedCouponCode = couponSelect ? couponSelect.value : '';

    // Get retroactive duration unit (isRetroactive and devDuration already declared above)
    var devDurationUnit = $('#sowDevDurationUnit') ? $('#sowDevDurationUnit').value : 'weeks';
    var devDurationParsed = devDuration ? parseInt(devDuration) || null : null;

    // Get deferred payment settings
    var deferredEnabled = $('#sowDeferredPayment') && $('#sowDeferredPayment').checked;
    var deferredData = {
        enabled: deferredEnabled,
        splitType: 'lump_sum',
        dueDate: null,
        deferredAmount: 0,
        lateFee: 0,
        lateFeeWaived: false,
        allowPartialPayments: true,
        maintenanceDuringDeferral: true,
        customSchedule: [],
        // Recurring payment plan fields
        frequency: null,
        startDate: null,
        calculationMode: null,
        amountPerPayment: null,
        numberOfPayments: null,
        acknowledgmentSigned: false,
        acknowledgmentDate: null
    };

    if (deferredEnabled) {
        var splitTypeRadio = document.querySelector('input[name="deferred_split"]:checked');
        deferredData.splitType = splitTypeRadio ? splitTypeRadio.value : 'lump_sum';
        deferredData.lateFeeWaived = $('#sowWaiveLateFee') && $('#sowWaiveLateFee').checked;
        deferredData.allowPartialPayments = $('#sowAllowPartialPayments') ? $('#sowAllowPartialPayments').checked : true;
        deferredData.maintenanceDuringDeferral = $('#sowMaintenanceDuringDeferral') ? $('#sowMaintenanceDuringDeferral').checked : true;

        if (deferredData.splitType === 'custom') {
            var schedule = [];
            var customRows = document.querySelectorAll('.custom-payment-row');
            customRows.forEach(function(row) {
                var amountInput = row.querySelector('.custom-payment-amount');
                var dateInput = row.querySelector('.custom-payment-date');
                var amount = parseFloat(amountInput ? amountInput.value : 0) || 0;
                var date = dateInput ? dateInput.value : null;
                if (amount > 0) {
                    schedule.push({ amount: amount, dueDate: date });
                }
            });
            deferredData.customSchedule = schedule;
            deferredData.deferredAmount = schedule.reduce(function(sum, item) { return sum + item.amount; }, 0);
        } else if (deferredData.splitType === 'recurring') {
            // Recurring payment plan
            deferredData.deferredAmount = parseFloat($('#sowRecurringTotalAmount') ? $('#sowRecurringTotalAmount').value : 0) || 0;
            deferredData.startDate = $('#sowRecurringStartDate') ? $('#sowRecurringStartDate').value : null;
            deferredData.frequency = $('#sowRecurringFrequency') ? $('#sowRecurringFrequency').value : 'biweekly';
            deferredData.calculationMode = $('#sowRecurringCalcMode') ? $('#sowRecurringCalcMode').value : 'amount';

            if (deferredData.calculationMode === 'amount') {
                deferredData.amountPerPayment = parseFloat($('#sowRecurringPaymentAmount') ? $('#sowRecurringPaymentAmount').value : 0) || 0;
            } else {
                deferredData.numberOfPayments = parseInt($('#sowRecurringPaymentCount') ? $('#sowRecurringPaymentCount').value : 0) || 0;
            }

            // Generate the schedule using the same function used for preview
            var amountOrCount = deferredData.calculationMode === 'amount' ? deferredData.amountPerPayment : deferredData.numberOfPayments;
            deferredData.customSchedule = generateRecurringSchedule(
                deferredData.deferredAmount,
                deferredData.startDate,
                deferredData.frequency,
                deferredData.calculationMode,
                amountOrCount
            );
        } else {
            // Lump sum
            deferredData.deferredAmount = parseFloat($('#sowDeferredAmount') ? $('#sowDeferredAmount').value : 0) || 0;
            deferredData.dueDate = $('#sowDeferredDueDate') ? $('#sowDeferredDueDate').value : null;
        }

        // Late fee only applies if payment is late (stored for PDF terms)
        deferredData.lateFee = deferredData.lateFeeWaived ? 0 : (deferredData.deferredAmount * 0.10);

        // Validation
        if (deferredData.deferredAmount <= 0) {
            alert(t('sow.val.deferredAmount'));
            return;
        }
        if (deferredData.splitType === 'lump_sum' && !deferredData.dueDate) {
            alert(t('sow.val.deferredDueDate'));
            return;
        }
        if (deferredData.splitType === 'custom' && deferredData.customSchedule.length === 0) {
            alert(t('sow.val.customSchedule'));
            return;
        }
        if (deferredData.splitType === 'recurring') {
            if (!deferredData.startDate) {
                alert(t('sow.val.firstPaymentDate'));
                return;
            }
            if (deferredData.calculationMode === 'amount' && (!deferredData.amountPerPayment || deferredData.amountPerPayment <= 0)) {
                alert(t('sow.val.paymentAmount'));
                return;
            }
            if (deferredData.calculationMode === 'count' && (!deferredData.numberOfPayments || deferredData.numberOfPayments < 2)) {
                alert(t('sow.val.paymentCount'));
                return;
            }
            if (deferredData.customSchedule.length === 0) {
                alert(t('sow.val.scheduleError'));
                return;
            }
        }
        if (deferredData.deferredAmount > totalPrice) {
            alert(t('sow.val.deferredExceedsTotal'));
            return;
        }
    }

    var sowData = {
        // Use business name as primary if business entity, otherwise individual name
        clientName: isBusinessEntity ? businessName : clientName,
        clientEmail: isBusinessEntity ? (businessEmail || '') : (clientEmail || ''),
        clientPhone: isBusinessEntity ? (normalizeToE164(businessPhone) || '') : (normalizeToE164(clientPhone) || ''),
        packageType: packageType,
        estimatedWeeks: isRetroactive ? (devDurationParsed || null) : parseInt(weeks),
        startDate: isRetroactive ? (retroactiveEndDate || null) : (startDate || null),
        features: features,
        notes: notes,
        maintenancePlan: maintenancePlan,
        isRetroactive: isRetroactive,
        devDuration: devDurationParsed,
        devDurationUnit: devDurationUnit,
        retroactiveEndDate: isRetroactive ? (retroactiveEndDate || null) : null,
        couponCode: selectedCouponCode || null,
        // Business entity information
        isBusinessEntity: isBusinessEntity,
        businessName: isBusinessEntity ? businessName : '',
        entityType: isBusinessEntity ? entityType : '',
        stateOfFormation: isBusinessEntity ? stateOfFormation : '',
        representativeName: isBusinessEntity ? repName : '',
        representativeTitle: isBusinessEntity ? repTitle : '',
        payment: {
            total: totalPrice,
            deposit: totalPrice * 0.50,
            milestone1: totalPrice * 0.25,
            final: totalPrice * 0.25,
            breakdown: {
                basePrice: pricingData.basePrice,
                addOns: pricingData.addOns,
                discounts: pricingData.discounts,
                ecommerceOption: pricingData.ecommerceOption,
                ecommercePrice: pricingData.ecommercePrice,
                couponCode: selectedCouponCode || null,
                couponDiscount: pricingData.couponDiscount || 0
            },
            deferred: deferredData
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    var self = this;

    firebase.firestore().collection('sow_documents').doc(sowId).update(sowData)
        .then(function() {
            console.log('SOW updated successfully');

            // If editing from a change request, mark it as completed
            if (self.currentEditChangeRequestId) {
                return firebase.firestore().collection('change_requests')
                    .doc(self.currentEditChangeRequestId)
                    .update({
                        status: 'completed',
                        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                    .then(function() {
                        // Also update SOW to reflect completed change request
                        return firebase.firestore().collection('sow_documents')
                            .doc(sowId)
                            .update({
                                changeRequestStatus: 'completed',
                                lastChangeOrderApplied: firebase.firestore.FieldValue.serverTimestamp()
                            });
                    })
                    .then(function() {
                        self.currentEditChangeRequestId = null; // Clear the reference
                        alert(t('sow.msg.updateChangeSuccess'));
                    });
            } else {
                alert(t('sow.msg.updateSuccess'));
            }
        })
        .then(function() {
            $('#sowCreatorContainer').style.display = 'none';
            self.loadSOWDocuments(); // Refresh the list
        })
        .catch(function(error) {
            console.error('Error updating SOW:', error);
            alert(t('sow.err.update') + error.message);
        });
};


    ContractFormHandler.prototype.selectContractToSign = function(contractId, contracts) {
        var self = this;
        
        // Find the contract
        var contract = contracts.find(function(c) { return c.id === contractId; });
        if (!contract) {
            alert(t('contract.err.notFound'));
            return;
        }
        
        console.log('Selected contract to sign:', contractId);
        
        // Store as current contract
        this.currentContract = { id: contractId, data: contract };
        
        // Hide dashboard
        var dashboard = $('#developerDashboard');
        if (dashboard) dashboard.style.display = 'none';
        
        // SHOW the contract form
        var contractForm = $('#contractForm');
        if (contractForm) {
            contractForm.style.display = 'block';
        }
        
        // Show the contract form sections
        this.showContractSigningForm(contract);
    };
    
    ContractFormHandler.prototype.showContractSigningForm = function(contract) {
    var self = this;
    
    // Make sure contract form is visible
    var contractForm = $('#contractForm');
    if (contractForm) {
        contractForm.style.display = 'block';
    }
    
    // ✅ SHOW modal header when signing a contract
    var modalHeader = $('.modal-header');
    if (modalHeader) {
        modalHeader.style.display = 'block';
    }
    
    // ✅ SHOW the original modal-close button and reset positioning
    var modalClose = $('.modal-close');
    if (modalClose) {
        modalClose.style.display = 'flex';
        modalClose.style.position = '';
        modalClose.style.top = '';
        modalClose.style.alignSelf = '';
        modalClose.style.marginRight = '';
        modalClose.style.marginTop = '';
        modalClose.style.marginBottom = '';
        modalClose.style.flexShrink = '';
    }
    
    // Show developer signature block
    var devBlock = $('#devSignatureBlock');
    if (devBlock) {
        devBlock.style.display = 'block';
        var devInputs = devBlock.querySelectorAll('input');
        devInputs.forEach(function(input) {
            input.disabled = false;
        });
        
        var devHeader = devBlock.querySelector('h3');
        if (devHeader) {
            devHeader.innerHTML = t('contract.label.devSig') + ' <span style="font-size: 12px; color: #f59e0b;">' + t('contract.label.signBelow') + '</span>';
        }
    }
        
        // Set today's date for developer
        var today = new Date().toISOString().split('T')[0];
        var devDate = $('#devDate');
        if (devDate) devDate.value = today;
        
        // Populate form with client data
        this.populateFormWithContract(contract);
        
        // Show submit button
        var submitBtn = $('#submitBtn');
        if (submitBtn) {
            submitBtn.style.display = 'inline-flex';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span id="submitBtnText">' + t('contract.btn.uploadFinalize') + '</span>';
            submitBtn.style.background = '';
        }
        
        // Add back button to return to dashboard (remove existing one first)
        var existingBackBtn = $('#backToDashboard');
        if (existingBackBtn) {
            existingBackBtn.remove();
        }
        
        var backBtn = document.createElement('button');
        backBtn.id = 'backToDashboard';
        backBtn.className = 'btn btn-secondary';
        backBtn.innerHTML = t('contract.btn.backDashboard');
        backBtn.style.marginRight = '10px';
        backBtn.onclick = function(e) {
            e.preventDefault();
            self.showDeveloperDashboard();
            // Reset signature pad
            if (self.devSignaturePad) self.devSignaturePad.clear();
        };
        
        var actionButtons = $('.action-buttons');
        if (actionButtons) {
            actionButtons.insertBefore(backBtn, actionButtons.firstChild);
        }
        
        // Initialize developer signature pad
        setTimeout(function() {
            var devCanvas = document.getElementById('devSignaturePad');
            if (devCanvas) {
                self.devSignaturePad = createSignaturePad(devCanvas);
                console.log('Dev signature pad initialized for signing');
            }
        }, 200);
    };
    
    ContractFormHandler.prototype.viewCompletedContract = function(contractId, contracts) {
        var self = this;
        
        // Find the contract
        var contract = contracts.find(function(c) { return c.id === contractId; });
        if (!contract) {
            alert(t('contract.err.notFound'));
            return;
        }
        
        console.log('Viewing completed contract:', contractId);
        
        // Store as current contract for PDF generation
        this.currentContract = { id: contractId, data: contract };
        
        // Generate PDF directly
        this.generatePDF();
    };

    ContractFormHandler.prototype.setupClientView = function() {
    console.log('Setting up client view - dual signing mode');

    var self = this;
    var user = firebase.auth().currentUser;

    // ============= ENSURE CLOSE BUTTON IS VISIBLE =============
    var modalClose = $('.modal-close');
    if (modalClose) {
        modalClose.style.display = 'flex';
    }

    // ============= CHECK FOR EXISTING SUBMISSIONS FIRST =============
    var userEmail = user.email;
    var userPhone = user.phoneNumber;

    // Build query based on auth type
    var contractQuery;
    if (userEmail) {
        console.log('Checking existing contracts by email:', userEmail);
        contractQuery = firebase.firestore().collection('contracts')
            .where('clientEmail', '==', userEmail)
            .where('status', 'in', ['pending_developer', 'completed'])
            .orderBy('timestamp', 'desc')
            .limit(1);
    } else if (userPhone) {
        // Try multiple phone formats since stored format may vary
        var digits = userPhone.replace(/\D/g, '');
        var tenDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
        var phoneFormats = [
            userPhone,                                                    // +15591231010
            digits,                                                       // 15591231010
            tenDigits,                                                    // 5591231010
            '(' + tenDigits.slice(0,3) + ') ' + tenDigits.slice(3,6) + '-' + tenDigits.slice(6)  // (559) 123-1010
        ];
        console.log('Checking existing contracts by phone formats:', phoneFormats);

        // Try each format sequentially
        var tryFormat = function(index) {
            if (index >= phoneFormats.length) {
                console.log('No existing contract found for phone user');
                self.proceedWithClientSetup();
                return;
            }
            firebase.firestore().collection('contracts')
                .where('clientPhone', '==', phoneFormats[index])
                .where('status', 'in', ['pending_developer', 'completed'])
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get()
                .then(function(snapshot) {
                    if (!snapshot.empty) {
                        var contractDoc = snapshot.docs[0];
                        var contractData = contractDoc.data();
                        contractData.id = contractDoc.id;
                        console.log('Found existing contract with format:', phoneFormats[index]);
                        var completedContainer = document.getElementById('dualSigningCompleted');
                        if (completedContainer) {
                            completedContainer.style.display = 'block';
                        } else {
                            self.showExistingCompletion(contractData);
                        }
                    } else {
                        tryFormat(index + 1);
                    }
                })
                .catch(function() {
                    tryFormat(index + 1);
                });
        };
        tryFormat(0);
        return;
    } else {
        console.log('No email or phone - proceeding to setup');
        return self.proceedWithClientSetup();
    }

    // Check if user already has a pending or completed contract (email path only now)
    contractQuery.get()
        .then(function(contractSnapshot) {
            if (!contractSnapshot.empty) {
                // Contract exists - check if it's completed or pending
                var contractDoc = contractSnapshot.docs[0];
                var contractData = contractDoc.data();
                contractData.id = contractDoc.id;
                
                console.log('Found existing contract with status:', contractData.status);
                
                // Show completed view directly - don't show signing interface again
                var completedContainer = document.getElementById('dualSigningCompleted');
                if (completedContainer) {
                    completedContainer.style.display = 'block';
                    console.log('Showing existing completion view');
                } else {
                    // Recreate completion view
                    self.showExistingCompletion(contractData);
                }
                
                return; // STOP HERE - don't show signing interface
            }
            
            // No existing contract - proceed with normal flow
            return self.proceedWithClientSetup();
        })
        .catch(function(error) {
            console.error('Error checking existing contracts:', error);
            self.proceedWithClientSetup(); // Fallback to normal flow
        });
};

// New helper function for when no existing contract found
ContractFormHandler.prototype.proceedWithClientSetup = function() {
    var self = this;
    
    // ============= SHOW CLIENT SIGNATURE BLOCK =============
    var clientBlock = $('#clientSignatureBlock');
    if (clientBlock) {
        clientBlock.style.display = 'block';
        clientBlock.style.pointerEvents = 'auto';
        clientBlock.classList.remove('signature-locked');
    }
    
    // Hide developer signature block
    var devBlock = $('#devSignatureBlock');
    if (devBlock) {
        devBlock.style.display = 'none';
        var devInputs = devBlock.querySelectorAll('input');
        devInputs.forEach(function(input) {
            input.disabled = true;
            input.removeAttribute('required');
        });
    }
    
    var devPending = $('#devPendingBlock');
    if (devPending) devPending.style.display = 'block';
    
    var downloadBtn = $('#downloadBtn');
    if (downloadBtn) downloadBtn.style.display = 'none';
    
    // ============= CHECK FOR SOW WITHOUT POPUP =============
    var user = firebase.auth().currentUser;
    var userEmail = user.email;
    var userPhone = user.phoneNumber;

    // Build query based on auth type
    var sowQuery;
    if (userEmail) {
        // Email user - query by email
        console.log('Querying SOW by email:', userEmail);
        sowQuery = firebase.firestore().collection('sow_documents')
            .where('clientEmail', '==', userEmail)
            .orderBy('createdAt', 'desc')
            .limit(1);
    } else if (userPhone) {
        // Try multiple phone formats since stored format may vary
        var digits = userPhone.replace(/\D/g, '');
        var tenDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
        var phoneFormats = [
            userPhone,                                                    // +15591231010
            digits,                                                       // 15591231010
            tenDigits,                                                    // 5591231010
            '(' + tenDigits.slice(0,3) + ') ' + tenDigits.slice(3,6) + '-' + tenDigits.slice(6)  // (559) 123-1010
        ];
        console.log('Querying SOW by phone formats:', phoneFormats);

        // Try each format sequentially
        var tryFormat = function(index) {
            if (index >= phoneFormats.length) {
                console.log('⚠️ No SOW found for client (tried all phone formats)');
                self.showNoSOWNotification();
                return;
            }
            firebase.firestore().collection('sow_documents')
                .where('clientPhone', '==', phoneFormats[index])
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get()
                .then(function(snapshot) {
                    if (!snapshot.empty) {
                        var sowDoc = snapshot.docs[0];
                        var sowData = sowDoc.data();
                        sowData.id = sowDoc.id;
                        console.log('✓ SOW found with format:', phoneFormats[index], 'ID:', sowData.id);
                        self.showDualSigningInterface(sowData);
                    } else {
                        tryFormat(index + 1);
                    }
                })
                .catch(function(error) {
                    console.error('Error querying SOW format', phoneFormats[index], error);
                    tryFormat(index + 1);
                });
        };
        tryFormat(0);
        return;
    } else {
        console.log('No email or phone found');
        self.showNoSOWNotification();
        return;
    }

    sowQuery.get()
        .then(function(snapshot) {
            if (snapshot.empty) {
                console.log('⚠️ No SOW found for client');
                self.showNoSOWNotification();
            } else {
                var sowDoc = snapshot.docs[0];
                var sowData = sowDoc.data();
                sowData.id = sowDoc.id;

                self.showDualSigningInterface(sowData);
            }
        })
        .catch(function(error) {
            console.error('Error fetching SOW:', error);
            self.showNoSOWNotification(error.message);
        });
};
ContractFormHandler.prototype.showNoSOWNotification = function(errorMsg) {
    var self = this;
    
    console.log('Showing no-SOW notification');
    
    // Hide client signature block
    var clientBlock = $('#clientSignatureBlock');
    if (clientBlock) clientBlock.style.display = 'none';
    
    // Disable and hide submit button
    var submitBtn = $('#submitBtn');
    if (submitBtn) {
        submitBtn.style.display = 'none';
        submitBtn.disabled = true;
    }
    
    // Create subtle notification banner with clickable Request Help link
    var notificationHTML =
        '<div class="sow-missing-notification">' +
        '<div class="notification-icon">📋</div>' +
        '<div class="notification-content">' +
        '<h4>' + t('signing.sowRequired') + '</h4>' +
        '<p>' + t('signing.sowRequiredMsg') + '</p>' +
        '<p class="notification-action">' + t('signing.sowRequiredAction') + ' <a href="#" class="request-help-link" style="color: #6366f1; text-decoration: underline; cursor: pointer; font-weight: 700;">' + t('signing.requestHelp') + '</a> ' + t('signing.sowRequiredAction2') + '</p>' +
        '</div>' +
        '</div>';
    
    // Insert notification at the top of the contract form
    var contractForm = $('#contractForm');
    if (contractForm) {
        var existingNotification = $('.sow-missing-notification');
        if (existingNotification) existingNotification.remove();
        
        contractForm.insertAdjacentHTML('afterbegin', notificationHTML);
        
        // Add click handler to the Request Help link
        var requestHelpLink = $('.request-help-link');
        if (requestHelpLink) {
            requestHelpLink.addEventListener('click', function(e) {
                e.preventDefault();
                var helpModal = $('#helpModal');
                if (helpModal) {
                    helpModal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                    document.body.classList.add('modal-open');
                    
                    // Pre-fill contact info if user is logged in
                    var currentUser = firebase.auth().currentUser;
                    if (currentUser) {
                        var contactField = $('#helpContact');
                        var contactLabel = $('#helpContactLabel');
                        if (contactField) {
                            if (currentUser.email) {
                                contactField.value = currentUser.email;
                                contactField.type = 'email';
                                contactField.placeholder = 'your@email.com';
                                if (contactLabel) contactLabel.textContent = t('help.label.email');
                            } else if (currentUser.phoneNumber) {
                                contactField.value = formatPhoneNumber(currentUser.phoneNumber);
                                contactField.type = 'tel';
                                contactField.placeholder = '(555) 123-4567';
                                if (contactLabel) contactLabel.textContent = t('help.label.phone');
                            }
                            contactField.setAttribute('readonly', 'readonly');
                            contactField.style.opacity = '0.7';
                        }
                    }
                }
            });
        }
    }
    
    // Highlight the "Request Help" button in the contract section too
    var requestHelpBtn = $('#requestHelpBtn');
    if (requestHelpBtn) {
        requestHelpBtn.style.animation = 'pulse 6s infinite';
        requestHelpBtn.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.18)';
    }
};
    
ContractFormHandler.prototype.showDualSigningInterface = function(sowData) {
    var self = this;

    console.log('Showing dual signing interface for:', sowData.clientName);

    // Store SOW data
    this.currentSOW = sowData;

    // Populate client info from SOW (read-only display)
    this.populateClientInfoFromSOW(sowData);

    // Hide the regular contract form
    var contractForm = $('#contractForm');
    if (contractForm) contractForm.style.display = 'none';
    
    // ============= HIDE ORIGINAL SUBMIT BUTTON =============
    var originalSubmitBtn = $('#submitBtn');
    if (originalSubmitBtn) {
        originalSubmitBtn.style.display = 'none';
    }
    
    // Create tabbed interface
    var modalContent = $('.modal-content');
    if (!modalContent) return;
    
    // ============= PREVENT DUPLICATE TABS =============
    // Remove any existing tabs first
    var existingTabs = $('#clientSigningTabs');
    if (existingTabs) {
        console.log('Removing existing tabs to prevent duplicates');
        existingTabs.remove();
    }
    
    // Insert tabs after close button
    var closeBtn = $('#closeModalBtn');

    // Make close button sticky so it stays visible while scrolling
    if (closeBtn) {
        closeBtn.style.position = 'sticky';
        closeBtn.style.top = '1rem';
        closeBtn.style.alignSelf = 'flex-end';
        closeBtn.style.marginRight = '1.5rem';
        closeBtn.style.marginTop = '1rem';
        closeBtn.style.marginBottom = '-2.5rem';
        closeBtn.style.flexShrink = '0';
    }

    var tabsContainer = document.createElement('div');
    tabsContainer.id = 'clientSigningTabs';
    tabsContainer.className = 'client-signing-tabs';
    
    tabsContainer.innerHTML =
        '<div class="signing-tabs-header">' +
        '<button class="signing-tab active" data-tab="contract">' +
        '<span class="tab-icon">📄</span>' +
        '<span class="tab-title">' + t('signing.contractAgreement') + '</span>' +
        '<span class="tab-status" id="contractStatus">' + t('signing.pending') + '</span>' +
        '</button>' +
        '<button class="signing-tab" data-tab="sow">' +
        '<span class="tab-icon">📋</span>' +
        '<span class="tab-title">' + t('signing.statementOfWork') + '</span>' +
        '<span class="tab-status" id="sowStatus">' + t('signing.pending') + '</span>' +
        '</button>' +
        '</div>' +

        '<div class="signing-tabs-content">' +
        // Contract Tab
        '<div class="signing-tab-pane active" data-tab="contract">' +
        '<div id="contractSigningContent"></div>' +
        '</div>' +

        // SOW Tab
        '<div class="signing-tab-pane" data-tab="sow">' +
        '<div id="sowSigningContent"></div>' +
        '</div>' +
        '</div>' +

        '<div class="signing-footer">' +
        '<div class="signing-progress">' +
        '<div class="progress-indicator">' +
        '<span class="progress-dot" id="contractDot"></span>' +
        '<span class="progress-line"></span>' +
        '<span class="progress-dot" id="sowDot"></span>' +
        '</div>' +
        '<p class="progress-text">' + t('signing.completeBoth') + '</p>' +
        '</div>' +
        '<button class="btn btn-primary" id="dualSignBtn">' +
        '<span id="dualSignBtnText">' + t('signing.nextSignSOW') + '</span>' +
        '</button>' +
        '</div>';    
    if (closeBtn && closeBtn.nextSibling) {
        modalContent.insertBefore(tabsContainer, closeBtn.nextSibling);
    } else {
        modalContent.appendChild(tabsContainer);
    }
    
    // Load contract content into first tab
    var contractContent = $('#contractSigningContent');
    if (contractContent) {
        // Add contract header
        var contractHeader = document.createElement('div');
        contractHeader.className = 'modal-header';
        contractHeader.innerHTML = '<h2>' + t('signing.contract') + '</h2>' +
            '<p class="modal-subtitle">Scarlo - Carlos Martin</p>';
        contractContent.appendChild(contractHeader);
        contractContent.appendChild(contractForm);
        contractForm.style.display = 'block';

        // ENSURE CLIENT FORM INPUTS ARE ENABLED AFTER DOM MOVE
        // This fixes the first-load issue where inputs become unresponsive
        var clientSignerName = document.getElementById('clientSignerName');
        if (clientSignerName) {
            clientSignerName.disabled = false;
            clientSignerName.required = true;
            clientSignerName.style.pointerEvents = 'auto';
        }

        var clientDate = document.getElementById('clientDate');
        if (clientDate) {
            clientDate.disabled = false;
            clientDate.required = true;
            clientDate.style.pointerEvents = 'auto';
            if (!clientDate.value) {
                clientDate.value = new Date().toISOString().split('T')[0];
            }
        }

        // Ensure acknowledgment checkbox section is visible and enabled
        var ackSection = document.querySelector('.acknowledgment');
        if (ackSection) {
            ackSection.style.display = 'block';
        }

        var acknowledgment = document.getElementById('acknowledgment');
        if (acknowledgment) {
            acknowledgment.disabled = false;
            acknowledgment.required = true;
        }
    }

    // Load SOW content into second tab
    this.renderSOWForClientSigning(sowData);

    // Re-apply language translations after DOM restructure
    // (contract form was moved into tab — data-i18n elements need re-translation)
    if (typeof getCurrentLang === 'function' && getCurrentLang() !== 'en') {
        var navInstance = window.navigation || (window.navInstance);
        if (navInstance && navInstance.applyLanguage) {
            navInstance.applyLanguage(getCurrentLang());
        } else {
            // Fallback: directly translate data-i18n elements
            document.querySelectorAll('[data-i18n]').forEach(function(el) {
                var key = el.getAttribute('data-i18n');
                var translated = t(key);
                if (translated && translated !== key) {
                    el.textContent = translated;
                }
            });
            document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
                var key = el.getAttribute('data-i18n-html');
                var translated = t(key);
                if (translated && translated !== key) {
                    el.innerHTML = translated;
                }
            });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
                var key = el.getAttribute('data-i18n-placeholder');
                var translated = t(key);
                if (translated && translated !== key) {
                    el.placeholder = translated;
                }
            });
        }
    }

    // Setup tab switching
    $$('.signing-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            var tabName = this.getAttribute('data-tab');
            self.switchSigningTab(tabName);
        });
    });
    
    // Setup dual-purpose button (Next on Contract, Submit on SOW)
    var dualBtn = $('#dualSignBtn');
    if (dualBtn) {
        dualBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Check which tab we're on
            var activeTab = $('.signing-tab.active');
            var currentTab = activeTab ? activeTab.getAttribute('data-tab') : 'contract';
            
            if (currentTab === 'contract') {
                // VALIDATE CONTRACT FIELDS
                var errors = self.validateContractTab();
                if (errors.length > 0) {
                    alert(t('signing.pleaseComplete') + '\n\n' + errors.join('\n'));
                    return;
                }
                
                // All valid - mark as signed and move to SOW
                self.updateSignatureStatus('contract', true);
                self.switchSigningTab('sow');
            } else {
                // On SOW tab - submit both signatures
                self.submitBothSignatures();
            }
        });
    }
    
    // ============= INITIALIZE SIGNATURE PADS AFTER DOM IS READY =============
    setTimeout(function() {
        console.log('🎨 Initializing dual signature pads...');
        
        // Initialize CONTRACT signature pad (Tab 1)
        var clientCanvas = document.getElementById('clientSignaturePad');
        if (clientCanvas) {
            console.log('Found contract canvas, initializing...');
            
            // Make canvas fully interactive
            clientCanvas.style.pointerEvents = 'auto';
            clientCanvas.style.touchAction = 'none';
            clientCanvas.style.cursor = 'crosshair';
            
            // Remove any existing signature-locked class
            var clientBlock = clientCanvas.closest('.signature-block');
            if (clientBlock) {
                clientBlock.classList.remove('signature-locked');
                clientBlock.style.pointerEvents = 'auto';
            }
            
            self.clientSignaturePad = createSignaturePad(clientCanvas);
            console.log('✓ Contract signature pad initialized');
            
            // Setup clear button for contract
            var contractClearBtn = $('.clear-btn[data-canvas="clientSignaturePad"]');
            if (contractClearBtn) {
                contractClearBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (self.clientSignaturePad) {
                        self.clientSignaturePad.clear();
                        self.updateSignatureStatus('contract', false);
                    }
                });
            }
        } else {
            console.error('❌ Contract signature canvas not found!');
        }
        
        // Setup clear button for SOW (signature pad will be initialized when tab is opened)
        var sowClearBtn = $('.clear-btn[data-canvas="sowClientSignaturePad"]');
        if (sowClearBtn) {
            sowClearBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.sowClientPad) {
                    window.sowClientPad.clear();
                    self.updateSignatureStatus('sow', false);
                }
            });
        }
        
        console.log('ℹ️ SOW signature pad will be initialized when SOW tab is opened');

        // Re-enable form inputs after DOM is fully ready (backup initialization)
        // This ensures inputs work even if the immediate initialization didn't take effect
        var clientSignerNameBackup = document.getElementById('clientSignerName');
        if (clientSignerNameBackup) {
            clientSignerNameBackup.disabled = false;
        }

        var clientDateBackup = document.getElementById('clientDate');
        if (clientDateBackup) {
            clientDateBackup.disabled = false;
            if (!clientDateBackup.value) {
                clientDateBackup.value = new Date().toISOString().split('T')[0];
            }
        }

        var ackSectionBackup = document.querySelector('.acknowledgment');
        if (ackSectionBackup) {
            ackSectionBackup.style.display = 'block';
        }

        var acknowledgmentBackup = document.getElementById('acknowledgment');
        if (acknowledgmentBackup) {
            acknowledgmentBackup.disabled = false;
        }

        // Check if signatures already exist
        self.checkExistingSignatures();

    }, 400); // Increased timeout to ensure DOM is fully ready
};
ContractFormHandler.prototype.renderSOWForClientSigning = function(sowData) {
    var sowContent = $('#sowSigningContent');
    if (!sowContent) return;

    var packageNames = {
        'essential': t('pkg.essential'),
        'starter': t('pkg.starter'),
        'growth': t('pkg.growth'),
        'professional': t('pkg.professional'),
        'enterprise': t('pkg.enterprise'),
        'custom': t('pkg.custom')
    };

    var packageDetails = {
        'essential': {
            includes: [t('pkg.essential.i1'), t('pkg.essential.i2'), t('pkg.essential.i3'), t('pkg.essential.i4'), t('pkg.essential.i5'), t('pkg.essential.i6')]
        },
        'starter': {
            includes: [t('pkg.starter.i1'), t('pkg.starter.i2'), t('pkg.starter.i3'), t('pkg.starter.i4'), t('pkg.starter.i5'), t('pkg.starter.i6'), t('pkg.starter.i7')]
        },
        'growth': {
            includes: [t('pkg.growth.i1'), t('pkg.growth.i2'), t('pkg.growth.i3'), t('pkg.growth.i4'), t('pkg.growth.i5'), t('pkg.growth.i6'), t('pkg.growth.i7')]
        },
        'professional': {
            includes: [t('pkg.professional.i1'), t('pkg.professional.i2'), t('pkg.professional.i3'), t('pkg.professional.i4'), t('pkg.professional.i5'), t('pkg.professional.i6'), t('pkg.professional.i7'), t('pkg.professional.i8')]
        },
        'enterprise': {
            includes: [t('pkg.enterprise.i1'), t('pkg.enterprise.i2'), t('pkg.enterprise.i3'), t('pkg.enterprise.i4'), t('pkg.enterprise.i5'), t('pkg.enterprise.i6'), t('pkg.enterprise.i7'), t('pkg.enterprise.i8')]
        }
    };

    var packageInfo = packageDetails[sowData.packageType] || { includes: [] };
    var totalPrice = sowData.payment ? sowData.payment.total : 0;
    var deposit = totalPrice * 0.50;
    var milestone1 = totalPrice * 0.25;
    var finalPayment = totalPrice * 0.25;

    // Extract pricing breakdown if available
    var breakdown = (sowData.payment && sowData.payment.breakdown) ? sowData.payment.breakdown : null;
    var basePrice = breakdown ? breakdown.basePrice : totalPrice;
    var addOns = breakdown ? breakdown.addOns : [];
    var discounts = breakdown ? breakdown.discounts : [];
    var couponCode = breakdown ? breakdown.couponCode : null;
    var couponDiscount = breakdown ? breakdown.couponDiscount : 0;

    var html = '' +

        // HEADER
        '<div class="modal-header">' +
        '<h2>' + t('sow.title') + '</h2>' +
        '<p class="modal-subtitle">Scarlo - Carlos Martin</p>' +
        '</div>' +

        // CLIENT INFO BOX
        '<section class="contract-section-inner">' +
        '<h3>' + t('sow.clientInfo') + '</h3>' +
        '<div class="sow-info-grid">' +
        '<div class="sow-info-item"><strong>' + t('sow.clientName') + '</strong> ' + sowData.clientName + '</div>' +
        '<div class="sow-info-item"><strong>' + t('sow.contact') + '</strong> ' + (sowData.clientEmail || sowData.clientPhone || t('common.na')) + '</div>' +
        '<div class="sow-info-item"><strong>' + t('sow.package') + '</strong> ' + (packageNames[sowData.packageType] || sowData.packageType) + '</div>' +
        '<div class="sow-info-item"><strong>' + t('sow.timeline') + '</strong> ' + (sowData.estimatedWeeks || t('common.tbd')) + ' ' + t('sow.weeks') + '</div>' +
        '</div>' +
        '</section>' +

        // PACKAGE INCLUDES
        '<section class="contract-section-inner">' +
        '<h3>' + t('sow.packageIncludes') + '</h3>' +
        '<ul class="sow-list">';
    
    if (sowData.packageType === 'custom') {
        // Custom packages: all selected features ARE the package
        if (sowData.features && sowData.features.length > 0) {
            sowData.features.forEach(function(feature) {
                html += '<li>' + translateStoredFeature(feature) + '</li>';
            });
        }
    } else {
        if (packageInfo.includes && packageInfo.includes.length > 0) {
            packageInfo.includes.forEach(function(item) {
                html += '<li>' + item + '</li>';
            });
        }
    }

    html += '</ul></section>';

    // SELECTED FEATURES (non-custom packages only — custom shows features above)
    if (sowData.packageType !== 'custom' && sowData.features && sowData.features.length > 0) {
        html += '<section class="contract-section-inner">' +
            '<h3>' + t('sow.additionalFeatures') + '</h3>' +
            '<ul class="sow-list">';

        sowData.features.forEach(function(feature) {
            html += '<li>' + translateStoredFeature(feature) + '</li>';
        });

        html += '</ul></section>';
    }

    // SPECIAL REQUIREMENTS
    if (sowData.notes) {
        html += '<section class="contract-section-inner">' +
            '<h3>' + t('sow.specialRequirements') + '</h3>' +
            '<p>' + sowData.notes + '</p>' +
            '</section>';
    }

    // PRICING BREAKDOWN (show itemized costs)
    html += '<section class="contract-section-inner">' +
        '<h3>' + t('sow.pricingBreakdown') + '</h3>' +
        '<table class="sow-payment-table pricing-breakdown-table">' +
        '<thead>' +
        '<tr>' +
        '<th>' + t('sow.item') + '</th>' +
        '<th>' + t('sow.description') + '</th>' +
        '<th>' + t('sow.amount') + '</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '<tr class="base-package-row">' +
        '<td><strong>' + (packageNames[sowData.packageType] || t('common.package')) + '</strong></td>' +
        '<td>' + t('sow.basePackagePrice') + '</td>' +
        '<td><strong>$' + basePrice.toFixed(0) + '</strong></td>' +
        '</tr>';

    // Add-ons (features added beyond package)
    if (addOns && addOns.length > 0) {
        addOns.forEach(function(addon) {
            var thirdPartyNote = addon.thirdParty ? ' <span class="third-party-indicator">*</span>' : '';
            var addonLabel = addon.key ? translateAddonByKey(addon.key, addon.label) : translateStoredFeature(addon.label);
            html += '<tr class="addon-row">' +
                '<td>' + addonLabel + thirdPartyNote + '</td>' +
                '<td>' + t('sow.additionalFeature') + '</td>' +
                '<td class="addon-price">+$' + addon.price.toFixed(0) + '</td>' +
                '</tr>';
        });
    }

    // Discounts (features removed from package)
    if (discounts && discounts.length > 0) {
        discounts.forEach(function(discount) {
            var discountLabel = discount.key ? translateAddonByKey(discount.key, discount.label) : translateStoredFeature(discount.label);
            html += '<tr class="discount-row">' +
                '<td>' + discountLabel + '</td>' +
                '<td>' + t('sow.featureRemoved') + '</td>' +
                '<td class="discount-price">-$' + discount.price.toFixed(0) + '</td>' +
                '</tr>';
        });
    }

    // Coupon discount
    if (couponCode && couponDiscount > 0) {
        html += '<tr class="coupon-row">' +
            '<td>' + couponCode + '</td>' +
            '<td>' + t('sow.couponDiscount') + '</td>' +
            '<td class="discount-price">-$' + couponDiscount.toFixed(0) + '</td>' +
            '</tr>';
    }

    html += '<tr class="sow-total-row">' +
        '<td colspan="2"><strong>' + t('sow.totalProjectCost') + '</strong></td>' +
        '<td><strong>$' + totalPrice.toFixed(0) + '</strong></td>' +
        '</tr>' +
        '</tbody>' +
        '</table>';

    // Third-party costs note
    if (addOns && addOns.some(function(a) { return a.thirdParty; })) {
        html += '<p class="third-party-note-text"><span class="third-party-indicator">*</span> ' + t('sow.thirdPartyNote') + '</p>';
    }

    // View Industry Pricing button
    html += '<button type="button" class="view-industry-pricing-btn" onclick="window.contractFormHandler.showPricingComparisonModal()">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>' +
        t('sow.viewIndustryPricing') +
        '</button>';

    html += '</section>';

    // PAYMENT STRUCTURE
    html += '<section class="contract-section-inner">' +
        '<h3>' + t('sow.paymentSchedule') + '</h3>' +
        '<table class="sow-payment-table">' +
        '<thead>' +
        '<tr>' +
        '<th>' + t('sow.paymentMilestone') + '</th>' +
        '<th>' + t('sow.description') + '</th>' +
        '<th>' + t('sow.amount') + '</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '<tr>' +
        '<td><strong>' + t('sow.initialDeposit') + '</strong></td>' +
        '<td>' + t('sow.dueBeforeWork') + '</td>' +
        '<td><strong>$' + deposit.toFixed(0) + '</strong></td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>' + t('sow.milestone1') + '</strong></td>' +
        '<td>' + t('sow.designApproval') + '</td>' +
        '<td><strong>$' + milestone1.toFixed(0) + '</strong></td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>' + t('sow.finalPayment') + '</strong></td>' +
        '<td>' + t('sow.priorToDeployment') + '</td>' +
        '<td><strong>$' + finalPayment.toFixed(0) + '</strong></td>' +
        '</tr>' +
        '</tbody>' +
        '</table>' +
        '</section>';
    
    // TERMS
    html += '<section class="contract-section-inner">' +
        '<h3>' + t('sow.termsConditions') + '</h3>' +
        '<p>' + t('sow.termsText1') + ' <strong>' + sowData.clientName + '</strong>' + t('sow.termsText2') + '</p>' +
        '<p>' + t('sow.termsText3') + '</p>' +
        '</section>' +

        // SIGNATURE BLOCK
        '<section class="contract-section-inner signatures">' +
        '<h3>' + t('sow.clientSignatureRequired') + '</h3>' +
        '<p>' + t('sow.signatureInstructions') + '</p>' +

        '<div class="signature-block">' +
        '<h3>' + t('sow.clientSignature') + ' ' + sowData.clientName + '</h3>' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label>' + t('sow.fullName') + '</label>' +
        '<input type="text" id="sowClientName" value="' + sowData.clientName + '" required />' +
        '</div>' +
        '<div class="form-group">' +
        '<label>' + t('sow.date') + '</label>' +
        '<input type="date" id="sowClientDate" required />' +
        '</div>' +
        '</div>' +
        '<div class="signature-pad-container">' +
        '<canvas id="sowClientSignaturePad" class="signature-pad"></canvas>' +
        '<button class="clear-btn" data-canvas="sowClientSignaturePad">' + t('sow.clear') + '</button>' +
        '</div>' +
        '</div>' +

        '</section>';

    sowContent.innerHTML = html;
    
    // Set today's date
    var dateField = $('#sowClientDate');
    if (dateField) {
        dateField.value = new Date().toISOString().split('T')[0];
    }
    
    // NOTE: Signature pad initialization happens in showDualSigningInterface
    // to ensure proper timing after all DOM elements are in place
    console.log('✓ SOW content rendered, signature pad will be initialized by parent function');
};
ContractFormHandler.prototype.switchSigningTab = function(tabName) {
    var self = this;
    
    // Update tab buttons
    $$('.signing-tab').forEach(function(tab) {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Update tab content
    $$('.signing-tab-pane').forEach(function(pane) {
        pane.classList.remove('active');
        if (pane.getAttribute('data-tab') === tabName) {
            pane.classList.add('active');
        }
    });
    
    // ============= INITIALIZE/RESIZE SOW SIGNATURE PAD WHEN TAB OPENS =============
    if (tabName === 'sow') {
        setTimeout(function() {
            var sowCanvas = document.getElementById('sowClientSignaturePad');
            if (sowCanvas) {
                console.log('🎨 SOW tab opened - initializing signature pad');
                
                // Make canvas fully interactive
                sowCanvas.style.pointerEvents = 'auto';
                sowCanvas.style.touchAction = 'none';
                sowCanvas.style.cursor = 'crosshair';
                
                // Remove any locks
                var sowBlock = sowCanvas.closest('.signature-block');
                if (sowBlock) {
                    sowBlock.classList.remove('signature-locked');
                    sowBlock.style.pointerEvents = 'auto';
                }
                
                // Force canvas to be visible and properly sized BEFORE initialization
                sowCanvas.style.display = 'block';
                sowCanvas.style.width = '100%';
                sowCanvas.style.height = '270px';
                
                // Wait for layout to settle, then initialize
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        // Re-initialize or resize the signature pad
                        if (!window.sowClientPad || typeof window.sowClientPad.resize !== 'function') {
                            // Create new signature pad if it doesn't exist
                            window.sowClientPad = createSignaturePad(sowCanvas);
                            console.log('✓ SOW signature pad created');
                        } else {
                            // Resize existing pad now that canvas is visible
                            window.sowClientPad.resize();
                            console.log('✓ SOW signature pad resized');
                        }
                        
                        // Log dimensions for debugging
                        var rect = sowCanvas.getBoundingClientRect();
                        console.log('SOW canvas rect:', rect.width, 'x', rect.height, 'left:', rect.left, 'top:', rect.top);
                    });
                });
                
                // ============= ENABLE BUTTON WHEN USER SIGNS =============
                var updateSubmitButton = function() {
                    var dualBtn = $('#dualSignBtn');
                    if (!dualBtn) return;
                    
                    var hasSigned = window.sowClientPad && !window.sowClientPad.isEmpty();
                    
                    dualBtn.disabled = !hasSigned;
                    dualBtn.style.opacity = hasSigned ? '1' : '0.5';
                    
                    console.log('SOW signature state:', hasSigned ? 'Signed ✓' : 'Empty ✗');
                };
                
                // Listen for when user finishes drawing
                sowCanvas.addEventListener('mouseup', updateSubmitButton);
                sowCanvas.addEventListener('touchend', updateSubmitButton);
                
                // ============= ALSO LISTEN TO CLEAR BUTTON =============
                var sowClearBtn = $('.clear-btn[data-canvas="sowClientSignaturePad"]');
                if (sowClearBtn) {
                    // Remove any existing listeners to prevent duplicates
                    var newClearBtn = sowClearBtn.cloneNode(true);
                    sowClearBtn.parentNode.replaceChild(newClearBtn, sowClearBtn);
                    
                    // Add new listener that updates button state
                    newClearBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        if (window.sowClientPad) {
                            window.sowClientPad.clear();
                            self.updateSignatureStatus('sow', false);
                            // Update submit button immediately after clearing
                            updateSubmitButton();
                        }
                    });
                }
                
                // Initial check
                updateSubmitButton();
                
            } else {
                console.error('❌ SOW signature canvas not found when switching to tab');
            }
        }, 100); // Small delay to ensure tab is fully visible
    }
    
    // ============= UPDATE BUTTON TEXT AND STATE =============
    var dualBtn = $('#dualSignBtn');
    var btnText = $('#dualSignBtnText');
    
    if (tabName === 'contract') {
        // On Contract tab - show "Next" button
        if (btnText) btnText.textContent = t('signing.nextSignSOW');
        if (dualBtn) {
            dualBtn.disabled = false;
            dualBtn.style.display = 'inline-flex';
        }
    } else if (tabName === 'sow') {
        // On SOW tab - show "Submit" button
        if (btnText) btnText.textContent = t('signing.submitForDev');
        
        // Enable button only if SOW is signed
        var sowSigned = window.sowClientPad && !window.sowClientPad.isEmpty();
        
        if (dualBtn) {
            dualBtn.disabled = !sowSigned;
            dualBtn.style.display = 'inline-flex';
            dualBtn.style.opacity = sowSigned ? '1' : '0.5';
        }
    }
};
ContractFormHandler.prototype.checkExistingSignatures = function() {
    var contractSigned = false;
    var sowSigned = false;
    
    // Check contract signature
    if (this.clientSignaturePad && !this.clientSignaturePad.isEmpty()) {
        contractSigned = true;
        this.updateSignatureStatus('contract', true);
    }
    
    // Check SOW signature
    if (window.sowClientPad && !window.sowClientPad.isEmpty()) {
        sowSigned = true;
        this.updateSignatureStatus('sow', true);
    }
    
    // Show submit button if both signed
    if (contractSigned && sowSigned) {
        var submitBtn = $('#submitBothBtn');
        if (submitBtn) submitBtn.style.display = 'inline-flex';
    }
};
ContractFormHandler.prototype.updateSignatureStatus = function(type, signed) {
    var statusEl = $('#' + type + 'Status');
    var dotEl = $('#' + type + 'Dot');
    
    if (signed) {
        if (statusEl) {
            statusEl.textContent = t('signing.signed');
            statusEl.style.color = '#10b981';
        }
        if (dotEl) {
            dotEl.classList.add('completed');
        }
    } else {
        if (statusEl) {
            statusEl.textContent = t('signing.pending');
            statusEl.style.color = '#f59e0b';
        }
        if (dotEl) {
            dotEl.classList.remove('completed');
        }
    }
    
    // Check if both are signed
    var contractSigned = $('#contractStatus') && $('#contractStatus').textContent.includes('✓');
    var sowSigned = $('#sowStatus') && $('#sowStatus').textContent.includes('✓');
    
    // Only show submit button if on SOW tab AND both signed
    var activeTab = $('.signing-tab.active');
    var isOnSOWTab = activeTab && activeTab.getAttribute('data-tab') === 'sow';
    
    var submitBtn = $('#submitBothBtn');
    if (submitBtn) {
        submitBtn.style.display = (isOnSOWTab && contractSigned && sowSigned) ? 'inline-flex' : 'none';
    }
};
ContractFormHandler.prototype.validateContractTab = function() {
    var errors = [];
    
    // Validate client name
    var clientName = $('#clientName');
    if (!clientName || !clientName.value.trim()) {
        errors.push('• Client Name / Company Name is required');
    }
    
    // Validate signer name
    var signerName = $('#clientSignerName');
    if (!signerName || !signerName.value.trim()) {
        errors.push('• Your Full Name is required');
    }
    
    // Validate date
    var clientDate = $('#clientDate');
    if (!clientDate || !clientDate.value) {
        errors.push('• Signature Date is required');
    }
    
    // Validate acknowledgment checkbox
    var acknowledgment = $('#acknowledgment');
    if (!acknowledgment || !acknowledgment.checked) {
        errors.push('• You must acknowledge the terms and conditions');
    }
    
    // Validate signature
    if (!this.clientSignaturePad || this.clientSignaturePad.isEmpty()) {
        errors.push('• Your signature is required');
    }
    
    return errors;
};
    ContractFormHandler.prototype.checkPendingClientContract = function(userEmail) {
        var self = this;
        
        firebase.firestore().collection('contracts')
            .where('clientEmail', '==', userEmail)
            .where('status', '==', 'pending_developer')
            .limit(1)
            .get()
            .then(function(querySnapshot) {
                if (!querySnapshot.empty) {
                    self.showPendingStatus();
                }
            })
            .catch(function(error) {
                console.error('Error checking pending contracts:', error);
            });
    };
    
    ContractFormHandler.prototype.showCompletedContract = function(contractId, data) {
        console.log('Showing completed contract');
        
        var self = this;
        
        // Mark this as a completed contract view (prevents validation)
        this.isViewingCompletedContract = true;
        
        // Hide the form sections that shouldn't be shown
        var devPending = $('#devPendingBlock');
        if (devPending) devPending.style.display = 'none';
        
        var acknowledgment = $('.acknowledgment');
        if (acknowledgment) acknowledgment.style.display = 'none';
        
        // Populate form with completed data (read-only)
        var clientNameField = $('#clientName');
        if (clientNameField) {
            clientNameField.value = data.clientName || '';
            clientNameField.setAttribute('readonly', 'readonly');
            clientNameField.disabled = true;
        }
        
        // Create or update success message
        var messageDiv = $('#clientSubmitMessage');
        if (messageDiv) {
            messageDiv.innerHTML = '<p><strong>' + t('contract.msg.fullyExecuted') + '</strong></p>' +
                '<p>' + t('contract.msg.bothSigned') + '</p>' +
                '<p>' + t('contract.msg.contractDate') + (data.clientDate || 'N/A') + '</p>' +
                '<p>' + t('common.finalized') + ': ' + (data.finalizedTimestamp ? new Date(data.finalizedTimestamp.toDate()).toLocaleDateString() : 'N/A') + '</p>';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(46, 204, 113, 0.15)';
            messageDiv.style.borderColor = 'rgba(46, 204, 113, 0.4)';
        }
        
        // Store the contract data for PDF generation BEFORE setting up button
        this.currentContract = { id: contractId, data: data };
        
        // Replace the submit button with a new one to remove old event listeners
        var oldSubmitBtn = $('#submitBtn');
        if (oldSubmitBtn) {
            var newSubmitBtn = oldSubmitBtn.cloneNode(true);
            newSubmitBtn.innerHTML = '<span>' + t('contract.btn.downloadSigned') + '</span>';
            newSubmitBtn.style.display = 'inline-flex';
            newSubmitBtn.disabled = false;
            newSubmitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            
            // Replace old button with new one (removes all old event listeners)
            oldSubmitBtn.parentNode.replaceChild(newSubmitBtn, oldSubmitBtn);
            
            // Add new click handler for PDF download only
            newSubmitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Download button clicked - generating PDF');
                self.generatePDF();
            });
        }
        
        // Show both signatures
        this.displayBothSignatures(data);
    };
    
    ContractFormHandler.prototype.displayBothSignatures = function(data) {
    var self = this;
    
    console.log('Displaying both signatures...');
    console.log('Client signature exists:', !!data.clientSignature);
    console.log('Dev signature exists:', !!data.devSignature);
    
    // Show client signature block (LOCKED)
    var clientBlock = $('#clientSignatureBlock');
    if (clientBlock) {
        clientBlock.style.display = 'block';
        clientBlock.style.opacity = '1';
        
        // CRITICAL: Clone canvas to remove ALL event listeners
        var oldClientCanvas = document.getElementById('clientSignaturePad');
        if (oldClientCanvas) {
            var newClientCanvas = oldClientCanvas.cloneNode(true);
            oldClientCanvas.parentNode.replaceChild(newClientCanvas, oldClientCanvas);
        }
        
        // Lock the block
        clientBlock.style.pointerEvents = 'none';
        clientBlock.classList.add('signature-locked');
        
        // Update fields
        var clientSignerName = $('#clientSignerName');
        if (clientSignerName) {
            clientSignerName.value = data.clientSignerName || '';
            clientSignerName.setAttribute('readonly', 'readonly');
        }
        
        var clientDateField = $('#clientDate');
        if (clientDateField) {
            clientDateField.value = data.clientDate || '';
            clientDateField.setAttribute('readonly', 'readonly');
        }
    }
    
    // Show developer signature block (LOCKED)
    var devBlock = $('#devSignatureBlock');
    if (devBlock) {
        devBlock.style.display = 'block';
        devBlock.style.opacity = '1';
        
        // CRITICAL: Clone canvas to remove ALL event listeners
        var oldDevCanvas = document.getElementById('devSignaturePad');
        if (oldDevCanvas) {
            var newDevCanvas = oldDevCanvas.cloneNode(true);
            oldDevCanvas.parentNode.replaceChild(newDevCanvas, oldDevCanvas);
        }
        
        // Lock the block
        devBlock.style.pointerEvents = 'none';
        devBlock.classList.add('signature-locked');
        
        // Update fields
        var devName = $('#devName');
        if (devName) {
            devName.value = data.devName || 'Carlos Martin';
            devName.setAttribute('readonly', 'readonly');
        }
        
        var devDateField = $('#devDate');
        if (devDateField) {
            devDateField.value = data.devDate || '';
            devDateField.setAttribute('readonly', 'readonly');
        }
    }
    
    // Draw signatures after canvases are replaced and visible
    setTimeout(function() {
        if (data.clientSignature) {
            var clientCanvas = document.getElementById('clientSignaturePad');
            if (clientCanvas) {
                self.drawSignatureOnCanvas(clientCanvas, data.clientSignature);
            }
        }
        
        if (data.devSignature) {
            var devCanvas = document.getElementById('devSignaturePad');
            if (devCanvas) {
                self.drawSignatureOnCanvas(devCanvas, data.devSignature);
            }
        }
    }, 300);
    
    // Hide pending block
    var devPending = $('#devPendingBlock');
    if (devPending) devPending.style.display = 'none';
};
    
    ContractFormHandler.prototype.drawSignatureOnCanvas = function(canvas, signatureData) {
        if (!canvas || !signatureData) {
            console.log('Missing canvas or signature data');
            return;
        }
        
        var rect = canvas.getBoundingClientRect();
        console.log('Canvas rect:', rect.width, rect.height);
        
        // If canvas has no dimensions, try to set default size
        if (rect.width === 0 || rect.height === 0) {
            canvas.style.width = '100%';
            canvas.style.height = '150px';
            rect = canvas.getBoundingClientRect();
        }
        
        var dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        // Clear canvas first
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        var img = new Image();
        img.onload = function() {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
            console.log('Signature drawn on canvas');
        };
        img.onerror = function() {
            console.error('Failed to load signature image');
        };
        img.src = signatureData;
    };
    
    ContractFormHandler.prototype.showPendingStatus = function() {
        console.log('Client has a pending contract');
        
        // Hide signature input
        var clientBlock = $('#clientSignatureBlock');
        if (clientBlock) clientBlock.style.display = 'none';
        
        // Update the pending message
        var messageDiv = $('#clientSubmitMessage');
        if (messageDiv) {
            messageDiv.innerHTML = '<p><strong>' + t('contract.msg.pendingDev') + '</strong></p>' +
                '<p>' + t('contract.msg.pendingDevDesc') + '</p>' +
                '<p>' + t('contract.msg.pendingDevDownload') + '</p>';
            messageDiv.style.display = 'block';
            messageDiv.style.background = 'rgba(241, 196, 15, 0.15)';
            messageDiv.style.borderColor = 'rgba(241, 196, 15, 0.4)';
        }
        
        // Hide submit button
        var submitBtn = $('#submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    };

    ContractFormHandler.prototype.loadPendingContract = function() {
        var self = this;
        
        console.log('Loading pending contracts...');
        
        firebase.firestore().collection('contracts')
            .where('status', '==', 'pending_developer')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get()
            .then(function(querySnapshot) {
                if (!querySnapshot.empty) {
                    var doc = querySnapshot.docs[0];
                    self.currentContract = { id: doc.id, data: doc.data() };
                    self.populateFormWithContract(self.currentContract.data);
                    console.log('Loaded pending contract:', self.currentContract.id);
                } else {
                    console.log('No pending contracts found');
                }
            })
            .catch(function(error) {
                console.error('Error loading pending contract:', error);
            });
    };

    ContractFormHandler.prototype.populateFormWithContract = function(data) {
        console.log('Populating form for developer with client data:', data.clientName);
        
        // Show a message about which contract is being signed
        var contractInfo = document.createElement('div');
        contractInfo.id = 'pendingContractInfo';
        contractInfo.style.cssText = 'background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;';
        contractInfo.innerHTML = '<p style="margin: 0; color: #fff;"><strong>' + t('contract.msg.pendingFromClient') + '</strong></p>' +
            '<p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8);">' + t('common.client') + ': <strong>' + (data.clientName || 'N/A') + '</strong> | ' +
            t('common.submitted') + ': <strong>' + (data.clientDate || 'N/A') + '</strong></p>';
        
        // Insert at the top of the signatures section
        var signaturesSection = $('.signatures');
        if (signaturesSection && !$('#pendingContractInfo')) {
            signaturesSection.insertBefore(contractInfo, signaturesSection.firstChild.nextSibling);
        }
        
        // Populate client name field (read-only, just for display)
        var clientName = $('#clientName');
        if (clientName) {
            clientName.value = data.clientName || '';
            clientName.setAttribute('readonly', 'readonly');
            clientName.disabled = true;
            clientName.style.opacity = '0.7';
        }
        
        // Update client name display in header
        var clientNameDisplay = $('#clientNameDisplay');
        if (clientNameDisplay) clientNameDisplay.textContent = data.clientName || 'Client Name';
        
        // Show client signature block with their signature (read-only display)
        var clientBlock = $('#clientSignatureBlock');
        if (clientBlock && data.clientSignature) {
            clientBlock.style.display = 'block';
            clientBlock.style.opacity = '0.7';
            clientBlock.style.pointerEvents = 'none';
            
            // Add a label showing this is the client's signature
            var clientHeader = clientBlock.querySelector('h3');
            if (clientHeader) {
                clientHeader.innerHTML = t('contract.label.clientSig') + (data.clientName || t('common.client')) + ' <span style="font-size: 12px; color: #10b981;">' + t('contract.label.signed') + '</span>';
            }
            
            // Update client signer name and date (read-only)
            var clientSignerName = $('#clientSignerName');
            if (clientSignerName) {
                clientSignerName.value = data.clientSignerName || '';
                clientSignerName.setAttribute('readonly', 'readonly');
                clientSignerName.disabled = true;
            }
            
            var clientDateField = $('#clientDate');
            if (clientDateField) {
                clientDateField.value = data.clientDate || '';
                clientDateField.setAttribute('readonly', 'readonly');
                clientDateField.disabled = true;
            }
            
            // Display saved signature on canvas
            var clientCanvas = document.getElementById('clientSignaturePad');
            if (clientCanvas) {
                // Need to wait for canvas to be visible
                setTimeout(function() {
                    var rect = clientCanvas.getBoundingClientRect();
                    var dpr = window.devicePixelRatio || 1;
                    clientCanvas.width = rect.width * dpr;
                    clientCanvas.height = rect.height * dpr;
                    var ctx = clientCanvas.getContext('2d');
                    ctx.scale(dpr, dpr);
                    
                    var img = new Image();
                    img.onload = function() {
                        ctx.drawImage(img, 0, 0, rect.width, rect.height);
                    };
                    img.src = data.clientSignature;
                }, 200);
            }
            
            // Hide clear button for client signature
            var clearBtn = $('.clear-btn[data-canvas="clientSignaturePad"]');
            if (clearBtn) clearBtn.style.display = 'none';
        }
        
        // Hide acknowledgment section for developer
        var ackSection = $('.acknowledgment');
        if (ackSection) ackSection.style.display = 'none';
        
        // Make sure developer signature block is visible and enabled
        var devBlock = $('#devSignatureBlock');
        if (devBlock) {
            devBlock.style.display = 'block';
            devBlock.style.opacity = '1';
            
            var devHeader = devBlock.querySelector('h3');
            if (devHeader) {
                devHeader.innerHTML = t('contract.label.devSig') + ' <span style="font-size: 12px; color: #f59e0b;">' + t('contract.label.signBelow') + '</span>';
            }
        }
        
        console.log('Form populated with contract data for developer review');
    };

    ContractFormHandler.prototype.handleClientSubmit = function() {
        console.log('Handling client submit...');

        // Validate that SOW is attached (required)
        if (!this.currentSOW) {
            alert(t('contract.val.sowRequired'));
            return;
        }

        // Client info comes from SOW (stored in hidden fields)
        var errors = [];

        // Validate client name from hidden field (populated from SOW)
        var clientName = $('#clientName');
        if (!clientName || !clientName.value.trim()) {
            errors.push(t('contract.val.clientInfoMissing'));
        }

        var acknowledgment = $('#acknowledgment');
        if (!acknowledgment || !acknowledgment.checked) {
            errors.push(t('contract.val.acknowledgment'));
        }

        var clientSignerName = $('#clientSignerName');
        if (!clientSignerName || !clientSignerName.value.trim()) {
            errors.push(t('contract.val.enterName'));
        }
        
        if (!this.clientSignaturePad || this.clientSignaturePad.isEmpty()) {
            errors.push(t('contract.val.signatureRequired'));
        }
        
        var clientDate = $('#clientDate');
        if (!clientDate || !clientDate.value) {
            errors.push(t('contract.val.dateRequired'));
        }
        
        if (errors.length > 0) {
            alert(t('contract.val.completeRequired') + errors.join('\n'));
            return;
        }
        
        // All validation passed, submit to Firebase
        this.submitClientSignature();
    };

    // Submit client signature - redirects to dual signing flow
    ContractFormHandler.prototype.submitClientSignature = function() {
        // Since SOW is now required, redirect to the dual signing interface
        if (this.currentSOW) {
            this.submitBothSignatures();
        } else {
            alert(t('contract.val.sowRequired'));
        }
    };

    ContractFormHandler.prototype.handleDeveloperSubmit = function() {
        console.log('Handling developer submit...');
        
        // Validate developer fields
        var errors = [];
        
        if (!this.devSignaturePad || this.devSignaturePad.isEmpty()) {
            errors.push(t('contract.val.devSignRequired'));
        }
        
        var devDate = $('#devDate');
        if (!devDate || !devDate.value) {
            errors.push(t('contract.val.devDateRequired'));
        }
        
        if (!this.currentContract) {
            errors.push(t('contract.val.noPending'));
        }
        
        if (errors.length > 0) {
            alert(t('contract.val.completeRequired') + errors.join('\n'));
            return;
        }
        
        // All validation passed, finalize contract
        this.finalizeContract();
    };

    ContractFormHandler.prototype.submitBothSignatures = function() {
    var self = this;
    
    console.log('Submitting both contract and SOW signatures...');
    
    // Validate contract signature
    if (!this.clientSignaturePad || this.clientSignaturePad.isEmpty()) {
        alert(t('contract.val.signContract'));
        this.switchSigningTab('contract');
        return;
    }
    
    // Validate SOW fields
    var sowName = $('#sowClientName');
    var sowDate = $('#sowClientDate');
    
    if (!sowName || !sowName.value.trim()) {
        alert(t('contract.val.sowName'));
        return;
    }
    
    if (!sowDate || !sowDate.value) {
        alert(t('contract.val.sowDate'));
        return;
    }
    
    // Validate SOW signature  
    if (!window.sowClientPad || window.sowClientPad.isEmpty()) {
        alert(t('contract.val.signSow'));
        return;
    }
    
    var submitBtn = $('#submitBothBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>' + t('contract.btn.submitting') + '</span>';
    }

    var user = firebase.auth().currentUser;
    var clientEmail = user.email || '';
    var clientPhone = user.phoneNumber || '';

    // Get business entity info from SOW (not from form toggle anymore)
    var sowData = this.currentSOW || {};
    var isBusinessEntity = sowData.isBusinessEntity || false;
    var businessName = sowData.businessName || '';
    var entityType = sowData.entityType || '';
    var stateOfFormation = sowData.stateOfFormation || '';
    var repName = sowData.representativeName || '';
    var repTitle = sowData.representativeTitle || '';

    // Contract data - client info comes from SOW
    var contractData = {
        // Use business name if business entity, otherwise individual name
        clientName: isBusinessEntity ? businessName : sowData.clientName,
        clientSignerName: isBusinessEntity ? repName : $('#clientSignerName').value.trim(),
        clientDate: $('#clientDate').value,
        clientSignature: this.clientSignaturePad.toDataURL(),
        clientEmail: clientEmail,
        clientPhone: normalizeToE164(clientPhone),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending_developer',
        // Business entity information
        isBusinessEntity: isBusinessEntity,
        businessName: businessName,
        entityType: entityType,
        stateOfFormation: stateOfFormation,
        representativeName: repName,
        representativeTitle: repTitle
    };
    
    // SOW signature data
    var sowSignature = window.sowClientPad.toDataURL();
    var sowClientName = $('#sowClientName').value.trim();
    var sowClientDate = $('#sowClientDate').value;
    
    var contractId = null;
    
    // Submit contract
    firebase.firestore().collection('contracts').add(contractData)
        .then(function(docRef) {
            contractId = docRef.id;
            console.log('✓ Contract saved:', contractId);
            
            // Update SOW with signatures and link to contract
            return firebase.firestore().collection('sow_documents')
                .doc(self.currentSOW.id)
                .update({
                    clientSignature: sowSignature,
                    clientSignerName: sowClientName,
                    clientSignedDate: sowClientDate,
                    clientSignedTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    linkedContract: contractId,
                    linkedContractEmail: clientEmail,
                    linkedContractPhone: normalizeToE164(clientPhone),
                    status: 'pending_developer'
                });
        })
        .then(function() {
            console.log('✓ SOW updated and linked to contract');
            
            // Build complete SOW data with signatures
            var completedSOWData = {
                clientName: sowClientName,
                clientEmail: clientEmail,
                packageType: self.currentSOW.packageType,
                estimatedWeeks: self.currentSOW.estimatedWeeks,
                payment: self.currentSOW.payment,
                clientSignature: sowSignature,
                clientSignerName: sowClientName,
                clientSignedDate: sowClientDate
            };
            
            // Show completed view with both documents
            self.showDualSigningCompleted(contractData, completedSOWData);
        })
        .catch(function(error) {
            console.error('Error submitting signatures:', error);
            alert(t('contract.err.prefix') + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>' + t('contract.btn.submitForDev') + '</span>';
            }
        });
};
ContractFormHandler.prototype.showExistingCompletion = function(contractData) {
    var self = this;
    
    console.log('Recreating completion view for existing submission');
    
    // Store contract data for PDF generation
    this.currentContract = { id: contractData.id, data: contractData };
    
    // Hide tabs if they exist
    var tabsContainer = $('#clientSigningTabs');
    if (tabsContainer) tabsContainer.style.display = 'none';
    
    // Hide contract form
    var contractForm = $('#contractForm');
    if (contractForm) contractForm.style.display = 'none';
    
    // Check if fully signed (status = completed AND devSignature exists)
    var isFullySigned = contractData.status === 'completed' && contractData.devSignature;
    
    // Fetch linked SOW to display and enable download
    if (contractData.clientEmail) {
        firebase.firestore().collection('sow_documents')
            .where('clientEmail', '==', contractData.clientEmail)
            .where('linkedContract', '==', contractData.id)
            .limit(1)
            .get()
            .then(function(sowSnapshot) {
                var sowData = null;
                if (!sowSnapshot.empty) {
                    sowData = sowSnapshot.docs[0].data();
                    sowData.id = sowSnapshot.docs[0].id;
                }
                self.renderExistingCompletionView(contractData, sowData, isFullySigned);
            })
            .catch(function(error) {
                console.error('Error fetching SOW:', error);
                self.renderExistingCompletionView(contractData, null, isFullySigned);
            });
    } else if (contractData.clientPhone) {
        // Phone-based lookup - use clientPhone field (matches security rules)
        firebase.firestore().collection('sow_documents')
            .where('clientPhone', '==', contractData.clientPhone)
            .where('linkedContract', '==', contractData.id)
            .limit(1)
            .get()
            .then(function(sowSnapshot) {
                var sowData = null;
                if (!sowSnapshot.empty) {
                    sowData = sowSnapshot.docs[0].data();
                    sowData.id = sowSnapshot.docs[0].id;
                }
                self.renderExistingCompletionView(contractData, sowData, isFullySigned);
            })
            .catch(function(error) {
                console.error('Error fetching SOW by phone:', error);
                self.renderExistingCompletionView(contractData, null, isFullySigned);
            });
    } else {
        self.renderExistingCompletionView(contractData, null, isFullySigned);
    }
};

ContractFormHandler.prototype.renderExistingCompletionView = function(contractData, sowData, isFullySigned) {
    var self = this;

    // Ensure close button is visible and sticky
    var closeBtnRef = $('#closeModalBtn');
    if (closeBtnRef) {
        closeBtnRef.style.display = 'flex';
        closeBtnRef.style.position = 'sticky';
        closeBtnRef.style.top = '1rem';
        closeBtnRef.style.alignSelf = 'flex-end';
        closeBtnRef.style.marginRight = '1.5rem';
        closeBtnRef.style.marginTop = '1rem';
        closeBtnRef.style.marginBottom = '-2.5rem';
        closeBtnRef.style.flexShrink = '0';
    }

    // Create or get completed container
    var completedContainer = document.getElementById('dualSigningCompleted');
    if (!completedContainer) {
        completedContainer = document.createElement('div');
        completedContainer.id = 'dualSigningCompleted';
        completedContainer.className = 'dual-signing-completed';

        var modalContent = $('.modal-content');
        var closeBtn = $('#closeModalBtn');
        if (closeBtn && closeBtn.nextSibling) {
            modalContent.insertBefore(completedContainer, closeBtn.nextSibling);
        } else if (modalContent) {
            modalContent.appendChild(completedContainer);
        }
    }

    var statusBadge = isFullySigned
        ? '<span class="doc-status completed">✅ Fully Signed</span>'
        : '<span class="doc-status pending">⏳ Awaiting Developer Signature</span>';

    var headerText = isFullySigned
        ? 'Documents Fully Executed!'
        : 'Documents Successfully Submitted!';

    var headerNote = isFullySigned
        ? 'Both you and the developer have signed these documents. Download them below.'
        : 'The developer will review and countersign shortly.';

    // Calculate payment status for tab badge
    var paymentInfo = self.calculatePaymentStatus(sowData);
    var paymentBadgeClass = paymentInfo.allPaid ? 'paid' : (paymentInfo.paidCount > 0 ? 'partial' : 'unpaid');
    var paymentBadgeText = paymentInfo.allPaid ? 'Paid' : (paymentInfo.paidCount + '/' + paymentInfo.totalCount);

    // Build tabbed interface
    var bothFullySigned = isFullySigned && sowData && sowData.devSignature && sowData.clientSignature;
    var html = '<div class="completion-header">' +
        '<div class="completion-icon">✅</div>' +
        '<h2>' + headerText + '</h2>' +
        '<p class="completion-note">' + headerNote + '</p>' +
        (bothFullySigned ? '<button class="download-all-btn" id="downloadBothBtn">📦 Download All</button>' : '') +
        '</div>' +

        // Tab Navigation
        '<div class="completion-tabs">' +
        '<button class="completion-tab active" data-tab="documents">' +
        '<span class="tab-icon">📄</span>' +
        '<span class="tab-label">Documents</span>' +
        '</button>' +
        '<button class="completion-tab" data-tab="payments">' +
        '<span class="tab-icon">💳</span>' +
        '<span class="tab-label">Payment Status</span>' +
        '<span class="payment-badge ' + paymentBadgeClass + '">' + paymentBadgeText + '</span>' +
        '</button>' +
        '</div>' +

        // Tab Content Container
        '<div class="completion-tab-content">' +

        // Documents Tab Pane
        '<div class="completion-tab-pane active" data-tab="documents">' +
        '<div class="completed-documents">' +

        // Contract Card with signature preview
        '<div class="completed-doc-card">' +
        '<div class="doc-card-header">' +
        '<h3>📄 Contract Agreement</h3>' +
        statusBadge +
        '</div>' +
        '<div class="doc-card-body">' +
        '<div class="doc-field-row"><span class="field-label">Client:</span><span class="field-value">' + (contractData.clientName || 'N/A') + '</span></div>' +
        '<div class="doc-field-row"><span class="field-label">' + (contractData.clientEmail ? 'Email:' : 'Phone:') + '</span><span class="field-value">' + (contractData.clientEmail || (contractData.clientPhone ? formatPhoneNumber(contractData.clientPhone) : 'N/A')) + '</span></div>' +
        '<div class="doc-field-row"><span class="field-label">Client Signed:</span><span class="field-value">' + (contractData.clientDate || 'N/A') + '</span></div>' +
        (isFullySigned ? '<div class="doc-field-row"><span class="field-label">Developer Signed:</span><span class="field-value">' + (contractData.devDate || 'N/A') + '</span></div>' : '') +
        '</div>' +
        '<div class="doc-signature-preview">' +
        '<p class="signature-label">Your Signature:</p>' +
        '<img src="' + contractData.clientSignature + '" alt="Your signature" class="signature-image" style="width: 100%; max-width: 100%; height: auto; background: rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 0.5rem; border: 1px solid rgba(255, 255, 255, 0.1);" />' +
        '</div>';

    // Add download button ONLY if fully signed
    if (isFullySigned) {
        html += '<div class="doc-actions">' +
            '<button class="doc-action-btn doc-download-btn" id="downloadContractBtn">' +
            '📄 Download Contract' +
            '</button>' +
            '</div>';
    }

    html += '</div>'; // Close contract card

    // SOW Card (if exists) with signature preview
    if (sowData) {
        var sowFullySigned = sowData.devSignature && sowData.clientSignature;
        var sowStatusBadge = sowFullySigned
            ? '<span class="doc-status completed">✅ Fully Signed</span>'
            : '<span class="doc-status pending">⏳ Awaiting Developer Signature</span>';

        html += '<div class="completed-doc-card">' +
            '<div class="doc-card-header">' +
            '<h3>📋 Statement of Work</h3>' +
            sowStatusBadge +
            '</div>' +
            '<div class="doc-card-body">' +
            '<div class="doc-field-row"><span class="field-label">Client Name:</span><span class="field-value">' + (sowData.clientName || 'N/A') + '</span></div>' +
            '<div class="doc-field-row"><span class="field-label">Package:</span><span class="field-value">' + (sowData.packageType || 'N/A') + '</span></div>' +
            '<div class="doc-field-row"><span class="field-label">Total Cost:</span><span class="field-value">$' + (sowData.payment ? sowData.payment.total.toFixed(0) : '0') + '</span></div>' +
            '<div class="doc-field-row"><span class="field-label">Timeline:</span><span class="field-value">' + (sowData.estimatedWeeks || 'TBD') + ' weeks</span></div>' +
            '<div class="doc-field-row"><span class="field-label">Client Signed:</span><span class="field-value">' + (sowData.clientSignedDate || 'N/A') + '</span></div>' +
            (sowFullySigned ? '<div class="doc-field-row"><span class="field-label">Developer Signed:</span><span class="field-value">' + (sowData.devSignedDate || 'N/A') + '</span></div>' : '') +
            '</div>' +
            '<div class="doc-signature-preview">' +
            '<p class="signature-label">Your Signature:</p>' +
            '<img src="' + sowData.clientSignature + '" alt="Your SOW signature" class="signature-image" style="width: 100%; max-width: 100%; height: auto; background: rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 0.5rem; border: 1px solid rgba(255, 255, 255, 0.1);" />' +
            '</div>';

        // Add download button ONLY if fully signed
        if (sowFullySigned) {
            // Store SOW data globally for PDF generation and change requests
            var sowDataId = 'sowData_' + sowData.id.replace(/[^a-zA-Z0-9]/g, '_');
            window[sowDataId] = sowData;

            html += '<div class="doc-actions doc-actions-split">' +
                '<button type="button" class="doc-action-btn doc-download-btn" onclick="window.contractFormHandler.generateSOWPDF(window.' + sowDataId + ')">' +
                '📋 Download SOW' +
                '</button>';

            // Show "View Request" button if there's an existing change request, otherwise show "Request Change"
            if (sowData.hasChangeRequest && sowData.changeRequestId) {
                var statusColors = {
                    'pending': { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', text: '💬 View Request' },
                    'approved': { bg: 'linear-gradient(135deg, #10b981, #059669)', text: '✅ View Approved' },
                    'rejected': { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', text: '❌ View Response' },
                    'change_order': { bg: 'linear-gradient(135deg, #6366f1, #4f46e5)', text: '📋 View Order' }
                };
                var btnStyle = statusColors[sowData.changeRequestStatus] || statusColors.pending;
                html += '<button type="button" id="changeRequestBtn-' + sowData.id + '" class="doc-action-btn doc-change-btn" style="background: ' + btnStyle.bg + ';" onclick="window.contractFormHandler.viewChangeRequest(\'' + sowData.changeRequestId + '\')">' +
                    btnStyle.text +
                    '</button>';
            } else {
                html += '<button type="button" id="changeRequestBtn-' + sowData.id + '" class="doc-action-btn doc-change-btn" onclick="window.contractFormHandler.showChangeRequestModal(window.' + sowDataId + ')">' +
                    '📝 Request Change' +
                    '</button>';
            }

            html += '</div>';
        }

        html += '</div>'; // Close SOW card
    }

    html += '</div>'; // Close completed-documents
    html += '</div>'; // Close documents tab pane

    // Payment Status Tab Pane
    html += '<div class="completion-tab-pane" data-tab="payments">';
    html += self.renderPaymentStatusContent(sowData, paymentInfo);
    html += '</div>'; // Close payments tab pane

    html += '</div>'; // Close tab content container

    completedContainer.innerHTML = html;
    completedContainer.style.display = 'block';

    // Add tab switching functionality
    var tabs = completedContainer.querySelectorAll('.completion-tab');
    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            var targetTab = this.getAttribute('data-tab');

            // Update active tab button
            tabs.forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');

            // Update active tab pane
            var panes = completedContainer.querySelectorAll('.completion-tab-pane');
            panes.forEach(function(pane) {
                if (pane.getAttribute('data-tab') === targetTab) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });

    // Add event listeners for download buttons
    var downloadContractBtn = document.getElementById('downloadContractBtn');
    if (downloadContractBtn) {
        downloadContractBtn.addEventListener('click', function(e) {
            e.preventDefault();
            self.generatePDF();
        });
    }

    var downloadBothBtn = document.getElementById('downloadBothBtn');
    if (downloadBothBtn) {
        downloadBothBtn.addEventListener('click', function(e) {
            e.preventDefault();
            self.generateCombinedPDF(sowData);
        });
    }
};

// Calculate payment status from SOW data
ContractFormHandler.prototype.calculatePaymentStatus = function(sowData) {
    var result = {
        paidCount: 0,
        totalCount: 0,
        paidAmount: 0,
        totalAmount: 0,
        owedAmount: 0,
        allPaid: false,
        payments: []
    };

    if (!sowData || !sowData.payment) {
        return result;
    }

    var payment = sowData.payment;
    var tracking = payment.tracking || {};
    var isDeferred = payment.deferred && payment.deferred.enabled;

    if (isDeferred && payment.deferred.customSchedule && payment.deferred.customSchedule.length > 0) {
        // Deferred payment schedule
        var deferredPayments = tracking.deferredPayments || [];
        payment.deferred.customSchedule.forEach(function(scheduled, index) {
            var isPaid = deferredPayments[index] && deferredPayments[index].paid;
            var paidDate = deferredPayments[index] ? deferredPayments[index].paidDate : null;
            result.payments.push({
                name: 'Payment ' + (index + 1),
                amount: scheduled.amount,
                dueDate: scheduled.dueDate,
                paid: isPaid,
                paidDate: paidDate
            });
            result.totalCount++;
            result.totalAmount += scheduled.amount;
            if (isPaid) {
                result.paidCount++;
                result.paidAmount += scheduled.amount;
            }
        });
    } else {
        // Standard milestone payments
        var milestones = [
            { key: 'deposit', name: 'Deposit (50%)', amount: payment.deposit },
            { key: 'milestone1', name: 'Milestone (25%)', amount: payment.milestone1 },
            { key: 'final', name: 'Final (25%)', amount: payment.final }
        ];

        milestones.forEach(function(milestone) {
            var isPaid = tracking[milestone.key + 'Paid'] || false;
            var paidDate = tracking[milestone.key + 'PaidDate'] || null;
            result.payments.push({
                name: milestone.name,
                amount: milestone.amount,
                paid: isPaid,
                paidDate: paidDate
            });
            result.totalCount++;
            result.totalAmount += milestone.amount;
            if (isPaid) {
                result.paidCount++;
                result.paidAmount += milestone.amount;
            }
        });
    }

    result.owedAmount = result.totalAmount - result.paidAmount;
    result.allPaid = result.paidCount === result.totalCount && result.totalCount > 0;

    return result;
};

// Render payment status tab content
ContractFormHandler.prototype.renderPaymentStatusContent = function(sowData, paymentInfo) {
    if (!sowData || !sowData.payment) {
        return '<div class="payment-status-empty">' +
            '<p>No payment information available.</p>' +
            '</div>';
    }

    // Format due date with relative days
    function formatDueDate(dateStr) {
        if (!dateStr) return '';
        var date = new Date(dateStr + 'T00:00:00');
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var formatted = months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();

        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var diffTime = date.getTime() - today.getTime();
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        var relative = '';
        if (diffDays === 0) {
            relative = 'today';
        } else if (diffDays === 1) {
            relative = 'tomorrow';
        } else if (diffDays > 0) {
            relative = 'in ' + diffDays + ' days';
        } else if (diffDays === -1) {
            relative = '1 day ago';
        } else {
            relative = Math.abs(diffDays) + ' days ago';
        }

        return 'Due ' + formatted + ' (' + relative + ')';
    }

    // Separate paid and pending payments
    var paidPayments = [];
    var pendingPayments = [];
    paymentInfo.payments.forEach(function(payment) {
        if (payment.paid) {
            paidPayments.push(payment);
        } else {
            pendingPayments.push(payment);
        }
    });

    var nextPayment = pendingPayments.length > 0 ? pendingPayments[0] : null;
    var futurePayments = pendingPayments.slice(1);

    // Calculate progress
    var progressPercent = paymentInfo.totalAmount > 0
        ? Math.round((paymentInfo.paidAmount / paymentInfo.totalAmount) * 100)
        : 0;

    var html = '<div class="payment-status-container">';

    // Payment Progress Summary - minimal bar
    html += '<div class="payment-progress-summary">' +
        '<div class="progress-amounts">' +
        '<span class="progress-paid">$' + paymentInfo.paidAmount.toFixed(2) + '</span>' +
        '<span class="progress-total">of $' + paymentInfo.totalAmount.toFixed(2) + '</span>' +
        '</div>' +
        '<div class="progress-bar-minimal">' +
        '<div class="progress-bar-fill" style="width: ' + progressPercent + '%;"></div>' +
        '</div>' +
        '</div>';

    // Completed Payments - minimal pills
    if (paidPayments.length > 0) {
        html += '<div class="completed-payments-section">' +
            '<div class="completed-payments-row">';

        paidPayments.forEach(function(payment) {
            html += '<div class="completed-payment-chip">' +
                '<span class="chip-name">' + payment.name + '</span>' +
                '<span class="chip-amount">$' + payment.amount.toFixed(2) + '</span>' +
                '</div>';
        });

        html += '</div></div>';
    }

    // Next Payment - Hero focus
    if (nextPayment) {
        html += '<div class="next-payment-card">' +
            '<div class="next-payment-label">Next Payment</div>' +
            '<div class="next-payment-main">' +
            '<div class="next-payment-amount">$' + nextPayment.amount.toFixed(2) + '</div>' +
            '<div class="next-payment-info">' +
            '<span class="next-payment-name">' + nextPayment.name + '</span>' +
            (nextPayment.dueDate ? '<span class="next-payment-due">' + formatDueDate(nextPayment.dueDate) + '</span>' : '') +
            '</div>' +
            '</div>' +
            '</div>';
    } else if (paymentInfo.allPaid) {
        // All paid state
        html += '<div class="next-payment-card">' +
            '<div class="next-payment-label">Complete</div>' +
            '<div class="next-payment-main">' +
            '<div class="next-payment-amount" style="color: #10b981;">✓</div>' +
            '<div class="next-payment-info">' +
            '<span class="next-payment-name">All payments received</span>' +
            '<span class="next-payment-due">Thank you</span>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    // Future Payments Summary (collapsed, not overwhelming)
    if (futurePayments.length > 0) {
        var futureTotal = futurePayments.reduce(function(sum, p) { return sum + p.amount; }, 0);
        html += '<div class="future-payments-summary">' +
            '<span class="future-count">' + futurePayments.length + ' more payment' + (futurePayments.length > 1 ? 's' : '') + '</span>' +
            '<span class="future-total">$' + futureTotal.toFixed(2) + ' remaining</span>' +
            '</div>';
    }

    html += '</div>'; // Close payment-status-container

    return html;
};
ContractFormHandler.prototype.showDualSigningCompleted = function(contractData, sowData) {
    var self = this;
    
    console.log('Showing dual signing completed view');
    
    // Store contract data for PDF generation
    this.currentContract = { id: contractData.id || 'pending', data: contractData };
    
    // Hide the tabs
    var tabsContainer = $('#clientSigningTabs');
    if (tabsContainer) {
        tabsContainer.style.display = 'none';
        tabsContainer.remove(); // Remove to prevent re-showing
    }
    
    // Hide contract form
    var contractForm = $('#contractForm');
    if (contractForm) contractForm.style.display = 'none';

    // Ensure close button is visible and sticky
    var closeBtnEl = $('#closeModalBtn');
    if (closeBtnEl) {
        closeBtnEl.style.display = 'flex';
        closeBtnEl.style.position = 'sticky';
        closeBtnEl.style.top = '1rem';
        closeBtnEl.style.alignSelf = 'flex-end';
        closeBtnEl.style.marginRight = '1.5rem';
        closeBtnEl.style.marginTop = '1rem';
        closeBtnEl.style.marginBottom = '-2.5rem';
        closeBtnEl.style.flexShrink = '0';
    }

    // Create completed view
    var modalContent = $('.modal-content');
    if (!modalContent) return;

    // Create completed container
    var completedContainer = document.createElement('div');
    completedContainer.id = 'dualSigningCompleted';
    completedContainer.className = 'dual-signing-completed';
    
     completedContainer.innerHTML = 
        '<div class="completion-header">' +
        '<div class="completion-icon">✅</div>' +
        '<h2>Documents Successfully Submitted!</h2>' +
        '<p>Both your Contract and Statement of Work have been signed and submitted.</p>' +
        '<p class="completion-note">The developer will review and countersign shortly. You can download the PDFs once both parties have signed.</p>' +
        '</div>' +
        
        '<div class="completed-documents">' +
        
        // Contract Summary
        '<div class="completed-doc-card">' +
        '<div class="doc-card-header">' +
        '<h3>📄 Contract Agreement</h3>' +
        '<span class="doc-status pending">⏳ Awaiting Developer Signature</span>' +
        '</div>' +
        '<div class="doc-card-body">' +
        '<div class="doc-field-row">' +
        '<span class="field-label">Client Name:</span>' +
        '<span class="field-value">' + (contractData.clientName || 'N/A') + '</span>' +
        '</div>' +
        '<div class="doc-field-row">' +
        '<span class="field-label">Signer Name:</span>' +
        '<span class="field-value">' + (contractData.clientSignerName || 'N/A') + '</span>' +
        '</div>' +
        '<div class="doc-field-row">' +
        '<span class="field-label">Date Signed:</span>' +
        '<span class="field-value">' + (contractData.clientDate || 'N/A') + '</span>' +
        '</div>' +
        '<div class="doc-field-row">' +
        '<span class="field-label">' + (contractData.clientEmail ? 'Email:' : 'Phone:') + '</span>' +
        '<span class="field-value">' + (contractData.clientEmail || (contractData.clientPhone ? formatPhoneNumber(contractData.clientPhone) : 'N/A')) + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="doc-signature-preview">' +
        '<p class="signature-label">Your Signature:</p>' +
        '<img src="' + contractData.clientSignature + '" alt="Your signature" class="signature-image" />' +
        '</div>' +
        '</div>' +
        
        // SOW Summary
        '<div class="completed-doc-card">' +
        '<div class="doc-card-header">' +
        '<h3>📋 Statement of Work</h3>' +
        '<span class="doc-status pending">⏳ Awaiting Developer Signature</span>' +
        '</div>' +
        '<div class="doc-card-body">' +
        '<div class="doc-field-row">' +
        '<span class="field-label">Client Name:</span>' +
        '<span class="field-value">' + (sowData.clientName || 'N/A') + '</span>' +
        '</div>' +
        '<div class="doc-field-row">' +
        '<span class="field-label">Package:</span>' +
        '<span class="field-value">' + (sowData.packageType || 'N/A') + '</span>' +
        '</div>' +
        '<div class="doc-field-row">' +
        '<span class="field-label">Total Cost:</span>' +
        '<span class="field-value">$' + (sowData.payment ? sowData.payment.total.toFixed(0) : '0') + '</span>' +
        '</div>' +
        '<div class="doc-field-row">' +
        '<span class="field-label">Timeline:</span>' +
        '<span class="field-value">' + (sowData.estimatedWeeks || 'TBD') + ' weeks</span>' +
        '</div>' +
        '<div class="doc-field-row">' +
        '<span class="field-label">Client Signed:</span>' +
        '<span class="field-value">' + (sowData.clientSignedDate || 'N/A') + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="doc-signature-preview">' +
        '<p class="signature-label">Your Signature:</p>' +
        '<img src="' + sowData.clientSignature + '" alt="Your SOW signature" class="signature-image" />' +
        '</div>' +
        '</div>' +

        '</div>' +

        '<div class="completion-actions">' +
'</div>';

    // Insert completed view
    var closeBtn = $('#closeModalBtn');
    if (closeBtn && closeBtn.nextSibling) {
        modalContent.insertBefore(completedContainer, closeBtn.nextSibling);
    } else {
        modalContent.appendChild(completedContainer);
    }
    
    // Show success alert
    alert(t('contract.msg.submitSuccess'));
};
    ContractFormHandler.prototype.finalizeContract = function() {
        var self = this;
        var submitBtn = $('#submitBtn');
        var originalText = submitBtn ? submitBtn.innerHTML : '';
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>' + t('contract.btn.finalizing') + '</span>';
        }
        
        if (!this.currentContract) {
            alert(t('contract.val.noPending'));
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }
        
        console.log('Finalizing contract:', this.currentContract.id);
        
        // Get developer signature
        var devSignatureData = this.devSignaturePad ? this.devSignaturePad.toDataURL() : '';
        var devDateValue = $('#devDate') ? $('#devDate').value : new Date().toISOString().split('T')[0];
        
        var updateData = {
            devName: 'Carlos Martin',
            devSignature: devSignatureData,
            devDate: devDateValue,
            devEmail: firebase.auth().currentUser.email,
            finalizedTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed'
        };
        
        // Merge with existing contract data for PDF generation
        var fullContractData = Object.assign({}, this.currentContract.data, updateData);
        
        firebase.firestore().collection('contracts')
            .doc(this.currentContract.id)
            .update(updateData)
            .then(function() {
                console.log('Contract finalized successfully in Firebase');
                
                // Store full data for PDF generation
                self.currentContract.data = fullContractData;
                
                self.showDeveloperSuccessMessage();
            })
            .catch(function(error) {
                console.error('Error finalizing contract:', error);
                alert(t('contract.err.finalize') + error.message + t('contract.err.finalizeSuffix'));
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });
    };

    ContractFormHandler.prototype.showClientSuccessMessage = function() {
        var messageDiv = $('#clientSubmitMessage');
        var emailDisplay = $('#clientEmailDisplay');

        if (messageDiv) {
            var user = firebase.auth().currentUser;
            if (user && emailDisplay) {
                emailDisplay.textContent = user.email || user.phoneNumber || 'your account';
            }
            messageDiv.style.display = 'block';
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Hide signature sections
        var clientBlock = $('#clientSignatureBlock');
        if (clientBlock) clientBlock.style.display = 'none';
        
        var devPending = $('#devPendingBlock');
        if (devPending) devPending.style.display = 'none';
        
        // Hide acknowledgment section
        var ackSection = $('.acknowledgment');
        if (ackSection) ackSection.style.display = 'none';
    };

    ContractFormHandler.prototype.showDeveloperSuccessMessage = function() {
        var self = this;
        var submitBtn = $('#submitBtn');
        
        if (submitBtn) {
            submitBtn.innerHTML = '<span>' + t('contract.btn.uploadedDownload') + '</span>';
            submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            submitBtn.disabled = false;
            
            // Change button to download PDF
            submitBtn.onclick = function(e) {
                e.preventDefault();
                self.generatePDF();
            };
        }
        
        // Show download button too
        var downloadBtn = $('#downloadBtn');
        if (downloadBtn) {
            downloadBtn.style.display = 'inline-flex';
            downloadBtn.onclick = function(e) {
                e.preventDefault();
                self.generatePDF();
            };
        }
        
        alert(t('contract.msg.uploadSuccess'));
    };

    // ============================================================
    // CALIFORNIA LAW COMPLIANT CONTRACT PDF GENERATION
    // ============================================================
    ContractFormHandler.prototype.generatePDF = function() {
        var self = this;
        var contractData = this.currentContract ? this.currentContract.data : null;
        var contractId = this.currentContract ? this.currentContract.id : null;

        if (!contractData) {
            alert(t('pdf.err.noContract'));
            return;
        }

        // Create a new window with the formatted contract
        var printWindow = window.open('', '_blank');

        if (!printWindow) {
            alert(t('pdf.err.popups'));
            return;
        }

        var clientDate = contractData.clientDate || 'N/A';
        var devDate = contractData.devDate || 'N/A';
        var clientName = contractData.clientName || 'N/A';
        var clientSignerName = contractData.clientSignerName || 'N/A';
        var clientEmail = contractData.clientEmail || '';
        var clientPhone = contractData.clientPhone || '';
        var clientContact = clientEmail || (clientPhone ? formatPhoneNumber(clientPhone) : 'N/A');
        var clientContactLabel = clientEmail ? 'Email' : 'Phone';
        var devName = contractData.devName || 'Carlos Martin';
        var devEmail = contractData.devEmail || 'carlos@scarlo.dev';
        var clientSignature = contractData.clientSignature || '';
        var devSignature = contractData.devSignature || '';

        // Business entity fields
        var isBusinessEntity = contractData.isBusinessEntity || false;
        var businessName = contractData.businessName || '';
        var entityType = contractData.entityType || '';
        var stateOfFormation = contractData.stateOfFormation || '';
        var representativeName = contractData.representativeName || '';
        var representativeTitle = contractData.representativeTitle || '';

        var htmlContent = '<!DOCTYPE html>' +
        '<html><head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=1024">' +
        '<title>Website Development Agreement - ' + (isBusinessEntity ? businessName : clientName) + '</title>' +
        '<link rel="icon" type="image/png" href="https://scarlo.dev/favicons/favicon-96x96.png">' +
        '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; text-size-adjust: 100%; }' +
        'body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.6; color: #000; background: #fff; padding: 0.75in 1in; }' +
        '.contract-container { max-width: 750px; margin: 0 auto; }' +
        'h1 { font-size: 18pt; text-align: center; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }' +
        'h2 { font-size: 11pt; margin-top: 20px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #000; padding-bottom: 4px; }' +
        'h3 { font-size: 10.5pt; margin-top: 14px; margin-bottom: 6px; font-weight: bold; }' +
        'p { margin-bottom: 10px; text-align: justify; }' +
        'ul, ol { margin-left: 30px; margin-bottom: 10px; }' +
        'li { margin-bottom: 5px; }' +
        '.header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #000; }' +
        '.subtitle { font-size: 11pt; margin-top: 6px; font-style: italic; }' +
        '.parties { padding: 15px 20px; border: 1px solid #000; margin: 20px 0; }' +
        '.section { margin-bottom: 18px; page-break-inside: avoid; }' +
        '.caps-section { text-transform: uppercase; font-weight: bold; }' +
        '.highlight-box { padding: 15px 20px; margin: 15px 0; border: 1px solid #000; border-left: 4px solid #000; }' +
        '.signature-page { page-break-before: always; margin-top: 50px; }' +
        '.signature-block { display: inline-block; width: 45%; vertical-align: top; margin: 20px 2%; }' +
        '.signature-line { border-bottom: 1px solid #000; height: 70px; margin: 10px 0; display: flex; align-items: flex-end; justify-content: center; }' +
        '.signature-line img { max-height: 60px; max-width: 100%; filter: invert(1) grayscale(1); }' +
        '.signature-label { font-size: 9pt; margin-top: 5px; font-style: italic; }' +
        '.signature-name { font-weight: bold; margin-top: 10px; font-size: 10pt; }' +
        '.signature-date { margin-top: 5px; font-size: 10pt; }' +
        '.signature-email { font-size: 9pt; font-style: italic; }' +
        '.footer { margin-top: 50px; text-align: center; font-size: 9pt; border-top: 1px solid #000; padding-top: 20px; }' +
        '.contract-id { font-size: 8pt; margin-top: 10px; font-style: italic; }' +
        '.important { font-weight: bold; text-transform: uppercase; }' +
        '.indented { margin-left: 25px; }' +
        '.logo { max-width: 180px; max-height: 60px; margin-bottom: 15px; }' +
        '@media print { body { padding: 0; margin: 0; } .contract-container { max-width: 100%; } .signature-page { page-break-before: always; } }' +
        '@page { margin: 0.5in 0.6in; size: letter; }' +
        '</style>' +
        '</head><body>' +
        '<div class="contract-container">' +

        // HEADER
        '<div class="header">' +
        '<img src="' + getLogoForPDF() + '" alt="Scarlo Logo" class="logo" />' +
        '<h1>' + t('pdf.contract.title') + '</h1>' +
        '<div class="subtitle">' + t('pdf.contract.subtitle') + '</div>' +
        '</div>' +

        // PARTIES
        '<div class="section">' +
        '<h2>' + t('pdf.contract.parties') + '</h2>' +
        '<p>' + t('pdf.contract.partiesIntro') + ' <strong>' + clientDate + '</strong> ' + t('pdf.contract.between') + '</p>' +
        '<div class="parties">' +
        '<p><strong>' + t('pdf.contract.developer') + '</strong> ' + t('pdf.contract.developerDesc') + '</p>' +
        (isBusinessEntity
            ? '<p><strong>' + t('pdf.contract.client') + '</strong> ' + businessName + ', a ' + entityType + (stateOfFormation ? ' ' + t('common.formedIn') + ' ' + stateOfFormation : '') + (clientEmail ? ' (' + clientEmail + ')' : '') + '</p>'
            : '<p><strong>' + t('pdf.contract.client') + '</strong> ' + clientName + (clientEmail ? ' (' + clientEmail + ')' : '') + '</p>') +
        '</div>' +
        '</div>' +

        // SCOPE & SOW
        '<div class="section">' +
        '<h2>' + t('pdf.contract.scope') + '</h2>' +
        '<p>' + t('pdf.contract.scopeText') + '</p>' +
        '</div>' +

        // PAYMENT
        '<div class="section">' +
        '<h2>' + t('pdf.contract.paymentTerms') + '</h2>' +
        '<p><strong>' + t('pdf.contract.paymentSchedule') + '</strong></p>' +
        '<ul>' +
        '<li><strong>' + t('pdf.contract.depositLine') + '</strong> ' + t('pdf.contract.depositDesc') + '</li>' +
        '<li><strong>' + t('pdf.contract.milestoneLine') + '</strong> ' + t('pdf.contract.milestoneDesc') + '</li>' +
        '<li><strong>' + t('pdf.contract.finalLine') + '</strong> ' + t('pdf.contract.finalDesc') + '</li>' +
        '</ul>' +
        '<p><strong>' + t('pdf.contract.cancellationPolicy') + '</strong> ' + t('pdf.contract.cancellationText') + '</p>' +
        '<p><strong>' + t('pdf.contract.latePayments') + '</strong> ' + t('pdf.contract.latePaymentsText') + '</p>' +
        '</div>' +

        // IP
        '<div class="section">' +
        '<h2>' + t('pdf.contract.ip') + '</h2>' +
        '<p><strong>' + t('pdf.contract.ipClient') + '</strong> ' + t('pdf.contract.ipClientDesc') + '</p>' +
        '<p><strong>' + t('pdf.contract.ipDev') + '</strong> ' + t('pdf.contract.ipDevDesc') + '</p>' +
        '<p><strong>' + t('pdf.contract.ipImportant') + '</strong> ' + t('pdf.contract.ipImportantDesc') + '</p>' +
        '</div>' +

        // REVISIONS & CHANGES
        '<div class="section">' +
        '<h2>' + t('pdf.contract.revisions') + '</h2>' +
        '<p>' + t('pdf.contract.revisionsText') + '</p>' +
        '</div>' +

        // WARRANTY & LIABILITY
        '<div class="section">' +
        '<h2>' + t('pdf.contract.warranty') + '</h2>' +
        '<p><strong>' + t('pdf.contract.warranty').split('.')[0] + ':</strong> ' + t('pdf.contract.warrantyText') + '</p>' +
        '<div class="highlight-box">' +
        '<p class="caps-section"><strong>' + t('pdf.contract.warrantyDisclaimer') + '</strong> ' + t('pdf.contract.warrantyDisclaimerText') + '</p>' +
        '<p class="caps-section" style="margin-top: 10px;"><strong>' + t('pdf.contract.liabilityLimit') + '</strong> ' + t('pdf.contract.liabilityLimitText') + '</p>' +
        '</div>' +
        '</div>' +

        // INDEMNIFICATION
        '<div class="section">' +
        '<h2>' + t('pdf.contract.indemnification') + '</h2>' +
        '<p><strong>' + t('pdf.contract.clientIndemnifies') + '</strong> ' + t('pdf.contract.clientIndemnifiesText') + '</p>' +
        '<p><strong>' + t('pdf.contract.devIndemnifies') + '</strong> ' + t('pdf.contract.devIndemnifiesText') + '</p>' +
        '</div>' +

        // TERMINATION
        '<div class="section">' +
        '<h2>' + t('pdf.contract.termination') + '</h2>' +
        '<p><strong>' + t('pdf.contract.termByClient') + '</strong> ' + t('pdf.contract.termByClientText') + '</p>' +
        '<p><strong>' + t('pdf.contract.termByDev') + '</strong> ' + t('pdf.contract.termByDevText') + '</p>' +
        '<p><strong>' + t('pdf.contract.termForCause') + '</strong> ' + t('pdf.contract.termForCauseText') + '</p>' +
        '</div>' +

        // DISPUTE RESOLUTION
        '<div class="section">' +
        '<h2>' + t('pdf.contract.disputeResolution') + '</h2>' +
        '<p><strong>' + t('pdf.contract.disputeProcess') + '</strong> ' + t('pdf.contract.disputeProcessText') + '</p>' +
        '<p><strong>' + t('pdf.contract.attorneysFees') + '</strong> ' + t('pdf.contract.attorneysFeesText') + '</p>' +
        '</div>' +

        // GENERAL TERMS
        '<div class="section">' +
        '<h2>' + t('pdf.contract.generalTerms') + '</h2>' +
        '<p><strong>' + t('pdf.contract.governingLaw') + '</strong> ' + t('pdf.contract.governingLawText') + '</p>' +
        '<p><strong>' + t('pdf.contract.forceMajeure') + '</strong> ' + t('pdf.contract.forceMajeureText') + '</p>' +
        '<p><strong>' + t('pdf.contract.assignment') + '</strong> ' + t('pdf.contract.assignmentText') + '</p>' +
        '<p><strong>' + t('pdf.contract.severability') + '</strong> ' + t('pdf.contract.severabilityText') + '</p>' +
        '<p><strong>' + t('pdf.contract.confidentiality') + '</strong> ' + t('pdf.contract.confidentialityText') + '</p>' +
        '<p><strong>' + t('pdf.contract.independentContractor') + '</strong> ' + t('pdf.contract.independentContractorText') + '</p>' +
        '<p><strong>' + t('pdf.contract.entireAgreement') + '</strong> ' + t('pdf.contract.entireAgreementText') + '</p>' +
        '</div>' +

        // SIGNATURE PAGE
        '<div class="signature-page">' +
        '<h2 style="text-align: center; border: none; margin-bottom: 20px;">' + t('pdf.contract.signaturePage') + '</h2>' +
        '<p style="text-align: center; margin-bottom: 30px;">' + t('pdf.contract.signatureIntro') + '</p>' +

        '<div style="display: flex; justify-content: space-between; margin-top: 30px;">' +

        '<div class="signature-block">' +
        '<h3 style="font-size: 10pt;">' + t('pdf.contract.devSignature') + '</h3>' +
        '<div class="signature-line">' +
        (devSignature ? '<img src="' + devSignature + '" alt="Developer Signature" />' : '<span style="font-style: italic;">' + t('pdf.contract.awaitingSignature') + '</span>') +
        '</div>' +
        '<div class="signature-label">' + t('pdf.contract.authorizedSignature') + '</div>' +
        '<div class="signature-name">' + devName + '</div>' +
        '<div class="signature-date">' + t('common.date') + ' ' + devDate + '</div>' +
        '<div class="signature-email">' + t('common.email') + ' ' + devEmail + '</div>' +
        '</div>' +

        '<div class="signature-block">' +
        '<h3 style="font-size: 10pt;">' + t('pdf.contract.clientSignature') + ' ' + (isBusinessEntity ? businessName : clientName) + '</h3>' +
        (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 5px;">' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</p>' : '') +
        '<div class="signature-line">' +
        (clientSignature ? '<img src="' + clientSignature + '" alt="Client Signature" />' : '<span style="font-style: italic;">' + t('pdf.contract.awaitingSignature') + '</span>') +
        '</div>' +
        '<div class="signature-label">' + t('pdf.contract.authorizedSignature') + '</div>' +
        '<div class="signature-name">' + (isBusinessEntity ? t('common.by') + ' ' + representativeName + ', ' + representativeTitle : clientSignerName) + '</div>' +
        '<div class="signature-date">' + t('common.date') + ' ' + clientDate + '</div>' +
        '<div class="signature-email">' + clientContactLabel + ': ' + clientContact + '</div>' +
        '</div>' +

        '</div>' +
        '</div>' +

        // FOOTER
        '<div class="footer">' +
        '<p><strong>© ' + new Date().getFullYear() + ' Scarlo — Carlos Martin</strong></p>' +
        '<p>' + t('pdf.contract.professionalServices') + '</p>' +
        '<p class="contract-id">Contract ID: ' + (contractId || 'DRAFT') + '</p>' +
        '<p class="contract-id">Generated: ' + new Date().toLocaleString() + '</p>' +
        '</div>' +

        '</div>' + // Close contract-container

        '<script>' +
        'window.onload = function() {' +
        '  var images = document.images;' +
        '  var loaded = 0;' +
        '  var total = images.length;' +
        '  if (total === 0) { setTimeout(function() { window.print(); }, 300); return; }' +
        '  for (var i = 0; i < total; i++) {' +
        '    if (images[i].complete) { loaded++; }' +
        '    else { images[i].onload = images[i].onerror = function() { loaded++; if (loaded >= total) setTimeout(function() { window.print(); }, 300); }; }' +
        '  }' +
        '  if (loaded >= total) setTimeout(function() { window.print(); }, 300);' +
        '};' +
        '</script>' +
        '</body></html>';

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    ContractFormHandler.prototype.generateCombinedPDF = function(sowData) {
    var self = this;
    var contractData = this.currentContract ? this.currentContract.data : null;
    
    if (!contractData) {
        alert(t('pdf.err.noContractData'));
        return;
    }
    
    if (!sowData) {
        alert(t('pdf.err.noSowData'));
        return;
    }
    
    var printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        alert(t('pdf.err.popups'));
        return;
    }
    
    // Contract data
    var clientDate = contractData.clientDate || 'N/A';
    var devDate = contractData.devDate || 'N/A';
    var clientName = contractData.clientName || 'N/A';
    var clientSignerName = contractData.clientSignerName || 'N/A';
    var clientEmail = contractData.clientEmail || '';
    var clientPhone = contractData.clientPhone || '';
    var clientContact = clientEmail || (clientPhone ? formatPhoneNumber(clientPhone) : 'N/A');
    var clientContactLabel = clientEmail ? 'Email' : 'Phone';
    var devName = contractData.devName || 'Carlos Martin';
    var devEmail = contractData.devEmail || 'N/A';
    var clientSignature = contractData.clientSignature || '';
    var devSignature = contractData.devSignature || '';

    // Business entity fields (check both contract and SOW data)
    var isBusinessEntity = contractData.isBusinessEntity || sowData.isBusinessEntity || false;
    var businessName = contractData.businessName || sowData.businessName || '';
    var entityType = contractData.entityType || sowData.entityType || '';
    var stateOfFormation = contractData.stateOfFormation || sowData.stateOfFormation || '';
    var representativeName = contractData.representativeName || sowData.representativeName || '';
    var representativeTitle = contractData.representativeTitle || sowData.representativeTitle || '';

    // SOW data
    var packageNames = {
        'essential': t('pkg.essential'),
        'starter': t('pkg.starter'),
        'growth': t('pkg.growth'),
        'professional': t('pkg.professional'),
        'enterprise': t('pkg.enterprise'),
        'custom': t('pkg.custom')
    };

    var packageDetails = {
        'essential': {
            includes: [t('pkg.essential.i1'), t('pkg.essential.i2'), t('pkg.essential.i3'), t('pkg.essential.i4'), t('pkg.essential.i5'), t('pkg.essential.i6')]
        },
        'starter': {
            includes: [t('pkg.starter.i1'), t('pkg.starter.i2'), t('pkg.starter.i3'), t('pkg.starter.i4'), t('pkg.starter.i5'), t('pkg.starter.i6'), t('pkg.starter.i7')]
        },
        'growth': {
            includes: [t('pkg.growth.i1'), t('pkg.growth.i2'), t('pkg.growth.i3'), t('pkg.growth.i4'), t('pkg.growth.i5'), t('pkg.growth.i6'), t('pkg.growth.i7')]
        },
        'professional': {
            includes: [t('pkg.professional.i1'), t('pkg.professional.i2'), t('pkg.professional.i3'), t('pkg.professional.i4'), t('pkg.professional.i5'), t('pkg.professional.i6'), t('pkg.professional.i7'), t('pkg.professional.i8')]
        },
        'enterprise': {
            includes: [t('pkg.enterprise.i1'), t('pkg.enterprise.i2'), t('pkg.enterprise.i3'), t('pkg.enterprise.i4'), t('pkg.enterprise.i5'), t('pkg.enterprise.i6'), t('pkg.enterprise.i7'), t('pkg.enterprise.i8')]
        }
    };

    var packageInfo = packageDetails[sowData.packageType] || { includes: [] };
    var totalPrice = sowData.payment ? sowData.payment.total : 0;
    var deposit = totalPrice * 0.50;
    var milestone1 = totalPrice * 0.25;
    var finalPayment = totalPrice * 0.25;

    var maintenanceDetails = {
        'none': { name: t('maint.none.name'), cost: t('maint.none.price') },
        'basic': { name: t('maint.basic.name'), cost: t('maint.basic.price'), desc: t('maint.basic.desc') },
        'professional': { name: t('maint.professional.name'), cost: t('maint.professional.price'), desc: t('maint.professional.desc') },
        'premium': { name: t('maint.premium.name'), cost: t('maint.premium.price'), desc: t('maint.premium.desc') }
    };
    
    var maintenanceInfo = maintenanceDetails[sowData.maintenancePlan || 'none'] || maintenanceDetails['none'];
    
    var htmlContent = '<!DOCTYPE html>' +
        '<html><head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=1024">' +
        '<title>Complete Agreement Package - ' + (isBusinessEntity ? businessName : clientName) + '</title>' +
        '<link rel="icon" type="image/png" href="https://scarlo.dev/favicons/favicon-96x96.png">' +
        '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; text-size-adjust: 100%; }' +
        'body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.6; color: #000; background: #fff; padding: 0.75in 1in; }' +
        'h1 { font-size: 18pt; text-align: center; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }' +
        'h2 { font-size: 11pt; margin-top: 20px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #000; padding-bottom: 4px; }' +
        'h3 { font-size: 10.5pt; margin-top: 14px; margin-bottom: 6px; font-weight: bold; }' +
        'p { margin-bottom: 10px; text-align: justify; }' +
        'ul, ol { margin-left: 30px; margin-bottom: 10px; }' +
        'li { margin-bottom: 5px; }' +
        '.header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #000; }' +
        '.subtitle { font-size: 11pt; margin-top: 6px; font-style: italic; }' +
        '.parties { padding: 15px 20px; border: 1px solid #000; margin: 20px 0; }' +
        '.section { margin-bottom: 18px; page-break-inside: avoid; }' +
        '.signature-page { page-break-before: always; margin-top: 50px; }' +
        '.signature-block { display: inline-block; width: 45%; vertical-align: top; margin: 20px 2%; }' +
        '.signature-line { border-bottom: 1px solid #000; height: 70px; margin: 10px 0; display: flex; align-items: flex-end; justify-content: center; }' +
        '.signature-line img { max-height: 60px; max-width: 100%; filter: invert(1) grayscale(1); }' +
        '.signature-label { font-size: 9pt; margin-top: 5px; font-style: italic; }' +
        '.signature-name { font-weight: bold; margin-top: 10px; font-size: 10pt; }' +
        '.signature-date { margin-top: 5px; font-size: 10pt; }' +
        '.signature-email { font-size: 9pt; font-style: italic; }' +
        '.footer { margin-top: 50px; text-align: center; font-size: 9pt; border-top: 1px solid #000; padding-top: 20px; }' +
        '.contract-id { font-size: 8pt; margin-top: 10px; font-style: italic; }' +
        '.page-break { page-break-before: always; }' +
        '.info-box { padding: 15px 20px; border: 1px solid #000; border-left: 4px solid #000; margin: 20px 0; }' +
        '.info-box h3 { margin-top: 0; }' +
        '.payment-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }' +
        '.payment-table th, .payment-table td { border: 1px solid #000; padding: 10px 12px; text-align: left; }' +
        '.payment-table th { font-weight: bold; }' +
        '.total-row { font-weight: bold; font-size: 11pt; border-top: 2px solid #000; }' +
        '.highlight { font-weight: bold; }' +
        '.logo { max-width: 180px; max-height: 60px; margin-bottom: 15px; }' +
        '@media print { body { padding: 0; margin: 0; } .signature-page, .page-break { page-break-before: always; } }' +
        '@page { margin: 0.5in 0.6in; size: letter; }' +
        '</style>' +
        '</head><body>' +

        // ==================== CONTRACT SECTION ====================
        '<div class="header">' +
        '<img src="' + getLogoForPDF() + '" alt="Scarlo Logo" class="logo" />' +
        '<h1>' + t('pdf.contract.title') + '</h1>' +
        '<div class="subtitle">' + t('pdf.contract.subtitle') + '</div>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.partiesToAgreement') + '</h2>' +
        '<p>' + t('pdf.combined.partiesIntro') + ' <strong>' + clientDate + '</strong> ' + t('pdf.combined.effectiveDate') + '</p>' +
        '<div class="parties">' +
        '<p><strong>Scarlo</strong>, ' + t('pdf.combined.devDesc') + '</p>' +
        '<p>' + t('pdf.combined.and') + '</p>' +
        (isBusinessEntity
            ? '<p><strong>' + businessName + '</strong>, a ' + entityType + (stateOfFormation ? ' ' + t('common.formedIn') + ' ' + stateOfFormation : '') + ' ' + t('pdf.combined.theClient') + '</p>'
            : '<p><strong>' + clientName + '</strong> ' + t('pdf.combined.theClient') + '</p>') +
        '<p style="font-size: 10pt; font-style: italic; margin-top: 10px;">' + t('pdf.combined.partyNote') + '</p>' +
        '</div>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.projectScope') + '</h2>' +
        '<h3>' + t('pdf.combined.overview') + '</h3>' +
        '<p>' + t('pdf.combined.overviewText') + '</p>' +
        '<h3>' + t('pdf.combined.sowSection') + '</h3>' +
        '<p>' + t('pdf.combined.sowText') + '</p>' +
        '<h3>' + t('pdf.combined.scopeLimitations') + '</h3>' +
        '<p>' + t('pdf.combined.scopeLimitationsText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.packagesPricing') + '</h2>' +
        '<p>' + t('pdf.combined.packagesPricingText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.paymentTerms') + '</h2>' +
        '<p>' + t('pdf.combined.unlessSpecified') + '</p>' +
        '<h3>' + t('pdf.combined.deposit') + '</h3>' +
        '<p>' + t('pdf.combined.depositText') + '</p>' +
        '<h3>' + t('pdf.combined.milestonePayments') + '</h3>' +
        '<p>' + t('pdf.combined.milestonePaymentsIntro') + '</p>' +
        '<ul>' +
        '<li>' + t('pdf.combined.milestonePayment1') + '</li>' +
        '<li>' + t('pdf.combined.milestonePayment2') + '</li>' +
        '</ul>' +
        '<h3>' + t('pdf.combined.latePayments') + '</h3>' +
        '<p>' + t('pdf.combined.latePaymentsText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.clientResponsibilities') + '</h2>' +
        '<p>' + t('pdf.combined.clientRespText') + '</p>' +
        '<p>' + t('pdf.combined.clientRespText2') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.revisions') + '</h2>' +
        '<p>' + t('pdf.combined.revisionsIntro') + '</p>' +
        '<ul>' +
        '<li>' + t('pdf.combined.revision1') + '</li>' +
        '<li>' + t('pdf.combined.revision2') + '</li>' +
        '</ul>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.ipRights') + '</h2>' +
        '<h3>' + t('pdf.combined.devOwnership') + '</h3>' +
        '<p>' + t('pdf.combined.devOwnershipText') + '</p>' +
        '<h3>' + t('pdf.combined.clientOwnership') + '</h3>' +
        '<p>' + t('pdf.combined.clientOwnershipText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.maintenanceSupport') + '</h2>' +
        '<p>' + t('pdf.combined.maintenanceSupportText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.timelineDelivery') + '</h2>' +
        '<p>' + t('pdf.combined.timelineDeliveryText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.changeOrders') + '</h2>' +
        '<p>' + t('pdf.combined.changeOrdersText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.warrantyLimitations') + '</h2>' +
        '<h3>' + t('pdf.combined.devWarranty') + '</h3>' +
        '<p>' + t('pdf.combined.devWarrantyText') + '</p>' +
        '<h3>' + t('pdf.combined.exclusions') + '</h3>' +
        '<p>' + t('pdf.combined.exclusionsText') + '</p>' +
        '<h3>' + t('pdf.combined.liabilityLimitations') + '</h3>' +
        '<p>' + t('pdf.combined.liabilityLimitationsText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.confidentiality') + '</h2>' +
        '<p>' + t('pdf.combined.confidentialityText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.indemnification') + '</h2>' +
        '<p>' + t('pdf.combined.indemnificationText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.termination') + '</h2>' +
        '<p>' + t('pdf.combined.terminationText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.governingLaw') + '</h2>' +
        '<p>' + t('pdf.combined.governingLawText') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.entireAgreement') + '</h2>' +
        '<p>' + t('pdf.combined.entireAgreementText') + '</p>' +
        '</div>' +

        // Contract Signatures
        '<div class="signature-page">' +
        '<h2 style="text-align: center; border: none;">' + t('pdf.combined.contractSignatures') + '</h2>' +
        '<p style="text-align: center; margin-bottom: 30px;">' + t('pdf.combined.contractSignIntro') + '</p>' +

        '<div style="display: flex; justify-content: space-between; margin-top: 40px;">' +

        '<div class="signature-block">' +
        '<h3>' + t('pdf.combined.devSignature') + '</h3>' +
        '<div class="signature-line">' +
        (devSignature ? '<img src="' + devSignature + '" alt="Developer Signature" />' : '<span style="font-style: italic;">' + t('pdf.combined.pending') + '</span>') +
        '</div>' +
        '<div class="signature-label">' + t('pdf.combined.signature') + '</div>' +
        '<div class="signature-name">' + devName + '</div>' +
        '<div class="signature-date">' + t('common.date') + ' ' + devDate + '</div>' +
        '<div class="signature-email">' + devEmail + '</div>' +
        '</div>' +

        '<div class="signature-block">' +
        '<h3>' + t('pdf.combined.clientSignature') + ' ' + (isBusinessEntity ? businessName : clientName) + '</h3>' +
        (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 5px;">' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</p>' : '') +
        '<div class="signature-line">' +
        (clientSignature ? '<img src="' + clientSignature + '" alt="Client Signature" />' : '<span style="font-style: italic;">' + t('pdf.combined.pending') + '</span>') +
        '</div>' +
        '<div class="signature-label">' + t('pdf.combined.signature') + '</div>' +
        '<div class="signature-name">' + (isBusinessEntity ? t('common.by') + ' ' + representativeName + ', ' + representativeTitle : clientSignerName) + '</div>' +
        '<div class="signature-date">' + t('common.date') + ' ' + clientDate + '</div>' +
        '<div class="signature-email">' + clientContactLabel + ': ' + clientContact + '</div>' +
        '</div>' +

        '</div>' +
        '</div>' +

        // ==================== SOW SECTION (NEW PAGE) ====================
        '<div class="page-break"></div>' +

        '<div class="header">' +
        '<img src="' + getLogoForPDF() + '" alt="Scarlo Logo" class="logo" />' +
        '<h1>' + t('pdf.combined.sowSection2') + '</h1>' +
        '<div class="subtitle">' + t('pdf.combined.sowSubtitle') + '</div>' +
        '<div style="font-size: 10pt; font-style: italic; margin-top: 10px;">' + t('pdf.sow.generated') + ' ' + new Date().toLocaleDateString(getCurrentLang() === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div>' +
        '</div>' +

        '<div class="info-box">' +
        '<h3>' + t('pdf.combined.clientInfo') + '</h3>' +
        (isBusinessEntity
            ? '<p><strong>' + t('pdf.sow.businessName') + '</strong> ' + businessName + '</p>' +
              '<p><strong>' + t('pdf.sow.entityType') + '</strong> ' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</p>' +
              '<p><strong>' + t('pdf.sow.representative') + '</strong> ' + representativeName + ', ' + representativeTitle + '</p>'
            : '<p><strong>' + t('pdf.sow.clientName') + '</strong> ' + (sowData.clientName || clientName) + '</p>') +
        '<p><strong>' + t('pdf.sow.contact') + '</strong> ' + (sowData.clientEmail || sowData.clientPhone || clientEmail || t('common.na')) + '</p>' +
        '<p><strong>' + t('sow.package') + '</strong> ' + (packageNames[sowData.packageType] || sowData.packageType) + ' <span class="highlight">$' + totalPrice.toFixed(0) + '</span></p>' +
        '<p><strong>' + t('pdf.sow.estimatedTimeline') + '</strong> ' + (sowData.estimatedWeeks || t('common.tbd')) + ' ' + t('sow.weeks') + (sowData.startDate ? ' (' + new Date(sowData.startDate).toLocaleDateString() + ')' : '') + '</p>' +
        '</div>' +

        '<div class="section">' +
        '<h2>' + t('pdf.combined.packageIncludes') + '</h2>' +
        '<ul>';
    
    if (sowData.packageType === 'custom') {
        // Custom packages: all selected features ARE the package
        if (sowData.features && sowData.features.length > 0) {
            sowData.features.forEach(function(feature) {
                htmlContent += '<li>' + translateStoredFeature(feature) + '</li>';
            });
        }
    } else {
        if (packageInfo.includes && packageInfo.includes.length > 0) {
            packageInfo.includes.forEach(function(item) {
                htmlContent += '<li>' + item + '</li>';
            });
        }
    }

    htmlContent += '</ul></div>';

    // Additional Features (non-custom packages only — custom shows features above)
    if (sowData.packageType !== 'custom' && sowData.features && sowData.features.length > 0) {
        htmlContent += '<div class="section">' +
            '<h2>' + t('pdf.combined.additionalFeatures') + '</h2>' +
            '<ul>';
        sowData.features.forEach(function(feature) {
            htmlContent += '<li>' + translateStoredFeature(feature) + '</li>';
        });
        htmlContent += '</ul></div>';
    }

    // Special Requirements
    if (sowData.notes) {
        htmlContent += '<div class="section">' +
            '<h2>' + t('pdf.combined.specialRequirements') + '</h2>' +
            '<p>' + sowData.notes + '</p>' +
            '</div>';
    }

    // Payment Structure
    htmlContent += '<div class="section">' +
        '<h2>' + t('pdf.combined.paymentStructure') + '</h2>' +
        '<table class="payment-table">' +
        '<thead><tr><th>' + t('pdf.combined.paymentMilestone') + '</th><th>' + t('sow.description') + '</th><th>' + t('sow.amount') + '</th></tr></thead>' +
        '<tbody>' +
        '<tr><td><strong>' + t('pdf.combined.initialDeposit') + '</strong></td><td>' + t('pdf.combined.dueBeforeWork') + '</td><td><strong>$' + deposit.toFixed(0) + '</strong></td></tr>' +
        '<tr><td><strong>' + t('pdf.combined.milestone1') + '</strong></td><td>' + t('pdf.combined.designApproval') + '</td><td><strong>$' + milestone1.toFixed(0) + '</strong></td></tr>' +
        '<tr><td><strong>' + t('pdf.combined.finalPayment') + '</strong></td><td>' + t('pdf.combined.priorToDeployment') + '</td><td><strong>$' + finalPayment.toFixed(0) + '</strong></td></tr>' +
        '<tr class="total-row"><td colspan="2">' + t('pdf.combined.totalProjectCost') + '</td><td>$' + totalPrice.toFixed(0) + '</td></tr>' +
        '</tbody></table>' +
        '</div>';
    
    // Maintenance
    if (sowData.maintenancePlan === 'none') {
        htmlContent += '<div class="section">' +
            '<h2>' + t('pdf.combined.ongoingMaintenance') + '</h2>' +
            '<div class="info-box" style="background: #fff3cd; border-color: #856404;">' +
            '<h3 style="color: #856404;">' + t('pdf.combined.noMaintenanceTitle') + '</h3>' +
            '<p style="color: #856404;"><strong>' + t('pdf.combined.noMaintenanceWarning') + '</strong> ' + t('pdf.combined.noMaintenanceText') + '</p>' +
            '</div>' +
            '</div>';
    } else if (sowData.maintenancePlan) {
        htmlContent += '<div class="section">' +
            '<h2>' + t('pdf.combined.ongoingMaintenance') + '</h2>' +
            '<div class="info-box">' +
            '<h3>' + maintenanceInfo.name + ' — ' + maintenanceInfo.cost + '</h3>' +
            '<p>' + (maintenanceInfo.desc || '') + '</p>' +
            '</div>' +
            '</div>';
    }
    
    // Terms
    htmlContent += '<div class="section">' +
        '<h2>' + t('pdf.combined.termsConditions') + '</h2>' +
        '<p>' + t('sow.termsText1') + ' <strong>' + clientName + '</strong>' + t('sow.termsText2') + '</p>' +
        '<p>' + t('sow.termsText3') + '</p>' +
        '</div>';

    // SOW Signatures
    htmlContent += '<div class="signature-page">' +
        '<h2 style="text-align: center; border: none;">' + t('pdf.combined.sowSignatures') + '</h2>' +
        '<p style="text-align: center; margin-bottom: 30px;">' + t('pdf.combined.sowSignIntro') + '</p>' +

        '<div style="display: flex; justify-content: space-between; margin-top: 40px;">' +

        '<div class="signature-block">' +
        '<h3>' + t('pdf.combined.devSignature') + '</h3>' +
        '<div class="signature-line">' +
        (sowData.devSignature ? '<img src="' + sowData.devSignature + '" alt="Developer Signature" />' : '<span style="font-style: italic;">' + t('pdf.combined.pending') + '</span>') +
        '</div>' +
        '<div class="signature-label">' + t('pdf.combined.signature') + '</div>' +
        '<div class="signature-name">' + (sowData.devSignerName || 'Carlos Martin') + '</div>' +
        '<div class="signature-date">' + t('common.date') + ' ' + (sowData.devSignedDate || t('common.na')) + '</div>' +
        '</div>' +

        '<div class="signature-block">' +
        '<h3>' + t('pdf.combined.clientSignature') + ' ' + (isBusinessEntity ? businessName : clientName) + '</h3>' +
        (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 5px;">' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</p>' : '') +
        '<div class="signature-line">' +
        (sowData.clientSignature ? '<img src="' + sowData.clientSignature + '" alt="Client Signature" />' : '<span style="font-style: italic;">' + t('pdf.combined.pending') + '</span>') +
        '</div>' +
        '<div class="signature-label">' + t('pdf.combined.signature') + '</div>' +
        '<div class="signature-name">' + (isBusinessEntity ? t('common.by') + ' ' + representativeName + ', ' + representativeTitle : (sowData.clientSignerName || clientName)) + '</div>' +
        '<div class="signature-date">' + t('common.date') + ' ' + (sowData.clientSignedDate || t('common.na')) + '</div>' +
        '</div>' +

        '</div>' +
        '</div>' +

        // Footer
        '<div class="footer">' +
        '<p><strong>© ' + new Date().getFullYear() + ' Scarlo</strong> — ' + t('pdf.combined.footer') + '</p>' +
        '<p style="margin-top: 8px;">' + t('pdf.combined.footerDev') + '</p>' +
        '<p class="contract-id">Contract ID: ' + (self.currentContract ? self.currentContract.id : t('common.na')) + ' | SOW ID: ' + sowData.id + '</p>' +
        '</div>' +

        '<script>' +
        'window.onload = function() {' +
        '  var images = document.images;' +
        '  var loaded = 0;' +
        '  var total = images.length;' +
        '  if (total === 0) { setTimeout(function() { window.print(); }, 300); return; }' +
        '  for (var i = 0; i < total; i++) {' +
        '    if (images[i].complete) { loaded++; }' +
        '    else { images[i].onload = images[i].onerror = function() { loaded++; if (loaded >= total) setTimeout(function() { window.print(); }, 300); }; }' +
        '  }' +
        '  if (loaded >= total) setTimeout(function() { window.print(); }, 300);' +
        '};' +
        '</script>' +
        '</body></html>';

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

    // === PAGE LOADER ===
    var PageLoader = function() {
        window.addEventListener('load', function() {
            document.body.classList.add('loaded');
        });
    };

  // === ULTRA-RESPONSIVE CUSTOM CURSOR (FIXED) ===
var CustomCursor = function() {
    // Skip on touch-only devices (no mouse)
    if ('ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches) {
        console.log('Custom cursor disabled - touch-only device');
        return;
    }

    console.log('Custom cursor enabled - mouse devices only');

    // Create cursor element with GPU-accelerated styles
    this.cursor = document.createElement('div');
    this.cursor.className = 'custom-cursor';
    this.cursor.style.cssText = 'position:fixed;' +
        'left:0;top:0;' +
        'width:10px;height:10px;' +
        'background:rgba(255,255,255,0.9);' +
        'border-radius:50%;' +
        'pointer-events:none;' +
        'z-index:99999;' +
        'opacity:0;' +
        'mix-blend-mode:difference;' +
        'transition:width 0.2s cubic-bezier(0.4,0,0.2,1),height 0.2s cubic-bezier(0.4,0,0.2,1),opacity 0.15s ease-out;' +
        'will-change:transform;' +
        'backface-visibility:hidden;' +
        'transform:translate3d(0,0,0);';
    
    document.body.appendChild(this.cursor);

    // Position tracking
    this.position = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
    this.currentSize = 10; // Track current cursor size
    this.isVisible = false;
    this.isHovering = false;
    this.isAnimating = false;
    
    // Performance optimization
    this.hoverCheckFrame = 0;
    this.interactiveSelectors = 'a, button, input, textarea, select, canvas, .clear-btn, .modal-close, .auth-close, .nav-link, .btn, .hamburger, .item, .item__image, .enlarge';

    this.init();
    this.handleResize();
};

CustomCursor.prototype.init = function() {
    var self = this;
    
    // Inject cursor disable/enable styles with fallback
    var style = document.createElement('style');
    style.id = 'custom-cursor-style';
    style.textContent =
        '@media (min-width: 1024px) {' +
        '  body:not(.modal-open):not(.custom-cursor-hidden) * { cursor: none !important; }' +
        '  body.modal-open, body.modal-open * { cursor: auto !important; }' +
        '  body.modal-open .signature-pad { cursor: crosshair !important; }' +
        '  body.custom-cursor-hidden, body.custom-cursor-hidden * { cursor: auto !important; }' +
        '}';
    document.head.appendChild(style);

    var wasModalOpen = false;

    // Use pointermove for better performance than mousemove
    document.addEventListener('pointermove', function(e) {
        // Only respond to mouse input, not touch or pen
        if (e.pointerType !== 'mouse') {
            if (self.isVisible) {
                self.cursor.style.opacity = '0';
                self.isVisible = false;
                self.isAnimating = false;
            }
            return;
        }

        var isModalOpen = document.body.classList.contains('modal-open');

        // Check if modal just closed
        if (wasModalOpen && !isModalOpen) {
            self.isVisible = true;
            self.cursor.style.opacity = '1';
            document.body.classList.remove('custom-cursor-hidden');
        }

        wasModalOpen = isModalOpen;

        // Hide cursor when modal is open and show regular cursor
        if (isModalOpen) {
            self.cursor.style.opacity = '0';
            self.isAnimating = false;
            document.body.classList.add('custom-cursor-hidden');
            return;
        }

        // ⚡ INSTANT UPDATE - Set target position immediately
        self.target.x = e.clientX;
        self.target.y = e.clientY;
        
        // On first move, position cursor directly (no lerp lag)
        if (!self.isVisible) {
            self.position.x = e.clientX;
            self.position.y = e.clientY;
            self.updateCursorPosition();
            self.isVisible = true;
            self.cursor.style.opacity = '1';
        }
        
        // Start animation loop if not running
        if (!self.isAnimating) {
            self.isAnimating = true;
            self.animate();
        }
        
        // 🎯 OPTIMIZED HOVER CHECK - Every 2nd frame (~33ms at 60fps)
        self.hoverCheckFrame++;
        if (self.hoverCheckFrame % 2 === 0) {
            var element = document.elementFromPoint(e.clientX, e.clientY);
            self.checkHoverState(element);
        }
    }, { passive: true });

    document.addEventListener('pointerleave', function() {
        self.isVisible = false;
        self.isAnimating = false;
        self.cursor.style.opacity = '0';
        // Show regular cursor when custom cursor is hidden
        document.body.classList.add('custom-cursor-hidden');
    });

    document.addEventListener('pointerenter', function() {
        // Hide regular cursor when custom cursor is visible
        document.body.classList.remove('custom-cursor-hidden');
    });
};

CustomCursor.prototype.handleResize = function() {
    // Cursor always visible - no hiding on resize
};

CustomCursor.prototype.checkHoverState = function(element) {
    if (!element || document.body.classList.contains('modal-open')) return;

    // 🚀 OPTIMIZED: Use native closest() for fast parent traversal
    var isInteractive = !!element.closest(this.interactiveSelectors);

    // Only update if state actually changed
    if (isInteractive !== this.isHovering) {
        this.isHovering = isInteractive;

        if (isInteractive) {
            this.cursor.style.width = '40px';
            this.cursor.style.height = '40px';
            this.currentSize = 40; // Update current size
        } else {
            this.cursor.style.width = '10px';
            this.cursor.style.height = '10px';
            this.currentSize = 10; // Update current size
        }

        // Immediately update position with new offset
        this.updateCursorPosition();
    }
};

// 🎨 GPU-ACCELERATED POSITION UPDATE - NOW CENTERS PROPERLY
CustomCursor.prototype.updateCursorPosition = function() {
    // Calculate offset based on current size to keep cursor centered
    var offset = this.currentSize / 2;
    
    // Use translate3d for hardware acceleration
    this.cursor.style.transform = 'translate3d(' + 
        (this.position.x - offset) + 'px, ' + 
        (this.position.y - offset) + 'px, 0)';
};

CustomCursor.prototype.animate = function() {
    if (!this.isAnimating) return;
    
    var self = this;
    
    // ⚡ ULTRA-FAST LERP - 0.65 factor for instant response
    var lerpFactor = 0.65;
    var snapThreshold = 0.5;  // Stop animating if within 0.5px for faster snapping
    
    // Calculate distance to target
    var dx = this.target.x - this.position.x;
    var dy = this.target.y - this.position.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    
    // If very close, snap to target and stop animation loop
    if (distance < snapThreshold) {
        this.position.x = this.target.x;
        this.position.y = this.target.y;
        this.updateCursorPosition();
        this.isAnimating = false;  // 🔋 SAVE CPU
        return;
    }
    
    // Smooth interpolation with fast factor
    this.position.x += dx * lerpFactor;
    this.position.y += dy * lerpFactor;
    
    // Update position using GPU transform
    this.updateCursorPosition();

    // Continue animation loop
    requestAnimationFrame(function() {
        self.animate();
    });
};

    // === VIEWPORT FIX ===
    var ViewportFix = function() {
        this.setVH();
        var self = this;
        window.addEventListener('resize', debounce(function() {
            self.setVH();
        }, 250));
    };

    ViewportFix.prototype.setVH = function() {
        var vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', vh + 'px');
    };

    // === ACCESSIBILITY ===
    var AccessibilityEnhancer = function() {
        var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (prefersReducedMotion.matches) {
            document.body.classList.add('reduce-motion');
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-nav');
            }
        });

        document.addEventListener('mousedown', function() {
            document.body.classList.remove('keyboard-nav');
        });
    };
// === SECTION SEPARATOR GLOW ON SCROLL - FIXED ===
var SectionSeparatorGlow = function() {
    console.log('Initializing Section Separator Glow...');
    
    var sections = $$('section');
    if (!sections || sections.length === 0) return;
    
    var isMobile = window.innerWidth <= 1024;
    var minScrollToActivate = isMobile ? 20 : 50;
    
    var checkSectionVisibility = function() {
        var viewportHeight = window.innerHeight;
        
        sections.forEach(function(section) {
            // Skip if already visible or is footer
            if (section.classList.contains('separator-visible')) return;
            if (section.classList.contains('footer')) return;
            
            var rect = section.getBoundingClientRect();
            
            // The separator is at the BOTTOM of the section
            // Only trigger when the bottom of the section enters the viewport
            // rect.bottom tells us where the section ends relative to viewport top
            
            // Trigger when section bottom is in the lower 70% of viewport
            var bottomVisible = rect.bottom > 0 && rect.bottom < viewportHeight * 0.85;
            
            if (bottomVisible) {
                section.classList.add('separator-visible');
                console.log('Section separator triggered:', section.id || section.className);
            }
        });
    };
    
    // Throttled scroll handler
    var ticking = false;
    window.addEventListener('scroll', function() {
        // Must scroll minimum amount before any activation
        if (window.pageYOffset < minScrollToActivate) return;
        
        if (!ticking) {
            requestAnimationFrame(function() {
                checkSectionVisibility();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
};
    // === BACK TO TOP BUTTON ===
    var BackToTop = function() {
        var btn = $('.footer-back-to-top');
        if (!btn) return;

        var scrollThreshold = 300;
        var isVisible = false;

        var toggleVisibility = function() {
            var shouldShow = window.pageYOffset > scrollThreshold;
            if (shouldShow !== isVisible) {
                isVisible = shouldShow;
                if (shouldShow) {
                    btn.classList.add('visible');
                } else {
                    btn.classList.remove('visible');
                }
            }
        };

        window.addEventListener('scroll', throttle(toggleVisibility, 100), { passive: true });
        toggleVisibility();
    };

    // === INITIALIZATION ===
    var init = function() {
    console.log('Scarlo - Crafted with precision');

    // Preload logo for PDF generation
    preloadLogoForPDF();
    console.log('Device: ' + (DeviceDetector.isMobile() ? 'Mobile' : 'Desktop'));
    console.log('Screen width:', window.innerWidth);

    // Sync navbar ambient animations (double-rAF to avoid mobile flicker)
    var logoAmbient = $('.navbar-logo-ambient');
    var textAmbient = $('.navbar-text-ambient');
    if (logoAmbient && textAmbient) {
        requestAnimationFrame(function() {
            logoAmbient.style.animation = 'none';
            textAmbient.style.animation = 'none';
            requestAnimationFrame(function() {
                logoAmbient.style.animation = 'navbarAmbientPulse 3s ease-in-out infinite';
                textAmbient.style.animation = 'navbarAmbientPulse 3s ease-in-out infinite';
            });
        });
    }

    new HelpRequestHandler();

    new Navigation();
    window.rotatingText = new RotatingText();
    new ScrollAnimations();
    new PortfolioHandler();
    new FormHandler();
    new FirebaseAuthHandler();
    window.contractFormHandler = new ContractFormHandler();

    new PageLoader();
    new CustomCursor();
    new ViewportFix();
    new AccessibilityEnhancer();
    new SectionSeparatorGlow();
    new BackToTop();
};

    // Wait for both DOM and Firebase to be ready before initializing
    function startApp() {
        if (window.firebaseReady) {
            window.firebaseReady.then(init).catch(function(err) {
                console.error('Firebase initialization failed, starting app anyway:', err);
                init();
            });
        } else {
            // Fallback if firebaseReady isn't available
            init();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }

})();
// Auto-resize textarea
const messageTextarea = document.getElementById('message');
if (messageTextarea) {
    messageTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 400) + 'px';
    });

    // Also trigger on page load in case there's pre-filled content
    messageTextarea.style.height = 'auto';
    messageTextarea.style.height = Math.min(messageTextarea.scrollHeight, 400) + 'px';
}

// ============================================
// COOKIE CONSENT (with Firestore sync for authenticated users)
// ============================================
(function() {
    'use strict';

    var COOKIE_KEY = 'scarlo_cookie_consent';
    var FIRESTORE_COLLECTION = 'userPreferences';
    var REASK_AFTER_DAYS = 7;
    var REASK_AFTER_MS = REASK_AFTER_DAYS * 24 * 60 * 60 * 1000;

    var popup = document.getElementById('cookieConsent');
    var settingsBtn = document.getElementById('cookieSettingsBtn');
    var acceptBtn = document.getElementById('cookieAccept');
    var declineBtn = document.getElementById('cookieDecline');
    var analyticsToggle = document.getElementById('cookieAnalytics');
    var marketingToggle = document.getElementById('cookieMarketing');

    if (!popup) return;

    // --- Consent logic helpers ---
    // "Full consent" = both Analytics AND Marketing enabled
    function isFullConsent(consent) {
        return consent && consent.analytics === true && consent.marketing === true;
    }

    // Should we show the popup?
    // Yes if: no consent, OR (not full consent AND 7+ days have passed)
    function shouldShowPopup(consent) {
        if (!consent) return true;
        if (isFullConsent(consent)) return false;

        // Partial/declined consent - check if 7 days have passed
        var daysSince = Date.now() - (consent.timestamp || 0);
        return daysSince >= REASK_AFTER_MS;
    }

    // --- localStorage helpers ---
    function getLocalConsent() {
        try {
            var stored = localStorage.getItem(COOKIE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    }

    function saveLocalConsent(consent) {
        try {
            localStorage.setItem(COOKIE_KEY, JSON.stringify(consent));
        } catch (e) {
            // localStorage not available
        }
    }

    // --- Firestore helpers (for authenticated users) ---
    function getCurrentUser() {
        return window.auth && window.auth.currentUser ? window.auth.currentUser : null;
    }

    function saveToFirestore(consent) {
        var user = getCurrentUser();
        if (!user || !window.db) return Promise.resolve();

        return window.db.collection(FIRESTORE_COLLECTION).doc(user.uid).set({
            cookieConsent: consent,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(function(err) {
            console.warn('Failed to save cookie consent to Firestore:', err);
        });
    }

    function loadFromFirestore() {
        var user = getCurrentUser();
        if (!user || !window.db) return Promise.resolve(null);

        return window.db.collection(FIRESTORE_COLLECTION).doc(user.uid).get()
            .then(function(doc) {
                if (doc.exists && doc.data().cookieConsent) {
                    return doc.data().cookieConsent;
                }
                return null;
            })
            .catch(function(err) {
                console.warn('Failed to load cookie consent from Firestore:', err);
                return null;
            });
    }

    // --- UI helpers ---
    function showPopup() {
        popup.classList.add('visible');
        popup.setAttribute('aria-hidden', 'false');
        settingsBtn.classList.remove('visible');
        settingsBtn.setAttribute('aria-hidden', 'true');
    }

    function hidePopup() {
        popup.classList.remove('visible');
        popup.setAttribute('aria-hidden', 'true');
        settingsBtn.classList.add('visible');
        settingsBtn.setAttribute('aria-hidden', 'false');
    }

    function updateToggles(consent) {
        if (consent) {
            analyticsToggle.checked = consent.analytics;
            marketingToggle.checked = consent.marketing;
        }
    }

    function applyConsent(consent) {
        // Dispatch custom event for other scripts to listen to
        window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: consent }));

        // Example: Load analytics if consented
        if (consent.analytics) {
            // Uncomment and add your analytics script loading here
            // loadGoogleAnalytics();
        }

        // Example: Load marketing scripts if consented
        if (consent.marketing) {
            // Uncomment and add your marketing script loading here
            // loadMarketingPixels();
        }
    }

    // --- Main save function (localStorage + Firestore if authenticated) ---
    function saveConsent(consent) {
        saveLocalConsent(consent);
        saveToFirestore(consent);
    }

    // --- Initialization ---
    function init() {
        var localConsent = getLocalConsent();

        if (shouldShowPopup(localConsent)) {
            // No consent, or partial/declined and 7+ days passed - show immediately
            updateToggles(localConsent);
            showPopup();
        } else {
            // Full consent given - apply it and show settings button
            updateToggles(localConsent);
            settingsBtn.classList.add('visible');
            settingsBtn.setAttribute('aria-hidden', 'false');
            applyConsent(localConsent);
        }
    }

    // --- Sync from Firestore when user authenticates ---
    function onAuthStateChanged(user) {
        if (!user) return;

        loadFromFirestore().then(function(firestoreConsent) {
            var localConsent = getLocalConsent();
            var effectiveConsent = null;

            if (firestoreConsent && localConsent) {
                // Both exist - use the most recent one
                if (firestoreConsent.timestamp > localConsent.timestamp) {
                    effectiveConsent = firestoreConsent;
                    saveLocalConsent(firestoreConsent);
                } else {
                    effectiveConsent = localConsent;
                    saveToFirestore(localConsent);
                }
            } else if (firestoreConsent && !localConsent) {
                effectiveConsent = firestoreConsent;
                saveLocalConsent(firestoreConsent);
            } else if (!firestoreConsent && localConsent) {
                effectiveConsent = localConsent;
                saveToFirestore(localConsent);
            }

            // Apply the same show/hide logic as init
            if (effectiveConsent) {
                updateToggles(effectiveConsent);
                if (shouldShowPopup(effectiveConsent)) {
                    showPopup();
                } else {
                    popup.classList.remove('visible');
                    settingsBtn.classList.add('visible');
                    settingsBtn.setAttribute('aria-hidden', 'false');
                    applyConsent(effectiveConsent);
                }
            }
        });
    }

    // Listen for Firebase auth state changes
    function setupAuthListener() {
        if (window.auth) {
            window.auth.onAuthStateChanged(onAuthStateChanged);
        }
    }

    // Accept/Save button
    acceptBtn.addEventListener('click', function() {
        var consent = {
            essential: true,
            analytics: analyticsToggle.checked,
            marketing: marketingToggle.checked,
            timestamp: new Date().toLocaleString()
        };
        saveConsent(consent);
        hidePopup();
        applyConsent(consent);
    });

    // Decline button
    declineBtn.addEventListener('click', function() {
        var consent = {
            essential: true,
            analytics: false,
            marketing: false,
            timestamp: new Date().toLocaleString()
        };
        analyticsToggle.checked = false;
        marketingToggle.checked = false;
        saveConsent(consent);
        hidePopup();
        applyConsent(consent);
    });

    // Settings button (reopens popup)
    settingsBtn.addEventListener('click', function() {
        var consent = getLocalConsent();
        updateToggles(consent);
        showPopup();
    });

    // Initialize immediately with localStorage
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Setup Firestore sync after Firebase is ready
    if (window.firebaseReady) {
        window.firebaseReady.then(setupAuthListener).catch(function() {
            // Firebase failed to load - localStorage only
        });
    } else {
        window.addEventListener('firebaseReady', setupAuthListener);
    }
})();
