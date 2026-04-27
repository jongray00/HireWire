/**
 * CSS Recovery System - Ensures styles load even with hydration failures
 * This module provides multiple fallback mechanisms to guarantee CSS is applied
 */

// Track if recovery has been attempted
let recoveryAttempted = false;

/**
 * Force inject Tailwind CSS and global styles
 */
export function forceInjectStyles() {
  if (recoveryAttempted) return;
  recoveryAttempted = true;
  
  console.log('[CSS Recovery] Forcing style injection...');
  
  // Method 1: Direct style tag injection
  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-css-emergency', 'true');
  styleTag.textContent = `
    /* Emergency CSS Recovery */
    @import url('/src/app/global.css');
    
    /* Force Tailwind to recalculate */
    * {
      /* Trigger repaint */
      animation: cssRecoveryPulse 0.001s;
    }
    
    @keyframes cssRecoveryPulse {
      from { opacity: 0.9999; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(styleTag);
  
  // Method 2: Link tag injection
  const linkTag = document.createElement('link');
  linkTag.rel = 'stylesheet';
  linkTag.href = '/src/app/global.css?t=' + Date.now(); // Bust cache
  linkTag.setAttribute('data-css-recovery-link', 'true');
  document.head.appendChild(linkTag);
  
  // Method 3: Force module re-import
  try {
    import('../global.css').then(() => {
      console.log('[CSS Recovery] Global CSS module re-imported');
    });
  } catch (e) {
    console.error('[CSS Recovery] Failed to re-import CSS module:', e);
  }
  
  // Method 4: Force document reflow
  requestAnimationFrame(() => {
    const body = document.body;
    body.style.display = 'none';
    body.offsetHeight; // Force reflow
    body.style.display = '';
    
    // Remove browser extension attributes
    cleanupExtensionAttributes();
    
    console.log('[CSS Recovery] Reflow forced, styles should be applied');
  });
}

/**
 * Check if CSS is properly loaded by testing a Tailwind class
 */
export function checkCSSLoaded(): boolean {
  const testDiv = document.createElement('div');
  testDiv.className = 'bg-blue-500 text-white p-4';
  testDiv.style.position = 'absolute';
  testDiv.style.visibility = 'hidden';
  document.body.appendChild(testDiv);
  
  const computed = window.getComputedStyle(testDiv);
  const hasBackground = computed.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                       computed.backgroundColor !== 'transparent';
  const hasWhiteText = computed.color === 'rgb(255, 255, 255)' || 
                       computed.color === 'white';
  const hasPadding = parseInt(computed.padding) > 0;
  
  document.body.removeChild(testDiv);
  
  const isLoaded = hasBackground || hasWhiteText || hasPadding;
  
  if (!isLoaded) {
    console.warn('[CSS Recovery] CSS check failed:', {
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      padding: computed.padding
    });
  }
  
  return isLoaded;
}

/**
 * Clean up browser extension injected attributes
 */
export function cleanupExtensionAttributes() {
  const extensionAttributes = [
    'data-new-gr-c-s-check-loaded',
    'data-gr-ext-installed',
    'data-gr-c-s-loaded',
    'data-gramm',
    'data-gramm_editor',
    'data-grammarly-shadow-root',
    'data-lt-installed',
    'data-darkreader-mode',
    'data-darkreader-scheme'
  ];
  
  const elements = [document.documentElement, document.body];
  
  elements.forEach(el => {
    if (!el) return;
    extensionAttributes.forEach(attr => {
      if (el.hasAttribute(attr)) {
        el.removeAttribute(attr);
      }
    });
  });
}

/**
 * Monitor for CSS failures and auto-recover
 */
export function initCSSMonitor() {
  // Initial check after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        if (!checkCSSLoaded()) {
          console.warn('[CSS Recovery] Initial CSS check failed, attempting recovery...');
          forceInjectStyles();
        }
      }, 100);
    });
  } else {
    // DOM already loaded, check immediately
    setTimeout(() => {
      if (!checkCSSLoaded()) {
        console.warn('[CSS Recovery] CSS check failed, attempting recovery...');
        forceInjectStyles();
      }
    }, 100);
  }
  
  // Monitor for hydration errors
  const originalError = console.error;
  console.error = function(...args) {
    const errorStr = args.join(' ');
    if (errorStr.includes('Hydration') || 
        errorStr.includes('did not match') ||
        errorStr.includes('Extra attributes from the server')) {
      console.warn('[CSS Recovery] Hydration error detected, checking CSS...');
      setTimeout(() => {
        if (!checkCSSLoaded()) {
          forceInjectStyles();
        }
      }, 50);
    }
    originalError.apply(console, args);
  };
  
  // Periodic check as last resort
  let checkCount = 0;
  const checkInterval = setInterval(() => {
    checkCount++;
    if (checkCount > 10) {
      clearInterval(checkInterval);
      return;
    }
    
    if (!checkCSSLoaded()) {
      console.warn('[CSS Recovery] Periodic check failed, attempting recovery...');
      forceInjectStyles();
      clearInterval(checkInterval);
    }
  }, 500);
}

/**
 * Initialize on import
 */
if (typeof window !== 'undefined') {
  initCSSMonitor();
}

export default {
  forceInjectStyles,
  checkCSSLoaded,
  cleanupExtensionAttributes,
  initCSSMonitor
};