// OFF to GLB Converter Entry Point
// Exposes parseOff and exportGlb functions globally for use in webview

import { parseOff } from './import_off';
import { exportGlb } from './export_glb';

// Declare window object for TypeScript
declare const window: Window & {
    parseOff: typeof parseOff;
    exportGlb: typeof exportGlb;
};

// Export functions globally
if (typeof window !== 'undefined') {
    window.parseOff = parseOff;
    window.exportGlb = exportGlb;
    console.log('OFF-GLB converter loaded - parseOff and exportGlb functions available globally');
} else if (typeof global !== 'undefined') {
    // For Node.js/testing environments
    (global as any).parseOff = parseOff;
    (global as any).exportGlb = exportGlb;
    console.log('OFF-GLB converter loaded - parseOff and exportGlb functions available globally (Node.js)');
}
