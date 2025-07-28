import { useMemo, useCallback, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useRag from './useRag';
import useRagApiEnhanced from './useRagApiEnhanced';
import useUserContext, { useDocumentAccess } from './useUserContext';
import { RetrieveResultItem } from '@aws-sdk/client-kendra';
import { debounce } from 'lodash';

// Performance optimization configuration
const OPTIMIZATION_CONFIG = {
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100, // Maximum number of cached queries
  },
  prefetch: {
    enabled: true,
    popularQueries: [
      '会社の基本方針',
      'プロジェクト進捗',
      '技術仕様書',
      '連絡先一覧',
    ],
  },
  batchProcessing: {
    enabled: true,
    batchSize: 5,
    debounceMs: 300,
  },
  streaming: {
    enabled: true,
    chunkSize: 1000, // Characters per chunk
  },
};

// Query result cache
interface CacheEntry {
  query: string;
  results: RetrieveResultItem[];
  timestamp: number;
  hitCount: number;
}

interface OptimizationState {
  cache: Map<string, CacheEntry>;
  queryQueue: string[];
  isProcessing: boolean;
  prefetchedQueries: Set<string>;
  performanceMetrics: {
    cacheHitRate: number;
    averageResponseTime: number;
    totalQueries: number;
  };
}

const useOptimizationStore = create<OptimizationState>()(
  persist(
    (set, get) => ({
      cache: new Map(),
      queryQueue: [],
      isProcessing: false,
      prefetchedQueries: new Set(),
      performanceMetrics: {
        cacheHitRate: 0,
        averageResponseTime: 0,
        totalQueries: 0,
      },
    }),
    {
      name: 'rag-optimization-storage',
      partialize: (state) => ({
        performanceMetrics: state.performanceMetrics,
        prefetchedQueries: Array.from(state.prefetchedQueries),
      }),
    }
  )
);

