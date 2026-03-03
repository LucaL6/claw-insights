// src/context/read-context.ts

/**
 * Re-export createReadContext from ports/shared for convenience.
 * This allows consumers to import from context/ instead of ports/.
 */
export { createReadContext, type ReadContext } from '../ports/shared.js';
