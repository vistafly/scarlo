import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue } from 'motion/react';
import './Carousel.css';

// ============================================
// SWIPE CONFIGURATION
// ============================================
const VELOCITY_THRESHOLD = 300; // px/second for flick detection

// Responsive drag buffer - smaller on mobile for easier swiping
const getDragBuffer = (itemWidth) => {
  const width = window.innerWidth;
  if (width <= 390) return Math.min(25, itemWidth * 0.08);
  if (width <= 540) return Math.min(30, itemWidth * 0.1);
  return Math.min(40, itemWidth * 0.12);
};

// ============================================
// SLIDE ANIMATION CONFIGURATION
// ============================================
const SPRING_OPTIONS = {
  type: 'spring',
  mass: 0.8,        // Lighter for snappier response
  stiffness: 350,   // Quicker settle
  damping: 30,      // Natural bounce
};
// ============================================

export default function Carousel({
  items,
  baseWidth = 300,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  loop = false,
  round = false,
}) {
const getContainerPadding = () => {
  const width = window.innerWidth;
  if (width <= 390) return 16;
  if (width <= 540) return 20;
  return 30;
};

const containerPadding = getContainerPadding();
  const gap = 24;
  const itemWidth = baseWidth - containerPadding * 2;
  const [imgIndex, setImgIndex] = useState(0);
  const dragX = useMotionValue(0);
  const containerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  // Memoize drag buffer for performance
  const dragBuffer = useMemo(() => getDragBuffer(itemWidth), [itemWidth]);

  useEffect(() => {
    if (!autoplay || (pauseOnHover && isHovered)) return;

    const intervalRef = setInterval(() => {
      const x = dragX.get();

      if (x === 0) {
        setImgIndex((pv) => {
          if (pv === items.length - 1) {
            return loop ? 0 : pv;
          }
          return pv + 1;
        });
      }
    }, autoplayDelay);

    return () => clearInterval(intervalRef);
  }, [autoplay, autoplayDelay, dragX, items.length, loop, isHovered, pauseOnHover]);

  useEffect(() => {
    if (!pauseOnHover || !containerRef.current) return;

    const container = containerRef.current;
    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [pauseOnHover]);

  // Velocity-aware drag end handler for easier swiping
  const onDragEnd = (event, info) => {
    const x = dragX.get();
    const velocity = info.velocity.x;

    // Swipe detection: distance OR velocity (fast flicks work even with small distance)
    const shouldGoNext = x <= -dragBuffer || velocity < -VELOCITY_THRESHOLD;
    const shouldGoPrev = x >= dragBuffer || velocity > VELOCITY_THRESHOLD;

    if (shouldGoNext && imgIndex < items.length - 1) {
      setImgIndex((pv) => pv + 1);
    } else if (shouldGoPrev && imgIndex > 0) {
      setImgIndex((pv) => pv - 1);
    } else if (loop) {
      if (shouldGoNext && imgIndex === items.length - 1) {
        setImgIndex(0);
      } else if (shouldGoPrev && imgIndex === 0) {
        setImgIndex(items.length - 1);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`carousel-container ${round ? 'round' : ''}`}
      style={{
        width: `${baseWidth}px`,
        ...(round && {
          height: `${baseWidth}px`,
          borderRadius: '50%',
        }),
      }}
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        dragTransition={{
          bounceStiffness: 300,
          bounceDamping: 20,
        }}
        style={{
          x: dragX,
          width: itemWidth,
        }}
        animate={{
          translateX: `-${imgIndex * (itemWidth + gap)}px`,
        }}
        transition={SPRING_OPTIONS}
        onDragEnd={onDragEnd}
        className="carousel-track"
      >
        {items.map((item, idx) => {
  const isActive = idx === imgIndex;
  
  return (
    <motion.div
      key={idx}
      className={`carousel-item ${round ? 'round' : ''}`}
      style={{
        width: itemWidth,
        height: round ? itemWidth : '100%',
        ...(round && {
          borderRadius: '50%',
        }),
      }}
      animate={{
  scale: isActive ? 1 : 0.95,
  borderColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
  boxShadow: isActive 
    ? '0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 30px rgba(255, 255, 255, 0.08), 0 0 60px rgba(255, 255, 255, 0.04)' 
    : '0 0 0 0px rgba(255, 255, 255, 0), 0 0 0px rgba(255, 255, 255, 0), 0 0 0px rgba(255, 255, 255, 0)',
}}
transition={{
  ...SPRING_OPTIONS,
  boxShadow: {
    type: 'spring',
    mass: 3,
    stiffness: 200,
    damping: 50,
  }
}}
    >
              <div className={`carousel-item-header ${round ? 'round' : ''}`}>
                <span className="carousel-icon-container">{item.icon}</span>
              </div>
              <div className="carousel-item-content">
                <div className="carousel-item-title">{item.title}</div>
                <p className="carousel-item-description">{item.description}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className={`carousel-indicators-container ${round ? 'round' : ''}`}>
        <div className="carousel-indicators">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setImgIndex(idx)}
              className={`carousel-indicator ${
                idx === imgIndex ? 'active' : 'inactive'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}