import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';

import './Threads.css';

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec3 uColor;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2 uMouse;

#define PI 3.1415926538

uniform int u_line_count;
const float u_line_width = 7.0;
const float u_line_blur = 10.0;

float Perlin2D(vec2 P) {
    vec2 Pi = floor(P);
    vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
    vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
    Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
    Pt += vec2(26.0, 161.0).xyxy;
    Pt *= Pt;
    Pt = Pt.xzxz * Pt.yyww;
    vec4 hash_x = fract(Pt * (1.0 / 951.135664));
    vec4 hash_y = fract(Pt * (1.0 / 642.949883));
    vec4 grad_x = hash_x - 0.49999;
    vec4 grad_y = hash_y - 0.49999;
    vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y)
        * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
    grad_results *= 1.4142135623730950;
    vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy
               * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
    vec4 blend2 = vec4(blend, vec2(1.0 - blend));
    return dot(grad_results, blend2.zxzx * blend2.wwyy);
}

float pixel(float count, vec2 resolution) {
    return (1.0 / max(resolution.x, resolution.y)) * count;
}

float lineFn(vec2 st, float width, float perc, float offset, vec2 mouse, float time, float amplitude, float distance) {
    float split_offset = (perc * 0.4);
    float split_point = 0.1 + split_offset;

    float amplitude_normal = smoothstep(split_point, 0.7, st.x);
    float amplitude_strength = 0.5;
    float finalAmplitude = amplitude_normal * amplitude_strength
                           * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);

    float time_scaled = time / 10.0 + (mouse.x - 0.5) * 1.0;
    float blur = smoothstep(split_point, split_point + 0.05, st.x) * perc;

    float xnoise = mix(
        Perlin2D(vec2(time_scaled, st.x + perc) * 2.5),
        Perlin2D(vec2(time_scaled, st.x + time_scaled) * 3.5) / 1.5,
        st.x * 0.3
    );

    float y = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;

    float line_start = smoothstep(
        y + (width / 2.0) + (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        y,
        st.y
    );

    float line_end = smoothstep(
        y,
        y - (width / 2.0) - (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        st.y
    );

    return clamp(
        (line_start - line_end) * (1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3))),
        0.0,
        1.0
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    float line_strength = 1.0;
    for (int i = 0; i < 40; i++) {
        if (i >= u_line_count) break;
        float p = float(i) / float(u_line_count);
        line_strength *= (1.0 - lineFn(
            uv,
            u_line_width * pixel(1.0, iResolution.xy) * (1.0 - p),
            p,
            (PI * 1.0) * p,
            uMouse,
            iTime,
            uAmplitude,
            uDistance
        ));
    }

    float colorVal = 1.0 - line_strength;
    fragColor = vec4(uColor * colorVal, colorVal);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

// Smooth easing function for buttery motion
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Performance monitor (runs silently in background)
class PerformanceMonitor {
  constructor() {
    this.frameTimes = [];
    this.maxSamples = 60;
    this.lastTime = performance.now();
  }

  tick() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    
    this.frameTimes.push(delta);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  getAverageFPS() {
    if (this.frameTimes.length === 0) return 60;
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return Math.round(1000 / avgFrameTime);
  }

  isPerformancePoor() {
    return this.getAverageFPS() < 30;
  }

  isPerformanceGood() {
    return this.getAverageFPS() >= 50;
  }
}

// Get responsive scaling factors based on viewport
function getResponsiveScaling() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspectRatio = width / height;
  
  // Distance scaling - tighter spacing on smaller screens
  let distanceScale = 1.0;
  if (width < 480) {
    distanceScale = 0.4; // Much tighter on mobile
  } else if (width < 768) {
    distanceScale = 0.55; // Tablet
  } else if (width < 1024) {
    distanceScale = 0.7; // Small laptop
  } else if (width < 1440) {
    distanceScale = 0.85; // Standard laptop
  }
  
  // Amplitude scaling - reduce wave intensity on smaller screens
  let amplitudeScale = 1.0;
  if (width < 480) {
    amplitudeScale = 0.6; // Less wavy on mobile
  } else if (width < 768) {
    amplitudeScale = 0.75;
  } else if (width < 1024) {
    amplitudeScale = 0.85;
  }
  
  return { distanceScale, amplitudeScale };
}

