import React from 'react';
import { createRoot } from 'react-dom/client';
import PhilosophyCarousel from '../components/PhilosophyCarousel';

const mountPhilosophyCarousel = () => {
  const rootElement = document.getElementById('philosophy-carousel-root');
  
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<PhilosophyCarousel />);
    console.log('✓ Philosophy Carousel mounted successfully');
  } else {
    console.error('✗ Philosophy carousel root element not found');
  }
};

// Mount when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPhilosophyCarousel);
} else {
  mountPhilosophyCarousel();
}