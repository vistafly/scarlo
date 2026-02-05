import { useEffect, useMemo, useRef, useCallback } from 'react';
import './DomeGallery.css';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const wrapAngleSigned = deg => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};

function buildItems(pool, segments) {
  const xCols = Array.from({ length: segments }, (_, i) => -28 + i * 2);
  const evenYs = [-3, -1, 1, 3];
  const oddYs = [-2, 0, 2, 4];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map(y => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  if (pool.length === 0) {
    return coords.map(c => ({ ...c, preview: '', url: '', alt: '', type: 'image' }));
  }

  const normalizedImages = pool.map(image => ({
    preview: image.preview || image.src || '',
    url: image.url || image.src || '',
    alt: image.alt || '',
    type: image.type || 'image'
  }));

  // Calculate distance between two coordinates (considering dome wrapping)
  const getDistance = (coord1, coord2) => {
    const dx = coord1.x - coord2.x;
    const dy = coord1.y - coord2.y;
    
    // Consider horizontal wrapping (dome is circular)
    const xRange = 56; // -28 to +28
    const wrappedDx = Math.min(Math.abs(dx), xRange - Math.abs(dx));
    
    return Math.sqrt(wrappedDx * wrappedDx + dy * dy);
  };

  const numImages = normalizedImages.length;
  const totalPositions = coords.length;
  const usedImages = new Array(totalPositions).fill(null);
  
  // Track how many times each image has been placed
  const imageCounts = new Array(numImages).fill(0);
  const targetCount = Math.ceil(totalPositions / numImages);

  // Place images in rounds to ensure even distribution
  for (let position = 0; position < totalPositions; position++) {
    let bestImageIdx = -1;
    let bestScore = -Infinity;
    
    // Try each image and score it
    for (let imgIdx = 0; imgIdx < numImages; imgIdx++) {
      // Skip if this image has reached its quota
      if (imageCounts[imgIdx] >= targetCount) continue;
      
      const currentImage = normalizedImages[imgIdx];
      
      // Find all existing positions of this image
      const existingPositions = [];
      for (let i = 0; i < position; i++) {
        if (usedImages[i] && usedImages[i].url === currentImage.url) {
          existingPositions.push(i);
        }
      }
      
      // Calculate score based on distance to existing instances
      let score;
      if (existingPositions.length === 0) {
        // First instance - give it a base score
        score = 1000;
      } else {
        // Find minimum distance to any existing instance
        let minDistance = Infinity;
        existingPositions.forEach(existingIdx => {
          const dist = getDistance(coords[position], coords[existingIdx]);
          minDistance = Math.min(minDistance, dist);
        });
        score = minDistance;
      }
      
      // Prefer images that haven't been used as much
      const usageBonus = (targetCount - imageCounts[imgIdx]) * 0.5;
      score += usageBonus;
      
      if (score > bestScore) {
        bestScore = score;
        bestImageIdx = imgIdx;
      }
    }
    
    // Fallback: if no image found (all at quota), use round-robin
    if (bestImageIdx === -1) {
      bestImageIdx = position % numImages;
    }
    
    // Place the image
    usedImages[position] = normalizedImages[bestImageIdx];
    imageCounts[bestImageIdx]++;
  }

  // CRITICAL: Verify all positions are filled
  for (let i = 0; i < usedImages.length; i++) {
    if (!usedImages[i]) {
      console.error('Empty position found at index:', i);
      // Fallback to round-robin
      usedImages[i] = normalizedImages[i % numImages];
    }
  }

  return coords.map((c, i) => ({
    ...c,
    preview: usedImages[i].preview,
    url: usedImages[i].url,
    alt: usedImages[i].alt,
    type: usedImages[i].type
  }));
}

export default function DomeGallery({
  images = [],
  fit = 0.6,
  minRadius = 650,
  maxRadius = 1000,
  segments = 28,
  maxVerticalRotationDeg = 10,
  dragSensitivity = 18,
  openedImageWidth = '85vw',
  openedImageHeight = '85vh',
  imageBorderRadius = '12px',
  openedImageBorderRadius = '20px',
  overlayBlurColor = '#0a0a0a',
  grayscale = false,
  pressHoldDuration = 400,
  scrollThreshold = 12 // Lower threshold for more responsive swipe detection
}) {
  const rootRef = useRef(null);
  const mainRef = useRef(null);
  const sphereRef = useRef(null);
  const viewerRef = useRef(null);
  const scrimRef = useRef(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef(null);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const lastDragEndAt = useRef(0);
  const openingRef = useRef(false);
  
  // Tile interaction refs - simplified
  const touchTimerRef = useRef(null);
  const activeTouchTileRef = useRef(null);
  const holdCompletedRef = useRef(false);
  const tileTouchStartPosRef = useRef(null);
  const tileTouchStartTimeRef = useRef(0);
  const isScrollingRef = useRef(false);
  const rafRef = useRef(null);

  const items = useMemo(() => buildItems(images, segments), [images, segments]);

  // iOS Haptic Feedback
  const triggerHaptic = useCallback(() => {
    try {
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
      }
      // iOS audio feedback
      if (window.AudioContext || window.webkitAudioContext) {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.value = 200;
        gainNode.gain.value = 0.1;
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.01);
      }
    } catch (err) {
      // Silently fail
    }
  }, []);

  // Throttled z-index update
  const updateTileZIndex = useCallback((currentRotY) => {
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      
      if (!sphereRef.current) return;
      
      const tiles = sphereRef.current.querySelectorAll('.item');
      
      tiles.forEach((tile) => {
        const styleAttr = tile.getAttribute('style') || '';
        const offsetXMatch = styleAttr.match(/--offset-x:\s*(-?\d+(?:\.\d+)?)/);
        const offsetX = offsetXMatch ? parseFloat(offsetXMatch[1]) : 0;
        
        const tileRotY = (360 / segments) * (offsetX + 0.5);
        let relativeRot = tileRotY - currentRotY;
        
        while (relativeRot > 180) relativeRot -= 360;
        while (relativeRot < -180) relativeRot += 360;
        
        const zIndex = Math.round(500 + 499 * Math.cos((relativeRot * Math.PI) / 180));
        tile.style.zIndex = Math.max(1, zIndex);
      });
    });
  }, [segments]);

  const applyTransform = useCallback((xDeg, yDeg) => {
    if (sphereRef.current) {
      sphereRef.current.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
      updateTileZIndex(yDeg);
    }
  }, [updateTileZIndex]);

  // Set CSS variables and size
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const updateSize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const minDim = Math.min(w, h);
      
      let radius = minDim * fit;
      radius = clamp(radius, minRadius, maxRadius);
      
      root.style.setProperty('--radius', `${Math.round(radius)}px`);
      root.style.setProperty('--segments-x', segments);
      root.style.setProperty('--segments-y', segments);
      root.style.setProperty('--tile-radius', imageBorderRadius);
      root.style.setProperty('--enlarge-radius', openedImageBorderRadius);
      root.style.setProperty('--overlay-blur-color', overlayBlurColor);
      root.style.setProperty('--image-filter', grayscale ? 'grayscale(1)' : 'none');
      
      applyTransform(rotationRef.current.x, rotationRef.current.y);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(root);

    return () => observer.disconnect();
  }, [fit, minRadius, maxRadius, segments, imageBorderRadius, openedImageBorderRadius, overlayBlurColor, grayscale, applyTransform]);

  // Initial z-index setup
  useEffect(() => {
    const timer = setTimeout(() => {
      updateTileZIndex(0);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [updateTileZIndex]);

  // ===== SPHERE ROTATION =====
  
  const startDrag = useCallback((clientX, clientY) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    isScrollingRef.current = true; // Mark as scrolling
    startRotRef.current = { ...rotationRef.current };
    dragStartPosRef.current = { x: clientX, y: clientY };
  }, []);

  const updateDrag = useCallback((clientX, clientY) => {
    if (!isDraggingRef.current || !dragStartPosRef.current) return;
    
    const dx = clientX - dragStartPosRef.current.x;
    const dy = clientY - dragStartPosRef.current.y;
    
    if (!hasMovedRef.current && (dx * dx + dy * dy) > 25) {
      hasMovedRef.current = true;
    }
    
    const nextX = clamp(
      startRotRef.current.x - dy / dragSensitivity,
      -maxVerticalRotationDeg,
      maxVerticalRotationDeg
    );
    const nextY = wrapAngleSigned(startRotRef.current.y + dx / dragSensitivity);
    
    rotationRef.current = { x: nextX, y: nextY };
    applyTransform(nextX, nextY);
  }, [dragSensitivity, maxVerticalRotationDeg, applyTransform]);

  const endDrag = useCallback(() => {
    if (isDraggingRef.current && hasMovedRef.current) {
      lastDragEndAt.current = performance.now();
    }
    
    isDraggingRef.current = false;
    hasMovedRef.current = false;
    dragStartPosRef.current = null;
    
    // Reset scrolling flag after a delay
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  // Global touch/mouse handlers for sphere
  useEffect(() => {
    const onTouchMove = (e) => {
      if (isDraggingRef.current && e.touches[0]) {
        const touch = e.touches[0];
        updateDrag(touch.clientX, touch.clientY);
      }
    };
    
    const onTouchEnd = () => {
      endDrag();
    };

    const onMouseMove = (e) => {
      if (isDraggingRef.current) {
        updateDrag(e.clientX, e.clientY);
      }
    };
    
    const onMouseUp = () => {
      endDrag();
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [updateDrag, endDrag]);

  // Main area handlers
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      startDrag(e.clientX, e.clientY);
    };

    const onTouchStart = (e) => {
      // Only handle if not touching a tile
      if (!e.target.closest('.item__image')) {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
      }
    };

    main.addEventListener('mousedown', onMouseDown);
    main.addEventListener('touchstart', onTouchStart, { passive: true });

    return () => {
      main.removeEventListener('mousedown', onMouseDown);
      main.removeEventListener('touchstart', onTouchStart);
    };
  }, [startDrag]);

  // ===== TILE PRESS-AND-HOLD =====

  const openTileContent = useCallback((parent) => {
    if (openingRef.current) return;

    const url = parent.dataset.url;
    const type = parent.dataset.type;
    const preview = parent.dataset.preview;

    openingRef.current = true;

    const overlay = document.createElement('div');
    overlay.className = 'enlarge';
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: ${openedImageWidth};
      height: ${openedImageHeight};
      max-width: 92vw;
      max-height: 92vh;
      z-index: 9999;
      border-radius: ${openedImageBorderRadius};
      overflow: hidden;
      box-shadow: 0 25px 80px rgba(92, 92, 92, 0.24);
      background: #000000;
      pointer-events: auto;
    `;

    if (type === 'iframe' && url) {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.cssText = 'width:100%;height:100%;border:none;';
      iframe.setAttribute('allowfullscreen', '');
      overlay.appendChild(iframe);
    } else {
      const img = document.createElement('img');
      img.src = preview || url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      overlay.appendChild(img);
    }

    // Prevent wheel events inside the enlarge element from propagating to scrim
    overlay.addEventListener('wheel', (e) => {
      e.stopPropagation();
    }, { passive: false });

    viewerRef.current.appendChild(overlay);
    rootRef.current?.setAttribute('data-enlarging', 'true');
    
    triggerHaptic();
  }, [openedImageWidth, openedImageHeight, openedImageBorderRadius, triggerHaptic]);

  // TILE: Touch Start
  const handleTileTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    const tile = e.currentTarget.parentElement;

    tileTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    tileTouchStartTimeRef.current = performance.now();
    activeTouchTileRef.current = tile;
    holdCompletedRef.current = false;
    isScrollingRef.current = false;

    // Clear any existing timer
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }

    // Start press-and-hold timer
    touchTimerRef.current = setTimeout(() => {
      // Check if still valid for opening
      if (activeTouchTileRef.current && !isScrollingRef.current) {
        holdCompletedRef.current = true;
        // Haptic feedback only on hold completion
        triggerHaptic();
      }
    }, pressHoldDuration);
  }, [triggerHaptic, pressHoldDuration]);

  // TILE: Touch Move - Detect scrolling
  const handleTileTouchMove = useCallback((e) => {
    // Early bailout if already scrolling or no start position
    if (isScrollingRef.current || !tileTouchStartPosRef.current) return;

    const touch = e.touches[0];
    const dx = touch.clientX - tileTouchStartPosRef.current.x;
    const dy = touch.clientY - tileTouchStartPosRef.current.y;

    // Use squared distance to avoid sqrt for performance
    const distanceSq = dx * dx + dy * dy;
    const thresholdSq = scrollThreshold * scrollThreshold;

    // If moved beyond threshold, it's a scroll/swipe
    if (distanceSq > thresholdSq) {
      isScrollingRef.current = true;

      // Cancel press-and-hold immediately
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
      holdCompletedRef.current = false;

      // Start sphere drag from current touch position for smoother feel
      if (!isDraggingRef.current) {
        startDrag(touch.clientX, touch.clientY);
      }
    }
  }, [scrollThreshold, startDrag]);

  // TILE: Touch End
  const handleTileTouchEnd = useCallback((e) => {
    const parent = activeTouchTileRef.current;
    const wasHoldCompleted = holdCompletedRef.current;
    const wasScrolling = isScrollingRef.current;

    // Clear timer
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }

    // Only open if hold was completed and not scrolling
    if (wasHoldCompleted && !wasScrolling && parent) {
      e.preventDefault();
      e.stopPropagation();
      openTileContent(parent);
    }

    // Reset all tracking
    activeTouchTileRef.current = null;
    tileTouchStartPosRef.current = null;
    tileTouchStartTimeRef.current = 0;
    holdCompletedRef.current = false;
    isScrollingRef.current = false;
  }, [openTileContent]);

  const handleTileTouchCancel = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    
    activeTouchTileRef.current = null;
    tileTouchStartPosRef.current = null;
    tileTouchStartTimeRef.current = 0;
    holdCompletedRef.current = false;
    isScrollingRef.current = false;
  }, []);

  // DESKTOP: Click handler
  const handleTileClick = useCallback((e) => {
    // Skip on touch devices
    if ('ontouchstart' in window) return;
    
    if (isDraggingRef.current || hasMovedRef.current) return;
    if (performance.now() - lastDragEndAt.current < 100) return;

    const parent = e.currentTarget.parentElement;
    openTileContent(parent);
  }, [openTileContent]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Close handler
  useEffect(() => {
    const handleClose = () => {
      const overlay = viewerRef.current?.querySelector('.enlarge');
      if (overlay) overlay.remove();
      rootRef.current?.removeAttribute('data-enlarging');
      openingRef.current = false;
    };

    const scrim = scrimRef.current;
    if (scrim) {
      scrim.addEventListener('click', handleClose);
      scrim.addEventListener('touchend', handleClose);
      
      // Desktop only: Close on scroll outside enlarged content
      if (!('ontouchstart' in window)) {
        const handleWheel = (e) => {
          // If the event reached the scrim, it means the user scrolled outside the content
          // (because the overlay stops propagation of wheel events)
          e.preventDefault();
          handleClose();
        };
        scrim.addEventListener('wheel', handleWheel, { passive: false });
        
        // Cleanup wheel listener
        return () => {
          scrim.removeEventListener('click', handleClose);
          scrim.removeEventListener('touchend', handleClose);
          scrim.removeEventListener('wheel', handleWheel);
        };
      }
    }

    const handleKeydown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeydown);

    return () => {
      if (scrim) {
        scrim.removeEventListener('click', handleClose);
        scrim.removeEventListener('touchend', handleClose);
      }
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return (
    <div ref={rootRef} className="sphere-root">
      <main ref={mainRef} className="sphere-main">
        <div className="stage">
          <div ref={sphereRef} className="sphere">
            {items.map((it, i) => (
              <div
                key={`${it.x},${it.y},${i}`}
                className="item"
                data-preview={it.preview}
                data-url={it.url}
                data-type={it.type}
                style={{
                  ['--offset-x']: it.x,
                  ['--offset-y']: it.y,
                  ['--item-size-x']: it.sizeX,
                  ['--item-size-y']: it.sizeY
                }}
              >
                <div
                  className="item__image"
                  data-interactive="true"
                  role="button"
                  tabIndex={0}
                  onClick={handleTileClick}
                  onTouchStart={handleTileTouchStart}
                  onTouchMove={handleTileTouchMove}
                  onTouchEnd={handleTileTouchEnd}
                  onTouchCancel={handleTileTouchCancel}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTileClick(e);
                    }
                  }}
                >
                  <img src={it.preview} draggable={false} alt={it.alt} loading="lazy" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="viewer" ref={viewerRef}>
          <div ref={scrimRef} className="scrim" />
        </div>
      </main>
    </div>
  );
}