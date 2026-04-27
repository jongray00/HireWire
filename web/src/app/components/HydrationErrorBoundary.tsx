import React, { Component, useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasHydrationError: boolean;
  stylesInjected: boolean;
}

class HydrationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasHydrationError: false,
      stylesInjected: false,
    };
  }

  static getDerivedStateFromError(error: Error): State | null {
    // Check if it's a hydration error
    if (
      error.message?.includes('Hydration') ||
      error.message?.includes('Text content did not match') ||
      error.message?.includes('did not match')
    ) {
      return { hasHydrationError: true, stylesInjected: false };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('Hydration error caught:', error.message);
    
    // Force inject styles on hydration error
    this.injectStyles();
  }

  injectStyles = () => {
    // Check if styles are already present
    const existingStyles = document.head.querySelector('[data-css-recovery]');
    if (existingStyles || this.state.stylesInjected) return;

    // Force inject critical styles
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-css-recovery', 'true');
    styleTag.textContent = `
      /* Critical recovery styles */
      @import url('/src/app/global.css');
      
      /* Ensure Tailwind styles are loaded */
      body { 
        margin: 0; 
        padding: 0; 
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      /* Force re-apply Tailwind */
      [class*="bg-"], [class*="text-"], [class*="p-"], [class*="m-"], 
      [class*="flex"], [class*="grid"], [class*="rounded"], [class*="shadow"] {
        /* Trigger style recalculation */
        opacity: 0.999;
        animation: forceRepaint 0.01s;
      }
      
      @keyframes forceRepaint {
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(styleTag);

    // Force import global styles module
    import('../global.css').then(() => {
      console.log('Global styles re-imported after hydration error');
      this.setState({ stylesInjected: true });
    }).catch(err => {
      console.error('Failed to re-import styles:', err);
    });

    // Force a repaint
    requestAnimationFrame(() => {
      document.body.style.display = 'none';
      document.body.offsetHeight; // Trigger reflow
      document.body.style.display = '';
    });
  };

  render() {
    if (this.state.hasHydrationError) {
      // Attempt client-only render with forced style injection
      if (!this.state.stylesInjected) {
        this.injectStyles();
      }
    }

    return this.props.children;
  }
}

// Hook to suppress hydration warnings on specific elements
export function useSuppressHydrationWarning() {
  useEffect(() => {
    // Add suppressHydrationWarning to body and html elements
    const html = document.documentElement;
    const body = document.body;
    
    // Set attribute to suppress warnings for extension-injected attributes
    if (html) html.setAttribute('suppressHydrationWarning', 'true');
    if (body) body.setAttribute('suppressHydrationWarning', 'true');

    // Clean up Grammarly and other extension attributes
    const extensionAttrs = [
      'data-new-gr-c-s-check-loaded',
      'data-gr-ext-installed',
      'data-gramm',
      'data-gramm_editor',
      'data-gr-c-s-loaded'
    ];

    extensionAttrs.forEach(attr => {
      html?.removeAttribute(attr);
      body?.removeAttribute(attr);
    });
  }, []);
}

export default HydrationErrorBoundary;