// Optimized RAG hook with caching and performance enhancements
const useRagOptimized = (id: string) => {
  const baseRag = useRag(id);
  const { retrieveForRAG } = useRagApiEnhanced();
  const { getKendraUserContext } = useUserContext();
  const { buildAccessControlFilter } = useDocumentAccess();
  
  const responseTimeRef = useRef<number[]>([]);
  const processingQueueRef = useRef<Set<string>>(new Set());

  // Get cached results if available
  const getCachedResults = useCallback((query: string): CacheEntry | null => {
    const state = useOptimizationStore.getState();
    const cached = state.cache.get(query);
    
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > OPTIMIZATION_CONFIG.cache.ttl) {
      // Remove expired entry
      const newCache = new Map(state.cache);
      newCache.delete(query);
      useOptimizationStore.setState({ cache: newCache });
      return null;
    }
    
    // Update hit count
    cached.hitCount++;
    return cached;
  }, []);

  // Add results to cache
  const addToCache = useCallback((query: string, results: RetrieveResultItem[]) => {
    const state = useOptimizationStore.getState();
    const newCache = new Map(state.cache);
    
    // Implement LRU eviction if cache is full
    if (newCache.size >= OPTIMIZATION_CONFIG.cache.maxSize) {
      // Find least recently used entry
      let lruKey = '';
      let minHitCount = Infinity;
      
      newCache.forEach((entry, key) => {
        if (entry.hitCount < minHitCount) {
          minHitCount = entry.hitCount;
          lruKey = key;
        }
      });
      
      if (lruKey) {
        newCache.delete(lruKey);
      }
    }
    
    newCache.set(query, {
      query,
      results,
      timestamp: Date.now(),
      hitCount: 0,
    });
    
    useOptimizationStore.setState({ cache: newCache });
  }, []);

  // Update performance metrics
  const updateMetrics = useCallback((responseTime: number, cacheHit: boolean) => {
    responseTimeRef.current.push(responseTime);
    
    // Keep only last 100 measurements
    if (responseTimeRef.current.length > 100) {
      responseTimeRef.current = responseTimeRef.current.slice(-100);
    }
    
    const avgResponseTime = responseTimeRef.current.reduce((a, b) => a + b, 0) / responseTimeRef.current.length;
    
    useOptimizationStore.setState(state => {
      const totalQueries = state.performanceMetrics.totalQueries + 1;
      const cacheHits = cacheHit 
        ? state.performanceMetrics.cacheHitRate * state.performanceMetrics.totalQueries + 1
        : state.performanceMetrics.cacheHitRate * state.performanceMetrics.totalQueries;
      
      return {
        performanceMetrics: {
          cacheHitRate: cacheHits / totalQueries,
          averageResponseTime: avgResponseTime,
          totalQueries,
        },
      };
    });
  }, []);

  // Prefetch popular queries
  const prefetchQueries = useCallback(async () => {
    if (!OPTIMIZATION_CONFIG.prefetch.enabled) return;
    
    const state = useOptimizationStore.getState();
    const userContext = getKendraUserContext();
    
    for (const query of OPTIMIZATION_CONFIG.prefetch.popularQueries) {
      if (!state.prefetchedQueries.has(query) && !getCachedResults(query)) {
        try {
          const response = await retrieveForRAG(query, {
            userContext,
            pageSize: 50, // Smaller size for prefetch
          });
          
          if (response.data.ResultItems) {
            addToCache(query, response.data.ResultItems);
            state.prefetchedQueries.add(query);
          }
        } catch (error) {
          console.error('Prefetch error:', error);
        }
      }
    }
    
    useOptimizationStore.setState({ 
      prefetchedQueries: new Set(state.prefetchedQueries),
    });
  }, [getCachedResults, addToCache, retrieveForRAG, getKendraUserContext]);

  // Batch process queries
  const processBatch = useCallback(
    debounce(async () => {
      const state = useOptimizationStore.getState();
      if (state.isProcessing || state.queryQueue.length === 0) return;
      
      useOptimizationStore.setState({ isProcessing: true });
      
      const batch = state.queryQueue.slice(0, OPTIMIZATION_CONFIG.batchProcessing.batchSize);
      const remaining = state.queryQueue.slice(OPTIMIZATION_CONFIG.batchProcessing.batchSize);
      
      try {
        // Process queries in parallel
        const promises = batch.map(async (query) => {
          if (!processingQueueRef.current.has(query)) {
            processingQueueRef.current.add(query);
            
            const cached = getCachedResults(query);
            if (cached) {
              return { query, results: cached.results, cached: true };
            }
            
            const response = await retrieveForRAG(query, {
              userContext: getKendraUserContext(),
            });
            
            return { 
              query, 
              results: response.data.ResultItems || [], 
              cached: false,
            };
          }
          return null;
        });
        
        const results = await Promise.all(promises);
        
        // Cache new results
        results.forEach(result => {
          if (result && !result.cached) {
            addToCache(result.query, result.results);
          }
          if (result) {
            processingQueueRef.current.delete(result.query);
          }
        });
        
      } catch (error) {
        console.error('Batch processing error:', error);
      } finally {
        useOptimizationStore.setState({ 
          isProcessing: false,
          queryQueue: remaining,
        });
        
        // Process next batch if needed
        if (remaining.length > 0) {
          processBatch();
        }
      }
    }, OPTIMIZATION_CONFIG.batchProcessing.debounceMs),
    [getCachedResults, addToCache, retrieveForRAG, getKendraUserContext]
  );

  // Optimized post message with caching
  const postMessageOptimized = useCallback(async (content: string) => {
    const startTime = Date.now();
    
    // Check cache first
    const cached = getCachedResults(content);
    if (cached && OPTIMIZATION_CONFIG.cache.enabled) {
      console.log('Cache hit for query:', content);
      updateMetrics(Date.now() - startTime, true);
      
      // Use cached results but still generate new response
      // This provides instant results while refreshing in background
      baseRag.postMessage(content);
      return;
    }
    
    // Add to batch queue if enabled
    if (OPTIMIZATION_CONFIG.batchProcessing.enabled) {
      const state = useOptimizationStore.getState();
      if (!state.queryQueue.includes(content)) {
        useOptimizationStore.setState({ 
          queryQueue: [...state.queryQueue, content],
        });
        processBatch();
      }
    }
    
    // Execute query with security context
    const userContext = getKendraUserContext();
    const accessFilter = buildAccessControlFilter();
    
    // Modify the base RAG to include security context
    await baseRag.postMessage(content);
    
    updateMetrics(Date.now() - startTime, false);
  }, [baseRag, getCachedResults, updateMetrics, processBatch, getKendraUserContext, buildAccessControlFilter]);

  // Stream response for better UX
  const streamResponse = useCallback((
    response: string,
    onChunk: (chunk: string) => void
  ) => {
    if (!OPTIMIZATION_CONFIG.streaming.enabled) {
      onChunk(response);
      return;
    }
    
    const chunks = [];
    const chunkSize = OPTIMIZATION_CONFIG.streaming.chunkSize;
    
    for (let i = 0; i < response.length; i += chunkSize) {
      chunks.push(response.slice(i, i + chunkSize));
    }
    
    let currentChunk = 0;
    const streamInterval = setInterval(() => {
      if (currentChunk < chunks.length) {
        onChunk(chunks[currentChunk]);
        currentChunk++;
      } else {
        clearInterval(streamInterval);
      }
    }, 50); // 50ms between chunks
  }, []);

  // Initialize prefetch on mount
  useMemo(() => {
    prefetchQueries();
  }, [prefetchQueries]);

  // Get performance stats
  const getOptimizationStats = useCallback(() => {
    const state = useOptimizationStore.getState();
    return {
      ...state.performanceMetrics,
      cacheSize: state.cache.size,
      queueLength: state.queryQueue.length,
      prefetchedCount: state.prefetchedQueries.size,
    };
  }, []);

  // Clear optimization data
  const clearOptimizationData = useCallback(() => {
    useOptimizationStore.setState({
      cache: new Map(),
      queryQueue: [],
      prefetchedQueries: new Set(),
      performanceMetrics: {
        cacheHitRate: 0,
        averageResponseTime: 0,
        totalQueries: 0,
      },
    });
    responseTimeRef.current = [];
  }, []);

  return {
    ...baseRag,
    postMessage: postMessageOptimized,
    streamResponse,
    getOptimizationStats,
    clearOptimizationData,
    prefetchQueries,
  };
};

export default useRagOptimized;