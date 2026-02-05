// MouseTracker.js - Shared global mouse position tracker
class MouseTracker {
  constructor() {
    this.position = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.listeners = new Set();
    this.ready = false;
    this.init();
  }

  init() {
    const self = this;
    let rafId = null;
    let hasUpdate = false;

    // Track mouse globally with pointermove (same as your cursor)
    document.addEventListener('pointermove', function(e) {
      self.position.x = e.clientX;
      self.position.y = e.clientY;

      // Throttle listener notifications using RAF for 60fps updates
      if (!hasUpdate) {
        hasUpdate = true;
        rafId = requestAnimationFrame(function() {
          hasUpdate = false;
          // Notify all listeners once per frame
          self.listeners.forEach(callback => callback(self.position));
        });
      }
    }, { passive: true });

    document.addEventListener('pointerleave', function() {
      // Reset to center when mouse leaves window
      self.position.x = window.innerWidth / 2;
      self.position.y = window.innerHeight / 2;
      self.listeners.forEach(callback => callback(self.position));
    }, { passive: true });

    // Mark as ready immediately
    this.ready = true;
  }

  // Subscribe to mouse position updates
  subscribe(callback) {
    this.listeners.add(callback);
    // Immediately call with current position
    callback(this.position);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Get normalized position for a specific element (0-1 range)
  getNormalizedPosition(element) {
    if (!element) return { x: 0.5, y: 0.5 };

    const rect = element.getBoundingClientRect();
    const x = this.position.x;
    const y = this.position.y;

    // Quick bounds check with early exit
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return { x: 0.5, y: 0.5 };
    }

    // Mouse is within bounds - calculate normalized position
    return {
      x: (x - rect.left) / rect.width,
      y: 1.0 - (y - rect.top) / rect.height // Inverted Y for WebGL
    };
  }
}

// Create singleton instance
window.mouseTracker = new MouseTracker();

export default window.mouseTracker;