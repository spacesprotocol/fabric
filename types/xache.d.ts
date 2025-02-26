declare module 'xache' {
    export interface MaxCacheOptions {
        maxSize: number;
        maxAge: number;
        createMap?: () => Map<any, any>;
        ongc?: (oldest: Map<any, any>) => void;
    }

    export default class Cache {
      public maxSize: number;
      public maxAge: number;
      public ongc: ((oldest: Map<any, any>) => void) | null;

      constructor(options: MaxCacheOptions);

      // Iterator over the maps
      [Symbol.iterator](): IterableIterator<[any, any]>;

      // Iterator over the keys
      keys(): IterableIterator<any>;

      // Iterator over the values
      values(): IterableIterator<any>;

      // Destroys the cache, clearing all intervals and data
      destroy(): void;

      // Clears all entries in the cache
      clear(): void;

      // Adds an item to the cache
      set(k: any, v: any): this;

      // Retains an item in the cache, preventing it from being evicted
      retain(k: any, v: any): this;

      // Deletes an item from the cache
      delete(k: any): boolean;

      // Checks if an item exists in the cache
      has(k: any): boolean;

      // Gets an item from the cache
      get(k: any): any | null;
    }
}
