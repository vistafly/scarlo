import React from 'react';
import ReactDOM from 'react-dom/client';
import StaggeredMenu from '../components/StaggeredMenu.jsx';

// Menu items matching your existing navigation
const menuItems = [
  { label: 'Home', ariaLabel: 'Go to home section', link: '#home' },
  { label: 'Services', ariaLabel: 'View our services', link: '#philosophy' },
  { label: 'Portfolio', ariaLabel: 'See our work', link: '#portfolio' },
  { label: 'Agreement', ariaLabel: 'View development agreement', link: '#contract' },
  { label: 'Connect', ariaLabel: 'Get in touch', link: '#contact' }
];

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
  // Add class to body for any global styling needs
  document.body.classList.add('staggered-menu-open');
};

const handleMenuClose = () => {
  console.log('Staggered menu closed');
  document.body.classList.remove('staggered-menu-open');
};

// Mount the component
const mountPoint = document.getElementById('staggered-menu-root');

if (mountPoint) {
  const root = ReactDOM.createRoot(mountPoint);
  root.render(
    <React.StrictMode>
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
      />
    </React.StrictMode>
  );
} else {
  console.error('StaggeredMenu mount point not found: #staggered-menu-root');
}