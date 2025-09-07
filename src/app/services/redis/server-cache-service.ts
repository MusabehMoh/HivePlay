'use server';

import { createClient, RedisClientType } from 'redis';

interface CacheOptions {
  prefix?: string;
  ttl?: number; // Time-to-live in seconds
}

// Create a singleton client to be shared across functions
let client: RedisClientType | null = null;
let isConnected = false;

// Initialize Redis client
async function initializeClient() {
  if (client) return;
  
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = createClient({ url: redisUrl });
    
    client.on('error', (err) => {
      console.error('Redis connection error:', err);
      isConnected = false;
    });
    
    client.on('connect', () => {
      console.log('Redis client connected');
      isConnected = true;
    });
    
    client.on('reconnecting', () => {
      console.log('Redis client reconnecting');
      isConnected = false;
    });
    
    await client.connect();
  } catch (err) {
    console.error('Failed to initialize Redis client:', err);
    client = null;
  }
}

/**
 * Get a value from cache
 * @param key Cache key
 * @param prefix Optional prefix
 * @returns The cached value or null if not found
 */
export async function getFromCache<T>(key: string, prefix?: string): Promise<T | null> {
  await initializeClient();
  
  if (!client || !isConnected) {
    console.warn('Redis client not connected, skipping cache get');
    return null;
  }

  try {
    const fullKey = prefix ? `${prefix}:${key}` : key;
    const data = await client.get(fullKey);
    
    if (!data) return null;
    
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Redis cache get error:', error);
    return null;
  }
}

/**
 * Set a value in cache
 * @param key Cache key
 * @param value Value to cache
 * @param options Cache options (prefix and TTL)
 * @returns Promise<boolean> True if successful
 */
export async function setInCache(key: string, value: any, options?: CacheOptions): Promise<boolean> {
  await initializeClient();
  
  if (!client || !isConnected) {
    console.warn('Redis client not connected, skipping cache set');
    return false;
  }

  try {
    const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
    const serializedValue = JSON.stringify(value);
    
    if (options?.ttl) {
      await client.set(fullKey, serializedValue, { EX: options.ttl });
    } else {
      await client.set(fullKey, serializedValue);
    }
    
    return true;
  } catch (error) {
    console.error('Redis cache set error:', error);
    return false;
  }
}

/**
 * Delete a value from cache
 * @param key Cache key
 * @param prefix Optional prefix
 * @returns Promise<boolean> True if successful
 */
export async function deleteFromCache(key: string, prefix?: string): Promise<boolean> {
  await initializeClient();
  
  if (!client || !isConnected) {
    console.warn('Redis client not connected, skipping cache delete');
    return false;
  }

  try {
    const fullKey = prefix ? `${prefix}:${key}` : key;
    await client.del(fullKey);
    return true;
  } catch (error) {
    console.error('Redis cache delete error:', error);
    return false;
  }
}

/**
 * Clear cache entries by pattern (using SCAN for safety)
 * @param pattern Pattern to match keys (e.g., "prefix:*")
 * @returns Number of keys deleted
 */
export async function clearByPattern(pattern: string): Promise<number> {
  await initializeClient();
  
  if (!client || !isConnected) {
    console.warn('Redis client not connected, skipping clearByPattern');
    return 0;
  }

  try {
    let cursor = 0;
    let deleteCount = 0;
    
    do {
      const scanResult = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      cursor = scanResult.cursor;
      
      if (scanResult.keys.length > 0) {
        await client.del(scanResult.keys);
        deleteCount += scanResult.keys.length;
      }
    } while (cursor !== 0);
    
    return deleteCount;
  } catch (error) {
    console.error('Redis clearByPattern error:', error);
    return 0;
  }
}

/**
 * Check if a key exists in cache
 * @param key Cache key
 * @param prefix Optional prefix
 * @returns Promise<boolean> True if exists
 */
export async function existsInCache(key: string, prefix?: string): Promise<boolean> {
  await initializeClient();
  
  if (!client || !isConnected) {
    return false;
  }

  try {
    const fullKey = prefix ? `${prefix}:${key}` : key;
    return (await client.exists(fullKey)) === 1;
  } catch (error) {
    console.error('Redis cache exists error:', error);
    return false;
  }
}