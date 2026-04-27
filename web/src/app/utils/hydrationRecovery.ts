/**
 * Hydration Recovery System
 * Handles React SSR hydration mismatches caused by browser extensions
 */

import { forceInjectStyles, checkCSSLoaded } from './cssRecovery';

// Track hydration state
let hydrationFailed = false;
let recoveryAttempted = false;

/**
 * Initialize hydration recovery system
 */
export function initHydrationRecovery() {
  if (typeof window === 'undefined') return;
  
  // Intercept React warnings
  interceptReactWarnings();
  
  // Clean DOM before hydration
  cleanDOMForHydration();
  
  // Monitor for hydration failures
  monitorHydrationErrors();
}

/**
 * Clean DOM of extension-injected attributes before React hydrates
 */
export function cleanDOMForHydration() {
  const problematicAttributes = [
    'data-new-gr-c-s-check-loaded',
    'data-gr-ext-installed',
    'data-gr-c-s-loaded',
    'data-gramm',
    'data-gramm_editor',
    'data-grammarly-shadow-root',
    'data-lt-installed',
    'data-lt-active',
    'data-darkreader',
    'data-darkreader-mode',
    'data-darkreader-scheme',
    'data-rh',
    'data-savepage-used',
    'data-lastpass-icon',
    'data-lastpass-root',
    'translate',
    'goog_translated_js',
    'data-google-translate-element'
  ];
  
  // Clean HTML and BODY elements
  [document.documentElement, document.body].forEach(element => {
    if (!element) return;
    
    problematicAttributes.forEach(attr => {
      element.removeAttribute(attr);
    });
    
    // Remove any extension-injected elements
    element.querySelectorAll('grammarly-desktop-integration, grammarly-extension').forEach(el => {
      el.remove();
    });
  });
  
  // Remove extension style tags
  document.querySelectorAll('style[data-styled], style[data-emotion]').forEach(style => {
    if (style.textContent?.includes('grammarly') || 
        style.textContent?.includes('lastpass') ||
        style.textContent?.includes('darkreader')) {
      style.remove();
    }
  });
}

/**
 * Intercept React warnings and handle them
 */
function interceptReactWarnings() {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = function(...args) {
    const message = args[0]?.toString() || '';
    
    // Check for hydration warnings
    if (message.includes('Extra attributes from the server') ||
        message.includes('Warning: Prop') ||
        message.includes('did not match')) {
      handleHydrationWarning(message);
    }
    
    // Still log the original warning
    originalWarn.apply(console, args);
  };
  
  console.error = function(...args) {
    const message = args[0]?.toString() || '';
    
    // Check for hydration errors
    if (message.includes('Hydration failed') ||
        message.includes('There was an error while hydrating') ||
        message.includes('Text content did not match')) {
      handleHydrationError(message);
    }
    
    // Still log the original error
    originalError.apply(console, args);
  };
}

/**
 * Handle hydration warnings
 */
function handleHydrationWarning(message: string) {
  console.log('[Hydration Recovery] Warning detected:', message.substring(0, 100));
  
  // Clean DOM again
  cleanDOMForHydration();
  
  // Check CSS after a brief delay
  setTimeout(() => {
    if (!checkCSSLoaded()) {
      console.log('[Hydration Recovery] CSS missing after warning, injecting...');
      forceInjectStyles();
    }
  }, 50);
}

/**
 * Handle hydration errors
 */
function handleHydrationError(message: string) {
  hydrationFailed = true;
  console.log('[Hydration Recovery] Error detected:', message.substring(0, 100));
  
  if (!recoveryAttempted) {
    recoveryAttempted = true;
    recoverFromHydrationFailure();
  }
}

/**
 * Monitor for hydration errors using MutationObserver
 */
function monitorHydrationErrors() {
  // Watch for React root being replaced (sign of hydration failure)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        // Check if React replaced the entire tree
        if (mutation.removedNodes.length > 0 && mutation.addedNodes.length > 0) {
          const hasReactRoot = Array.from(mutation.addedNodes).some(node => {
            return (node as Element).id === 'root' || 
                   (node as Element).className?.includes('__next');
          });
          
          if (hasReactRoot && !recoveryAttempted) {
            console.log('[Hydration Recovery] React root replacement detected');
            setTimeout(() => recoverFromHydrationFailure(), 100);
          }
        }
      }
    });
  });
  
  // Start observing body for changes
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: false
    });
  }
  
  // Stop observing after initial load
  setTimeout(() => observer.disconnect(), 5000);
}

/**
 * Recover from hydration failure
 */
function recoverFromHydrationFailure() {
  console.log('[Hydration Recovery] Attempting recovery...');
  
  // 1. Clean DOM one more time
  cleanDOMForHydration();
  
  // 2. Force inject styles
  forceInjectStyles();
  
  // 3. Force React to re-render if possible
  if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('[Hydration Recovery] Forcing React re-render...');
    try {
      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook.checkDCE) {
        hook.checkDCE(() => {
          console.log('[Hydration Recovery] React re-render triggered');
        });
      }
    } catch (e) {
      console.error('[Hydration Recovery] Failed to trigger React re-render:', e);
    }
  }
  
  // 4. Final CSS check
  setTimeout(() => {
    if (!checkCSSLoaded()) {
      console.error('[Hydration Recovery] CSS still not loaded after recovery');
      // Last resort - reload the page
      if (confirm('The page styling failed to load. Would you like to refresh the page?')) {
        window.location.reload();
      }
    } else {
      console.log('[Hydration Recovery] Recovery successful, CSS loaded');
    }
  }, 500);
}

/**
 * Export recovery state
 */
export function isHydrationFailed() {
  return hydrationFailed;
}

/**
 * Initialize on import
 */
if (typeof window !== 'undefined') {
  // Initialize before React hydrates
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHydrationRecovery);
  } else {
    initHydrationRecovery();
  }
}

export default {
  initHydrationRecovery,
  cleanDOMForHydration,
  isHydrationFailed
};