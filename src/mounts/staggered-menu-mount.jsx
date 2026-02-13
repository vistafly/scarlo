import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import StaggeredMenu from '../components/StaggeredMenu.jsx';

// Translation keys for menu items
const menuItemDefs = [
  { i18nKey: 'nav.home', fallback: 'Home', ariaLabel: 'Go to home section', link: '#home' },
  { i18nKey: 'nav.services', fallback: 'Services', ariaLabel: 'View our services', link: '#philosophy' },
  { i18nKey: 'nav.portfolio', fallback: 'Portfolio', ariaLabel: 'See our work', link: '#portfolio' },
  { i18nKey: 'nav.agreement', fallback: 'Agreement', ariaLabel: 'View development agreement', link: '#contract' },
  { i18nKey: 'nav.connect', fallback: 'Connect', ariaLabel: 'Get in touch', link: '#contact' }
];

// Helper to get translated label using the global t() function
const translate = (key, fallback) => {
  if (typeof window.t === 'function') {
    const result = window.t(key);
    return (result && result !== key) ? result : fallback;
  }
  return fallback;
};

const getLang = () => {
  if (typeof window.getCurrentLang === 'function') return window.getCurrentLang();
  return localStorage.getItem('scarlo-lang') || 'en';
};

// Build translated menu items
const getMenuItems = () => menuItemDefs.map(def => ({
  label: translate(def.i18nKey, def.fallback),
  ariaLabel: def.ariaLabel,
  link: def.link
}));

// LinkedIn SVG Icon Component
const LinkedInIcon = () => (
  <svg
    className="sm-social-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// Social links with LinkedIn icons
const socialItems = [
  {
    label: 'Personal',
    link: 'https://www.linkedin.com/in/carlos-martin-050876314/',
    icon: <LinkedInIcon />
  },
  {
    label: 'Scarlo',
    link: 'https://www.linkedin.com/company/110879775/',
    icon: <LinkedInIcon />
  }
];

// Handle smooth scroll navigation
const handleItemClick = (item, e) => {
  e.preventDefault();

  const targetId = item.link;
  if (!targetId || targetId === '#') return;

  const target = document.querySelector(targetId);
  if (target) {
    const navbar = document.querySelector('.navbar');
    const navHeight = navbar ? navbar.offsetHeight : 0;
    const targetPosition = target.offsetTop - navHeight;

    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });
  }
};

// Handle menu open/close callbacks
const handleMenuOpen = () => {
  console.log('Staggered menu opened');
  document.body.classList.add('staggered-menu-open');
};

const handleMenuClose = () => {
  console.log('Staggered menu closed');
  document.body.classList.remove('staggered-menu-open');
};

// Language Toggle Component for inside the menu
const MenuLanguageToggle = ({ lang, onSwitch }) => {
  return (
    <div className="sm-lang-toggle" role="radiogroup" aria-label="Language">
      <button
        className={`sm-lang-btn${lang === 'en' ? ' active' : ''}`}
        onClick={() => onSwitch('en')}
        aria-checked={lang === 'en'}
        role="radio"
        type="button"
      >
        EN
      </button>
      <span className="sm-lang-divider">|</span>
      <button
        className={`sm-lang-btn${lang === 'es' ? ' active' : ''}`}
        onClick={() => onSwitch('es')}
        aria-checked={lang === 'es'}
        role="radio"
        type="button"
      >
        ES
      </button>
    </div>
  );
};

// Wrapper component that handles language state and re-renders
const StaggeredMenuApp = () => {
  const [lang, setLangState] = useState(getLang);

  const handleLangSwitch = useCallback((newLang) => {
    // Update global state
    if (typeof window.setLang === 'function') window.setLang(newLang);
    setLangState(newLang);

    // Sync the navbar toggle buttons
    const navbarToggle = document.getElementById('langToggle');
    if (navbarToggle) {
      navbarToggle.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === newLang);
      });
    }

    // Apply translations to the rest of the page using the Navigation prototype
    if (typeof window.t === 'function') {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = window.t(key);
        if (translated && translated !== key) {
          if (el.classList.contains('rotating-text')) return;
          el.textContent = translated;
        }
      });
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const translated = window.t(key);
        if (translated && translated !== key) el.innerHTML = translated;
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = window.t(key);
        if (translated && translated !== key) el.placeholder = translated;
      });
      // Auth button
      const authText = document.getElementById('authStatusText');
      if (authText) {
        const isLoggedIn = authText.textContent === 'Sign Out' || authText.textContent === 'Cerrar Sesión';
        authText.textContent = isLoggedIn ? window.t('nav.signOut') : window.t('nav.signIn');
      }
      // Rotating text
      if (window.rotatingText && window.rotatingText.switchLanguage) {
        window.rotatingText.switchLanguage();
      }
    }
  }, []);

  // Listen for language changes from the navbar toggle
  useEffect(() => {
    const navbarToggle = document.getElementById('langToggle');
    if (!navbarToggle) return;

    const handler = (e) => {
      const btn = e.target.closest('.lang-btn');
      if (!btn) return;
      const newLang = btn.getAttribute('data-lang');
      if (newLang) setLangState(newLang);
    };

    navbarToggle.addEventListener('click', handler);
    return () => navbarToggle.removeEventListener('click', handler);
  }, []);

  const menuItems = getMenuItems();

  return (
    <StaggeredMenu
      position="right"
      items={menuItems}
      socialItems={socialItems}
      displaySocials={true}
      displayItemNumbering={true}
      menuButtonColor="#fff"
      openMenuButtonColor="#fff"
      changeMenuColorOnOpen={true}
      colors={['#0a0a12', '#12121a', '#1a1a24']}
      accentColor="rgba(255, 255, 255, 0.9)"
      onMenuOpen={handleMenuOpen}
      onMenuClose={handleMenuClose}
      onItemClick={handleItemClick}
      languageToggle={<MenuLanguageToggle lang={lang} onSwitch={handleLangSwitch} />}
    />
  );
};

// Mount the component
const mountPoint = document.getElementById('staggered-menu-root');

if (mountPoint) {
  const root = ReactDOM.createRoot(mountPoint);
  root.render(
    <React.StrictMode>
      <StaggeredMenuApp />
    </React.StrictMode>
  );
} else {
  console.error('StaggeredMenu mount point not found: #staggered-menu-root');
}
