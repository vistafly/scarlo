// Scarlo — MOBILE-OPTIMIZED INTERACTIONS

(function() {
    'use strict';

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

// === ROTATING TEXT ANIMATION - ENHANCED ===
var RotatingText = function() {
    this.wrapper = $('.rotating-text-wrapper');
    if (!this.wrapper) return;
    
    this.texts = $$('.rotating-text');
    this.currentIndex = 0;
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
            btnText.textContent = 'Sending...';

            setTimeout(function() {
                btnText.textContent = 'Message sent!';
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
                    if (confirm('Are you sure you want to sign out?')) {
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
            if (authText) authText.textContent = 'Sign In';
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
            this.showError(errorEl, 'Please fill in all fields');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

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
                submitBtn.textContent = 'Sign In';
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
                alert('Error signing out. Please try again.');
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
            'auth/configuration-not-found': 'Firebase is not configured.',
            'auth/invalid-email': 'Invalid email address',
            'auth/user-not-found': 'No account found.',
            'auth/wrong-password': 'Incorrect password',
            'auth/too-many-requests': 'Too many failed attempts. Please wait a moment.',
            'auth/network-request-failed': 'Network error. Check your connection.',
            'auth/user-disabled': 'Account disabled.',
            'auth/invalid-credential': 'Invalid email or password',
            // Phone auth errors
            'auth/invalid-phone-number': 'Invalid phone number format.',
            'auth/missing-phone-number': 'Please enter a phone number.',
            'auth/quota-exceeded': 'SMS quota exceeded. Please try again later.',
            'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please try again.',
            'auth/invalid-verification-code': 'Invalid verification code.',
            'auth/code-expired': 'Verification code has expired. Please request a new one.',
            'auth/missing-verification-code': 'Please enter the verification code.',
            'auth/invalid-verification-id': 'Session expired. Please request a new code.',
            'auth/session-expired': 'Session expired. Please request a new verification code.',
            'auth/credential-already-in-use': 'This phone number is already linked to another account.',
            'auth/operation-not-allowed': 'Phone authentication is not enabled.',
            'auth/billing-not-enabled': 'This phone number is not authorized.'
        };

        return messages[errorCode] || 'Authentication error. Please try again.';
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
                if (helpContactLabel) helpContactLabel.textContent = 'Your Email *';
                // Hide tabs since we're pre-filling
                if (contactTabs) contactTabs.style.display = 'none';
            } else if (this.lastLoginError.phone) {
                helpContact.value = this.lastLoginError.phone;
                helpContact.type = 'tel';
                helpContact.placeholder = '(555) 123-4567';
                if (helpContactLabel) helpContactLabel.textContent = 'Your Phone Number *';
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
            this.showError(errorEl, 'Please enter a valid phone number');
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
                    self.showErrorWithHelpLink(errorEl, phoneHelpLink, 'Phone number not registered. Please contact support.', {
                        phone: fullPhoneNumber,
                        errorType: 'account_access'
                    });
                    self.setPhoneLoadingState(submitBtn, false);
                }
            })
            .catch(function(error) {
                console.error('Error checking test phone:', error);
                var phoneHelpLink = $('#phoneHelpLink');
                self.showErrorWithHelpLink(errorEl, phoneHelpLink, 'Unable to verify phone number. Please try again.', {
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
                'Please enter your verification code (4-6 digits)' :
                'Please enter the 6-digit verification code';
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
                this.showErrorWithHelpLink(errorEl, helpLinkEl, 'Session expired. Please request a new code.', {
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
            var message = error.message || 'Invalid verification code';
            if (error.code === 'functions/invalid-argument') {
                message = 'Invalid phone number or verification code.';
            } else if (error.code === 'functions/internal') {
                message = 'Server error. Please try again.';
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
    
    if (!confirm('Mark this help request as resolved?')) {
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
            alert('Error marking request as resolved: ' + error.message);
        });
};
ContractFormHandler.prototype.resolveAllHelpRequests = function(helpRequests) {
    var self = this;
    
    if (helpRequests.length === 0) {
        return;
    }
    
    if (!confirm('Mark all ' + helpRequests.length + ' help request(s) as resolved?')) {
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
            alert('Error marking requests as resolved: ' + error.message);
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
                if (contactLabel) contactLabel.textContent = 'Your Email *';
                if (contactHint) contactHint.textContent = "We'll use this to contact you about your request";
            } else if (hasPhone) {
                contactField.value = formatPhoneNumber(this.currentUser.phoneNumber);
                contactField.type = 'tel';
                contactField.placeholder = '(555) 123-4567';
                if (contactLabel) contactLabel.textContent = 'Your Phone Number *';
                if (contactHint) contactHint.textContent = "We'll use this to contact you about your request";
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
            if (contactLabel) contactLabel.textContent = 'Your Email *';

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
                if (contactLabel) contactLabel.textContent = 'Your Email *';
                if (contactHint) contactHint.textContent = "We'll use this to contact you about your request";
                // Remove phone formatting listener
                self.removePhoneFormatting(contactField);
            } else {
                contactField.type = 'tel';
                contactField.placeholder = '(555) 123-4567';
                if (contactLabel) contactLabel.textContent = 'Your Phone Number *';
                if (contactHint) contactHint.textContent = "We'll use this to contact you about your request";
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
    var originalText = submitText ? submitText.textContent : 'Send Help Request';
    
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = 'Sending...';
    
    var helpContact = $('#helpContact').value.trim();
    var helpIssue = $('#helpIssue').value;
    var helpDetails = $('#helpDetails').value.trim();

    if (!helpContact || !helpIssue || !helpDetails) {
        alert('Please fill in all required fields');
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = originalText;
        return;
    }

    // Determine if contact is email or phone
    var isPhone = this.currentUser && this.currentUser.phoneNumber && !this.currentUser.email;
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var phoneRegex = /^\+?[1-9]\d{6,14}$/;

    if (!isPhone && !emailRegex.test(helpContact)) {
        alert('Please enter a valid email address');
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = originalText;
        return;
    }

    if (isPhone && !phoneRegex.test(helpContact.replace(/[\s\-\(\)]/g, ''))) {
        alert('Please enter a valid phone number');
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
            alert('Error submitting help request: ' + error.message + '\n\nPlease try again or contact support directly.');
            
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
    '<h3>🆘 Help Requests</h3>' +
    '<div style="display: flex; align-items: center; gap: 10px;">';
    
    if (helpRequests.length > 0) {
        html += '<button class="btn-resolve-all" style="padding: 6px 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600;">✓ Resolve All</button>';
    }
    
    html += '</div></div>';
    if (helpRequests.length === 0) {
        html += '<div class="empty-state">' +
            '<img src="/images/scarlo-logo.png" alt="Scarlo" class="empty-icon">' +
            '<p>No pending help requests</p>' +
            '</div>';
    } else {
        html += '<div class="help-list">';
        helpRequests.forEach(function(request) {
            var requestDate = request.timestamp ? 
                (request.timestamp.toDate ? request.timestamp.toDate().toLocaleDateString() : new Date(request.timestamp).toLocaleDateString()) 
                : 'N/A';
            
            var authBadge = request.isAuthenticated 
                ? '<span class="auth-badge verified">✓ Verified User</span>' 
                : '<span class="auth-badge anonymous">◎ Anonymous</span>';
            
            html += '<div class="help-item" data-request-id="' + request.id + '">' +
                '<div class="help-icon">❓</div>' +
                '<div class="help-details">' +
                '<div class="help-header">' +
                '<h4>' + (request.userEmail || request.userPhone || 'Unknown User') + '</h4>' +
                authBadge +
                '<span class="help-badge">' + self.getIssueTypeLabel(request.issueType) + '</span>' +
                '</div>' +
                '<p class="help-message">' + (request.issueDetails || 'No details provided') + '</p>' +
                '<div class="help-meta">' +
                '<span class="meta-item">📅 ' + requestDate + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="help-actions">' +
                '<button class="btn-resolve-help" data-request-id="' + request.id + '" title="Mark as resolved">' +
                '✓ Resolve' +
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
                self.renderDeveloperDashboard(pendingContracts, completedContracts);

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
    
    ContractFormHandler.prototype.renderDeveloperDashboard = function(pendingContracts, completedContracts) {
    var self = this;
    var dashboard = $('#developerDashboard');
    
    if (!dashboard) return;
    
    // Calculate business metrics
    var totalContracts = pendingContracts.length + completedContracts.length;
    var urgentCount = pendingContracts.filter(function(c) { return c.daysSinceSubmission >= 7; }).length;
    var thisMonthCompleted = completedContracts.filter(function(c) {
        if (!c.finalizedTimestamp) return false;
        var date = c.finalizedTimestamp.toDate ? c.finalizedTimestamp.toDate() : new Date(c.finalizedTimestamp);
        var now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    
    var html = '';
    
    // ✅ ADD CLOSE BUTTON AT THE TOP
    html += '<button class="dashboard-close" onclick="document.querySelector(\'.contract-modal\').classList.remove(\'show\'); document.body.classList.remove(\'modal-open\'); document.body.style.overflow = \'\';">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<line x1="18" y1="6" x2="6" y2="18"></line>' +
        '<line x1="6" y1="6" x2="18" y2="18"></line>' +
        '</svg>' +
        '</button>';
    
    // Header with greeting
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    
    html += '<div class="dashboard-header">' +
        '<div class="header-content">' +
        '<h2>' + greeting + ', Carlos 👋</h2>' +
        '<p class="header-subtitle">Here\'s your business overview</p>' +
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
            '<strong>' + urgentCount + ' contract' + (urgentCount !== 1 ? 's' : '') + ' need' + (urgentCount === 1 ? 's' : '') + ' immediate attention!</strong>' +
            '<p>Client' + (urgentCount !== 1 ? 's have' : ' has') + ' been waiting 7+ days for your signature.</p>' +
            '</div>' +
            '</div>';
    } else if (pendingContracts.length === 0 && completedContracts.length > 0) {
        html += '<div class="alert-banner success">' +
            '<div class="alert-icon">🎉</div>' +
            '<div class="alert-content">' +
            '<strong>All caught up!</strong>' +
            '<p>No pending contracts. Great job staying on top of things!</p>' +
            '</div>' +
            '</div>';
    }
    
    // Quick Stats Row
    html += '<div class="quick-stats">' +
        '<div class="quick-stat action-required">' +
        '<div class="quick-stat-icon">📝</div>' +
        '<div class="quick-stat-content">' +
        '<span class="quick-stat-number">' + pendingContracts.length + '</span>' +
        '<span class="quick-stat-label">Awaiting Signature</span>' +
        '</div>' +
        '</div>' +
        '<div class="quick-stat completed-stat">' +
        '<div class="quick-stat-icon">✅</div>' +
        '<div class="quick-stat-content">' +
        '<span class="quick-stat-number">' + completedContracts.length + '</span>' +
        '<span class="quick-stat-label">Completed</span>' +
        '</div>' +
        '</div>' +
        '<div class="quick-stat monthly-stat">' +
        '<div class="quick-stat-icon">📈</div>' +
        '<div class="quick-stat-content">' +
        '<span class="quick-stat-number">' + thisMonthCompleted + '</span>' +
        '<span class="quick-stat-label">This Month</span>' +
        '</div>' +
        '</div>' +
        '</div>';
    
    // ============= TABBED INTERFACE =============
html += '<div class="dashboard-tabs">' +
    '<div class="tab-buttons">' +
    '<button class="tab-btn active" data-tab="contracts">' +
    '<span class="tab-icon">📄</span>' +
    '<span class="tab-label">Contracts</span>' +
    '<span class="tab-badge">' + (pendingContracts.length + completedContracts.length) + '</span>' +
    '</button>' +
    '<button class="tab-btn" data-tab="sow">' +
    '<span class="tab-icon">📋</span>' +
    '<span class="tab-label">SOW Documents</span>' +
    '<span class="tab-badge" id="sowCountBadge">0</span>' +
    '</button>' +
    '<button class="tab-btn" data-tab="coupons">' +
    '<span class="tab-icon">🎟️</span>' +
    '<span class="tab-label">Coupons</span>' +
    '<span class="tab-badge" id="couponCountBadge">0</span>' +
    '</button>' +
    '<button class="tab-btn" data-tab="help">' +
    '<span class="tab-icon">🆘</span>' +
    '<span class="tab-label">Help Requests</span>' +
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
    '<p>Loading SOW documents...</p>' +
    '</div>' +
    '</div>' +
    '</div>' +

    // Coupons Tab
    '<div class="tab-pane" data-tab="coupons">' +
    '<div id="couponsTabContent">' +
    '<div class="loading-state">' +
    '<div class="spinner"></div>' +
    '<p>Loading coupons...</p>' +
    '</div>' +
    '</div>' +
    '</div>' +

    // Help Requests Tab
    '<div class="tab-pane" data-tab="help">' +
    '<div id="helpTabContent">' +
    '<div class="loading-state">' +
    '<div class="spinner"></div>' +
    '<p>Loading help requests...</p>' +
    '</div>' +
    '</div>' +
    '</div>' +

    '</div>' +
    '</div>';
    // Close Modal Button
    html += '<div class="dashboard-footer">' +
        '<button class="btn-close-dashboard" onclick="document.querySelector(\'.contract-modal\').classList.remove(\'show\'); document.body.classList.remove(\'modal-open\');">Close Dashboard</button>' +
        '</div>';
    
    dashboard.innerHTML = html;
    
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
    
    // Action Required Section (Pending Contracts)
    html += '<div class="dashboard-section action-section">' +
        '<div class="section-header">' +
        '<h3>🖊️ Action Required</h3>' +
        '<span class="section-badge">' + pendingContracts.length + ' pending</span>' +
        '</div>';
    
    if (pendingContracts.length === 0) {
        html += '<div class="empty-state success-state">' +
            '<img src="/images/scarlo-logo.png" alt="Scarlo" class="empty-icon">' +
            '<p>No contracts waiting for your signature</p>' +
            '</div>';
    } else {
        html += '<div class="action-list">';
        pendingContracts.forEach(function(contract, index) {
            var urgency = self.getUrgencyLevel(contract.daysSinceSubmission);
            var submissionDate = contract.timestamp ? 
                (contract.timestamp.toDate ? contract.timestamp.toDate().toLocaleDateString() : new Date(contract.timestamp).toLocaleDateString()) 
                : 'N/A';
            
            html += '<div class="action-item" data-contract-id="' + contract.id + '">' +
                '<div class="action-priority" style="background: ' + urgency.color + ';">' +
                '<span class="priority-number">#' + (index + 1) + '</span>' +
                '</div>' +
                '<div class="action-details">' +
                '<div class="action-client">' +
                '<h4>' + (contract.clientName || 'Unknown Client') + '</h4>' +
                '<span class="urgency-tag" style="background: ' + urgency.color + '22; color: ' + urgency.color + ';">' + urgency.icon + ' ' + urgency.label + '</span>' +
                '</div>' +
                '<div class="action-meta">' +
                '<span class="meta-item"><strong>Email:</strong> ' + (contract.clientEmail || 'N/A') + '</span>' +
                '<span class="meta-item"><strong>Waiting:</strong> ' + contract.daysSinceSubmission + ' day' + (contract.daysSinceSubmission !== 1 ? 's' : '') + '</span>' +
                '<span class="meta-item"><strong>Received:</strong> ' + submissionDate + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="action-cta">' +
                '<button class="btn-sign-contract" data-contract-id="' + contract.id + '">' +
                '<span class="btn-icon">✍️</span>' +
                '<span class="btn-text">Sign Now</span>' +
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
        '<h3>📁 Completed Contracts</h3>' +
        '<span class="section-badge success">' + completedContracts.length + ' total</span>' +
        '</div>';
    
    if (completedContracts.length === 0) {
        html += '<div class="empty-state">' +
            '<img src="/images/scarlo-logo.png" alt="Scarlo" class="empty-icon">' +
            '<p>No completed contracts yet</p>' +
            '</div>';
    } else {
        html += '<div class="history-list">';
        completedContracts.forEach(function(contract) {
            var finalizedDate = contract.finalizedTimestamp ? 
                (contract.finalizedTimestamp.toDate ? contract.finalizedTimestamp.toDate().toLocaleDateString() : new Date(contract.finalizedTimestamp).toLocaleDateString()) 
                : 'N/A';
            
            html += '<div class="history-item" data-contract-id="' + contract.id + '">' +
                '<div class="history-status">' +
                '<span class="status-icon">✓</span>' +
                '</div>' +
                '<div class="history-details">' +
                '<h4>' + (contract.clientName || 'Unknown Client') + '</h4>' +
                '<span class="history-meta">Completed ' + finalizedDate + '</span>' +
                '</div>' +
                '<div class="history-actions">' +
                '<button class="btn-download" data-contract-id="' + contract.id + '" title="Download PDF">' +
                '📄 Download' +
                '</button>' +
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
        '<span class="btn-text">Create Coupon</span>' +
        '</button>' +
        '</div>';

    // Coupon Creator Form (hidden by default)
    html += '<div id="couponCreatorForm" class="coupon-creator-form" style="display: none;">' +
        '<div class="coupon-form-header">' +
        '<h4 id="couponFormTitle">Create New Coupon</h4>' +
        '<button class="btn-close-form" id="btnCloseCouponForm">×</button>' +
        '</div>' +
        '<div class="coupon-form-body">' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label>Coupon Code *</label>' +
        '<input type="text" id="couponCode" placeholder="e.g., WELCOME10" class="coupon-input" style="text-transform: uppercase;">' +
        '<small>Alphanumeric, no spaces. Auto-converts to uppercase.</small>' +
        '</div>' +
        '<div class="form-group">' +
        '<label>Discount Type *</label>' +
        '<select id="couponType" class="coupon-select">' +
        '<option value="percentage">Percentage Off (%)</option>' +
        '<option value="fixed">Fixed Amount Off ($)</option>' +
        '</select>' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label>Discount Value *</label>' +
        '<input type="number" id="couponValue" placeholder="e.g., 10" class="coupon-input" min="0" step="0.01">' +
        '<small id="couponValueHint">Enter percentage (0-100)</small>' +
        '</div>' +
        '<div class="form-group">' +
        '<label>Usage Limit</label>' +
        '<input type="number" id="couponUsageLimit" placeholder="Leave empty for unlimited" class="coupon-input" min="0">' +
        '<small>Max times this coupon can be used</small>' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label>Minimum Purchase ($)</label>' +
        '<input type="number" id="couponMinPurchase" placeholder="0" class="coupon-input" min="0" step="0.01">' +
        '<small>Minimum order amount required</small>' +
        '</div>' +
        '<div class="form-group">' +
        '<label>Expiration Date</label>' +
        '<input type="date" id="couponExpiration" class="coupon-input">' +
        '<small>Leave empty for no expiration</small>' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group full-width">' +
        '<label>Tier Restrictions</label>' +
        '<div class="tier-checkboxes">' +
        '<label class="tier-checkbox"><input type="checkbox" value="essential" checked> Essential</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="starter" checked> Starter</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="growth" checked> Growth</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="professional" checked> Professional</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="enterprise" checked> Enterprise</label>' +
        '<label class="tier-checkbox"><input type="checkbox" value="custom" checked> Custom</label>' +
        '</div>' +
        '<small>Select which tiers this coupon can be applied to</small>' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group full-width">' +
        '<label>Description (Optional)</label>' +
        '<input type="text" id="couponDescription" placeholder="e.g., Welcome discount for new clients" class="coupon-input">' +
        '</div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label class="checkbox-label">' +
        '<input type="checkbox" id="couponActive" checked>' +
        '<span>Coupon is Active</span>' +
        '</label>' +
        '</div>' +
        '</div>' +
        '<input type="hidden" id="couponEditId" value="">' +
        '<div class="form-actions">' +
        '<button class="btn-cancel" id="btnCancelCoupon">Cancel</button>' +
        '<button class="btn-save-coupon" id="btnSaveCoupon">Save Coupon</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    // Coupons List
    if (coupons.length === 0) {
        html += '<div class="empty-state">' +
            '<div class="empty-icon">🎟️</div>' +
            '<h4>No Coupons Yet</h4>' +
            '<p>Create your first coupon to offer discounts to clients.</p>' +
            '</div>';
    } else {
        html += '<div class="coupons-list">';

        // Active coupons
        var activeCoupons = coupons.filter(function(c) { return c.active !== false; });
        var inactiveCoupons = coupons.filter(function(c) { return c.active === false; });

        if (activeCoupons.length > 0) {
            html += '<div class="coupons-section">' +
                '<h4 class="section-label">Active Coupons (' + activeCoupons.length + ')</h4>';
            activeCoupons.forEach(function(coupon) {
                html += self.renderCouponCard(coupon);
            });
            html += '</div>';
        }

        if (inactiveCoupons.length > 0) {
            html += '<div class="coupons-section inactive-section">' +
                '<h4 class="section-label">Inactive Coupons (' + inactiveCoupons.length + ')</h4>';
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
                hint.textContent = 'Enter percentage (0-100)';
            } else {
                hint.textContent = 'Enter dollar amount';
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
        title.textContent = 'Edit Coupon';
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
        title.textContent = 'Create New Coupon';
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
        alert('Please enter a coupon code');
        return;
    }
    if (isNaN(value) || value <= 0) {
        alert('Please enter a valid discount value');
        return;
    }
    if (type === 'percentage' && value > 100) {
        alert('Percentage discount cannot exceed 100%');
        return;
    }
    if (allowedTiers.length === 0) {
        alert('Please select at least one tier');
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
            alert('✓ Coupon saved successfully!');
            self.hideCouponForm();
            self.loadCoupons();
        })
        .catch(function(error) {
            console.error('Error saving coupon:', error);
            alert('Error saving coupon: ' + error.message);
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

    if (!confirm('Are you sure you want to delete the coupon "' + coupon.code + '"?\n\nThis action cannot be undone.')) {
        return;
    }

    firebase.firestore().collection('coupons').doc(couponId).delete()
        .then(function() {
            alert('✓ Coupon deleted successfully');
            self.loadCoupons();
        })
        .catch(function(error) {
            console.error('Error deleting coupon:', error);
            alert('Error deleting coupon: ' + error.message);
        });
};

// Validate and get coupon by code (used when applying in SOW)
ContractFormHandler.prototype.validateCoupon = function(code, packageType, orderTotal) {
    var coupon = this.coupons ? this.coupons.find(function(c) {
        return c.code === code.toUpperCase() && c.active !== false;
    }) : null;

    if (!coupon) {
        return { valid: false, error: 'Invalid coupon code' };
    }

    // Check expiration
    if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) {
        return { valid: false, error: 'This coupon has expired' };
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return { valid: false, error: 'This coupon has reached its usage limit' };
    }

    // Check minimum purchase
    if (coupon.minPurchase && orderTotal < coupon.minPurchase) {
        return { valid: false, error: 'Minimum purchase of $' + coupon.minPurchase.toFixed(0) + ' required' };
    }

    // Check tier restriction
    if (coupon.allowedTiers && coupon.allowedTiers.length > 0 && packageType) {
        if (coupon.allowedTiers.indexOf(packageType) === -1) {
            return { valid: false, error: 'This coupon is not valid for the ' + packageType + ' tier' };
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
        '<span class="btn-icon">+</span> Create SOW' +
        '</button>' +
        '</div>';
    
    if (sows.length === 0) {
        html += '<div class="empty-state">' +
            '<img src="/images/scarlo-logo.png" alt="Scarlo" class="empty-icon">' +
            '<h4>No SOW Documents Yet</h4>' +
            '<p>Create your first Statement of Work to get started</p>' +
            '<button class="btn-create-sow" onclick="window.contractFormHandler.showSOWCreator()" style="margin-top: 20px;">' +
            '<span class="btn-icon">+</span> Create SOW' +
            '</button>' +
            '</div>';
    } else {
        html += '<div class="sow-list">';
        sows.forEach(function(sow) {
            var createdDate = sow.createdAt ? 
                (sow.createdAt.toDate ? sow.createdAt.toDate().toLocaleDateString() : new Date(sow.createdAt).toLocaleDateString()) 
                : 'N/A';
            
            var packageNames = {
                'essential': 'Essential — Landing Page',
                'starter': 'Tier 1 — Starter',
                'growth': 'Tier 2 — Growth',
                'professional': 'Tier 3 — Professional',
                'enterprise': 'Tier 4 — Enterprise',
                'custom': 'Custom Quote'
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
                    statusText = '⏳ AWAITING DEV';
                } else if (!sow.clientSignature) {
                    statusText = '📤 AWAITING CLIENT';
                }
            } else if (status === 'approved' && sow.clientSignature && sow.devSignature) {
                statusText = '✅ FULLY SIGNED';
            }
            
           // Store SOW data in window for inline handlers to access
            var sowDataId = 'sowData_' + sow.id.replace(/[^a-zA-Z0-9]/g, '_');
            window[sowDataId] = sow;
            
                        // Contract status is now handled inline in the header
           
            // Change request badge with unread indicator
            var changeRequestBadge = '';
            if (sow.hasChangeRequest && sow.changeRequestStatus) {
                var crStyles = {
                    'pending': { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', text: '📝 Change Requested' },
                    'approved': { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', text: '✅ Change Approved' },
                    'rejected': { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', text: '❌ Change Rejected' },
                    'change_order': { bg: 'rgba(99, 102, 241, 0.2)', color: '#6366f1', text: '📋 Change Order' }
                };
                var crStyle = crStyles[sow.changeRequestStatus] || crStyles.pending;

                // Check for unread messages
                var unreadBadge = '';
                if (sow.changeRequestData && sow.changeRequestData.hasUnreadMessages) {
                    unreadBadge = '<span class="unread-badge">New</span>';
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
                    '🔗 Linked to Contract' +
                    '</div>'
                : '') +
                changeRequestBadge +
                '</div>' +
                '</div>' +

                '<div class="sow-item-details">' +
                '<div class="sow-detail-row">' +
                '<span class="detail-label">' + (sow.clientEmail ? '📧 Email:' : '📱 Phone:') + '</span>' +
                '<span class="detail-value">' + (sow.clientEmail || (sow.clientPhone ? formatPhoneNumber(sow.clientPhone) : 'N/A')) + '</span>' +
                '</div>' +
                '<div class="sow-detail-row">' +
                '<span class="detail-label">💰 Total:</span>' +
                '<span class="detail-value">$' + ((sow.payment && sow.payment.total) ? sow.payment.total.toFixed(0) : '0') + '</span>' +
                '</div>' +
                '<div class="sow-detail-row">' +
                '<span class="detail-label">⏱️ Timeline:</span>' +
                '<span class="detail-value">' + (sow.estimatedWeeks || 'TBD') + ' ' + (sow.devDurationUnit || 'weeks') + '</span>' +
                '</div>' +
                '<div class="sow-detail-row">' +
                '<span class="detail-label">📅 Created:</span>' +
                '<span class="detail-value">' + createdDate + '</span>' +
                '</div>' +
                '</div>' +

// Change Request Card (if pending)
(sow.hasChangeRequest && sow.changeRequestStatus === 'pending' ?
    '<div class="change-request-card" style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 0.75rem; margin-bottom: 0.75rem;">' +
    '<div>' +
    '<p style="margin: 0; font-weight: 600; color: #fbbf24; font-size: 0.9rem; display: flex; align-items: center;">📝 Client Requested Changes' +
    (sow.changeRequestData && sow.changeRequestData.hasUnreadMessages ? '<span class="unread-badge">New</span>' : '') +
    '</p>' +
    '<p style="margin: 0.25rem 0 0; font-size: 0.8rem; opacity: 0.8;">Review and respond to this change request</p>' +
    '</div>' +
    '</div>'
: '') +

                '<div class="sow-item-actions">' +
// Sign button (if not fully signed)
((!sow.clientSignature || !sow.devSignature) ?
    '<button class="btn-sign-sow" onclick="window.contractFormHandler.showSOWSigningModal(\'' + sow.id + '\')" title="Sign SOW">' +
    '<span>✍️ Sign</span>' +
    '</button>' : '') +

// View Change Request button (if there's a change request)
(sow.hasChangeRequest && sow.changeRequestId ?
    '<button class="btn-view-request" onclick="window.contractFormHandler.viewChangeRequest(\'' + sow.changeRequestId + '\')" title="View Change Request">' +
    '<span>📝 View Request' + (sow.changeRequestData && sow.changeRequestData.hasUnreadMessages ? ' <span class="unread-badge">New</span>' : '') + '</span>' +
    '</button>' : '') +

'<button class="btn-edit-sow" onclick="window.contractFormHandler.editSOW(window.' + sowDataId + ')" title="Edit SOW">' +
'<span>✏️ Edit</span>' +
'</button>' +
'<button class="btn-download-sow" onclick="window.contractFormHandler.generateSOWPDF(window.' + sowDataId + ')" title="Download PDF">' +
'<span>📄 PDF</span>' +
'</button>' +
'<button class="btn-delete-sow" onclick="window.contractFormHandler.deleteSOW(\'' + sow.id + '\')" title="Delete SOW">' +
'<span>🗑️</span>' +
'</button>' +
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
    if (!confirm('Are you sure you want to delete this SOW? This action cannot be undone.')) {
        return;
    }

    var self = this;

    firebase.firestore().collection('sow_documents')
        .doc(sowId)
        .delete()
        .then(function() {
            console.log('SOW deleted successfully');
            alert('✓ SOW deleted successfully');
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error deleting SOW:', error);
            alert('Error deleting SOW: ' + error.message);
        });
};

// ============= CHANGE REQUEST FUNCTIONS =============

ContractFormHandler.prototype.showChangeRequestModal = function(sowData) {
    var self = this;

    // Store SOW data for the request
    this.currentChangeRequestSOW = sowData;

    // SOW sections that can be changed
    var sections = [
        { id: 'package', label: 'Package Tier', desc: 'Change to a different package level' },
        { id: 'features', label: 'Features & Deliverables', desc: 'Add, remove, or modify features' },
        { id: 'timeline', label: 'Timeline', desc: 'Adjust project duration or milestones' },
        { id: 'payment', label: 'Payment Structure', desc: 'Modify payment schedule or amounts' },
        { id: 'maintenance', label: 'Maintenance Plan', desc: 'Change ongoing maintenance options' },
        { id: 'other', label: 'Other', desc: 'Any other modifications not listed above' }
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

    var modalHtml = '<div id="changeRequestModal" class="modal-overlay" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(10px); z-index: 10000; justify-content: center; align-items: center;">' +
        '<div class="modal-content" style="max-width: 800px; padding: 2rem;">' +
        '<div class="modal-header" style="position: relative; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">' +
        '<h2 style="margin: 0; font-size: 1.5rem; color: #fff;">📝 Request SOW Change</h2>' +
        '<button type="button" class="modal-close" onclick="window.contractFormHandler.closeChangeRequestModal()" style="position: absolute; top: 0; right: 0; background: rgba(255, 255, 255, 0.1); border: none; width: 36px; height: 36px; border-radius: 50%; color: #fff; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">×</button>' +
        '</div>' +
        '<div class="modal-body" style="color: #fff;">' +

        '<div class="change-request-info" style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">' +
        '<p style="margin: 0; font-size: 0.9rem;"><strong>📋 SOW:</strong> ' + (sowData.packageType || 'N/A') + ' Package</p>' +
        '<p style="margin: 0.5rem 0 0; font-size: 0.9rem;"><strong>💰 Current Total:</strong> $' + (sowData.payment ? sowData.payment.total.toFixed(0) : '0') + '</p>' +
        '</div>' +

        '<div class="form-group">' +
        '<label class="form-label" style="display: block; margin-bottom: 0.75rem; font-weight: 600;">Which sections do you want to modify?</label>' +
        '<div class="change-sections-grid" style="display: grid; gap: 0.75rem;">' +
        sectionsHtml +
        '</div>' +
        '</div>' +

        '<div class="form-group" style="margin-top: 1.5rem;">' +
        '<label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Describe the changes you need:</label>' +
        '<textarea id="changeRequestDescription" class="form-input" rows="5" placeholder="Please describe in detail what changes you would like to make. Be as specific as possible to help the developer understand your request." style="width: 100%; resize: vertical; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 0.75rem; color: #fff; font-size: 0.95rem;"></textarea>' +
        '</div>' +

        '<div class="form-group" style="margin-top: 1rem;">' +
        '<label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Priority Level:</label>' +
        '<select id="changeRequestPriority" class="form-input" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 0.75rem; color: #fff; font-size: 0.95rem;">' +
        '<option value="normal" style="background: #1a1a1a; color: #fff;">Normal - Can wait for next review cycle</option>' +
        '<option value="high" style="background: #1a1a1a; color: #fff;">High - Needed before project continues</option>' +
        '<option value="urgent" style="background: #1a1a1a; color: #fff;">Urgent - Critical blocker</option>' +
        '</select>' +
        '</div>' +

        '</div>' +
        '<div class="modal-footer" style="display: flex; gap: 1rem; justify-content: flex-end; padding-top: 1.5rem; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">' +
        '<button type="button" class="btn btn-secondary" onclick="window.contractFormHandler.closeChangeRequestModal()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600;">Cancel</button>' +
        '<button type="button" class="btn btn-primary" onclick="window.contractFormHandler.submitChangeRequest()" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border: none; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600;">Submit Request</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    // Add modal styles if not already present
    if (!document.getElementById('changeRequestStyles')) {
        var styleEl = document.createElement('style');
        styleEl.id = 'changeRequestStyles';
        styleEl.textContent = '.change-section-option { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer; transition: all 0.2s; }' +
            '.change-section-option:hover { background: rgba(255,255,255,0.08); border-color: rgba(99, 102, 241, 0.5); }' +
            '.change-section-option input[type="checkbox"] { margin-top: 3px; }' +
            '.change-section-option input[type="checkbox"]:checked + .section-option-content { color: #6366f1; }' +
            '.section-option-content { display: flex; flex-direction: column; }' +
            '.section-option-label { font-weight: 600; font-size: 0.95rem; }' +
            '.section-option-desc { font-size: 0.8rem; opacity: 0.7; margin-top: 2px; }' +
            '.change-request-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }' +
            '.change-request-badge.pending { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }' +
            '.change-request-badge.approved { background: rgba(16, 185, 129, 0.2); color: #10b981; }' +
            '.change-request-badge.rejected { background: rgba(239, 68, 68, 0.2); color: #ef4444; }' +
            '.change-request-badge.change-order { background: rgba(99, 102, 241, 0.2); color: #6366f1; }' +
            '.change-request-badge.completed { background: rgba(16, 185, 129, 0.2); color: #10b981; }' +
            '.change-request-card { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 1rem; margin-top: 1rem; }' +
            '.change-request-card.approved { background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); }' +
            '.change-request-card.rejected { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }' +
            '.btn-change-request { cursor: pointer !important; pointer-events: auto !important; }' +
            '.btn-change-request:hover { background: linear-gradient(135deg, rgba(251, 191, 36, 0.4) 0%, rgba(245, 158, 11, 0.4) 100%) !important; border-color: rgba(251, 191, 36, 0.6) !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2); }';
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
        alert('Error: No SOW data found');
        return;
    }

    // Get selected sections
    var selectedSections = [];
    document.querySelectorAll('input[name="changeSections"]:checked').forEach(function(checkbox) {
        selectedSections.push(checkbox.value);
    });

    if (selectedSections.length === 0) {
        alert('Please select at least one section to modify');
        return;
    }

    var description = document.getElementById('changeRequestDescription').value.trim();
    if (!description) {
        alert('Please describe the changes you need');
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
                btn.innerHTML = '💬 View Request';
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
            alert('✓ Change request submitted successfully!\n\nThe developer will review your request and respond shortly.');
        })
        .catch(function(error) {
            console.error('Error submitting change request:', error);
            alert('Error submitting change request: ' + error.message);
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
                alert('Change request not found');
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
            alert('Error loading change request: ' + error.message);
        });
};

ContractFormHandler.prototype.showChangeRequestDetailModal = function(request) {
    var self = this;

    // Store request for message sending
    this.currentChangeRequest = request;

    var sectionLabels = {
        'package': '📦 Package Tier',
        'features': '✨ Features & Deliverables',
        'timeline': '⏱️ Timeline',
        'payment': '💰 Payment Structure',
        'maintenance': '🔧 Maintenance Plan',
        'other': '📝 Other'
    };

    var priorityStyles = {
        'normal': { bg: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', label: 'Normal' },
        'high': { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', label: 'High Priority' },
        'urgent': { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', label: 'Urgent' }
    };

    var statusStyles = {
        'pending': { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', label: '⏳ Pending Review' },
        'approved': { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', label: '✅ Approved' },
        'rejected': { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', label: '❌ Rejected' },
        'change_order': { bg: 'rgba(99, 102, 241, 0.2)', color: '#6366f1', label: '📋 Change Order Created' },
        'completed': { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', label: '✅ Completed' }
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
        sendBtn.textContent = 'Sending...';
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
                    '<div class="message-time">Just now</div>' +
                    '</div>';
                thread.insertAdjacentHTML('beforeend', msgHtml);
                thread.scrollTop = thread.scrollHeight;
            }

            // Re-enable send button
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
            }
        })
        .catch(function(error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
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

    if (!confirm('Are you sure you want to approve this change request?')) {
        return;
    }

    // Add a system message to the conversation (use ISO string for arrayUnion)
    var approvalMessage = {
        sender: 'developer',
        senderName: 'Carlos (Developer)',
        text: '✅ Change request has been APPROVED. I will now proceed with the requested changes.',
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
            alert('Change request approved! You can now edit the SOW with the requested changes.');
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error approving change request:', error);
            alert('Error: ' + error.message);
        });
};

ContractFormHandler.prototype.rejectChangeRequest = function(changeRequestId) {
    var self = this;

    if (!confirm('Are you sure you want to reject this change request? Consider sending a message to explain why before rejecting.')) {
        return;
    }

    // Add a system message to the conversation (use ISO string for arrayUnion)
    var rejectionMessage = {
        sender: 'developer',
        senderName: 'Carlos (Developer)',
        text: '❌ Change request has been REJECTED. Please see my previous messages for details.',
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
            alert('Change request rejected. The client has been notified.');
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error rejecting change request:', error);
            alert('Error: ' + error.message);
        });
};

ContractFormHandler.prototype.createChangeOrderFromRequest = function(changeRequestId) {
    var self = this;

    firebase.firestore().collection('change_requests')
        .doc(changeRequestId)
        .get()
        .then(function(doc) {
            if (!doc.exists) {
                alert('Change request not found');
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
                        alert('SOW not found');
                    }
                });
        })
        .catch(function(error) {
            console.error('Error creating change order:', error);
            alert('Error: ' + error.message);
        });
};

ContractFormHandler.prototype.showChangeOrderModal = function(changeRequest) {
    var self = this;

    var sectionLabels = {
        'package': 'Package Tier',
        'features': 'Features & Deliverables',
        'timeline': 'Timeline',
        'payment': 'Payment Structure',
        'maintenance': 'Maintenance Plan',
        'other': 'Other'
    };

    var sectionsText = changeRequest.sections.map(function(s) { return sectionLabels[s] || s; }).join(', ');

    var modalHtml = '<div id="changeOrderModal" class="modal-overlay-fixed">' +
        '<div class="modal-content" style="max-width: 600px;">' +
        '<div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">' +
        '<h2 style="margin: 0; font-size: 1.25rem;">📋 Create Change Order</h2>' +
        '<button style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.1)\'" onclick="document.getElementById(\'changeOrderModal\').remove()">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="padding: 1.5rem;">' +

        '<div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">' +
        '<p style="margin: 0; font-size: 0.9rem;"><strong>Client:</strong> ' + changeRequest.clientName + '</p>' +
        '<p style="margin: 0.5rem 0 0; font-size: 0.9rem;"><strong>Sections:</strong> ' + sectionsText + '</p>' +
        '<p style="margin: 0.5rem 0 0; font-size: 0.9rem;"><strong>Request:</strong> ' + changeRequest.description.substring(0, 100) + (changeRequest.description.length > 100 ? '...' : '') + '</p>' +
        '</div>' +

        '<div class="form-group">' +
        '<label class="form-label">Change Order Description:</label>' +
        '<textarea id="changeOrderDescription" class="form-input" rows="4" placeholder="Describe the approved changes in detail..." style="width: 100%; resize: vertical;">' + changeRequest.description + '</textarea>' +
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
        '<button class="btn btn-secondary" onclick="document.getElementById(\'changeOrderModal\').remove()">Cancel</button>' +
        '<button class="btn btn-primary" onclick="window.contractFormHandler.saveChangeOrder(\'' + changeRequest.id + '\', \'' + changeRequest.sowId + '\')">Create Change Order</button>' +
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
        alert('Please provide a description for the change order');
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
            alert('✓ Change Order created successfully!\n\nThe client will be notified to review and approve the changes.');
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error creating change order:', error);
            alert('Error: ' + error.message);
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
            alert('Error loading SOW: ' + error.message);
        });
};

    // ============= SOW CREATOR FUNCTIONS =============

ContractFormHandler.prototype.showSOWCreator = function() {
    var container = $('#sowCreatorContainer');
    if (!container) return;
    
    var html = '<div class="sow-creator-form">' +
        '<div class="sow-form-header">' +
        '<h4 style="display: flex; align-items: center; gap: 0.5rem;"><img src="/images/morph-logo14.png" alt="Logo" style="height: 2rem; width: auto;"> Create Statement of Work</h4>' +
        '<button class="btn-close-sow">×</button>' +
        '</div>' +
        
        // Client Information
        '<div class="sow-form-section client-info-section">' +
        '<h5><span class="section-icon">👤</span> Client Information</h5>' +

        // Searchable User Dropdown (users without SOW)
        '<div class="sow-user-search-container">' +
        '<label class="sow-search-label">Quick Select: Existing User (without SOW)</label>' +
        '<div class="sow-search-wrapper">' +
        '<input type="text" id="sowUserSearch" placeholder="Search by name, email, or phone..." class="sow-input sow-search-input" autocomplete="off" />' +
        '<div class="sow-search-icon">🔍</div>' +
        '<div id="sowUserDropdown" class="sow-user-dropdown" style="display: none;"></div>' +
        '</div>' +
        '<div class="sow-search-actions">' +
        '<p class="sow-search-hint">Or enter client details manually below</p>' +
        '<button type="button" id="btnAddUser" class="btn-add-user">+ Add User</button>' +
        '</div>' +
        // Add User inline form (hidden by default)
        '<div id="addUserForm" class="add-user-form" style="display: none;">' +
        '<div class="add-user-form-inner">' +
        '<input type="text" id="addUserName" placeholder="Display Name (optional)" class="sow-input" />' +
        '<div class="add-user-auth-section">' +
        '<div class="add-user-auth-row">' +
        '<input type="email" id="addUserEmail" placeholder="Email" class="sow-input" oninput="window.toggleAuthFields()" />' +
        '<input type="password" id="addUserPassword" placeholder="Password (min 6 chars)" class="sow-input" style="display: none;" />' +
        '</div>' +
        '<div class="add-user-auth-divider"><span>OR</span></div>' +
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
        '<input type="tel" id="addUserPhone" placeholder="Phone Number" class="sow-input" oninput="window.toggleAuthFields()" />' +
        '</div>' +
        '<input type="text" id="addUserCode" placeholder="Verification Code (4-6 digits)" class="sow-input" style="display: none;" maxlength="6" />' +
        '</div>' +
        '</div>' +
        '<div class="add-user-buttons">' +
        '<button type="button" id="btnSaveUser" class="btn-save-user">Save User</button>' +
        '<button type="button" id="btnCancelAddUser" class="btn-cancel-add-user">Cancel</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +

        // Combined toggles row (Email/Phone + Individual/Business)
        '<div class="toggles-row">' +
        '<div class="client-id-toggle">' +
        '<span class="toggle-label" id="emailToggleLabel">Email</span>' +
        '<label class="toggle-switch">' +
        '<input type="checkbox" id="clientIdTypeToggle" />' +
        '<span class="toggle-slider"></span>' +
        '</label>' +
        '<span class="toggle-label" id="phoneToggleLabel">Phone</span>' +
        '</div>' +
        '<div class="entity-type-toggle">' +
        '<span class="toggle-label active" id="sowIndividualLabel">Individual</span>' +
        '<label class="toggle-switch">' +
        '<input type="checkbox" id="sowEntityTypeToggle" />' +
        '<span class="toggle-slider"></span>' +
        '</label>' +
        '<span class="toggle-label" id="sowBusinessLabel">Business Entity</span>' +
        '</div>' +
        '</div>' +

        // Individual client fields (shown by default)
        '<div id="sowIndividualFields">' +
        '<div class="sow-input-group client-inputs-row">' +
        '<input type="text" id="sowClientName" placeholder="Client Name *" class="sow-input" required />' +
        '<div id="sowClientEmailWrapper" class="sow-input-wrapper-single">' +
        '<input type="email" id="sowClientEmail" placeholder="Client Email *" class="sow-input" />' +
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
        '<input type="tel" id="sowClientPhone" placeholder="Client Phone *" class="sow-input" />' +
        '</div>' +
        '</div>' +
        '</div>' +

        // Business entity fields (hidden by default)
        '<div id="sowBusinessFields" style="display: none;">' +
        '<div class="sow-input-group">' +
        '<input type="text" id="sowBusinessName" placeholder="Business Legal Name *" class="sow-input" />' +
        '<select id="sowEntityType" class="sow-select" style="flex: 1;">' +
        '<option value="">Entity Type *</option>' +
        '<option value="LLC">LLC</option>' +
        '<option value="Corporation">Corporation</option>' +
        '<option value="Partnership">Partnership</option>' +
        '<option value="Sole Proprietorship">Sole Proprietorship</option>' +
        '</select>' +
        '</div>' +
        '<div class="sow-input-group">' +
        '<input type="text" id="sowStateOfFormation" placeholder="State of Formation (optional)" class="sow-input" />' +
        '<div id="sowBusinessEmailWrapper" class="sow-input-wrapper-single">' +
        '<input type="email" id="sowBusinessEmail" placeholder="Business Email *" class="sow-input" />' +
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
        '<input type="tel" id="sowBusinessPhone" placeholder="Business Phone *" class="sow-input" />' +
        '</div>' +
        '</div>' +
        '<div class="sow-input-group">' +
        '<input type="text" id="sowRepName" placeholder="Representative Name *" class="sow-input" />' +
        '<input type="text" id="sowRepTitle" placeholder="Title (e.g., CEO, Managing Member) *" class="sow-input" />' +
        '</div>' +
        '</div>' +
        '</div>' +
        
        // Package Selection
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">📦</span> Package Tier</h5>' +
        '<select id="sowPackage" class="sow-select" onchange="setTimeout(syncDeferredWithTotal, 50)">' +
        '<option value="">Select a package tier...</option>' +
        '<option value="essential">Essential — Landing Page ($1,000 - $3,000)</option>' +
        '<option value="starter">Tier 1 — Starter ($3,000 - $6,000)</option>' +
        '<option value="growth">Tier 2 — Growth ($6,000 - $12,000)</option>' +
        '<option value="professional">Tier 3 — Professional ($12,000 - $25,000)</option>' +
        '<option value="enterprise">Tier 4 — Enterprise ($25,000 - $50,000)</option>' +
        '<option value="custom">Custom Quote (Manual Entry)</option>' +
        '</select>' +
        
        // Custom pricing (only shown if custom selected)
        '<div id="customPricingSection" style="display: none; margin-top: 15px;">' +
        '<input type="number" id="sowCustomPrice" placeholder="Enter custom total price" class="sow-input" step="0.01" min="0" oninput="setTimeout(syncDeferredWithTotal, 50)" />' +
        '</div>' +
        '</div>' +
        
        // Project Timeline
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">⏱️</span> Project Timeline</h5>' +
        '<label class="sow-checkbox retroactive-toggle" style="margin-bottom: 10px; padding: 8px 12px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.3);">' +
        '<input type="checkbox" id="sowRetroactive" onchange="toggleRetroactiveFields()" />' +
        '<span style="color: #f59e0b; font-weight: 500;">Retroactive Project</span>' +
        '<span style="font-size: 0.8em; color: #888; margin-left: 8px;">(project already in development)</span>' +
        '</label>' +
        '<div class="sow-input-group">' +
        '<input type="number" id="sowWeeks" placeholder="Estimated Weeks *" class="sow-input" min="1" max="52" required />' +
        '<input type="date" id="sowStartDate" class="sow-input" title="Target completion date" />' +
        '</div>' +
        '<div id="retroactiveDurationFields" style="display: none; margin-top: 10px; padding: 10px; background: rgba(245, 158, 11, 0.05); border-radius: 6px; border: 1px dashed rgba(245, 158, 11, 0.3);">' +
        '<label style="font-size: 0.85em; color: #f59e0b; margin-bottom: 5px; display: block;">Development Duration</label>' +
        '<div class="sow-input-group">' +
        '<input type="number" id="sowDevDuration" placeholder="Duration *" class="sow-input" min="1" max="52" style="flex: 1;" />' +
        '<select id="sowDevDurationUnit" class="sow-input" style="flex: 1;">' +
        '<option value="weeks">Weeks</option>' +
        '<option value="months">Months</option>' +
        '</select>' +
        '</div>' +
        '<label style="font-size: 0.85em; color: #f59e0b; margin-bottom: 5px; margin-top: 10px; display: block;">Estimated Final Revision</label>' +
        '<input type="date" id="sowRetroactiveEndDate" class="sow-input" title="Estimated final revision date" />' +
        '</div>' +
        '</div>' +
        
        // Features & Deliverables
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">✨</span> Features & Deliverables</h5>' +
        '<div class="sow-checkboxes">' +

        // Standard Features
        '<div class="feature-group">' +
        '<p class="feature-group-title">Standard Features</p>' +
        '<label class="sow-checkbox"><input type="checkbox" value="responsive_design" /> Cross-Device Optimization (Mobile, Tablet, Desktop)</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="custom_ui" /> Brand-Matched Design System</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="animations" /> Scroll & Micro-Interactions</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="seo_optimization" /> Technical SEO Setup (Meta, Sitemap, Schema)</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="analytics" /> GA4 + Custom Event Tracking</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="contact_forms" /> Multi-Step Contact Forms</label>' +
        '</div>' +

        // Premium Add-ons
        '<div class="feature-group">' +
        '<p class="feature-group-title">Premium Add-ons</p>' +
        '<label class="sow-checkbox"><input type="checkbox" value="firebase_auth" /> User Authentication System <span class="third-party-note">+ Firebase costs</span></label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="firebase_db" /> Database & Data Management <span class="third-party-note">+ Firebase costs</span></label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="user_profiles" /> Client Portal / User Dashboard</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="file_storage" /> Media Upload System <span class="third-party-note">+ Firebase costs</span></label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="api_integration" /> Third-Party Integrations (CRM, Zapier, etc.)</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="email_integration" /> Email Notifications (SendGrid) <span class="third-party-note">+ SendGrid costs</span></label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="music_media" /> Audio/Video Player Integration</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="booking_basic" /> Scheduling & Booking System</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="newsletter" /> Newsletter Integration</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="social_feed" /> Social Media Feed Integration</label>' +
        '</div>' +

        // Enterprise Features
        '<div class="feature-group">' +
        '<p class="feature-group-title">Enterprise Features</p>' +
        '<label class="sow-checkbox"><input type="checkbox" value="user_roles" /> Role-Based Access Control</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="cms_integration" /> Content Management System</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="booking_system" /> Advanced Booking + Availability</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="blog" /> Blog/News Module</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="gallery" /> Media Gallery System</label>' +
        '<label class="sow-checkbox"><input type="checkbox" value="notifications" /> In-App Notifications</label>' +
        '</div>' +

        // E-Commerce Options
        '<div class="feature-group">' +
        '<p class="feature-group-title">E-Commerce Options</p>' +
        '<div class="ecommerce-radio-group">' +
        '<label class="sow-radio"><input type="radio" name="ecommerce_option" value="none" checked /> No E-Commerce</label>' +
        '<label class="sow-radio"><input type="radio" name="ecommerce_option" value="basic_cart" /> Basic E-Commerce Setup (+$3,000 - $8,000) <span class="third-party-note">+ Stripe fees</span></label>' +
        '<label class="sow-radio"><input type="radio" name="ecommerce_option" value="full_store" /> Full E-Commerce Store (+$8,000 - $20,000) <span class="third-party-note">+ Stripe fees</span></label>' +
        '</div>' +
        '</div>' +

        '</div>' +
        '</div>' +
        
        // Additional Requirements
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">📝</span> Additional Requirements</h5>' +
        '<textarea id="sowNotes" placeholder="Any special requirements, integrations, or custom features..." class="sow-textarea" rows="4"></textarea>' +
        '</div>' +
        
        // Ongoing Maintenance
        '<div class="sow-form-section">' +
        '<h5><span class="section-icon">🔧</span> Ongoing Maintenance Plan</h5>' +
        '<select id="sowMaintenance" class="sow-select" required>' +
        '<option value="">Select a maintenance plan...</option>' +
        '<option value="none">No Maintenance — $0/month</option>' +
        '<option value="basic" selected>Basic Care — $167/month (2-3 hrs/mo)</option>' +
        '<option value="professional">Professional Care — $335/month (4-6 hrs/mo)</option>' +
        '<option value="premium">Premium Care — $670/month (8-12 hrs/mo)</option>' +
        '</select>' +
        '</div>' +

        // Deferred Payment Section
        '<div class="sow-form-section" id="deferredPaymentSection">' +
        '<h5><span class="section-icon">🔄</span> Deferred Payment Option</h5>' +

        '<label class="sow-checkbox deferred-toggle" style="margin-bottom: 10px; padding: 8px 12px; background: rgba(99, 102, 241, 0.1); border-radius: 6px; border: 1px solid rgba(99, 102, 241, 0.3);">' +
        '<input type="checkbox" id="sowDeferredPayment" onchange="toggleDeferredPaymentFields()" />' +
        '<span style="color: #6366f1; font-weight: 500;">Enable Deferred Payment</span>' +
        '<span style="font-size: 0.8em; color: #888; margin-left: 8px;">(client pays later with terms)</span>' +
        '</label>' +

        '<div id="deferredPaymentFields" style="display: none; margin-top: 10px; padding: 15px; background: rgba(99, 102, 241, 0.05); border-radius: 8px; border: 1px dashed rgba(99, 102, 241, 0.3);">' +

        '<div class="deferred-split-type">' +
        '<label style="font-size: 0.9em; color: #94a3b8; margin-bottom: 8px; display: block;">Payment Type</label>' +
        '<div class="deferred-radio-group" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">' +
        '<label class="sow-radio deferred-type-card" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;">' +
        '<input type="radio" name="deferred_split" value="lump_sum" checked onchange="toggleDeferredSplitType()" style="display: none;" />' +
        '<span style="font-size: 1.5em;">💵</span>' +
        '<span style="font-weight: 500; font-size: 0.85em;">Lump Sum</span>' +
        '<span style="font-size: 0.7em; color: #94a3b8; text-align: center;">Single payment on one date</span>' +
        '</label>' +
        '<label class="sow-radio deferred-type-card" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;">' +
        '<input type="radio" name="deferred_split" value="recurring" onchange="toggleDeferredSplitType()" style="display: none;" />' +
        '<span style="font-size: 1.5em;">📅</span>' +
        '<span style="font-weight: 500; font-size: 0.85em;">Payment Plan</span>' +
        '<span style="font-size: 0.7em; color: #94a3b8; text-align: center;">Recurring schedule</span>' +
        '</label>' +
        '<label class="sow-radio deferred-type-card" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;">' +
        '<input type="radio" name="deferred_split" value="custom" onchange="toggleDeferredSplitType()" style="display: none;" />' +
        '<span style="font-size: 1.5em;">✏️</span>' +
        '<span style="font-weight: 500; font-size: 0.85em;">Custom</span>' +
        '<span style="font-size: 0.7em; color: #94a3b8; text-align: center;">Manual dates & amounts</span>' +
        '</label>' +
        '</div>' +
        '</div>' +

        '<div id="lumpSumFields" style="margin-top: 15px;">' +
        '<div class="sow-input-group" style="display: flex; gap: 10px;">' +
        '<div style="flex: 1;">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">Amount to Defer</label>' +
        '<input type="number" id="sowDeferredAmount" placeholder="Amount $" class="sow-input" min="0" step="0.01" onchange="calculateLateFee()" oninput="calculateLateFee()" />' +
        '</div>' +
        '<div style="flex: 1;">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">Due Date</label>' +
        '<input type="date" id="sowDeferredDueDate" class="sow-input" />' +
        '</div>' +
        '</div>' +
        '</div>' +

        '<div id="recurringFields" style="display: none; margin-top: 15px;">' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">' +
        '<div>' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">Total Amount to Defer</label>' +
        '<input type="number" id="sowRecurringTotalAmount" placeholder="Total $" class="sow-input" min="0" step="0.01" onchange="updateRecurringSchedule()" oninput="updateRecurringSchedule()" />' +
        '</div>' +
        '<div>' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">First Payment Date</label>' +
        '<input type="date" id="sowRecurringStartDate" class="sow-input" onchange="updateRecurringSchedule()" />' +
        '</div>' +
        '</div>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">' +
        '<div>' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">Payment Frequency</label>' +
        '<select id="sowRecurringFrequency" class="sow-select" onchange="updateRecurringSchedule()" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff;">' +
        '<option value="weekly">Weekly</option>' +
        '<option value="biweekly" selected>Bi-Weekly (Every 2 Weeks)</option>' +
        '<option value="semimonthly">Semi-Monthly (1st & 15th)</option>' +
        '<option value="monthly">Monthly</option>' +
        '<option value="bimonthly">Bi-Monthly (Every 2 Months)</option>' +
        '</select>' +
        '</div>' +
        '<div>' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">Calculate By</label>' +
        '<select id="sowRecurringCalcMode" class="sow-select" onchange="toggleRecurringCalcMode(); updateRecurringSchedule();" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff;">' +
        '<option value="amount">Fixed Payment Amount</option>' +
        '<option value="count">Number of Payments</option>' +
        '</select>' +
        '</div>' +
        '</div>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">' +
        '<div id="recurringAmountField">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">Amount Per Payment</label>' +
        '<input type="number" id="sowRecurringPaymentAmount" placeholder="e.g. 300" class="sow-input" min="1" step="0.01" onchange="updateRecurringSchedule()" oninput="updateRecurringSchedule()" />' +
        '</div>' +
        '<div id="recurringCountField" style="display: none;">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">Number of Payments</label>' +
        '<input type="number" id="sowRecurringPaymentCount" placeholder="e.g. 6" class="sow-input" min="2" max="52" onchange="updateRecurringSchedule()" oninput="updateRecurringSchedule()" />' +
        '</div>' +
        '<div id="recurringCalcResult" style="display: flex; align-items: flex-end;">' +
        '<div style="padding: 10px 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; width: 100%;">' +
        '<span style="font-size: 0.75em; color: #10b981; display: block;">Calculated</span>' +
        '<span id="recurringCalcDisplay" style="font-size: 1.1em; font-weight: 600; color: #10b981;">--</span>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div id="recurringSchedulePreview" style="display: none; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 12px; max-height: 200px; overflow-y: auto;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">' +
        '<span style="font-size: 0.85em; font-weight: 500; color: #6366f1;">Payment Schedule Preview</span>' +
        '<span id="recurringScheduleSummary" style="font-size: 0.75em; color: #94a3b8;"></span>' +
        '</div>' +
        '<div id="recurringScheduleList" style="display: grid; gap: 6px;"></div>' +
        '</div>' +
        '</div>' +

        '<div id="customSplitFields" style="display: none; margin-top: 15px;">' +
        '<label style="font-size: 0.85em; color: #6366f1; margin-bottom: 5px; display: block;">Custom Payment Schedule</label>' +
        '<div id="customPaymentsList" class="custom-payments-list"></div>' +
        '<button type="button" class="btn-add-payment" onclick="addCustomPaymentRow()" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 8px 16px; background: rgba(99, 102, 241, 0.15); border: 1px dashed rgba(99, 102, 241, 0.4); border-radius: 6px; color: #818cf8; cursor: pointer; font-size: 0.9em;">' +
        '<span>+ Add Payment</span>' +
        '</button>' +
        '</div>' +

        '<div class="late-fee-section" style="margin-top: 15px; padding: 12px; background: rgba(245, 158, 11, 0.08); border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.2);">' +
        '<div style="display: flex; justify-content: space-between; align-items: center;">' +
        '<div>' +
        '<span style="color: #f59e0b; font-weight: 500;">Late Fee (10%):</span>' +
        '<span id="lateFeeDisplay" style="color: #fff; margin-left: 8px;">$0</span>' +
        '<span style="font-size: 0.75em; color: #94a3b8; margin-left: 6px;">(if payment is late)</span>' +
        '</div>' +
        '<label class="sow-checkbox" style="margin: 0; display: flex; align-items: center; gap: 6px;">' +
        '<input type="checkbox" id="sowWaiveLateFee" onchange="calculateLateFee()" />' +
        '<span style="font-size: 0.85em; color: #f59e0b;">Waive Late Fee</span>' +
        '</label>' +
        '</div>' +
        '<div style="margin-top: 8px;">' +
        '<span style="color: #94a3b8; font-size: 0.85em;">Total Deferred Amount:</span>' +
        '<span id="totalDeferredDisplay" style="color: #10b981; font-weight: 600; margin-left: 8px;">$0</span>' +
        '</div>' +
        '</div>' +

        '<div class="deferred-options" style="margin-top: 15px;">' +
        '<label class="sow-checkbox" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">' +
        '<input type="checkbox" id="sowAllowPartialPayments" checked />' +
        '<span>Allow partial payments toward balance during deferral</span>' +
        '</label>' +
        '<label class="sow-checkbox" style="display: flex; align-items: center; gap: 8px;">' +
        '<input type="checkbox" id="sowMaintenanceDuringDeferral" checked />' +
        '<span>Client pays monthly maintenance during deferral period</span>' +
        '</label>' +
        '</div>' +

        '</div>' +
        '</div>' +

        // Coupon / Discount Code
        '<div class="sow-form-section coupon-section">' +
        '<h5><span class="section-icon">🎟️</span> Discount Code</h5>' +
        '<div class="coupon-input-group">' +
        '<select id="sowCouponSelect" class="sow-select coupon-select" onchange="setTimeout(syncDeferredWithTotal, 50)">' +
        '<option value="">No discount applied</option>' +
        '</select>' +
        '<div id="couponValidationMessage" class="coupon-validation-message"></div>' +
        '</div>' +
        '</div>' +

        // Pricing Summary
        '<div class="sow-form-section pricing-summary">' +
        '<h5><span class="section-icon">💰</span> Pricing Summary</h5>' +

        // Itemized breakdown
        '<div class="pricing-itemized-container">' +
        '<div id="pricingItemizedList" class="pricing-itemized-list">' +
        '</div>' +
        '</div>' +

        '<div class="pricing-breakdown">' +
        '<div class="pricing-divider"></div>' +
        '<div class="pricing-row total-row">' +
        '<span><strong>Project Total:</strong></span>' +
        '<span id="sowTotalPrice" class="price-value total-value">$0.00</span>' +
        '</div>' +
        '<div class="pricing-row deposit-row">' +
        '<span>Deposit (50%):</span>' +
        '<span id="sowDepositCalc" class="price-value">$0.00</span>' +
        '</div>' +
        '<div class="pricing-row">' +
        '<span>Milestone Payment (25%):</span>' +
        '<span id="sowMilestone1Calc" class="price-value">$0.00</span>' +
        '</div>' +
        '<div class="pricing-row">' +
        '<span>Final Payment (25%):</span>' +
        '<span id="sowFinalCalc" class="price-value">$0.00</span>' +
        '</div>' +
        '<div class="pricing-divider"></div>' +
        '<div class="pricing-row maintenance-row" id="maintenanceRow">' +
        '<span>Monthly Maintenance:</span>' +
        '<span id="sowMaintenanceCalc" class="price-value">$167/month</span>' +
        '</div>' +
        '</div>' +
        '</div>' +

        // Action Buttons
        '<div class="sow-form-actions">' +
        '<button class="btn-cancel-sow btn-secondary">Cancel</button>' +
        '<button class="btn-save-sow btn-primary"><span class="btn-icon">💾</span> Save SOW</button>' +
        '<button class="btn-generate-sow-pdf btn-primary"><span class="btn-icon">📄</span> Generate PDF</button>' +
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
        'none': { price: 0, label: 'No E-Commerce' },
        'basic_cart': { price: 5500, label: 'Basic E-Commerce Setup', thirdParty: true, note: 'Stripe fees' },  // $3,000-$8,000
        'full_store': { price: 14000, label: 'Full E-Commerce Store', thirdParty: true, note: 'Stripe fees' }    // $8,000-$20,000
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
            userSearchInput.placeholder = 'Loading users...';
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
                userSearchInput.placeholder = 'Search by name, email, or phone...';
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
                    userSearchInput.placeholder = 'Search unavailable - enter manually';
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
            alert('Please enter either an email or phone number.');
            return Promise.reject('No email or phone provided');
        }

        if (hasEmail && (!password || password.length < 6)) {
            alert('Password must be at least 6 characters for email authentication.');
            return Promise.reject('Password too short');
        }

        if (hasPhone && (!verificationCode || !/^\d{4,6}$/.test(verificationCode))) {
            alert('Verification code must be 4-6 digits for phone authentication.');
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
            userDropdown.innerHTML = '<div class="sow-dropdown-empty">No users without SOW found</div>';
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
                   (hasEmail ? '<span class="badge-email">Email</span>' : '') +
                   (hasPhone ? '<span class="badge-phone">Phone</span>' : '') +
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
            btnSaveUser.textContent = 'Saving...';

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
                    btnSaveUser.textContent = 'Save User';

                    // The realtime listener will automatically update the dropdown
                    alert('User added successfully! They can now sign in and will appear in the dropdown.');
                })
                .catch(function(error) {
                    // Reset button
                    btnSaveUser.disabled = false;
                    btnSaveUser.textContent = 'Save User';

                    if (error !== 'No email or phone provided' && error !== 'Password too short' && error !== 'Invalid verification code') {
                        alert('Error adding user: ' + (error.message || error));
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

    // Feature display labels for nice formatting
    var featureLabels = {
        'responsive_design': 'Responsive Design',
        'custom_ui': 'Custom UI/UX Design',
        'animations': 'Animations & Micro-interactions',
        'seo_optimization': 'SEO Optimization',
        'analytics': 'Analytics Integration (GA4)',
        'contact_forms': 'Contact Forms',
        'firebase_auth': 'User Authentication',
        'firebase_db': 'Database Integration',
        'user_profiles': 'User Profiles & Dashboard',
        'file_storage': 'File/Media Storage',
        'api_integration': 'API Integrations',
        'email_integration': 'Email Notifications',
        'newsletter': 'Newsletter Integration',
        'user_roles': 'Role-Based Access Control',
        'notifications': 'In-App Notifications',
        'booking_basic': 'Basic Booking System',
        'booking_system': 'Advanced Booking + Availability',
        'blog': 'Blog Module',
        'cms_integration': 'Content Management System',
        'gallery': 'Media Gallery',
        'music_media': 'Music/Video Player',
        'social_feed': 'Social Media Feed'
    };

    // Package tier display names
    var packageTierNames = {
        'essential': 'Essential — Landing Page',
        'starter': 'Tier 1 — Starter',
        'growth': 'Tier 2 — Growth',
        'professional': 'Tier 3 — Professional',
        'enterprise': 'Tier 4 — Enterprise',
        'custom': 'Custom Quote'
    };

    var html = '';
    var packageType = pricingData.packageType;

    // Show placeholder if no package selected
    if (!packageType) {
        html = '<div class="pricing-empty-state">Select a package to see pricing breakdown</div>';
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
        html += '<div class="pricing-section-header">Included in Package</div>';
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
        html += '<div class="pricing-section-header">' + (packageType === 'custom' ? 'Included Features' : 'Add-Ons') + '</div>';
        nonEcommerceAddOns.forEach(function(item) {
            var label = featureLabels[item.key] || item.label;
            var priceDisplay = item.price === 0 ?
                '<span class="included-badge">Included</span>' :
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
            html += '<div class="pricing-section-header">' + (packageType === 'custom' ? 'Included Features' : 'Add-Ons') + '</div>';
        }
        var ecommercePriceDisplay = ecommerceAddOn.price === 0 ?
            '<span class="included-badge">Included</span>' :
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
        html += '<div class="pricing-section-header">Removed Features (50% Credit)</div>';
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
            discountLabel += ' (' + coupon.discountValue + '% off)';
        } else {
            discountLabel += ' ($' + coupon.discountValue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ' off)';
        }
        html += '<div class="pricing-section-header coupon-header">Discount Applied</div>';
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
                couponMessage.innerHTML = '✓ ' + validation.discountDisplay + ' discount applied!';
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
            alert('Please fill in all required fields:\n- ' + missingFields.join('\n- '));
            return;
        }
        if (!businessEmail && !businessPhone) {
            alert('Please provide either a Business Email or Business Phone number.');
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
            alert('Please fill in all required fields:\n- ' + missingFields.join('\n- '));
            return;
        }
        if (!clientEmail && !clientPhone) {
            alert('Please provide either a Client Email or Client Phone number.');
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
            alert('Please enter a valid deferred amount.');
            return;
        }
        if (deferredData.splitType === 'lump_sum' && !deferredData.dueDate) {
            alert('Please select a due date for the deferred payment.');
            return;
        }
        if (deferredData.splitType === 'custom' && deferredData.customSchedule.length === 0) {
            alert('Please add at least one payment to the custom schedule.');
            return;
        }
        if (deferredData.splitType === 'recurring') {
            if (!deferredData.startDate) {
                alert('Please select a first payment date for the payment plan.');
                return;
            }
            if (deferredData.calculationMode === 'amount' && (!deferredData.amountPerPayment || deferredData.amountPerPayment <= 0)) {
                alert('Please enter a valid payment amount.');
                return;
            }
            if (deferredData.calculationMode === 'count' && (!deferredData.numberOfPayments || deferredData.numberOfPayments < 2)) {
                alert('Please enter a valid number of payments (minimum 2).');
                return;
            }
            if (deferredData.customSchedule.length === 0) {
                alert('Could not generate payment schedule. Please check your inputs.');
                return;
            }
        }
        if (deferredData.deferredAmount > totalPrice) {
            alert('Deferred amount cannot exceed the total project price.');
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
        createdBy: firebase.auth().currentUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'draft'
    };

    var self = this;

    firebase.firestore().collection('sow_documents').add(sowData)
        .then(function(docRef) {
            console.log('SOW saved with ID:', docRef.id);
            alert('✓ SOW saved successfully!\n\nYou can now generate the PDF or attach it to a contract.');
            $('#sowCreatorContainer').style.display = 'none';
            
            // Refresh the SOW list
            self.loadSOWDocuments();
        })
        .catch(function(error) {
            console.error('Error saving SOW:', error);
            alert('Error saving SOW: ' + error.message);
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
                alert('SOW not found');
                return;
            }
            
            var sowData = doc.data();
            sowData.id = doc.id;
            
            // Check if already signed
            if (sowData.clientSignature && sowData.devSignature) {
                alert('This SOW is already fully signed by both parties.');
                self.generateSOWPDF(sowData);
                return;
            }
            
            // Show signing modal
            self.renderSOWSigningModal(sowData);
        })
        .catch(function(error) {
            console.error('Error loading SOW:', error);
            alert('Error loading SOW: ' + error.message);
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
        alert('You do not have permission to sign this SOW');
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
        '<h1>📋 Statement of Work - Signature Required</h1>' +
        '<p class="modal-subtitle">' + sowData.clientName + ' | ' + sowData.packageType.toUpperCase() + '</p>' +
        '</div>' +
        
        '<div class="contract-form" ">' +
        
        // SOW Summary
        '<div class="contract-section-inner">' +
        '<h2>SOW Summary</h2>' +
        '<p><strong>Client:</strong> ' + sowData.clientName + '</p>' +
        '<p><strong>Package:</strong> ' + sowData.packageType + '</p>' +
        '<p><strong>Total Cost:</strong> $' + (sowData.payment ? sowData.payment.total.toFixed(0) : '0') + '</p>' +
        '<p><strong>Timeline:</strong> ' + (sowData.estimatedWeeks || 'TBD') + ' weeks</p>' +
        '<p><strong>Features:</strong> ' + (sowData.features ? sowData.features.length : 0) + ' selected</p>' +
        '</div>' +
        
        // Signature Sections
        '<div class="signatures">' +
        '<div class="signature-grid">';
    
    // CLIENT SIGNATURE BLOCK
    html += '<div class="signature-block" id="sowClientSignatureBlock">' +
        '<h3>Client Signature — ' + sowData.clientName + '</h3>';
    
    if (sowData.clientSignature) {
        // Already signed
        html += '<div class="pending-notice">' +
            '<p><strong>✓ Client has signed this SOW</strong></p>' +
            '<p>Signed on: ' + (sowData.clientSignedDate || 'N/A') + '</p>' +
            '</div>' +
            '<div class="signature-pad-container">' +
            '<canvas id="sowClientSigPad" class="signature-pad"></canvas>' +
            '</div>';
    } else if (isClient) {
        // Client needs to sign
        html += '<div class="form-row">' +
            '<div class="form-group">' +
            '<label>Name *</label>' +
            '<input type="text" id="sowClientSignerName" value="' + sowData.clientName + '" required />' +
            '</div>' +
            '<div class="form-group">' +
            '<label>Date *</label>' +
            '<input type="date" id="sowClientSignDate" required />' +
            '</div>' +
            '</div>' +
            '<div class="form-group">' +
            '<label>Signature *</label>' +
            '<div class="signature-pad-container">' +
            '<canvas id="sowClientSigPad" class="signature-pad"></canvas>' +
            '<button class="clear-btn" data-canvas="sowClientSigPad">Clear</button>' +
            '</div>' +
            '</div>';
    } else {
        // Developer viewing - client hasn't signed yet
        html += '<div class="pending-notice">' +
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>' +
            '<p><strong>Awaiting Client Signature</strong></p>' +
            '<p>Client has not signed this SOW yet.</p>' +
            '</div>';
    }
    
    html += '</div>'; // Close client signature block
    
    // DEVELOPER SIGNATURE BLOCK
    html += '<div class="signature-block" id="sowDevSignatureBlock">' +
        '<h3>Developer Signature — Scarlo</h3>';
    
    if (sowData.devSignature) {
        // Already signed
        html += '<div class="pending-notice">' +
            '<p><strong>✓ Developer has signed this SOW</strong></p>' +
            '<p>Signed on: ' + (sowData.devSignedDate || 'N/A') + '</p>' +
            '</div>' +
            '<div class="signature-pad-container">' +
            '<canvas id="sowDevSigPad" class="signature-pad"></canvas>' +
            '</div>';
    } else if (isDeveloper) {
        // Developer needs to sign
        html += '<div class="form-row">' +
            '<div class="form-group">' +
            '<label>Name</label>' +
            '<input type="text" id="sowDevSignerName" value="Carlos Martin" required />' +
            '</div>' +
            '<div class="form-group">' +
            '<label>Date *</label>' +
            '<input type="date" id="sowDevSignDate" required />' +
            '</div>' +
            '</div>' +
            '<div class="form-group">' +
            '<label>Signature</label>' +
            '<div class="signature-pad-container">' +
            '<canvas id="sowDevSigPad" class="signature-pad"></canvas>' +
            '<button class="clear-btn" data-canvas="sowDevSigPad">Clear</button>' +
            '</div>' +
            '</div>';
    } else {
        // Client viewing - developer hasn't signed yet
        html += '<div class="pending-notice">' +
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>' +
            '<p><strong>Awaiting Developer Signature</strong></p>' +
            '<p>Developer will review and sign shortly.</p>' +
            '</div>';
    }
    
    html += '</div>'; // Close dev signature block
    html += '</div></div>'; // Close signature-grid and signatures
    
    // Action Buttons
    html += '<div class="action-buttons">';
    
    if (sowData.clientSignature && sowData.devSignature) {
        // Both signed - show download
        html += '<button class="btn btn-primary" id="downloadSOWBtn">' +
            '<span>📄 Download Signed SOW</span>' +
            '</button>';
    } else if (isClient && !sowData.clientSignature) {
        // Client can sign
        html += '<button class="btn btn-primary" id="submitSOWClientSig">' +
            '<span>✍️ Submit Signature</span>' +
            '</button>';
    } else if (isDeveloper && !sowData.devSignature && sowData.clientSignature) {
        // Developer can sign (only if client signed first)
        html += '<button class="btn btn-primary" id="submitSOWDevSig">' +
            '<span>✍️ Sign SOW</span>' +
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
        alert('Please provide your signature');
        return;
    }
    
    var signerName = document.getElementById('sowClientSignerName').value.trim();
    var signDate = document.getElementById('sowClientSignDate').value;
    
    if (!signerName || !signDate) {
        alert('Please fill in all fields');
        return;
    }
    
    var submitBtn = document.getElementById('submitSOWClientSig');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Submitting...</span>';
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
            alert('✓ SOW signed successfully!\n\nThe developer will review and sign shortly.');
            
            var modal = document.getElementById('sowSigningModal');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        })
        .catch(function(error) {
            console.error('Error signing SOW:', error);
            alert('Error signing SOW: ' + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>✍️ Submit Signature</span>';
            }
        });
};

ContractFormHandler.prototype.submitSOWDeveloperSignature = function(sowId, signaturePad) {
    var self = this;
    
    if (!signaturePad || signaturePad.isEmpty()) {
        alert('Please provide your signature');
        return;
    }
    
    var signerName = document.getElementById('sowDevSignerName').value.trim();
    var signDate = document.getElementById('sowDevSignDate').value;
    
    if (!signerName || !signDate) {
        alert('Please fill in all fields');
        return;
    }
    
    var submitBtn = document.getElementById('submitSOWDevSig');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Signing...</span>';
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
            alert('✓ SOW fully executed!\n\nBoth parties have signed.');
            
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
            alert('Error signing SOW: ' + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>✍️ Sign SOW</span>';
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
            alert('Please select a Package Tier to generate PDF');
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
            alert('Please fill in the ' + (isBusinessEntityForm ? 'Business Name' : 'Client Name') + ' to generate PDF');
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

    // Package definitions (comprehensive) - 2025 Revised Structure
    var packageDefinitions = {
        'essential': {
            name: 'Essential — Landing Page',
            priceRange: '$1,000 - $3,000',
            defaultPrice: 2000,
            timeline: '1-2 weeks',
            description: 'Clean, effective landing page for establishing your online presence quickly.',
            includes: [
                'Single-page landing page (1-3 sections)',
                'Cross-device optimization (mobile, tablet, desktop)',
                'Clean, modern React/Next.js design',
                'Contact form with validation',
                'Basic SEO setup (meta tags)',
                'DNS & hosting configuration (client pays for domain)',
                '1 round of revisions',
                '14-day post-launch support'
            ],
            notIncluded: [
                'Custom animations or micro-interactions',
                'Advanced SEO (sitemap, schema)',
                'Analytics integration',
                'User authentication',
                'Database functionality'
            ]
        },
        'starter': {
            name: 'Tier 1 — Starter',
            priceRange: '$3,000 - $6,000',
            defaultPrice: 4500,
            timeline: '2-3 weeks',
            description: 'Polished single-page website for individuals and small businesses needing a professional online presence.',
            includes: [
                'Multi-section single-page React/Next.js website',
                'Brand-matched design system',
                'Cross-device optimization (mobile, tablet, desktop)',
                'Scroll animations & micro-interactions',
                'Multi-step contact forms with validation',
                'GA4 + custom event tracking',
                'Full technical SEO (meta tags, sitemap, schema)',
                'DNS & hosting configuration (client pays for domain)',
                '2 rounds of revisions per milestone',
                '30-day post-launch support'
            ],
            notIncluded: [
                'User authentication or login systems',
                'Database integration',
                'E-commerce functionality',
                'Backend development'
            ]
        },
        'growth': {
            name: 'Tier 2 — Growth',
            priceRange: '$6,000 - $12,000',
            defaultPrice: 9000,
            timeline: '3-5 weeks',
            description: 'For businesses needing auth-protected content, form data capture, and user data management.',
            includes: [
                'Everything in Starter',
                'Firebase Authentication (email/password login)',
                'Protected content areas (auth-gated pages/sections)',
                'Form data capture & storage',
                'User session management',
                'Domain, hosting & SSL included (first year)',
                '3 rounds of revisions',
                '45-day post-launch support'
            ],
            notIncluded: [
                'User dashboard or profile pages',
                'Database-driven content',
                'Multiple API integrations',
                'E-commerce functionality'
            ]
        },
        'professional': {
            name: 'Tier 3 — Professional',
            priceRange: '$12,000 - $25,000',
            defaultPrice: 18500,
            timeline: '5-8 weeks',
            description: 'Full-featured application with user dashboard, profiles, and database-driven functionality.',
            includes: [
                'Everything in Growth',
                'Full Firebase backend (Auth, Firestore, Storage)',
                'User dashboard with personalized content',
                'User profile management',
                'File/media upload system',
                'Multiple API integrations (CRMs, Zapier, etc.)',
                'Email notifications (SendGrid)',
                'Domain, hosting & SSL included (first year)',
                'Priority support response (24-48 hours)',
                '4 rounds of revisions',
                '2 months of included maintenance'
            ],
            notIncluded: [
                'Role-based access control (RBAC)',
                'Multi-page application routing',
                'E-commerce functionality',
                'Mobile app development'
            ]
        },
        'enterprise': {
            name: 'Tier 4 — Enterprise',
            priceRange: '$25,000 - $50,000',
            defaultPrice: 37500,
            timeline: '8-14 weeks',
            description: 'Enterprise-grade web application with full infrastructure, role-based access, and scalable architecture.',
            includes: [
                'Everything in Professional',
                'Multi-page Next.js application with routing',
                'Role-based access control (admin, editor, user, etc.)',
                'In-app notification system',
                'Custom admin dashboards and analytics',
                'Scalable, production-ready architecture',
                'Database design and optimization',
                'Security best practices implementation',
                'Domain, hosting & SSL included (first year)',
                'Documentation and training materials',
                '5 rounds of revisions',
                '3 months of premium maintenance included',
                'Dedicated support channel'
            ],
            notIncluded: [
                'Native mobile app development (available separately)',
                'Machine learning / AI features',
                '24/7 on-call support (available separately)'
            ]
        },
        'custom': {
            name: 'Custom Quote',
            priceRange: 'Custom Pricing',
            defaultPrice: 0,
            timeline: 'TBD',
            description: 'Tailored solution designed to meet your specific requirements.',
            includes: ['Custom scope to be defined'],
            notIncluded: []
        }
    };

    var maintenanceDefinitions = {
        'none': {
            name: 'No Maintenance Plan',
            price: '$0/month',
            description: 'Developer will NOT provide any ongoing maintenance, updates, or support after the post-launch period ends. Client is solely responsible for website maintenance.',
            includes: []
        },
        'basic': {
            name: 'Basic Care',
            price: '$167/month',
            description: 'Ideal for websites requiring occasional updates and minor adjustments (2-3 hrs/month).',
            includes: [
                'Minor text and image updates (up to 2-3 hours/month)',
                'Security updates and patches',
                'Uptime monitoring',
                'Monthly backup verification',
                'Email support (48-72 hour response)',
                'Bug fixes for existing functionality'
            ]
        },
        'professional': {
            name: 'Professional Care',
            price: '$335/month',
            description: 'For businesses requiring regular updates and more hands-on support (4-6 hrs/month).',
            includes: [
                'Everything in Basic Care',
                'Content updates (up to 4-6 hours/month)',
                'Performance optimization',
                'Analytics review and recommendations',
                'Priority email support (24-48 hour response)',
                'Minor feature enhancements',
                'Third-party integration monitoring',
                'Monthly status reports'
            ]
        },
        'premium': {
            name: 'Premium Care',
            price: '$670/month',
            description: 'Comprehensive support for mission-critical websites and applications (8-12 hrs/month).',
            includes: [
                'Everything in Professional Care',
                'Priority support (same-day response)',
                'New component development (up to 8-12 hours/month)',
                'SEO optimization and monitoring',
                'A/B testing setup and analysis',
                'Dedicated support channel (Slack/Discord)',
                'Quarterly strategy calls',
                'Proactive performance improvements',
                'Database optimization',
                'Emergency support availability'
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
    var generatedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    var formattedStartDate = startDate ?
        new Date(startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) :
        'To be determined';

    // Build HTML first, then open window with Blob URL
    var htmlContent = '<!DOCTYPE html>' +
    '<html><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
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
    '.section { margin-bottom: 10px; }' +
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
    '.assumptions-box { border: 1px solid #000; border-left: 3px solid #000; padding: 8px 12px; margin: 8px 0; }' +
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
    '@media screen and (max-width: 768px) { body { padding: 0.3in 0.25in; } .sow-container { max-width: 100%; } }' +
    '@media print { body { padding: 0.4in 0.6in; } @page { margin: 0.5in 0.75in 0.5in 0.75in; } .info-box, .package-box, .timeline-box, .maintenance-box, .payment-table, .legal-notice, .deferred-terms { page-break-inside: avoid !important; break-inside: avoid !important; } h2, h3 { page-break-after: avoid !important; } }' +
    '@page { margin: 0.5in 0.75in; size: letter; }' +
    '</style>' +
    '</head><body>' +
    '<div class="sow-container">' +

    // HEADER
    '<div class="header">' +
    '<img src="' + getLogoForPDF() + '" alt="Scarlo Logo" class="logo" />' +
    '<h1>Statement of Work</h1>' +
    '<div class="subtitle">Scarlo — Professional Web Development</div>' +
    '<div class="meta-date">Document Generated: ' + generatedDate + '</div>' +
    '</div>' +

    // LEGAL INCORPORATION
    '<div class="legal-notice">' +
    '<strong>INCORPORATION:</strong> This SOW is incorporated into and governed by the Website Development Agreement between Scarlo and ' + clientName + '. All Agreement terms apply. In case of conflict, the Agreement controls.' +
    '</div>' +

    // CLIENT INFORMATION
    '<div class="section">' +
    '<h2>1. Client Information</h2>' +
    '<div class="info-box">' +
    '<div class="info-grid">' +
    (isBusinessEntity
        ? '<div class="info-item"><strong>Business Name:</strong> ' + businessName + '</div>' +
          '<div class="info-item"><strong>Entity Type:</strong> ' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</div>' +
          '<div class="info-item"><strong>Representative:</strong> ' + representativeName + ', ' + representativeTitle + '</div>'
        : '<div class="info-item"><strong>Client Name:</strong> ' + clientName + '</div>') +
    '<div class="info-item"><strong>Contact:</strong> ' + clientEmail + '</div>' +
    '<div class="info-item"><strong>Package Selected:</strong> ' + packageInfo.name + '</div>' +
    (isRetroactive
        ? '<div class="info-item"><strong>Development Duration:</strong> ' + (devDuration || estimatedWeeks) + ' ' + devDurationUnit + '</div>'
        : '<div class="info-item"><strong>Estimated Timeline:</strong> ' + estimatedWeeks + ' weeks</div>') +
    '<div class="info-item"><strong>Estimated Final Revision:</strong> ' + formattedStartDate + '</div>' +
    '<div class="info-item"><strong>SOW Reference:</strong> ' + sowId + '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +

    // PROJECT OVERVIEW
    '<div class="section">' +
    '<h2>2. Project Overview</h2>' +
    '<div class="package-box">' +
    '<div class="package-header">' +
    '<span class="package-name">' + packageInfo.name + '</span>' +
    '<span class="package-price">' + packageInfo.priceRange + '</span>' +
    '</div>' +
    '<p style="font-size: 9pt; margin-bottom: 10px;">' + packageInfo.description + '</p>' +
    '<h3 style="font-size: 9pt; margin-top: 10px;">Included in This Package:</h3>' +
    '<ul class="feature-list">';

    // For custom quotes, show selected features; for packages, show package includes
    if (packageType === 'custom' && addOns && addOns.length > 0) {
        addOns.forEach(function(addon) {
            htmlContent += '<li>' + addon.label + '</li>';
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
        '<h2>3. Additional Features</h2>' +
        '<div class="info-box">' +
        '<ul class="feature-list">';
        trueAddOns.forEach(function(addon) {
            htmlContent += '<li>' + addon.label + '</li>';
        });
        htmlContent += '</ul></div></div>';
    }

    // SPECIAL REQUIREMENTS
    if (notes && notes.trim()) {
        htmlContent += '<div class="section">' +
        '<h2>' + (trueAddOns.length > 0 ? '4' : '3') + '. Special Requirements & Notes</h2>' +
        '<div class="info-box">' +
        '<p style="font-size: 9pt; margin-bottom: 0;">' + notes + '</p>' +
        '</div>' +
        '</div>';
    }

    var sectionNum = 3 + (trueAddOns.length > 0 ? 1 : 0) + (notes && notes.trim() ? 1 : 0);

    // PROJECT TIMELINE (hidden for retroactive projects)
    if (!isRetroactive) {
        htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. Project Timeline & Milestones</h2>' +
        '<div class="timeline-box">' +
        '<div class="timeline-header">Estimated Project Duration: ' + estimatedWeeks + ' Weeks</div>' +

        '<div class="milestone">' +
        '<div class="milestone-title">1. Discovery & Planning (Week 1)</div>' +
        '<div class="milestone-desc">Requirements gathering, sitemap, wireframes, project kickoff.</div>' +
        '</div>' +

        '<div class="milestone">' +
        '<div class="milestone-title">2. UI/UX Design (Weeks 2-3)</div>' +
        '<div class="milestone-desc">Visual mockups, component design, approval. <strong>Milestone Payment due.</strong></div>' +
        '</div>' +

        '<div class="milestone">' +
        '<div class="milestone-title">3. Development (Weeks 4-' + Math.max(4, parseInt(estimatedWeeks) - 2 || 4) + ')</div>' +
        '<div class="milestone-desc">Frontend/backend development, feature implementation, testing.</div>' +
        '</div>' +

        '<div class="milestone">' +
        '<div class="milestone-title">4. Testing & Deployment (Final Week)</div>' +
        '<div class="milestone-desc">QA, bug fixes, optimization, deployment. <strong>Final Payment due.</strong></div>' +
        '</div>' +

        '</div>' +
        '<p style="font-size: 9pt; font-style: italic; margin-top: 6px;">Timeline is an estimate. See Agreement Section 8 for terms.</p>' +
        '</div>';

        sectionNum++;
    }

    // PRICING SUMMARY (individualized breakdown)
    htmlContent += '<div class="section">' +
    '<h2>' + sectionNum + '. Pricing Summary</h2>' +
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
            var priceDisplay = addon.price === 0 ?
                '<span style="color: #2e7d32; font-style: italic;">Included</span>' :
                '<span style="color: #2e7d32;">+$' + addon.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</span>';
            htmlContent += '<tr>' +
            '<td>' + addon.label + '</td>' +
            '<td style="text-align: right;">' + priceDisplay + '</td>' +
            '</tr>';
        });
    }

    // Discounts (removed features)
    if (discounts && discounts.length > 0) {
        discounts.forEach(function(discount) {
            htmlContent += '<tr>' +
            '<td>' + discount.label + ' <span style="font-size: 8pt; color: #666;">(removed)</span></td>' +
            '<td style="text-align: right; color: #c62828;">-$' + discount.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</td>' +
            '</tr>';
        });
    }

    // Coupon discount
    if (couponCode && couponDiscount > 0) {
        htmlContent += '<tr>' +
        '<td>Coupon: ' + couponCode + '</td>' +
        '<td style="text-align: right; color: #c62828;">-$' + couponDiscount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</td>' +
        '</tr>';
    }

    // Total row
    htmlContent += '<tr style="border-top: 2px solid #333;">' +
    '<td><strong>TOTAL</strong></td>' +
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
    '<h2>' + sectionNum + '. Your Value Summary</h2>' +

    '<div style="border: 2px solid #000; padding: 12px 15px; margin: 8px 0;">' +

    // Price comparison - anchored
    '<div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #ccc; margin-bottom: 10px;">' +
    '<div style="font-size: 9pt;">' +
    '<div style="color: #666; margin-bottom: 2px;">Fresno/Central Valley agencies typically charge:</div>' +
    '<div style="font-size: 11pt; font-weight: bold;">' + tierRates.local + '</div>' +
    '</div>' +
    '<div style="text-align: right;">' +
    '<div style="color: #666; font-size: 9pt; margin-bottom: 2px;">Your Scarlo Quote:</div>' +
    '<div style="font-size: 14pt; font-weight: bold;">$' + totalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>' +
    '</div>' +
    '</div>' +

    // Savings callout
    (potentialSavings > 500 ?
    '<div style="background: #f0f7f0; padding: 8px 12px; margin-bottom: 10px; text-align: center; border-left: 3px solid #2e7d32;">' +
    '<span style="font-size: 9pt; color: #666;">Potential savings vs. local market: </span>' +
    '<strong style="font-size: 11pt; color: #2e7d32;">Up to $' + potentialSavings.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong>' +
    '</div>' : '') +

    // Value propositions - 3 key differentiators focused on functionality & purpose
    '<div style="font-size: 9pt;">' +
    '<div style="margin-bottom: 4px;"><strong style="color: #2e7d32;">✓</strong> <strong>Advanced Functionality</strong> — Real features that work: auth systems, dashboards, integrations — not static pages</div>' +
    '<div style="margin-bottom: 4px;"><strong style="color: #2e7d32;">✓</strong> <strong>Modern Tech Stack</strong> — React/Next.js built for speed, SEO, and scale — not outdated WordPress themes</div>' +
    '<div><strong style="color: #2e7d32;">✓</strong> <strong>Creative Solutions</strong> — Your online presence matters. Stand out in a market full of cookie-cutter websites</div>' +
    '</div>' +

    '</div>' +

    '<p style="font-size: 7pt; color: #888; margin-top: 4px; margin-bottom: 0;">Market rates based on Fresno/Central Valley research (2024-2025). Full industry comparison: <a href="https://scarlo.dev/pricing" target="_blank" style="color: #2e7d32; text-decoration: underline;">scarlo.dev/pricing</a></p>' +
    '</div>';

    sectionNum++;

    // PAYMENT STRUCTURE (simplified for retroactive projects)
    if (isRetroactive) {
        // Simple total for retroactive projects
        htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. Payment Summary</h2>' +
        '<div class="info-box" style="text-align: center; padding: 15px;">' +
        '<div style="font-size: 10pt; color: #666; margin-bottom: 5px;">Total Project Cost</div>' +
        '<div style="font-size: 16pt; font-weight: bold;">$' + totalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>' +
        '</div>' +
        '<p style="font-size: 9pt; font-style: italic;">Payment terms as agreed. IP rights transfer upon full payment (Section 6.6).</p>' +
        '</div>';
    } else {
        // Full payment structure for new projects
        htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. Payment Structure</h2>' +

        '<table class="payment-table">' +
        '<thead>' +
        '<tr>' +
        '<th style="width: 25%;">Payment</th>' +
        '<th style="width: 45%;">Description</th>' +
        '<th style="width: 15%;">Percentage</th>' +
        '<th style="width: 15%;">Amount</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '<tr>' +
        '<td><strong>Deposit</strong></td>' +
        '<td>Before work begins</td>' +
        '<td>50%</td>' +
        '<td><strong>$' + deposit.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>Milestone</strong></td>' +
        '<td>Upon design approval</td>' +
        '<td>25%</td>' +
        '<td><strong>$' + milestone1.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>Final</strong></td>' +
        '<td>Prior to deployment</td>' +
        '<td>25%</td>' +
        '<td><strong>$' + finalPayment.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>' +
        '<tr class="total-row">' +
        '<td colspan="2"><strong>TOTAL PROJECT COST</strong></td>' +
        '<td><strong>100%</strong></td>' +
        '<td><strong>$' + totalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>' +
        '</tbody>' +
        '</table>' +

        '<p style="font-size: 9pt; font-style: italic;">Late payments subject to interest (Section 3.3). IP rights transfer upon full payment (Section 6.6).</p>' +
        '</div>';
    }

    sectionNum++;

    // DEFERRED PAYMENT AGREEMENT (if enabled)
    if (sowData.payment && sowData.payment.deferred && sowData.payment.deferred.enabled) {
        var deferred = sowData.payment.deferred;

        htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. Deferred Payment Agreement</h2>' +

        '<div style="background: #fff8e6; border: 2px solid #f59e0b; padding: 10px; margin-bottom: 10px;">' +
        '<p style="font-size: 9pt; margin: 0 0 5px; color: #92400e; font-weight: bold;">DEFERRED PAYMENT TERMS</p>' +
        '<p style="font-size: 8pt; margin: 0; color: #78350f;">Client has elected to defer a portion of payment. The following terms apply to the deferred amount and are binding upon both parties.</p>' +
        '</div>' +

        '<table class="payment-table">' +
        '<thead>' +
        '<tr>' +
        '<th style="width: 50%;">Description</th>' +
        '<th style="width: 25%;">Due Date</th>' +
        '<th style="width: 25%;">Amount</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>';

        // Frequency labels for recurring payments
        var freqLabels = {
            'weekly': 'Weekly',
            'biweekly': 'Bi-Weekly',
            'semimonthly': 'Semi-Monthly',
            'monthly': 'Monthly',
            'bimonthly': 'Bi-Monthly'
        };

        if ((deferred.splitType === 'custom' || deferred.splitType === 'recurring') && deferred.customSchedule && deferred.customSchedule.length > 0) {
            // Show payment plan summary for recurring type
            if (deferred.splitType === 'recurring' && deferred.frequency) {
                var freqLabel = freqLabels[deferred.frequency] || deferred.frequency;
                htmlContent += '<tr style="background: #e0f2fe;">' +
                '<td colspan="3" style="font-size: 8pt; color: #0369a1; padding: 6px 8px;">' +
                '<strong>Payment Plan:</strong> ' + deferred.customSchedule.length + ' ' + freqLabel.toLowerCase() + ' payments of $' +
                (deferred.customSchedule[0].amount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) +
                '</td></tr>';
            }
            deferred.customSchedule.forEach(function(payment, index) {
                var formattedDate = payment.dueDate ? new Date(payment.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD';
                htmlContent += '<tr>' +
                '<td>Payment ' + (index + 1) + '</td>' +
                '<td>' + formattedDate + '</td>' +
                '<td><strong>$' + (payment.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
                '</tr>';
            });
        } else {
            var formattedDueDate = deferred.dueDate ? new Date(deferred.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD';
            htmlContent += '<tr>' +
            '<td>Deferred Payment (Lump Sum)</td>' +
            '<td>' + formattedDueDate + '</td>' +
            '<td><strong>$' + (deferred.deferredAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
            '</tr>';
        }

        // Total deferred amount row
        htmlContent += '<tr class="total-row">' +
        '<td colspan="2"><strong>TOTAL DEFERRED AMOUNT</strong></td>' +
        '<td><strong>$' + (deferred.deferredAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong></td>' +
        '</tr>';

        // Late fee row (only applies if payment is late)
        var lateFeeWaived = deferred.lateFeeWaived || deferred.feeWaived;
        var lateFeeAmount = deferred.deferredAmount * 0.10;
        htmlContent += '<tr style="background: #fef3c7;">' +
        '<td>Late Fee (10%)' + (lateFeeWaived ? ' <em style="color:#666;">(WAIVED)</em>' : '') + '</td>' +
        '<td style="font-size: 8pt; color: #92400e;">If payment is late</td>' +
        '<td>' + (lateFeeWaived ? '<s>$' + lateFeeAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</s> $0' : '<strong>$' + lateFeeAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</strong>') + '</td>' +
        '</tr>' +
        '</tbody></table>';

        // Terms and conditions
        var isRecurringPlan = deferred.splitType === 'recurring' || (deferred.splitType === 'custom' && deferred.customSchedule && deferred.customSchedule.length > 1);
        var lateFeeText = lateFeeWaived ? 'Waived for this agreement.' :
            (isRecurringPlan ?
                '10% of missed payment amount per late payment. Applied after 5-day grace period.' :
                'One-time 10% fee ($' + lateFeeAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ') if payment exceeds grace period.');

        htmlContent += '<div class="deferred-terms">' +
        '<h3 style="font-size: 9pt; margin-top: 10px; margin-bottom: 5px;">Terms and Conditions:</h3>' +
        '<ol style="font-size: 8pt; margin: 5px 0; padding-left: 18px; line-height: 1.3;">' +
        '<li><strong>Due Date & Grace Period:</strong> Payments due by specified date(s). 5-day grace period before fees apply.</li>' +
        '<li><strong>Late Fee:</strong> ' + lateFeeText + '</li>' +
        '<li><strong>Interest (30+ Days):</strong> 1.5% monthly (18% annually) on balances 30+ days overdue. Compounds monthly.</li>' +
        '<li><strong>Service Suspension (60+ Days):</strong> Website may be taken offline after 60 days non-payment. 7-day written notice provided. Restored within 24-48 hrs of payment.</li>' +
        '<li><strong>Collection Costs:</strong> Client pays all collection costs, attorney fees, court costs if collection action required.</li>' +
        '<li><strong>IP Rights:</strong> All intellectual property rights retained by Developer until full payment received.</li>' +
        '<li><strong>Default Remedies:</strong> Upon default, Developer may: (a) accelerate payments, (b) apply fees/interest, (c) suspend services, (d) disable website, (e) pursue legal remedies.</li>';

        if (deferred.allowPartialPayments) {
            htmlContent += '<li><strong>Partial Payments:</strong> Accepted anytime. Applied to: (1) collection costs, (2) interest, (3) late fees, (4) principal.</li>';
        }

        if (deferred.maintenanceDuringDeferral) {
            htmlContent += '<li><strong>Maintenance:</strong> Monthly maintenance fees due during deferral. Separate from deferred project payments.</li>';
        } else {
            htmlContent += '<li><strong>Maintenance:</strong> Maintenance fees deferred with project payments.</li>';
        }

        htmlContent += '<li><strong>Notice:</strong> 7-day written notice via email before any fees or suspension.</li>' +
        '</ol>' +
        '</div>' +
        '</div>';

        sectionNum++;
    }

    // MAINTENANCE PLAN (Required for all projects)
    htmlContent += '<div class="section">' +
        '<h2>' + sectionNum + '. Ongoing Maintenance Plan</h2>' +
        '<div class="maintenance-box">' +
        '<div class="maintenance-header">' +
        '<span class="maintenance-name">' + maintenanceInfo.name + '</span>' +
        '<span class="maintenance-price">' + maintenanceInfo.price + '</span>' +
        '</div>' +
        '<p style="font-size: 9pt; margin: 10px 0;">' + maintenanceInfo.description + '</p>';

        // Show warning box for No Maintenance selection
        if (maintenancePlan === 'none') {
            htmlContent += '<div style="background: #fff3cd; border: 2px solid #856404; padding: 12px; margin: 10px 0; border-radius: 4px;">' +
                '<p style="font-size: 9pt; margin: 0; color: #856404; font-weight: bold;">⚠️ IMPORTANT NOTICE:</p>' +
                '<p style="font-size: 9pt; margin: 5px 0 0; color: #856404;">By selecting No Maintenance Plan, Client acknowledges and agrees that Developer will NOT provide any ongoing maintenance, updates, security patches, bug fixes, or technical support after the included post-launch support period ends. Client assumes full responsibility for all website maintenance going forward.</p>' +
                '</div>';
        }

        if (maintenanceInfo.includes && maintenanceInfo.includes.length > 0) {
            htmlContent += '<h3 style="font-size: 9pt; margin-top: 10px;">Maintenance Includes:</h3>' +
            '<ul>';
            maintenanceInfo.includes.forEach(function(item) {
                htmlContent += '<li>' + item + '</li>';
            });
            htmlContent += '</ul>';
        }

        htmlContent += '</div>';

    // Different footer text based on maintenance selection
    if (maintenancePlan === 'none') {
        htmlContent += '<p style="font-size: 8pt; font-style: italic;">Support ends after the included post-launch period. See Agreement Section 7.</p>';
    } else {
        htmlContent += '<p style="font-size: 8pt; font-style: italic;">Begins after post-launch support. Billed monthly. 30-day cancellation notice. See Agreement Section 7.</p>';
    }
    htmlContent += '</div>';

    sectionNum++;

    // ASSUMPTIONS
    htmlContent += '<div class="section">' +
    '<h2>' + sectionNum + '. Assumptions & Dependencies</h2>' +
    '<div class="assumptions-box">' +
    '<ul>' +
    '<li><strong>Content:</strong> Client provides all content within 5 business days of request</li>' +
    '<li><strong>Feedback:</strong> Client provides consolidated feedback within 5 business days</li>' +
    '<li><strong>Contact:</strong> Client designates one authorized representative for approvals</li>' +
    '<li><strong>Third-Party:</strong> Required APIs/services remain available throughout project</li>' +
    '<li><strong>Domain & Hosting:</strong> Essential & Starter: Client pays for domain (Developer handles DNS & hosting configuration). Growth, Professional & Enterprise: Domain, hosting & SSL included (first year).</li>' +
    '<li><strong>Rights:</strong> Client has rights to all materials provided</li>' +
    '<li><strong>Scope:</strong> Project scope remains substantially unchanged</li>' +
    '</ul>' +
    '<p style="font-size: 8pt; margin-bottom: 0; margin-top: 6px;">Changes to assumptions may require a Change Order (Section 9).</p>' +
    '</div>' +
    '</div>';

    sectionNum++;

    // ACCEPTANCE CRITERIA
    htmlContent += '<div class="section">' +
    '<h2>' + sectionNum + '. Acceptance Criteria</h2>' +
    '<div class="info-box">' +
    '<p style="font-size: 9pt; margin-bottom: 4px;"><strong>Process:</strong> Client has 5 business days to review deliverables. Acceptance occurs when Client: (a) approves in writing, (b) fails to respond, or (c) uses in production. Acceptance triggers payment.</p>' +
    '<p style="font-size: 9pt; margin-bottom: 0;"><strong>Final Criteria:</strong> Modern browser compatibility (Chrome, Firefox, Safari, Edge), mobile responsiveness (iOS/Android), all features functional, forms working, page load under 5 seconds.</p>' +
    '</div>' +
    '</div>';

    sectionNum++;

    // CHANGE ORDER PROCESS
    htmlContent += '<div class="section">' +
    '<h2>' + sectionNum + '. Scope Changes</h2>' +
    '<div class="info-box">' +
    '<p style="font-size: 9pt; margin-bottom: 4px;">Any scope modifications require a written Change Order (Agreement Section 9).</p>' +
    '<p style="font-size: 9pt; margin-bottom: 0;"><strong>Process:</strong> Client submits request → Developer evaluates impact → Change Order issued with revised scope/timeline/pricing → Client signs and pays deposit → Work proceeds.</p>' +
    '</div>' +
    '</div>';

    // SIGNATURES
    htmlContent += '<div class="signature-section">' +
    '<h2>Signatures</h2>' +
    '<p style="font-size: 9pt;">By signing, both parties agree to this SOW and confirm it accurately reflects the project scope, deliverables, timeline, and pricing. Subject to the Website Development Agreement.</p>' +

    '<div class="signature-grid">' +

    // Developer Signature
    '<div class="signature-block">' +
    '<h3>DEVELOPER: Scarlo</h3>' +
    (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 8px;">&nbsp;</p>' : '') +
    '<div class="signature-line">' +
    (devSignature ? '<img src="' + devSignature + '" alt="Developer Signature" />' : '<span style="font-style: italic;">Awaiting Signature</span>') +
    '</div>' +
    '<div class="signature-label">Authorized Signature</div>' +
    '<div class="signature-name">' + devSignerName + '</div>' +
    '<div class="signature-date">Date: ' + (devSignedDate || '_______________') + '</div>' +
    '</div>' +

    // Client Signature
    '<div class="signature-block">' +
    '<h3>CLIENT: ' + (isBusinessEntity ? businessName : clientName) + '</h3>' +
    (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 8px;">' + entityType + (stateOfFormation ? ', ' + stateOfFormation : '') + '</p>' : '') +
    '<div class="signature-line">' +
    (clientSignature ? '<img src="' + clientSignature + '" alt="Client Signature" />' : '<span style="font-style: italic;">Awaiting Signature</span>') +
    '</div>' +
    '<div class="signature-label">Authorized Signature</div>' +
    '<div class="signature-name">' + (isBusinessEntity ? 'By: ' + representativeName + ', ' + representativeTitle : clientSignerName) + '</div>' +
    '<div class="signature-date">Date: ' + (clientSignedDate || '_______________') + '</div>' +
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
        '<h2 style="color: #92400e; font-size: 11pt; margin-bottom: 8px;">Deferred Payment Acknowledgment</h2>' +
        '<div style="background: #fff8e6; padding: 10px; margin-bottom: 10px; border: 1px solid #f59e0b;">' +
        '<p style="font-size: 8pt; margin: 0 0 5px; font-weight: bold;">By signing below, Client acknowledges:</p>' +
        '<ul style="font-size: 8pt; margin: 0; padding-left: 18px; line-height: 1.4;">' +
        '<li><strong>Deferred:</strong> $' + (deferred.deferredAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ' per schedule above</li>' +
        '<li><strong>Late Fee:</strong> ' + (lateFeeWaivedAck ? 'Waived' : '10% ($' + lateFeeAmountAck.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ') if 5+ days late') + '</li>' +
        '<li><strong>Interest:</strong> 1.5%/month (~$' + monthlyInterest.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '/mo) after 30 days</li>' +
        '<li><strong>Suspension:</strong> Site offline after 60 days non-payment</li>' +
        '<li><strong>Collection:</strong> Client pays all collection/legal costs</li>' +
        '<li><strong>IP Rights:</strong> Retained by Developer until paid</li>' +
        '</ul>' +
        '</div>' +

        '<div class="signature-grid">' +
        '<div class="signature-block">' +
        '<h3>CLIENT ACKNOWLEDGMENT</h3>' +
        '<div class="signature-line">' +
        (deferred.acknowledgmentSigned && clientSignature ? '<img src="' + clientSignature + '" alt="Client Acknowledgment" />' : '<span style="font-style: italic;">Awaiting Acknowledgment</span>') +
        '</div>' +
        '<div class="signature-label">Client Signature</div>' +
        '<div class="signature-name">' + (isBusinessEntity ? 'By: ' + representativeName : clientSignerName) + '</div>' +
        '<div class="signature-date">Date: ' + (deferred.acknowledgmentDate || '_______________') + '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    // FOOTER
    htmlContent += '<div class="footer">' +
    '<p><strong>© ' + new Date().getFullYear() + ' Scarlo</strong> — Professional Web Development | Fresno, CA</p>' +
    '<p class="sow-id">SOW: ' + sowId + ' | Generated: ' + new Date().toLocaleString() + '</p>' +
    '<p style="font-size: 7pt; font-style: italic;">Valid for 30 days. Must be signed with the Website Development Agreement.</p>' +
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
        alert('Please allow popups to download the PDF');
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
            'none': { price: 0, label: 'No E-Commerce' },
            'basic_cart': { price: 5500, label: 'Basic E-Commerce Setup', thirdParty: true, note: 'Stripe fees' },  // $3,000-$8,000
            'full_store': { price: 14000, label: 'Full E-Commerce Store', thirdParty: true, note: 'Stripe fees' }    // $8,000-$20,000
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
                'package': '📦 Package Tier',
                'features': '✨ Features & Deliverables',
                'timeline': '⏱️ Timeline',
                'payment': '💰 Payment Structure',
                'maintenance': '🔧 Maintenance Plan',
                'other': '📝 Other'
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
            alert('Please fill in all required fields:\n- ' + missingFields.join('\n- '));
            return;
        }
        if (!businessEmail && !businessPhone) {
            alert('Please provide either a Business Email or Business Phone number.');
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
            alert('Please fill in all required fields:\n- ' + missingFields.join('\n- '));
            return;
        }
        if (!clientEmail && !clientPhone) {
            alert('Please provide either a Client Email or Client Phone number.');
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
            alert('Please enter a valid deferred amount.');
            return;
        }
        if (deferredData.splitType === 'lump_sum' && !deferredData.dueDate) {
            alert('Please select a due date for the deferred payment.');
            return;
        }
        if (deferredData.splitType === 'custom' && deferredData.customSchedule.length === 0) {
            alert('Please add at least one payment to the custom schedule.');
            return;
        }
        if (deferredData.splitType === 'recurring') {
            if (!deferredData.startDate) {
                alert('Please select a first payment date for the payment plan.');
                return;
            }
            if (deferredData.calculationMode === 'amount' && (!deferredData.amountPerPayment || deferredData.amountPerPayment <= 0)) {
                alert('Please enter a valid payment amount.');
                return;
            }
            if (deferredData.calculationMode === 'count' && (!deferredData.numberOfPayments || deferredData.numberOfPayments < 2)) {
                alert('Please enter a valid number of payments (minimum 2).');
                return;
            }
            if (deferredData.customSchedule.length === 0) {
                alert('Could not generate payment schedule. Please check your inputs.');
                return;
            }
        }
        if (deferredData.deferredAmount > totalPrice) {
            alert('Deferred amount cannot exceed the total project price.');
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
                        alert('✓ SOW updated and change request completed!');
                    });
            } else {
                alert('✓ SOW updated successfully!');
            }
        })
        .then(function() {
            $('#sowCreatorContainer').style.display = 'none';
            self.loadSOWDocuments(); // Refresh the list
        })
        .catch(function(error) {
            console.error('Error updating SOW:', error);
            alert('Error updating SOW: ' + error.message);
        });
};


    ContractFormHandler.prototype.selectContractToSign = function(contractId, contracts) {
        var self = this;
        
        // Find the contract
        var contract = contracts.find(function(c) { return c.id === contractId; });
        if (!contract) {
            alert('Contract not found');
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
    
    // ✅ SHOW the original modal-close button
    var modalClose = $('.modal-close');
    if (modalClose) {
        modalClose.style.display = 'flex';
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
            devHeader.innerHTML = 'Developer Signature — Scarlo <span style="font-size: 12px; color: #f59e0b;">⏳ Sign Below</span>';
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
            submitBtn.innerHTML = '<span id="submitBtnText">Upload & Finalize</span>';
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
        backBtn.innerHTML = '← Back to Dashboard';
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
            alert('Contract not found');
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
        '<h4>Statement of Work Required</h4>' +
        '<p>You need an approved SOW before signing the contract.</p>' +
        '<p class="notification-action">Please <a href="#" class="request-help-link" style="color: #6366f1; text-decoration: underline; cursor: pointer; font-weight: 700;">Request Help</a> to request your SOW from the developer.</p>' +
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
                                if (contactLabel) contactLabel.textContent = 'Your Email *';
                            } else if (currentUser.phoneNumber) {
                                contactField.value = formatPhoneNumber(currentUser.phoneNumber);
                                contactField.type = 'tel';
                                contactField.placeholder = '(555) 123-4567';
                                if (contactLabel) contactLabel.textContent = 'Your Phone Number *';
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
    var tabsContainer = document.createElement('div');
    tabsContainer.id = 'clientSigningTabs';
    tabsContainer.className = 'client-signing-tabs';
    
    tabsContainer.innerHTML = 
        '<div class="signing-tabs-header">' +
        '<button class="signing-tab active" data-tab="contract">' +
        '<span class="tab-icon">📄</span>' +
        '<span class="tab-title">1. Contract Agreement</span>' +
        '<span class="tab-status" id="contractStatus">⏳ Pending</span>' +
        '</button>' +
        '<button class="signing-tab" data-tab="sow">' +
        '<span class="tab-icon">📋</span>' +
        '<span class="tab-title">2. Statement of Work</span>' +
        '<span class="tab-status" id="sowStatus">⏳ Pending</span>' +
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
        '<p class="progress-text">Complete both signatures to submit</p>' +
        '</div>' +
        '<button class="btn btn-primary" id="dualSignBtn">' +
        '<span id="dualSignBtnText">Next: Sign SOW →</span>' +
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
        contractHeader.innerHTML = '<h2>Contract</h2>' +
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
                    alert('Please complete all required fields:\n\n' + errors.join('\n'));
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
        'essential': 'Essential — Landing Page',
        'starter': 'Tier 1 — Starter',
        'growth': 'Tier 2 — Growth',
        'professional': 'Tier 3 — Professional',
        'enterprise': 'Tier 4 — Enterprise',
        'custom': 'Custom Quote'
    };

    var packageDetails = {
        'essential': {
            includes: ['Single-page landing page (1-3 sections)', 'Cross-device optimization', 'Clean, modern React/Next.js design', 'Contact form with validation', 'Basic SEO setup', 'DNS & hosting configuration (client pays for domain)']
        },
        'starter': {
            includes: ['Multi-section React/Next.js website', 'Brand-matched design system', 'Scroll animations & micro-interactions', 'Multi-step contact forms', 'GA4 + custom event tracking', 'Full technical SEO', 'DNS & hosting configuration (client pays for domain)']
        },
        'growth': {
            includes: ['Everything in Starter', 'Firebase Authentication', 'Protected content areas', 'Form data capture & storage', 'Newsletter integration', '3 rounds of revisions', 'Domain, hosting & SSL included (first year)']
        },
        'professional': {
            includes: ['Everything in Growth', 'Full Firebase backend', 'User dashboard & profiles', 'File/media upload system', 'API integrations', 'Email notifications (SendGrid)', '2 months of maintenance included', 'Domain, hosting & SSL included (first year)']
        },
        'enterprise': {
            includes: ['Everything in Professional', 'Multi-page application', 'Role-based access control', 'In-app notifications', 'Admin dashboards', 'Documentation & training', '3 months of premium maintenance included', 'Domain, hosting & SSL included (first year)']
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
        '<h2>STATEMENT OF WORK</h2>' +
        '<p class="modal-subtitle">Scarlo - Carlos Martin</p>' +
        '</div>' +

        // CLIENT INFO BOX
        '<section class="contract-section-inner">' +
        '<h3>Client Information</h3>' +
        '<div class="sow-info-grid">' +
        '<div class="sow-info-item"><strong>Client Name:</strong> ' + sowData.clientName + '</div>' +
        '<div class="sow-info-item"><strong>Contact:</strong> ' + (sowData.clientEmail || sowData.clientPhone || 'N/A') + '</div>' +
        '<div class="sow-info-item"><strong>Package:</strong> ' + (packageNames[sowData.packageType] || sowData.packageType) + '</div>' +
        '<div class="sow-info-item"><strong>Timeline:</strong> ' + (sowData.estimatedWeeks || 'TBD') + ' weeks</div>' +
        '</div>' +
        '</section>' +

        // PACKAGE INCLUDES
        '<section class="contract-section-inner">' +
        '<h3>Package Includes</h3>' +
        '<ul class="sow-list">';
    
    if (packageInfo.includes && packageInfo.includes.length > 0) {
        packageInfo.includes.forEach(function(item) {
            html += '<li>' + item + '</li>';
        });
    }
    
    html += '</ul></section>';

    // SELECTED FEATURES
    if (sowData.features && sowData.features.length > 0) {
        html += '<section class="contract-section-inner">' +
            '<h3>Additional Features & Deliverables</h3>' +
            '<ul class="sow-list">';

        sowData.features.forEach(function(feature) {
            html += '<li>' + feature + '</li>';
        });

        html += '</ul></section>';
    }

    // SPECIAL REQUIREMENTS
    if (sowData.notes) {
        html += '<section class="contract-section-inner">' +
            '<h3>Special Requirements</h3>' +
            '<p>' + sowData.notes + '</p>' +
            '</section>';
    }

    // PRICING BREAKDOWN (show itemized costs)
    html += '<section class="contract-section-inner">' +
        '<h3>Pricing Breakdown</h3>' +
        '<table class="sow-payment-table pricing-breakdown-table">' +
        '<thead>' +
        '<tr>' +
        '<th>Item</th>' +
        '<th>Description</th>' +
        '<th>Amount</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '<tr class="base-package-row">' +
        '<td><strong>' + (packageNames[sowData.packageType] || 'Package') + '</strong></td>' +
        '<td>Base package price</td>' +
        '<td><strong>$' + basePrice.toFixed(0) + '</strong></td>' +
        '</tr>';

    // Add-ons (features added beyond package)
    if (addOns && addOns.length > 0) {
        addOns.forEach(function(addon) {
            var thirdPartyNote = addon.thirdParty ? ' <span class="third-party-indicator">*</span>' : '';
            html += '<tr class="addon-row">' +
                '<td>' + addon.label + thirdPartyNote + '</td>' +
                '<td>Additional feature</td>' +
                '<td class="addon-price">+$' + addon.price.toFixed(0) + '</td>' +
                '</tr>';
        });
    }

    // Discounts (features removed from package)
    if (discounts && discounts.length > 0) {
        discounts.forEach(function(discount) {
            html += '<tr class="discount-row">' +
                '<td>' + discount.label + '</td>' +
                '<td>Feature removed (50% credit)</td>' +
                '<td class="discount-price">-$' + discount.price.toFixed(0) + '</td>' +
                '</tr>';
        });
    }

    // Coupon discount
    if (couponCode && couponDiscount > 0) {
        html += '<tr class="coupon-row">' +
            '<td>' + couponCode + '</td>' +
            '<td>Coupon discount</td>' +
            '<td class="discount-price">-$' + couponDiscount.toFixed(0) + '</td>' +
            '</tr>';
    }

    html += '<tr class="sow-total-row">' +
        '<td colspan="2"><strong>Total Project Cost</strong></td>' +
        '<td><strong>$' + totalPrice.toFixed(0) + '</strong></td>' +
        '</tr>' +
        '</tbody>' +
        '</table>';

    // Third-party costs note
    if (addOns && addOns.some(function(a) { return a.thirdParty; })) {
        html += '<p class="third-party-note-text"><span class="third-party-indicator">*</span> These features may incur additional third-party costs (e.g., Firebase, Stripe, hosting, domain) which are billed separately by the respective providers.</p>';
    }

    // View Industry Pricing button
    html += '<button type="button" class="view-industry-pricing-btn" onclick="window.contractFormHandler.showPricingComparisonModal()">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>' +
        'View Industry Pricing' +
        '</button>';

    html += '</section>';

    // PAYMENT STRUCTURE
    html += '<section class="contract-section-inner">' +
        '<h3>Payment Schedule</h3>' +
        '<table class="sow-payment-table">' +
        '<thead>' +
        '<tr>' +
        '<th>Payment Milestone</th>' +
        '<th>Description</th>' +
        '<th>Amount</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '<tr>' +
        '<td><strong>Initial Deposit</strong></td>' +
        '<td>Due before work begins (50%)</td>' +
        '<td><strong>$' + deposit.toFixed(0) + '</strong></td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>Milestone 1</strong></td>' +
        '<td>UI/UX Design Approval (25%)</td>' +
        '<td><strong>$' + milestone1.toFixed(0) + '</strong></td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>Final Payment</strong></td>' +
        '<td>Prior to deployment (25%)</td>' +
        '<td><strong>$' + finalPayment.toFixed(0) + '</strong></td>' +
        '</tr>' +
        '</tbody>' +
        '</table>' +
        '</section>';
    
    // TERMS
    html += '<section class="contract-section-inner">' +
        '<h3>Terms & Conditions</h3>' +
        '<p>This Statement of Work is subject to the terms outlined in the Website Development Agreement between Scarlo and <strong>' + sowData.clientName + '</strong>. All work will be performed using modern technologies including React, Next.js, Firebase, and associated development tools in accordance with industry best practices.</p>' +
        '<p>The project timeline is an estimate and may be adjusted based on client feedback, content delivery, and scope changes. Any requests beyond the defined scope require a signed Change Order.</p>' +
        '</section>' +

        // SIGNATURE BLOCK
        '<section class="contract-section-inner signatures">' +
        '<h3>Client Signature Required</h3>' +
        '<p>Please review the above Statement of Work carefully. By signing below, you acknowledge that you have read and agree to the scope, timeline, and payment terms outlined in this document.</p>' +

        '<div class="signature-block">' +
        '<h3>Client Signature — ' + sowData.clientName + '</h3>' +
        '<div class="form-row">' +
        '<div class="form-group">' +
        '<label>Full Name *</label>' +
        '<input type="text" id="sowClientName" value="' + sowData.clientName + '" required />' +
        '</div>' +
        '<div class="form-group">' +
        '<label>Date *</label>' +
        '<input type="date" id="sowClientDate" required />' +
        '</div>' +
        '</div>' +
        '<div class="signature-pad-container">' +
        '<canvas id="sowClientSignaturePad" class="signature-pad"></canvas>' +
        '<button class="clear-btn" data-canvas="sowClientSignaturePad">Clear</button>' +
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
        if (btnText) btnText.textContent = 'Next: Sign SOW →';
        if (dualBtn) {
            dualBtn.disabled = false;
            dualBtn.style.display = 'inline-flex';
        }
    } else if (tabName === 'sow') {
        // On SOW tab - show "Submit" button
        if (btnText) btnText.textContent = '✍️ Submit for Developer Signature';
        
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
            statusEl.textContent = '✓ Signed';
            statusEl.style.color = '#10b981';
        }
        if (dotEl) {
            dotEl.classList.add('completed');
        }
    } else {
        if (statusEl) {
            statusEl.textContent = '⏳ Pending';
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
            messageDiv.innerHTML = '<p><strong>✓ Your contract has been fully executed!</strong></p>' +
                '<p>Both you and the developer have signed the agreement.</p>' +
                '<p>Contract Date: ' + (data.clientDate || 'N/A') + '</p>' +
                '<p>Finalized: ' + (data.finalizedTimestamp ? new Date(data.finalizedTimestamp.toDate()).toLocaleDateString() : 'N/A') + '</p>';
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
            newSubmitBtn.innerHTML = '<span>📄 Download Signed Contract</span>';
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
            messageDiv.innerHTML = '<p><strong>⏳ Your agreement is pending developer signature</strong></p>' +
                '<p>You have already signed this agreement. The developer will review and sign it shortly.</p>' +
                '<p>You will be able to download the fully executed contract once both parties have signed.</p>';
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
        contractInfo.innerHTML = '<p style="margin: 0; color: #fff;"><strong>📋 Pending Contract from Client</strong></p>' +
            '<p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8);">Client: <strong>' + (data.clientName || 'N/A') + '</strong> | ' +
            'Submitted: <strong>' + (data.clientDate || 'N/A') + '</strong></p>';
        
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
                clientHeader.innerHTML = 'Client Signature — ' + (data.clientName || 'Client') + ' <span style="font-size: 12px; color: #10b981;">✓ Signed</span>';
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
                devHeader.innerHTML = 'Developer Signature — Scarlo <span style="font-size: 12px; color: #f59e0b;">⏳ Sign Below</span>';
            }
        }
        
        console.log('Form populated with contract data for developer review');
    };

    ContractFormHandler.prototype.handleClientSubmit = function() {
        console.log('Handling client submit...');

        // Validate that SOW is attached (required)
        if (!this.currentSOW) {
            alert('A Statement of Work (SOW) must be attached before signing the contract.');
            return;
        }

        // Client info comes from SOW (stored in hidden fields)
        var errors = [];

        // Validate client name from hidden field (populated from SOW)
        var clientName = $('#clientName');
        if (!clientName || !clientName.value.trim()) {
            errors.push('Client information is missing. Please ensure a SOW is attached.');
        }

        var acknowledgment = $('#acknowledgment');
        if (!acknowledgment || !acknowledgment.checked) {
            errors.push('Please acknowledge that you have read and agree to the terms');
        }

        var clientSignerName = $('#clientSignerName');
        if (!clientSignerName || !clientSignerName.value.trim()) {
            errors.push('Please enter your full name');
        }
        
        if (!this.clientSignaturePad || this.clientSignaturePad.isEmpty()) {
            errors.push('Your signature is required');
        }
        
        var clientDate = $('#clientDate');
        if (!clientDate || !clientDate.value) {
            errors.push('Signature date is required');
        }
        
        if (errors.length > 0) {
            alert('Please complete all required fields:\n\n' + errors.join('\n'));
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
            alert('A Statement of Work (SOW) must be attached before signing the contract.');
        }
    };

    ContractFormHandler.prototype.handleDeveloperSubmit = function() {
        console.log('Handling developer submit...');
        
        // Validate developer fields
        var errors = [];
        
        if (!this.devSignaturePad || this.devSignaturePad.isEmpty()) {
            errors.push('Developer signature is required');
        }
        
        var devDate = $('#devDate');
        if (!devDate || !devDate.value) {
            errors.push('Developer signature date is required');
        }
        
        if (!this.currentContract) {
            errors.push('No pending contract found to finalize');
        }
        
        if (errors.length > 0) {
            alert('Please complete all required fields:\n\n' + errors.join('\n'));
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
        alert('Please sign the contract first (Tab 1)');
        this.switchSigningTab('contract');
        return;
    }
    
    // Validate SOW fields
    var sowName = $('#sowClientName');
    var sowDate = $('#sowClientDate');
    
    if (!sowName || !sowName.value.trim()) {
        alert('Please enter your name on the SOW');
        return;
    }
    
    if (!sowDate || !sowDate.value) {
        alert('Please enter the signature date on the SOW');
        return;
    }
    
    // Validate SOW signature  
    if (!window.sowClientPad || window.sowClientPad.isEmpty()) {
        alert('Please sign the Statement of Work');
        return;
    }
    
    var submitBtn = $('#submitBothBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Submitting...</span>';
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
            alert('Error: ' + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>✍️ Submit for Developer Signature</span>';
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
    
    var html = '<div class="completion-header">' +
        '<div class="completion-icon">✅</div>' +
        '<h2>' + headerText + '</h2>' +
        '<p class="completion-note">' + headerNote + '</p>' +
        '</div>' +
        
        '<div class="completed-documents">' +
        
        // Contract Card with signature preview
        '<div class="completed-doc-card">' +
        '<div class="doc-card-header">' +
        '<h3>📄 Contract Agreement</h3>' +
        statusBadge +
        '</div>' +
        '<div class="doc-card-body">' +
        '<div class="doc-field-row"><span class="field-label">Client:</span><span class="field-value">' + (contractData.clientName || 'N/A') + '</span></div>' +
        '<div class="doc-field-row"><span class="field-label">Client Signed:</span><span class="field-value">' + (contractData.clientDate || 'N/A') + '</span></div>' +
        (isFullySigned ? '<div class="doc-field-row"><span class="field-label">Developer Signed:</span><span class="field-value">' + (contractData.devDate || 'N/A') + '</span></div>' : '') +
        '<div class="doc-field-row"><span class="field-label">' + (contractData.clientEmail ? 'Email:' : 'Phone:') + '</span><span class="field-value">' + (contractData.clientEmail || (contractData.clientPhone ? formatPhoneNumber(contractData.clientPhone) : 'N/A')) + '</span></div>' +
        '</div>' +
        '<div class="doc-signature-preview">' +
        '<p class="signature-label">Your Signature:</p>' +
'<img src="' + contractData.clientSignature + '" alt="Your signature" class="signature-image" style="width: 100%; max-width: 100%; height: auto; background: rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 0.5rem; border: 1px solid rgba(255, 255, 255, 0.1);" />' +
        '</div>';
    
    // Add download button ONLY if fully signed
    if (isFullySigned) {
        html += '<button class="btn btn-primary download-doc-btn" id="downloadContractBtn" style="width: 100%; margin-top: 1rem;">' +
            '<span>📄 Download Contract PDF</span>' +
            '</button>';
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

            html += '<div style="display: flex; gap: 0.75rem; margin-top: 1rem;">' +
                '<button type="button" class="sow-action-btn sow-download-btn" onclick="window.contractFormHandler.generateSOWPDF(window.' + sowDataId + ')">' +
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
                html += '<button type="button" id="changeRequestBtn-' + sowData.id + '" class="sow-action-btn" style="background: ' + btnStyle.bg + '; color: white; border: none;" onclick="window.contractFormHandler.viewChangeRequest(\'' + sowData.changeRequestId + '\')">' +
                    btnStyle.text +
                    '</button>';
            } else {
                html += '<button type="button" id="changeRequestBtn-' + sowData.id + '" class="sow-action-btn sow-change-btn" onclick="window.contractFormHandler.showChangeRequestModal(window.' + sowDataId + ')">' +
                    '📝 Request Change' +
                    '</button>';
            }

            html += '</div>';
        }

        html += '</div>'; // Close SOW card
    }
    
    html += '</div>'; // Close completed-documents
    
    // Action buttons
html += '<div class="completion-actions">';

// If both documents are fully signed, add a "Download Both" button
if (isFullySigned && sowData && sowData.devSignature && sowData.clientSignature) {
    html += '<button class="btn btn-primary" id="downloadBothBtn">' +
        '<span>📦 Download Both PDFs</span>' +
        '</button>';
}

html += '</div>';
    
    completedContainer.innerHTML = html;
    completedContainer.style.display = 'block';
    
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
    alert('✓ Success!\n\nBoth your Contract and Statement of Work have been submitted.\n\nThe developer will review and sign shortly.');
};
    ContractFormHandler.prototype.finalizeContract = function() {
        var self = this;
        var submitBtn = $('#submitBtn');
        var originalText = submitBtn ? submitBtn.innerHTML : '';
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Finalizing...</span>';
        }
        
        if (!this.currentContract) {
            alert('No pending contract found to finalize');
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
                alert('Error finalizing contract: ' + error.message + '\n\nPlease try again.');
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
            submitBtn.innerHTML = '<span>✓ Uploaded! Click to Download PDF</span>';
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
        
        alert('Contract uploaded successfully! Click the button to download the PDF.');
    };

    // ============================================================
    // CALIFORNIA LAW COMPLIANT CONTRACT PDF GENERATION
    // ============================================================
    ContractFormHandler.prototype.generatePDF = function() {
        var self = this;
        var contractData = this.currentContract ? this.currentContract.data : null;
        var contractId = this.currentContract ? this.currentContract.id : null;

        if (!contractData) {
            alert('No contract data available to generate PDF');
            return;
        }

        // Create a new window with the formatted contract
        var printWindow = window.open('', '_blank');

        if (!printWindow) {
            alert('Please allow popups to download the PDF');
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
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
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
        '@media screen and (max-width: 768px) { body { padding: 0.3in 0.25in; } .contract-container { max-width: 100%; } }' +
        '@media print { body { padding: 0.5in 0.75in; } .signature-page { page-break-before: always; } }' +
        '@page { margin: 0.75in 1in; size: letter; }' +
        '</style>' +
        '</head><body>' +
        '<div class="contract-container">' +

        // HEADER
        '<div class="header">' +
        '<img src="' + getLogoForPDF() + '" alt="Scarlo Logo" class="logo" />' +
        '<h1>Website Development Agreement</h1>' +
        '<div class="subtitle">Scarlo — Professional Web Development Services</div>' +
        '</div>' +

        // PARTIES
        '<div class="section">' +
        '<h2>1. Parties</h2>' +
        '<p>This Agreement is entered into as of <strong>' + clientDate + '</strong> between:</p>' +
        '<div class="parties">' +
        '<p><strong>Developer:</strong> Scarlo (Carlos Martin), Fresno County, California</p>' +
        (isBusinessEntity
            ? '<p><strong>Client:</strong> ' + businessName + ', a ' + entityType + (stateOfFormation ? ' formed in ' + stateOfFormation : '') + (clientEmail ? ' (' + clientEmail + ')' : '') + '</p>'
            : '<p><strong>Client:</strong> ' + clientName + (clientEmail ? ' (' + clientEmail + ')' : '') + '</p>') +
        '</div>' +
        '</div>' +

        // SCOPE & SOW
        '<div class="section">' +
        '<h2>2. Scope of Work</h2>' +
        '<p>Developer agrees to design, develop, and deliver a custom website as detailed in the attached Statement of Work (SOW). The SOW specifies all features, deliverables, timeline, and pricing. Only items in the approved SOW are included; additional requests require a written Change Order with revised pricing.</p>' +
        '</div>' +

        // PAYMENT
        '<div class="section">' +
        '<h2>3. Payment Terms</h2>' +
        '<p><strong>Payment Schedule:</strong></p>' +
        '<ul>' +
        '<li><strong>50% Deposit</strong> — Due before work begins</li>' +
        '<li><strong>25% Milestone</strong> — Due upon design approval</li>' +
        '<li><strong>25% Final</strong> — Due before deployment</li>' +
        '</ul>' +
        '<p><strong>Cancellation Policy:</strong> If Client cancels, Developer retains: 15% (before design), 35% (during design), or full deposit (after development starts). These amounts reflect Developer\'s actual estimated damages per California Civil Code §1671.</p>' +
        '<p><strong>Late Payments:</strong> Payments over 7 days late incur 1.5% monthly interest. Developer may pause work if payment is 14+ days overdue.</p>' +
        '</div>' +

        // IP
        '<div class="section">' +
        '<h2>4. Intellectual Property</h2>' +
        '<p><strong>Upon full payment, Client receives:</strong> The final website design, custom graphics, and production build.</p>' +
        '<p><strong>Developer retains:</strong> Source code, backend architecture, reusable components, and development tools. Client receives a license to use these as part of the delivered website.</p>' +
        '<p><strong>Important:</strong> No IP rights transfer until full payment is received.</p>' +
        '</div>' +

        // REVISIONS & CHANGES
        '<div class="section">' +
        '<h2>5. Revisions & Changes</h2>' +
        '<p>Client receives <strong>2 revision rounds per milestone</strong>. Additional revisions or scope changes require a Change Order. Client must provide materials and feedback within 5 business days of request; delays extend the timeline accordingly.</p>' +
        '</div>' +

        // WARRANTY & LIABILITY
        '<div class="section">' +
        '<h2>6. Warranty & Liability</h2>' +
        '<p><strong>Warranty:</strong> Developer warrants the website will function as specified for 30 days after delivery. This excludes issues from Client modifications, third-party service changes, or hosting problems.</p>' +
        '<div class="highlight-box">' +
        '<p class="caps-section"><strong>WARRANTY DISCLAIMER:</strong> EXCEPT FOR THE EXPRESS 30-DAY WARRANTY ABOVE, ALL DELIVERABLES ARE PROVIDED "AS IS" WITHOUT ANY IMPLIED WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.</p>' +
        '<p class="caps-section" style="margin-top: 10px;"><strong>LIMITATION OF LIABILITY:</strong> DEVELOPER\'S TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY CLIENT. DEVELOPER IS NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR LOST PROFIT DAMAGES, EVEN IF ADVISED OF THEIR POSSIBILITY.</p>' +
        '</div>' +
        '</div>' +

        // INDEMNIFICATION
        '<div class="section">' +
        '<h2>7. Indemnification</h2>' +
        '<p><strong>Client indemnifies Developer</strong> from any claims, damages, or expenses (including attorneys\' fees) arising from: (a) content or materials provided by Client; (b) Client\'s use of deliverables in violation of law; or (c) infringement claims caused by Client-provided materials.</p>' +
        '<p><strong>Developer indemnifies Client</strong> from IP infringement claims for Developer\'s original work (excluding Client content and third-party materials), limited to fees paid under this Agreement.</p>' +
        '</div>' +

        // TERMINATION
        '<div class="section">' +
        '<h2>8. Termination</h2>' +
        '<p><strong>By Client:</strong> 14 days written notice; cancellation policy applies.</p>' +
        '<p><strong>By Developer:</strong> May terminate if Client fails to provide materials for 15+ days, is unresponsive for 30+ days, or engages in abusive behavior.</p>' +
        '<p><strong>For Cause:</strong> Either party may terminate for material breach not cured within 15 days of notice.</p>' +
        '</div>' +

        // DISPUTE RESOLUTION
        '<div class="section">' +
        '<h2>9. Dispute Resolution</h2>' +
        '<p><strong>Process:</strong> Parties shall first negotiate in good faith for 30 days. If unresolved, disputes shall be submitted to mediation in Fresno County, California. If mediation fails, either party may pursue litigation in Fresno County courts.</p>' +
        '<p><strong>Attorneys\' Fees:</strong> The prevailing party in any dispute shall recover reasonable attorneys\' fees and costs from the other party.</p>' +
        '</div>' +

        // GENERAL TERMS
        '<div class="section">' +
        '<h2>10. General Terms</h2>' +
        '<p><strong>Governing Law:</strong> This Agreement is governed by California law.</p>' +
        '<p><strong>Force Majeure:</strong> Neither party is liable for delays caused by circumstances beyond reasonable control (natural disasters, pandemic, internet outages, acts of government).</p>' +
        '<p><strong>Assignment:</strong> Client may not assign this Agreement without Developer\'s written consent. Developer may assign to a successor upon notice.</p>' +
        '<p><strong>Severability:</strong> If any provision is unenforceable, it shall be modified to the minimum extent necessary; remaining provisions continue in effect.</p>' +
        '<p><strong>Confidentiality:</strong> Both parties agree to keep confidential information private for 3 years after termination.</p>' +
        '<p><strong>Independent Contractor:</strong> Developer is not an employee of Client.</p>' +
        '<p><strong>Entire Agreement:</strong> This Agreement and the attached SOW constitute the complete agreement. Amendments require written consent from both parties. Electronic signatures are valid.</p>' +
        '</div>' +

        // SIGNATURE PAGE
        '<div class="signature-page">' +
        '<h2 style="text-align: center; border: none; margin-bottom: 20px;">Agreement & Signatures</h2>' +
        '<p style="text-align: center; margin-bottom: 30px;">By signing below, both parties agree to the terms of this Agreement and the attached Statement of Work.</p>' +

        '<div style="display: flex; justify-content: space-between; margin-top: 30px;">' +

        '<div class="signature-block">' +
        '<h3 style="font-size: 10pt;">DEVELOPER: Scarlo</h3>' +
        '<div class="signature-line">' +
        (devSignature ? '<img src="' + devSignature + '" alt="Developer Signature" />' : '<span style="font-style: italic;">Awaiting Signature</span>') +
        '</div>' +
        '<div class="signature-label">Authorized Signature</div>' +
        '<div class="signature-name">' + devName + '</div>' +
        '<div class="signature-date">Date: ' + devDate + '</div>' +
        '<div class="signature-email">Email: ' + devEmail + '</div>' +
        '</div>' +

        '<div class="signature-block">' +
        '<h3 style="font-size: 10pt;">CLIENT: ' + (isBusinessEntity ? businessName : clientName) + '</h3>' +
        (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 5px;">' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</p>' : '') +
        '<div class="signature-line">' +
        (clientSignature ? '<img src="' + clientSignature + '" alt="Client Signature" />' : '<span style="font-style: italic;">Awaiting Signature</span>') +
        '</div>' +
        '<div class="signature-label">Authorized Signature</div>' +
        '<div class="signature-name">' + (isBusinessEntity ? 'By: ' + representativeName + ', ' + representativeTitle : clientSignerName) + '</div>' +
        '<div class="signature-date">Date: ' + clientDate + '</div>' +
        '<div class="signature-email">' + clientContactLabel + ': ' + clientContact + '</div>' +
        '</div>' +

        '</div>' +
        '</div>' +

        // FOOTER
        '<div class="footer">' +
        '<p><strong>© ' + new Date().getFullYear() + ' Scarlo — Carlos Martin</strong></p>' +
        '<p>Professional Web Development Services</p>' +
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
        alert('No contract data available');
        return;
    }
    
    if (!sowData) {
        alert('No SOW data available');
        return;
    }
    
    var printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        alert('Please allow popups to download the PDF');
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
        'essential': 'Essential — Landing Page',
        'starter': 'Tier 1 — Starter',
        'growth': 'Tier 2 — Growth',
        'professional': 'Tier 3 — Professional',
        'enterprise': 'Tier 4 — Enterprise',
        'custom': 'Custom Quote'
    };

    var packageDetails = {
        'essential': {
            includes: ['Single-page landing page (1-3 sections)', 'Cross-device optimization', 'Clean, modern React/Next.js design', 'Contact form with validation', 'Basic SEO setup', 'DNS & hosting configuration (client pays for domain)']
        },
        'starter': {
            includes: ['Multi-section React/Next.js website', 'Brand-matched design system', 'Scroll animations & micro-interactions', 'Multi-step contact forms', 'GA4 + custom event tracking', 'Full technical SEO', 'DNS & hosting configuration (client pays for domain)']
        },
        'growth': {
            includes: ['Everything in Starter', 'Firebase Authentication', 'Protected content areas', 'Form data capture & storage', 'Newsletter integration', '3 rounds of revisions', 'Domain, hosting & SSL included (first year)']
        },
        'professional': {
            includes: ['Everything in Growth', 'Full Firebase backend', 'User dashboard & profiles', 'File/media upload system', 'API integrations', 'Email notifications (SendGrid)', '2 months of maintenance included', 'Domain, hosting & SSL included (first year)']
        },
        'enterprise': {
            includes: ['Everything in Professional', 'Multi-page application', 'Role-based access control', 'In-app notifications', 'Admin dashboards', 'Documentation & training', '3 months of premium maintenance included', 'Domain, hosting & SSL included (first year)']
        }
    };
    
    var packageInfo = packageDetails[sowData.packageType] || { includes: [] };
    var totalPrice = sowData.payment ? sowData.payment.total : 0;
    var deposit = totalPrice * 0.50;
    var milestone1 = totalPrice * 0.25;
    var finalPayment = totalPrice * 0.25;
    
    var maintenanceDetails = {
        'none': { name: 'No Maintenance Plan', cost: '$0/month' },
        'basic': { name: 'Basic Care', cost: '$167/month', desc: 'Minor updates, security patches (2-3 hrs/month)' },
        'professional': { name: 'Professional Care', cost: '$335/month', desc: 'Regular updates, performance optimization (4-6 hrs/month)' },
        'premium': { name: 'Premium Care', cost: '$670/month', desc: 'Priority support, new components, SEO optimization (8-12 hrs/month)' }
    };
    
    var maintenanceInfo = maintenanceDetails[sowData.maintenancePlan || 'none'] || maintenanceDetails['none'];
    
    var htmlContent = '<!DOCTYPE html>' +
        '<html><head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
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
        '@media screen and (max-width: 768px) { body { padding: 0.3in 0.25in; } }' +
        '@media print { body { padding: 0.5in 0.75in; } .signature-page, .page-break { page-break-before: always; } }' +
        '@page { margin: 0.75in 1in; size: letter; }' +
        '</style>' +
        '</head><body>' +

        // ==================== CONTRACT SECTION ====================
        '<div class="header">' +
        '<img src="' + getLogoForPDF() + '" alt="Scarlo Logo" class="logo" />' +
        '<h1>Website Development Agreement</h1>' +
        '<div class="subtitle">Scarlo — Professional Web Development Services</div>' +
        '</div>' +

        '<div class="section">' +
        '<h2>PARTIES TO THE AGREEMENT</h2>' +
        '<p>This Website Development Agreement ("Agreement") is made effective as of <strong>' + clientDate + '</strong> (the "Effective Date") and is entered into by and between:</p>' +
        '<div class="parties">' +
        '<p><strong>Scarlo</strong>, a sole proprietorship owned and operated by Carlos Martin (the "Developer"),</p>' +
        '<p>and</p>' +
        (isBusinessEntity
            ? '<p><strong>' + businessName + '</strong>, a ' + entityType + (stateOfFormation ? ' formed in ' + stateOfFormation : '') + ' (the "Client")</p>'
            : '<p><strong>' + clientName + '</strong> (the "Client")</p>') +
        '<p style="font-size: 10pt; font-style: italic; margin-top: 10px;">The Developer and Client may be referred to individually as a "Party" and collectively as the "Parties."</p>' +
        '</div>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>1. PROJECT SCOPE</h2>' +
        '<h3>1.1 Overview</h3>' +
        '<p>Developer agrees to design, build, and deliver a custom website or web application using modern technologies, which may include but are not limited to: Visual Studio Code, React, Next.js, Firebase, Vite, REST/Graph APIs, and associated development tools.</p>' +
        '<h3>1.2 Statement of Work (SOW)</h3>' +
        '<p>All features, functionalities, pages, integrations, and deliverables will be detailed in a separate Proposal or Statement of Work ("SOW") prepared by Developer and approved by Client.</p>' +
        '<h3>1.3 Scope Limitations</h3>' +
        '<p>Only items expressly included in the SOW form part of the Project Scope. Any request beyond that scope—whether new features, design changes, additional pages, or system enhancements—requires an approved Change Order (Section 10).</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>2. PACKAGES & PRICING</h2>' +
        '<p>Developer offers multiple service tiers, including Starter, Professional, Premium, and Elite website/application packages. The applicable pricing, deliverables, and package level for this Agreement will be specified in the attached SOW, which forms an integral part of this Agreement.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>3. PAYMENT TERMS</h2>' +
        '<p>Unless otherwise specified in the SOW:</p>' +
        '<h3>3.1 Deposit</h3>' +
        '<p>A non-refundable deposit of 50% is required before any work begins, unless the Developer chooses to accept a different amount at their discretion.</p>' +
        '<h3>3.2 Milestone Payments</h3>' +
        '<p>If no custom timetable is specified in the SOW, the standard schedule is:</p>' +
        '<ul>' +
        '<li>25% due upon UI/UX design approval</li>' +
        '<li>25% due at final delivery or prior to deployment, whichever the Developer determines is appropriate</li>' +
        '</ul>' +
        '<h3>3.3 Late Payments</h3>' +
        '<p>Payments not received within 7 days of the due date may, at the Developer\'s discretion, incur a monthly late fee of up to 5%. The Developer may also pause or delay work until any outstanding balance is paid.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>4. CLIENT RESPONSIBILITIES</h2>' +
        '<p>Client agrees to provide all necessary materials—including copy, images, brand assets, credentials, and requested information—within 5 business days of Developer\'s request.</p>' +
        '<p>Any delays in providing required materials will directly extend the project timeline. Developer is not responsible for delays caused by the Client.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>5. REVISIONS</h2>' +
        '<p>Unless otherwise stated in the SOW:</p>' +
        '<ul>' +
        '<li>Client receives up to two (2) rounds of revisions per milestone</li>' +
        '<li>Additional revisions or redesigns require a Change Order and may incur additional charges</li>' +
        '</ul>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>6. INTELLECTUAL PROPERTY RIGHTS</h2>' +
        '<h3>6.1 Developer Ownership</h3>' +
        '<p>Developer retains full ownership of all proprietary materials, including source code, backend logic and architecture, custom components, scripts, and utilities, and Developer\'s internal systems, tools, libraries, and workflows.</p>' +
        '<h3>6.2 Client Ownership</h3>' +
        '<p>Upon full payment, Client gains ownership of the final website design, all content supplied by Client (text, images, media), and the compiled, minified production build of the project.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>7. MAINTENANCE & SUPPORT</h2>' +
        '<p>Maintenance plans (Basic, Professional, Premium) may be purchased separately and will be defined in the SOW. Maintenance plans do not include new pages or sections, new features or functionalities, major redesigns, third-party outages, policy changes from platforms, or fixes related to Client misuse.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>8. TIMELINE & DELIVERY</h2>' +
        '<p>Developer will provide an estimated project timeline. Client acknowledges these timelines are estimates, not guarantees. Any Client-caused delay automatically extends the project schedule.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>9. CHANGE ORDERS</h2>' +
        '<p>Any request modifying the Project Scope—including added features, redesigns, advanced animations, dashboards, APIs, or system logic—requires a signed Change Order that includes revised pricing and timelines.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>10. WARRANTY & LIMITATIONS</h2>' +
        '<h3>10.1 Developer Warranty</h3>' +
        '<p>Developer warrants that the delivered website will function substantially as described in the SOW for 30 days after deployment.</p>' +
        '<h3>10.2 Exclusions</h3>' +
        '<p>This warranty does not apply to issues caused by Client-modified code, third-party service changes, library updates, hosting issues, improper access, or security breaches caused by Client.</p>' +
        '<h3>10.3 Liability Limitations</h3>' +
        '<p>Developer\'s total liability under this Agreement is limited to the total amount paid by Client.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>11. CONFIDENTIALITY</h2>' +
        '<p>Both Parties agree to maintain the confidentiality of all proprietary or sensitive information exchanged during the course of this project.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>12. INDEMNIFICATION</h2>' +
        '<p>Client agrees to indemnify and hold Developer harmless from any claims arising out of content supplied by Client, misuse of the website, unauthorized access, or business decisions made using data produced by the website.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>13. TERMINATION</h2>' +
        '<p>Either Party may terminate this Agreement with 7 days written notice. If Client terminates early, all deposits are forfeited, all completed work must be paid for immediately, and Developer retains all rights to unfinished work.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>14. GOVERNING LAW</h2>' +
        '<p>This Agreement shall be governed by and construed in accordance with the laws of the State of California without regard to conflict-of-law principles.</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>15. ENTIRE AGREEMENT</h2>' +
        '<p>This Agreement, together with all attached SOWs, proposals, and addenda, constitutes the entire and complete agreement between the Parties and supersedes all prior discussions, negotiations, or understandings.</p>' +
        '</div>' +
        
        // Contract Signatures
        '<div class="signature-page">' +
        '<h2 style="text-align: center; border: none;">CONTRACT SIGNATURES</h2>' +
        '<p style="text-align: center; margin-bottom: 30px;">By signing below, both parties acknowledge that they have read, understood, and agree to all terms and conditions outlined in this Agreement.</p>' +
        
        '<div style="display: flex; justify-content: space-between; margin-top: 40px;">' +
        
        '<div class="signature-block">' +
        '<h3>Developer — Scarlo</h3>' +
        '<div class="signature-line">' +
        (devSignature ? '<img src="' + devSignature + '" alt="Developer Signature" />' : '<span style="font-style: italic;">Pending</span>') +
        '</div>' +
        '<div class="signature-label">Signature</div>' +
        '<div class="signature-name">' + devName + '</div>' +
        '<div class="signature-date">Date: ' + devDate + '</div>' +
        '<div class="signature-email">' + devEmail + '</div>' +
        '</div>' +
        
        '<div class="signature-block">' +
        '<h3>Client — ' + (isBusinessEntity ? businessName : clientName) + '</h3>' +
        (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 5px;">' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</p>' : '') +
        '<div class="signature-line">' +
        (clientSignature ? '<img src="' + clientSignature + '" alt="Client Signature" />' : '<span style="font-style: italic;">Pending</span>') +
        '</div>' +
        '<div class="signature-label">Signature</div>' +
        '<div class="signature-name">' + (isBusinessEntity ? 'By: ' + representativeName + ', ' + representativeTitle : clientSignerName) + '</div>' +
        '<div class="signature-date">Date: ' + clientDate + '</div>' +
        '<div class="signature-email">' + clientContactLabel + ': ' + clientContact + '</div>' +
        '</div>' +

        '</div>' +
        '</div>' +

        // ==================== SOW SECTION (NEW PAGE) ====================
        '<div class="page-break"></div>' +

        '<div class="header">' +
        '<img src="' + getLogoForPDF() + '" alt="Scarlo Logo" class="logo" />' +
        '<h1>STATEMENT OF WORK</h1>' +
        '<div class="subtitle">Scarlo — Professional Web Development</div>' +
        '<div style="font-size: 10pt; font-style: italic; margin-top: 10px;">Generated: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div>' +
        '</div>' +
        
        '<div class="info-box">' +
        '<h3>Client Information</h3>' +
        (isBusinessEntity
            ? '<p><strong>Business Name:</strong> ' + businessName + '</p>' +
              '<p><strong>Entity Type:</strong> ' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</p>' +
              '<p><strong>Representative:</strong> ' + representativeName + ', ' + representativeTitle + '</p>'
            : '<p><strong>Client Name:</strong> ' + (sowData.clientName || clientName) + '</p>') +
        '<p><strong>Contact:</strong> ' + (sowData.clientEmail || sowData.clientPhone || clientEmail || 'N/A') + '</p>' +
        '<p><strong>Package:</strong> ' + (packageNames[sowData.packageType] || sowData.packageType) + ' <span class="highlight">$' + totalPrice.toFixed(0) + '</span></p>' +
        '<p><strong>Estimated Timeline:</strong> ' + (sowData.estimatedWeeks || 'TBD') + ' weeks' + (sowData.startDate ? ' (Starting ' + new Date(sowData.startDate).toLocaleDateString() + ')' : '') + '</p>' +
        '</div>' +
        
        '<div class="section">' +
        '<h2>Package Includes</h2>' +
        '<ul>';
    
    if (packageInfo.includes && packageInfo.includes.length > 0) {
        packageInfo.includes.forEach(function(item) {
            htmlContent += '<li>' + item + '</li>';
        });
    }
    
    htmlContent += '</ul></div>';
    
    // Additional Features
    if (sowData.features && sowData.features.length > 0) {
        htmlContent += '<div class="section">' +
            '<h2>Additional Features & Deliverables</h2>' +
            '<ul>';
        sowData.features.forEach(function(feature) {
            htmlContent += '<li>' + feature + '</li>';
        });
        htmlContent += '</ul></div>';
    }
    
    // Special Requirements
    if (sowData.notes) {
        htmlContent += '<div class="section">' +
            '<h2>Special Requirements</h2>' +
            '<p>' + sowData.notes + '</p>' +
            '</div>';
    }
    
    // Payment Structure
    htmlContent += '<div class="section">' +
        '<h2>Payment Structure</h2>' +
        '<table class="payment-table">' +
        '<thead><tr><th>Payment Milestone</th><th>Description</th><th>Amount</th></tr></thead>' +
        '<tbody>' +
        '<tr><td><strong>Initial Deposit</strong></td><td>Due before work begins (50%)</td><td><strong>$' + deposit.toFixed(0) + '</strong></td></tr>' +
        '<tr><td><strong>Milestone 1</strong></td><td>UI/UX Design Approval (25%)</td><td><strong>$' + milestone1.toFixed(0) + '</strong></td></tr>' +
        '<tr><td><strong>Final Payment</strong></td><td>Prior to deployment (25%)</td><td><strong>$' + finalPayment.toFixed(0) + '</strong></td></tr>' +
        '<tr class="total-row"><td colspan="2">Total Project Cost</td><td>$' + totalPrice.toFixed(0) + '</td></tr>' +
        '</tbody></table>' +
        '</div>';
    
    // Maintenance
    if (sowData.maintenancePlan === 'none') {
        htmlContent += '<div class="section">' +
            '<h2>Ongoing Maintenance</h2>' +
            '<div class="info-box" style="background: #fff3cd; border-color: #856404;">' +
            '<h3 style="color: #856404;">No Maintenance Plan — $0/month</h3>' +
            '<p style="color: #856404;"><strong>⚠️ IMPORTANT:</strong> Developer will NOT provide any ongoing maintenance, updates, security patches, bug fixes, or technical support after the post-launch period ends. Client is solely responsible for website maintenance.</p>' +
            '</div>' +
            '</div>';
    } else if (sowData.maintenancePlan) {
        htmlContent += '<div class="section">' +
            '<h2>Ongoing Maintenance</h2>' +
            '<div class="info-box">' +
            '<h3>' + maintenanceInfo.name + ' — ' + maintenanceInfo.cost + '</h3>' +
            '<p>' + (maintenanceInfo.desc || '') + '</p>' +
            '</div>' +
            '</div>';
    }
    
    // Terms
    htmlContent += '<div class="section">' +
        '<h2>Terms & Conditions</h2>' +
        '<p>This Statement of Work is subject to the terms outlined in the Website Development Agreement between Scarlo and <strong>' + clientName + '</strong>. All work will be performed using modern technologies including React, Next.js, Firebase, and associated development tools in accordance with industry best practices.</p>' +
        '<p>The project timeline is an estimate and may be adjusted based on client feedback, content delivery, and scope changes. Any requests beyond the defined scope require a signed Change Order.</p>' +
        '</div>';
    
    // SOW Signatures
    htmlContent += '<div class="signature-page">' +
        '<h2 style="text-align: center; border: none;">SOW SIGNATURES</h2>' +
        '<p style="text-align: center; margin-bottom: 30px;">By signing below, both parties acknowledge agreement to the scope, timeline, and payment terms outlined in this Statement of Work.</p>' +
        
        '<div style="display: flex; justify-content: space-between; margin-top: 40px;">' +
        
        '<div class="signature-block">' +
        '<h3>Developer — Scarlo</h3>' +
        '<div class="signature-line">' +
        (sowData.devSignature ? '<img src="' + sowData.devSignature + '" alt="Developer Signature" />' : '<span style="font-style: italic;">Pending</span>') +
        '</div>' +
        '<div class="signature-label">Signature</div>' +
        '<div class="signature-name">' + (sowData.devSignerName || 'Carlos Martin') + '</div>' +
        '<div class="signature-date">Date: ' + (sowData.devSignedDate || 'N/A') + '</div>' +
        '</div>' +
        
        '<div class="signature-block">' +
        '<h3>Client — ' + (isBusinessEntity ? businessName : clientName) + '</h3>' +
        (isBusinessEntity ? '<p style="font-size: 9pt; margin-bottom: 5px;">' + entityType + (stateOfFormation ? ' (' + stateOfFormation + ')' : '') + '</p>' : '') +
        '<div class="signature-line">' +
        (sowData.clientSignature ? '<img src="' + sowData.clientSignature + '" alt="Client Signature" />' : '<span style="font-style: italic;">Pending</span>') +
        '</div>' +
        '<div class="signature-label">Signature</div>' +
        '<div class="signature-name">' + (isBusinessEntity ? 'By: ' + representativeName + ', ' + representativeTitle : (sowData.clientSignerName || clientName)) + '</div>' +
        '<div class="signature-date">Date: ' + (sowData.clientSignedDate || 'N/A') + '</div>' +
        '</div>' +

        '</div>' +
        '</div>' +

        // Footer
        '<div class="footer">' +
        '<p><strong>© ' + new Date().getFullYear() + ' Scarlo</strong> — Crafted with precision</p>' +
        '<p style="margin-top: 8px;">Carlos Martin | Professional Web Development</p>' +
        '<p class="contract-id">Contract ID: ' + (self.currentContract ? self.currentContract.id : 'N/A') + ' | SOW ID: ' + sowData.id + '</p>' +
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

    // Sync navbar ambient animations
    var logoAmbient = $('.navbar-logo-ambient');
    var textAmbient = $('.navbar-text-ambient');
    if (logoAmbient && textAmbient) {
        logoAmbient.style.animation = 'none';
        textAmbient.style.animation = 'none';
        // Force reflow
        logoAmbient.offsetHeight;
        textAmbient.offsetHeight;
        // Restart animations together
        logoAmbient.style.animation = 'navbarAmbientPulse 3s ease-in-out infinite';
        textAmbient.style.animation = 'navbarAmbientPulse 3s ease-in-out infinite';
    }

    new HelpRequestHandler();

    new Navigation();
    new RotatingText();
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
