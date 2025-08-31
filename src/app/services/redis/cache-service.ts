interface CacheOptions {
  prefix?: string;
  ttl?: number; // Time-to-live in seconds
}

// In-memory fallback cache for client-side
class MemoryCache {
  private cache: Map<string, { value: any; expires: number | null }> = new Map();

  async get<T>(key: string, prefix?: string): Promise<T | null> {
    const fullKey = prefix ? `${prefix}:${key}` : key;
    const item = this.cache.get(fullKey);
    
    if (!item) return null;
    
    // Check if expired
    if (item.expires !== null && item.expires < Date.now()) {
      this.cache.delete(fullKey);
      return null;
    }
    
    return item.value as T;
  }

  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
    const expires = options?.ttl ? Date.now() + options.ttl * 1000 : null;
    
    this.cache.set(fullKey, { value, expires });
    return true;
  }

  async delete(key: string, prefix?: string): Promise<boolean> {
    const fullKey = prefix ? `${prefix}:${key}` : key;
    return this.cache.delete(fullKey);
  }

  async clearByPattern(pattern: string): Promise<number> {
    // Simple pattern matching for memory cache (only supports prefix*)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      let count = 0;
      
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          count++;
        }
      }
      
      return count;
    }
    
    return 0;
  }

  async exists(key: string, prefix?: string): Promise<boolean> {
    const fullKey = prefix ? `${prefix}:${key}` : key;
    return this.cache.has(fullKey);
  }
}

// Client-safe cache service
class CacheService {
  private memoryCache = new MemoryCache();

  async get<T>(key: string, prefix?: string): Promise<T | null> {
    // Always use memory cache on the client side
    return this.memoryCache.get<T>(key, prefix);
  }

  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    // Always use memory cache on the client side
    return this.memoryCache.set(key, value, options);
  }

  async delete(key: string, prefix?: string): Promise<boolean> {
    // Always use memory cache on the client side
    return this.memoryCache.delete(key, prefix);
  }

  async clearByPattern(pattern: string): Promise<number> {
    // Always use memory cache on the client side
    return this.memoryCache.clearByPattern(pattern);
  }

  async exists(key: string, prefix?: string): Promise<boolean> {
    // Always use memory cache on the client side
    return this.memoryCache.exists(key, prefix);
  }
}

// Export a singleton instance
export const cacheService = new CacheService();