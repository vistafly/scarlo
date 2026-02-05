import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import Threads from '../components/Threads';

function HeroThreadsBackground() {
  const mousePositionRef = useRef({ x: 0.5, y: 0.5 });
  const heroSectionRef = useRef(null);
  const lastTouchTime = useRef(0);
  const touchVelocity = useRef({ x: 0, y: 0 });
  const isMouseInSection = useRef(false);
  const lastKnownPosition = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const heroSection = document.getElementById('home');
    heroSectionRef.current = heroSection;

    if (!heroSection) return;

    // CRITICAL: Check if mouse is already in the hero section on mount
    // This ensures interaction works immediately on page load
    if (window.mouseTracker) {
      const rect = heroSection.getBoundingClientRect();
      const mouseX = window.mouseTracker.position.x;
      const mouseY = window.mouseTracker.position.y;

      // If mouse is already in the hero section, mark it and get position
      if (mouseX >= rect.left && mouseX <= rect.right &&
          mouseY >= rect.top && mouseY <= rect.bottom) {
        isMouseInSection.current = true;
        // Initialize with current mouse position immediately
        const normalized = window.mouseTracker.getNormalizedPosition(heroSection);
        mousePositionRef.current = normalized;
        lastKnownPosition.current = normalized;
        console.log('🎯 Hero Threads: Mouse detected in section on load', normalized);
      }
    }

    // Handle mouse enter - smooth transition from last known position
    const handleMouseEnter = () => {
      isMouseInSection.current = true;
      // Don't reset position, keep last known position
    };

    // Handle mouse leave - store last position for smooth re-entry
    const handleMouseLeave = () => {
      isMouseInSection.current = false;
      lastKnownPosition.current = { ...mousePositionRef.current };
    };

    // Optimize touch event handling
    const handleTouchMove = (e) => {
      const now = Date.now();
      const timeDelta = now - lastTouchTime.current;
      lastTouchTime.current = now;

      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = heroSection.getBoundingClientRect();
        
        // Calculate position
        const x = (touch.clientX - rect.left) / rect.width;
        const y = (touch.clientY - rect.top) / rect.height;
        
        // Calculate velocity for smoother interpolation
        if (timeDelta > 0) {
          touchVelocity.current.x = (x - mousePositionRef.current.x) / timeDelta;
          touchVelocity.current.y = (y - mousePositionRef.current.y) / timeDelta;
        }
        
        const newPosition = {
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y))
        };
        
        mousePositionRef.current = newPosition;
        lastKnownPosition.current = newPosition;
      }
    };

    const handleTouchEnd = () => {
      // Smooth deceleration on touch end
      touchVelocity.current = { x: 0, y: 0 };
    };

    // Add mouse enter/leave listeners
    heroSection.addEventListener('mouseenter', handleMouseEnter);
    heroSection.addEventListener('mouseleave', handleMouseLeave);

    // Add optimized touch listeners
    heroSection.addEventListener('touchmove', handleTouchMove, { passive: true });
    heroSection.addEventListener('touchend', handleTouchEnd, { passive: true });
    heroSection.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // Subscribe to MouseTracker immediately (it's always available)
    const unsubscribe = window.mouseTracker.subscribe((pos) => {
      // Only update if mouse is in section
      if (isMouseInSection.current) {
        // Get normalized position relative to hero section
        const normalized = window.mouseTracker.getNormalizedPosition(heroSection);
        mousePositionRef.current = normalized;
        lastKnownPosition.current = normalized;
      }
    });

    // Trigger an immediate update if mouse is already in section
    if (isMouseInSection.current && window.mouseTracker) {
      const normalized = window.mouseTracker.getNormalizedPosition(heroSection);
      mousePositionRef.current = normalized;
      lastKnownPosition.current = normalized;
    }
    
    return () => {
      heroSection.removeEventListener('mouseenter', handleMouseEnter);
      heroSection.removeEventListener('mouseleave', handleMouseLeave);
      heroSection.removeEventListener('touchmove', handleTouchMove);
      heroSection.removeEventListener('touchend', handleTouchEnd);
      heroSection.removeEventListener('touchcancel', handleTouchEnd);

      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return (
    <div 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      <Threads
        color={[0.4, 0.6, 1.0]}
        amplitude={1.0}  // Automatically scaled by device/viewport
        distance={0.3}   // Automatically scaled by device/viewport
        enableMouseInteraction={true}
        externalMouseRef={mousePositionRef}
      />
    </div>
  );
}

// Mount Threads background in hero section
const heroThreadsRoot = document.getElementById('hero-threads-root');

if (heroThreadsRoot) {
  const root = ReactDOM.createRoot(heroThreadsRoot);
  root.render(<HeroThreadsBackground />);
}