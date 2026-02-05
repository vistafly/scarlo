import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Carousel from './Carousel';
import './PhilosophyCarousel.css';

// ============================================
// CINEMATIC ZOOM CONFIGURATION
// ============================================
const ZOOM_DURATION = 20;
const ZOOM_START_SCALE = 1;
const ZOOM_END_SCALE = 1.26;
const ZOOM_EASING = [0.19, 1, 0.22, 1];
// ============================================

// ============================================
// RESPONSIVE WIDTH CALCULATION
// ============================================
const getResponsiveWidth = () => {
  const width = window.innerWidth;
  const zoomFactor = ZOOM_END_SCALE; // Account for the zoom
  
  if (width >= 1024) return 500;                      // Desktop
  if (width >= 768) return (width * 0.65) / zoomFactor; // Tablet landscape
  if (width >= 540) return (width * 0.75) / zoomFactor; // Tablet portrait
  if (width >= 430) return (width * 0.85) / zoomFactor; // Large mobile
  return (width * 0.90) / zoomFactor;                   // Small mobile
};
// ============================================

const PHILOSOPHY_ITEMS = [
  {
    title: 'Fixed Scope, No Surprises',
    description: 'Everything defined upfront in a clear SOW. No hidden fees, no unexpected charges.',
    id: 1,
    icon: (
      <svg className="carousel-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    )
  },
  {
    title: 'Built on Modern Tech',
    description: 'React, Next.js, Firebase—enterprise-level tools that keep your site fast and reliable.',
    id: 2,
    icon: (
      <svg className="carousel-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
      </svg>
    )
  },
  {
    title: 'Pay as We Build',
    description: 'Milestone-based payments. You only pay for completed work—design approval, then delivery.',
    id: 3,
    icon: (
      <svg className="carousel-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    )
  },
  {
    title: '30-Day Launch Warranty',
    description: 'Your site will work as promised. Guaranteed functionality for 30 days post-deployment.',
    id: 4,
    icon: (
      <svg className="carousel-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    )
  },
  {
    title: 'Ongoing Support Available',
    description: 'Launch is just the beginning. Maintenance plans keep your site running smoothly as you grow.',
    id: 5,
    icon: (
      <svg className="carousel-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
      </svg>
    )
  }
];

export default function PhilosophyCarousel() {
  const [carouselWidth, setCarouselWidth] = useState(getResponsiveWidth());

  useEffect(() => {
    const handleResize = () => {
      setCarouselWidth(getResponsiveWidth());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <motion.div
      initial={{ 
        scale: ZOOM_START_SCALE
      }}
      whileInView={{ 
        scale: ZOOM_END_SCALE
      }}
      transition={{
        duration: ZOOM_DURATION,
        ease: ZOOM_EASING,
        delay: 0.3
      }}
      viewport={{ 
        once: true, 
        amount: 0.2 
      }}
    >
      <Carousel
        items={PHILOSOPHY_ITEMS}
        baseWidth={carouselWidth}
        autoplay={true}
        autoplayDelay={4000}
        pauseOnHover={true}
        loop={true}
        round={false}
      />
    </motion.div>
  );
}