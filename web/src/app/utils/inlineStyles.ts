/**
 * Inline Critical CSS - Ensures styles are always loaded
 * This contains the essential Tailwind utilities and custom styles
 */

export const injectCriticalStyles = () => {
  // Check if styles already injected
  if (document.getElementById('critical-inline-styles')) return;
  
  const styleTag = document.createElement('style');
  styleTag.id = 'critical-inline-styles';
  styleTag.textContent = `
    /* Reset and Base */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; }
    body { margin: 0; padding: 0; min-height: 100vh; }
    
    /* Critical Tailwind Utilities */
    .bg-gray-50 { background-color: rgb(249 250 251); }
    .bg-gray-100 { background-color: rgb(243 244 246); }
    .bg-white { background-color: rgb(255 255 255); }
    .bg-blue-50 { background-color: rgb(239 246 255); }
    .bg-blue-100 { background-color: rgb(219 234 254); }
    .bg-blue-500 { background-color: rgb(59 130 246); }
    .bg-blue-600 { background-color: rgb(37 99 235); }
    .bg-purple-600 { background-color: rgb(147 51 234); }
    .bg-purple-700 { background-color: rgb(126 34 206); }
    .bg-yellow-50 { background-color: rgb(254 252 232); }
    .bg-yellow-100 { background-color: rgb(254 249 195); }
    .bg-green-50 { background-color: rgb(240 253 244); }
    .bg-green-100 { background-color: rgb(220 252 231); }
    .bg-green-500 { background-color: rgb(34 197 94); }
    .bg-gray-800 { background-color: rgb(31 41 55); }
    .bg-gray-900 { background-color: rgb(17 24 39); }
    
    /* Dark Mode Critical Styles */
    .dark .bg-gray-50,
    .dark .dark\\:bg-gray-900 { background-color: rgb(17 24 39) !important; }
    .dark .bg-gray-100,
    .dark .dark\\:bg-gray-800 { background-color: rgb(31 41 55) !important; }
    .dark .bg-white,
    .dark .dark\\:bg-sw-charcoal-700 { background-color: #1a1f28 !important; }
    .dark .dark\\:bg-sw-charcoal-800 { background-color: #0a0f1a !important; }
    .dark .dark\\:bg-sw-charcoal-900 { background-color: #050910 !important; }
    .dark .dark\\:from-sw-charcoal-900 { --tw-gradient-from: #050910 !important; }
    .dark .dark\\:to-sw-charcoal-800 { --tw-gradient-to: #0a0f1a !important; }
    .dark .dark\\:border-sw-border-dark { border-color: #3a4149 !important; }
    .dark .dark\\:text-white { color: rgb(255 255 255) !important; }
    .dark .dark\\:text-gray-300 { color: rgb(209 213 219) !important; }
    .dark .dark\\:text-gray-400 { color: rgb(156 163 175) !important; }
    .dark .dark\\:text-blue-400 { color: rgb(96 165 250) !important; }
    .dark .dark\\:text-blue-300 { color: rgb(147 197 253) !important; }
    .dark .dark\\:text-green-400 { color: rgb(74 222 128) !important; }
    .dark .dark\\:text-purple-400 { color: rgb(196 181 253) !important; }
    .dark .dark\\:text-yellow-400 { color: rgb(250 204 21) !important; }
    
    .text-white { color: rgb(255 255 255); }
    .text-gray-50 { color: rgb(249 250 251); }
    .text-gray-400 { color: rgb(156 163 175); }
    .text-gray-500 { color: rgb(107 114 128); }
    .text-gray-600 { color: rgb(75 85 99); }
    .text-gray-700 { color: rgb(55 65 81); }
    .text-gray-800 { color: rgb(31 41 55); }
    .text-gray-900 { color: rgb(17 24 39); }
    .text-blue-500 { color: rgb(59 130 246); }
    .text-blue-600 { color: rgb(37 99 235); }
    .text-blue-700 { color: rgb(29 78 216); }
    .text-purple-600 { color: rgb(147 51 234); }
    .text-green-600 { color: rgb(22 163 74); }
    .text-green-700 { color: rgb(21 128 61); }
    .text-yellow-600 { color: rgb(202 138 4); }
    .text-yellow-700 { color: rgb(161 98 7); }
    .text-yellow-800 { color: rgb(133 77 14); }
    
    /* Layout */
    .flex { display: flex; }
    .inline-flex { display: inline-flex; }
    .grid { display: grid; }
    .hidden { display: none; }
    .block { display: block; }
    .inline-block { display: inline-block; }
    .relative { position: relative; }
    .absolute { position: absolute; }
    .fixed { position: fixed; }
    
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .flex-col { flex-direction: column; }
    .flex-row { flex-direction: row; }
    .gap-1 { gap: 0.25rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .gap-8 { gap: 2rem; }
    
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    
    /* Spacing */
    .p-0 { padding: 0; }
    .p-1 { padding: 0.25rem; }
    .p-2 { padding: 0.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-5 { padding: 1.25rem; }
    .p-6 { padding: 1.5rem; }
    .p-8 { padding: 2rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .pb-2 { padding-bottom: 0.5rem; }
    
    .m-0 { margin: 0; }
    .m-4 { margin: 1rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .mt-6 { margin-top: 1.5rem; }
    .mt-8 { margin-top: 2rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .ml-2 { margin-left: 0.5rem; }
    .mr-2 { margin-right: 0.5rem; }
    
    .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
    .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
    .space-x-2 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.5rem; }
    
    /* Sizing */
    .w-full { width: 100%; }
    .w-5 { width: 1.25rem; }
    .w-6 { width: 1.5rem; }
    .w-8 { width: 2rem; }
    .w-10 { width: 2.5rem; }
    .w-12 { width: 3rem; }
    .h-5 { height: 1.25rem; }
    .h-6 { height: 1.5rem; }
    .h-8 { height: 2rem; }
    .h-10 { height: 2.5rem; }
    .h-12 { height: 3rem; }
    .h-full { height: 100%; }
    .h-screen { height: 100vh; }
    .min-h-screen { min-height: 100vh; }
    .max-w-md { max-width: 28rem; }
    .max-w-lg { max-width: 32rem; }
    .max-w-4xl { max-width: 56rem; }
    .max-w-6xl { max-width: 72rem; }
    .max-w-7xl { max-width: 80rem; }
    
    /* Typography */
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .text-base { font-size: 1rem; line-height: 1.5rem; }
    .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
    .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
    .text-2xl { font-size: 1.5rem; line-height: 2rem; }
    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
    .font-light { font-weight: 300; }
    .font-normal { font-weight: 400; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    
    /* Borders & Radius */
    .border { border-width: 1px; }
    .border-2 { border-width: 2px; }
    .border-gray-200 { border-color: rgb(229 231 235); }
    .border-gray-300 { border-color: rgb(209 213 219); }
    .border-blue-500 { border-color: rgb(59 130 246); }
    .border-green-500 { border-color: rgb(34 197 94); }
    .border-yellow-400 { border-color: rgb(250 204 21); }
    .border-l-4 { border-left-width: 4px; }
    .rounded { border-radius: 0.25rem; }
    .rounded-md { border-radius: 0.375rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-full { border-radius: 9999px; }
    
    /* Shadow */
    .shadow { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1); }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
    .shadow-md { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
    
    /* Effects */
    .opacity-0 { opacity: 0; }
    .opacity-50 { opacity: 0.5; }
    .opacity-75 { opacity: 0.75; }
    .opacity-100 { opacity: 1; }
    .hover\\:opacity-75:hover { opacity: 0.75; }
    .hover\\:bg-blue-600:hover { background-color: rgb(37 99 235); }
    .hover\\:bg-blue-700:hover { background-color: rgb(29 78 216); }
    .hover\\:bg-purple-700:hover { background-color: rgb(126 34 206); }
    .hover\\:bg-gray-100:hover { background-color: rgb(243 244 246); }
    .hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
    .transition { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .duration-200 { transition-duration: 200ms; }
    .duration-300 { transition-duration: 300ms; }
    
    /* Utility */
    .overflow-hidden { overflow: hidden; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cursor-pointer { cursor: pointer; }
    .select-none { user-select: none; }
    .outline-none { outline: 2px solid transparent; outline-offset: 2px; }
    .focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
    .ring-2 { box-shadow: 0 0 0 2px var(--tw-ring-color); }
    .ring-blue-500 { --tw-ring-color: rgb(59 130 246); }
    
    /* Custom styles for the app */
    input, textarea, select, button {
      outline: none;
    }
    input:focus, textarea:focus, select:focus, button:focus {
      outline: none;
    }
    
    /* SignalWire video container styles */
    #video-container video,
    #video-container > div > video {
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    #video-container > div {
      width: 100% !important;
      height: 100% !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    #video-container video[id*="local"],
    #video-container video.localVideo {
      display: none;
    }
  `;
  
  // Insert at the beginning of head to ensure it loads first
  const firstChild = document.head.firstChild;
  if (firstChild) {
    document.head.insertBefore(styleTag, firstChild);
  } else {
    document.head.appendChild(styleTag);
  }
  
  console.log('[Inline Styles] Critical CSS injected successfully');
};

// Auto-inject on module load
if (typeof window !== 'undefined') {
  injectCriticalStyles();
}