// Detect if device is a laptop (has battery but large screen)
function detectLaptopSync() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isLargeScreen = window.innerWidth >= 1024;

  // Large non-touch screen is likely a laptop or desktop
  // We'll refine this with Battery API async check
  return isLargeScreen && !isTouch;
}

// Async laptop detection using Battery API (called after initial render)
async function detectLaptopAsync() {
  if ('getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      // Device has battery = laptop/tablet (desktops don't have batteries)
      return battery && typeof battery.charging !== 'undefined';
    } catch (e) {
      // Battery API blocked or unavailable
    }
  }
  return null; // Unknown
}

// Enhanced device detection with GPU profiling (optimized for immediate execution)
function getDeviceProfile(isConfirmedLaptop = null) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4; // GB

  // Laptop detection: use async result if available, otherwise use sync heuristic
  const isLikelyLaptop = isConfirmedLaptop !== null ? isConfirmedLaptop : detectLaptopSync();

  // Fast GPU tier detection - check only if not mobile (skip for mobile since we have a default profile)
  let gpuTier = 'high';
  let gpuRenderer = '';
  if (!isMobile) {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', {
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: true
      });
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
          // Intel integrated graphics or old GPUs
          if (gpuRenderer.includes('intel') && !gpuRenderer.includes('iris xe')) {
            gpuTier = 'low';
          }
          // Detect mobile/laptop GPUs (MX series, Max-Q, etc.)
          const mobileGpuIndicators = ['mx', 'max-q', 'mobile', 'laptop'];
          if (mobileGpuIndicators.some(ind => gpuRenderer.includes(ind))) {
            gpuTier = 'mid';
          }
        }
        // Clean up immediately
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch (e) {
      // If context creation fails, assume low-end
      gpuTier = 'low';
    }
  }

  // Touch-specific smoothing (higher = smoother but slightly more lag)
  const touchSmoothing = isTouch ? 0.12 : 0.06;

  // Ultra-low end: Old laptops, budget devices
  if ((cores < 4 || memory < 4) && gpuTier === 'low') {
    console.log('Threads: Ultra-low profile (15 lines)');
    return {
      lineCount: 15,
      amplitude: 0.8,
      smoothing: touchSmoothing,
      quality: 'ultra-low',
      isTouch,
      targetFPS: 60
    };
  }

  // Low-end: Older laptops with integrated graphics
  if (cores === 4 || gpuTier === 'low') {
    console.log('Threads: Low-end profile (20 lines)');
    return {
      lineCount: 20,
      amplitude: 1.0,
      smoothing: touchSmoothing,
      quality: 'low',
      isTouch,
      targetFPS: 60
    };
  }

  // Mobile: Even high-end mobile prioritizes battery
  if (isMobile) {
    console.log('Threads: Mobile profile (25 lines)');
    return {
      lineCount: 25,
      amplitude: 0.8,
      smoothing: touchSmoothing,
      quality: 'mobile',
      isTouch,
      targetFPS: 60
    };
  }

  // Laptop: Balance between visuals and responsiveness
  // Detected via Battery API, large non-touch screen, or mobile GPU
  if (isLikelyLaptop || gpuTier === 'mid') {
    console.log('Threads: Laptop profile (28 lines, 45fps)');
    return {
      lineCount: 28,
      amplitude: 1.2,
      smoothing: 0.09, // More smoothing than desktop
      quality: 'laptop',
      isTouch,
      targetFPS: 45 // Throttle to 45fps for better responsiveness
    };
  }

  // High-end: Modern desktops with dedicated GPUs
  console.log('Threads: High-end profile (40 lines)');
  return {
    lineCount: 40,
    amplitude: 1.5,
    smoothing: touchSmoothing,
    quality: 'desktop',
    isTouch,
    targetFPS: 60
  };
}

