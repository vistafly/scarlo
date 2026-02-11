import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import DomeGallery from '../components/DomeGallery.jsx';

// Get the base URL from Vite config
const BASE_URL = import.meta.env.BASE_URL;

// Portfolio projects
const portfolioProjects = [
  {
    preview: `${BASE_URL}images/logo.png`,
    url: 'https://vistafly.services/',
    alt: 'VistaFly Services - FPV drone videography',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo1.png`,
    url: 'https://vistafly.github.io/CSAnew/',
    alt: 'CSA Entertainment - Sports & Music Programs',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo2.png`,
    url: 'https://themorenosband.com/',
    alt: 'The Morenos Band - Official Music Website',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo3.png`,
    url: 'https://cultivanetwork.com/',
    alt: 'CultivaNetwork - Agricultural Platform',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo5.png`,
    url: 'https://vistafly.github.io/thebox/',
    alt: 'The Box - Creative Digital Project',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo6.png`,
    url: 'https://vistafly.github.io/landscapingcultura/',
    alt: 'Landscaping Cultura - Professional Landscaping',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo7.png`,
    url: 'https://vistafly.github.io/sproutscloth/',
    alt: 'Sprouts Clothing - Sustainable Fashion',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo8.png`,
    url: 'https://agstounding.com/',
    alt: 'Agstounding - Professional Services',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo9.png`,
    url: 'https://eltacochingonllc.vercel.app/',
    alt: 'El Taco Chingon - Authentic Mexican Street Food in Fresno, CA',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo10.png`,
    url: 'https://handyman-sam.vercel.app/',
    alt: 'Handyman Sam - Professional Handyman Services in Fresno, CA',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo11.png`,
    url: 'https://vistafly.github.io/vistafly-studyguide/',
    alt: 'VistaFly Academy - Drone Pilot Training Portal',
    type: 'iframe'
  },
  {
    preview: `${BASE_URL}images/logo12.png`,
    url: 'https://vistafly.github.io/Part-107studyguide/',
    alt: 'Part 107 Study Guide - FAA Drone Certification Prep',
    type: 'iframe'
  },
];

// Responsive wrapper with full parameter control per device type
function ResponsiveDomeGallery() {
  const [config, setConfig] = useState({
    minRadius: 1100,
    maxRadius: 1300,
    fit: 1,
    maxVerticalRotationDeg: 2,
    dragSensitivity: 18,
    segments: 30,
    openedImageWidth: "70vw",
    openedImageHeight: "70vh",
    imageBorderRadius: "40px",
    openedImageBorderRadius: "20px"
  });

  useEffect(() => {
    const updateConfig = () => {
      const width = window.innerWidth;
      
      if (width <= 430) {
        // Mobile phones - optimized for small screens
        setConfig({
          minRadius: 500,
          maxRadius: 650,
          fit: 0.9,
          maxVerticalRotationDeg: 1.5,
          dragSensitivity: 16, // Lower for more responsive swipe
          segments: 20,
          openedImageWidth: "85vw",
          openedImageHeight: "78vh",
          imageBorderRadius: "20px",
          openedImageBorderRadius: "12px"
        });
      } else if (width <= 768) {
        // Tablets (portrait) - medium settings
        setConfig({
          minRadius: 700,
          maxRadius: 700,
          fit: 0.95,
          maxVerticalRotationDeg: 1.8,
          dragSensitivity: 17, // Slightly lower for smoother tablet swipe
          segments: 25,
          openedImageWidth: "90vw",
          openedImageHeight: "80vh",
          imageBorderRadius: "30px",
          openedImageBorderRadius: "15px"
        });
      } else if (width <= 1024) {
        // Tablets (landscape) / Small laptops
        setConfig({
          minRadius: 1000,
          maxRadius: 1200,
          fit: 0.98,
          maxVerticalRotationDeg: 2,
          dragSensitivity: 19,
          segments: 28,
          openedImageWidth: "90vw",
          openedImageHeight: "80vh",
          imageBorderRadius: "35px",
          openedImageBorderRadius: "18px"
        });
      } else {
        // Desktop / Large laptops - your perfect settings
        setConfig({
          minRadius: 1000,
          maxRadius: 1200,
          fit: 1,
          maxVerticalRotationDeg: 2,
          dragSensitivity: 18,
          segments: 30,
          openedImageWidth: "85vw",
          openedImageHeight: "80vh",
          imageBorderRadius: "40px",
          openedImageBorderRadius: "20px"
        });
      }
    };

    updateConfig();
    window.addEventListener('resize', updateConfig);
    return () => window.removeEventListener('resize', updateConfig);
  }, []);

  return (
    <DomeGallery
      images={portfolioProjects}
      minRadius={config.minRadius}
      maxRadius={config.maxRadius}
      fit={config.fit}
      maxVerticalRotationDeg={config.maxVerticalRotationDeg}
      dragSensitivity={config.dragSensitivity}
      segments={config.segments}
      openedImageWidth={config.openedImageWidth}
      openedImageHeight={config.openedImageHeight}
      imageBorderRadius={config.imageBorderRadius}
      openedImageBorderRadius={config.openedImageBorderRadius}
      overlayBlurColor="#0a0a0a"
      grayscale={false}
    />
  );
}
const root = ReactDOM.createRoot(document.getElementById('portfolio-dome-root'));
root.render(
  <React.StrictMode>
    <ResponsiveDomeGallery />
  </React.StrictMode>
);