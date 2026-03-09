/**
 * Minimal type declaration for lru-cache v5.
 * Only covers the API surface used by this project.
 */
declare module 'lru-cache' {
  interface Options<K = string, V = unknown> {
    max?: number;
    maxSize?: number;
    maxAge?: number;
    sizeCalculation?: (value: V, key?: K) => number;
  }

  class LRUCache<K = string, V = unknown> {
    constructor(options?: Options<K, V>);
    set(key: K, value: V, maxAge?: number): boolean;
    get(key: K): V | undefined;
    has(key: K): boolean;
  }

  export default LRUCache;
}