const Threads = ({ 
  color = [1, 1, 1], 
  amplitude = 1, 
  distance = 0, 
  enableMouseInteraction = false, 
  externalMouseRef = null,
  ...rest
}) => {
  const containerRef = useRef(null);
  const animationFrameId = useRef();
  const programRef = useRef(null);
  const deviceProfile = useRef(getDeviceProfile());
  const perfMonitor = useRef(new PerformanceMonitor());
  const qualityLevel = useRef(deviceProfile.current.lineCount);
  const isVisible = useRef(true);
  const responsiveScaling = useRef(getResponsiveScaling());

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const renderer = new Renderer({ 
      alpha: true,
      antialias: false, // Significant performance boost
      powerPreference: 'high-performance',
      depth: false, // Don't need depth buffer
      stencil: false // Don't need stencil buffer
    });
    
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Disable unnecessary WebGL features
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    
    container.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    
    // Apply responsive scaling
    const scaledAmplitude = amplitude * deviceProfile.current.amplitude * responsiveScaling.current.amplitudeScale;
    const scaledDistance = distance * responsiveScaling.current.distanceScale;
    
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)
        },
        uColor: { value: new Color(...color) },
        uAmplitude: { value: scaledAmplitude },
        uDistance: { value: scaledDistance },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        u_line_count: { value: qualityLevel.current }
      }
    });

    programRef.current = program;
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      const { clientWidth, clientHeight } = container;

      // Resolution scaling - render at lower resolution for laptops to reduce GPU load
      const resolutionScale = deviceProfile.current.quality === 'laptop' ? 0.8 :
                              deviceProfile.current.quality === 'low' ? 0.75 :
                              deviceProfile.current.quality === 'ultra-low' ? 0.6 : 1.0;

      const renderWidth = Math.floor(clientWidth * resolutionScale);
      const renderHeight = Math.floor(clientHeight * resolutionScale);

      renderer.setSize(renderWidth, renderHeight);

      // CSS scales the canvas back to full size (slight blur but much faster)
      gl.canvas.style.width = clientWidth + 'px';
      gl.canvas.style.height = clientHeight + 'px';

      program.uniforms.iResolution.value.r = renderWidth;
      program.uniforms.iResolution.value.g = renderHeight;
      program.uniforms.iResolution.value.b = renderWidth / renderHeight;

      // Update responsive scaling on resize
      responsiveScaling.current = getResponsiveScaling();
      const newScaledAmplitude = amplitude * deviceProfile.current.amplitude * responsiveScaling.current.amplitudeScale;
      const newScaledDistance = distance * responsiveScaling.current.distanceScale;
      program.uniforms.uAmplitude.value = newScaledAmplitude;
      program.uniforms.uDistance.value = newScaledDistance;
    }
    
    // Debounced resize for better performance
    let resizeTimeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 150);
    };
    
    window.addEventListener('resize', debouncedResize);
    resize();

    // Visibility detection - pause when not visible (huge battery saver)
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible.current = entries[0].isIntersecting;
        if (isVisible.current && !animationFrameId.current) {
          lastTime = performance.now();
          animationFrameId.current = requestAnimationFrame(update);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    // Enhanced smooth tracking with velocity damping and re-entry smoothing
let currentMouse = [0.5, 0.5];
let targetMouse = [0.5, 0.5];
let velocity = [0, 0];
let lastTime = performance.now();
let lastRenderTime = 0; // For frame rate throttling
let frameCount = 0;
let reEntryFrames = 0; // Track frames since re-entry
const qualityCheckInterval = 120; // Check performance every 2 seconds
const RE_ENTRY_SMOOTH_FRAMES = 10; // Extra smoothing for 10 frames after re-entry (~167ms at 60fps)
const targetFrameTime = 1000 / (deviceProfile.current.targetFPS || 60); // Frame time based on target FPS

function update(t) {
  // Don't render if not visible
  if (!isVisible.current) {
    animationFrameId.current = null;
    return;
  }

  // Frame rate throttling - skip frame if we're ahead of target FPS
  if (t - lastRenderTime < targetFrameTime) {
    animationFrameId.current = requestAnimationFrame(update);
    return;
  }
  lastRenderTime = t;

  const deltaTime = Math.min((t - lastTime) / 16.67, 2); // Cap at 2x for consistency
  lastTime = t;
  
  // Performance monitoring (silent, adaptive)
  perfMonitor.current.tick();
  frameCount++;

  // Adaptive quality adjustment (keeps visual feel, just reduces line count if needed)
  if (frameCount >= qualityCheckInterval) {
    frameCount = 0;
    
    // Reduce quality if struggling
    if (perfMonitor.current.isPerformancePoor() && qualityLevel.current > 10) {
      qualityLevel.current = Math.max(10, qualityLevel.current - 5);
      program.uniforms.u_line_count.value = qualityLevel.current;
      console.log(`⚠️ Threads: Reduced to ${qualityLevel.current} lines (low FPS)`);
    }
    // Restore quality if performance recovers
    else if (perfMonitor.current.isPerformanceGood() && 
             qualityLevel.current < deviceProfile.current.lineCount) {
      qualityLevel.current = Math.min(deviceProfile.current.lineCount, qualityLevel.current + 3);
      program.uniforms.u_line_count.value = qualityLevel.current;
      console.log(`✅ Threads: Increased to ${qualityLevel.current} lines (good FPS)`);
    }
  }
  
  if (enableMouseInteraction && externalMouseRef) {
    // Get target position from external ref
    const newTargetX = externalMouseRef.current.x;
    const newTargetY = externalMouseRef.current.y;
    
    // Detect large jumps (re-entry detection) - lowered threshold for more responsiveness
    const jumpX = Math.abs(newTargetX - targetMouse[0]);
    const jumpY = Math.abs(newTargetY - targetMouse[1]);
    const isLargeJump = jumpX > 0.5 || jumpY > 0.5;
    
    // If large jump detected, start re-entry smoothing
    if (isLargeJump && reEntryFrames === 0) {
      reEntryFrames = RE_ENTRY_SMOOTH_FRAMES;
    }
    
    targetMouse[0] = newTargetX;
    targetMouse[1] = newTargetY;
    
    // Calculate smoothing factor (extra smooth during re-entry)
    let smoothing = deviceProfile.current.smoothing;
    if (reEntryFrames > 0) {
      // Gradual transition from smooth to normal - faster ramp up
      const reEntryProgress = reEntryFrames / RE_ENTRY_SMOOTH_FRAMES;
      smoothing = smoothing * (0.5 + 0.5 * (1 - reEntryProgress)); // Start at 50% speed, ramp to 100%
      reEntryFrames--;
    }
    
    // Calculate delta
    const dx = targetMouse[0] - currentMouse[0];
    const dy = targetMouse[1] - currentMouse[1];
    
    // Update velocity with damping (prevents overshooting)
    velocity[0] += (dx * 0.3 - velocity[0]) * 0.4;
    velocity[1] += (dy * 0.3 - velocity[1]) * 0.4;
    
    // Apply smoothed position with velocity
    currentMouse[0] += dx * smoothing + velocity[0] * 0.15;
    currentMouse[1] += dy * smoothing + velocity[1] * 0.15;
    
    // Clamp to valid range
    currentMouse[0] = Math.max(0, Math.min(1, currentMouse[0]));
    currentMouse[1] = Math.max(0, Math.min(1, currentMouse[1]));
    
    program.uniforms.uMouse.value[0] = currentMouse[0];
    program.uniforms.uMouse.value[1] = currentMouse[1];
  } else {
    // Smooth return to center when not interacting
    const returnSpeed = 0.02;
    currentMouse[0] += (0.5 - currentMouse[0]) * returnSpeed;
    currentMouse[1] += (0.5 - currentMouse[1]) * returnSpeed;
    velocity = [0, 0];
    reEntryFrames = 0; // Reset re-entry counter when not interacting
    
    program.uniforms.uMouse.value[0] = currentMouse[0];
    program.uniforms.uMouse.value[1] = currentMouse[1];
  }
  
  program.uniforms.iTime.value = t * 0.001;

  renderer.render({ scene: mesh });
  animationFrameId.current = requestAnimationFrame(update);
}

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
      observer.disconnect();
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      // Properly dispose WebGL context
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [color, amplitude, distance, enableMouseInteraction, externalMouseRef]);

  return <div ref={containerRef} className="threads-container" {...rest} />;
};

export default Threads;