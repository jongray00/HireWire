import { startTransition, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import './global.css';
import { injectCriticalStyles } from './utils/inlineStyles';

// Force CSS injection before React renders
const forceLoadCSS = () => {
  // First inject inline styles
  injectCriticalStyles();

  // Method 1: Create a link tag with timestamp to bust cache
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = `/src/app/global.css?t=${Date.now()}`;
  cssLink.setAttribute('data-css-forced', 'true');
  document.head.appendChild(cssLink);

  // Method 2: Import the CSS module directly
  import('./global.css').catch(() => {
    console.warn('CSS module import failed, using fallback');
  });

  // Method 3: Force style recalculation
  document.documentElement.style.display = 'none';
  document.documentElement.offsetHeight; // Force reflow
  document.documentElement.style.display = '';
};

// Clean browser extension attributes before rendering
const cleanExtensionAttributes = () => {
  const attrs = [
    'data-new-gr-c-s-check-loaded',
    'data-gr-ext-installed',
    'data-gramm',
    'data-grammarly-shadow-root',
    'translate'
  ];

  [document.documentElement, document.body].forEach(el => {
    if (el) {
      attrs.forEach(attr => el.removeAttribute(attr));
    }
  });
};

// Inject critical styles IMMEDIATELY on page load
injectCriticalStyles();

// Initialize before React renders
cleanExtensionAttributes();
forceLoadCSS();

// Clear any server-rendered content and use client-only rendering
if (document.body) {
  document.body.innerHTML = '';
}

// Wait a moment for styles to load, then render (client-only, no hydration)
setTimeout(() => {
  startTransition(() => {
    const root = createRoot(document);
    root.render(
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    );
  });
}, 100);