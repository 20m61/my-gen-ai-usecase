import { Auth } from 'aws-amplify';
import axios, { AxiosResponse } from 'axios';
import { RetrieveResultItem, QueryResultItem, FacetResult } from '@aws-sdk/client-kendra';
import { create } from 'zustand';

// Enhanced API types
export interface EnhancedKendraRequest {
  query: string;
  apiType?: 'retrieve' | 'query';
  pageSize?: number;
  pageNumber?: number;
  attributeFilter?: any;
  facets?: Array<{
    DocumentAttributeKey: string;
    MaxResults?: number;
  }>;
  userContext?: {
    token?: string;
    userId?: string;
    groups?: string[];
  };
  sortingConfiguration?: {
    DocumentAttributeKey: string;
    SortOrder: 'ASC' | 'DESC';
  };
  documentRelevanceOverride?: Array<{
    Name: string;
    Relevance: {
      Importance?: number;
      Duration?: string;
      RankOrder?: 'ASCENDING' | 'DESCENDING';
      ValueImportanceMap?: Record<string, number>;
    };
  }>;
  includeQuerySuggestions?: boolean;
}

export interface EnhancedRetrieveResponse {
  ResultItems?: RetrieveResultItem[];
  QueryId?: string;
  metadata: {
    apiType: 'retrieve';
    totalResults: number;
    queryId?: string;
    processingTime: string;
  };
}

export interface EnhancedQueryResponse {
  ResultItems?: QueryResultItem[];
  FacetResults?: FacetResult[];
  TotalNumberOfResults?: number;
  QueryId?: string;
  SpellCorrectedQueries?: Array<{
    SuggestedQueryText?: string;
  }>;
  processedFacets?: Array<{
    documentAttributeKey?: string;
    values?: Array<{
      value: any;
      count?: number;
    }>;
  }>;
  metadata: {
    apiType: 'query';
    totalResults: number;
    queryId?: string;
    processingTime: string;
    hasSuggestions: boolean;
  };
}

// State for caching and optimization
interface RagApiState {
  cache: Map<string, { data: any; timestamp: number }>;
  addToCache: (key: string, data: any) => void;
  getFromCache: (key: string) => any | null;
  clearCache: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const useRagApiStore = create<RagApiState>((set, get) => ({
  cache: new Map(),
  
  addToCache: (key: string, data: any) => {
    const cache = new Map(get().cache);
    cache.set(key, { data, timestamp: Date.now() });
    set({ cache });
  },
  
  getFromCache: (key: string) => {
    const cached = get().cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      // Cache expired
      const cache = new Map(get().cache);
      cache.delete(key);
      set({ cache });
      return null;
    }
    
    return cached.data;
  },
  
  clearCache: () => {
    set({ cache: new Map() });
  },
}));

const useRagApiEnhanced = () => {
  const { addToCache, getFromCache, clearCache } = useRagApiStore();

  // Enhanced retrieve function with caching
  const retrieveEnhanced = async (
    request: EnhancedKendraRequest
  ): Promise<AxiosResponse<EnhancedRetrieveResponse | EnhancedQueryResponse>> => {
    const token = await Auth.currentSession().then((session) =>
      session.getIdToken().getJwtToken()
    );
    
    // Generate cache key
    const cacheKey = JSON.stringify({
      query: request.query,
      apiType: request.apiType || 'retrieve',
      pageSize: request.pageSize,
      pageNumber: request.pageNumber,
    });
    
    // Check cache first
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      console.log('Returning cached result for query:', request.query);
      return { data: cachedResult } as AxiosResponse;
    }
    
    const endpoint = import.meta.env.VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT!;
    
    try {
      const result = await axios.post<EnhancedRetrieveResponse | EnhancedQueryResponse>(
        endpoint,
        request,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      // Cache successful results
      addToCache(cacheKey, result.data);
      
      return result;
    } catch (error) {
      console.error('Enhanced Kendra API error:', error);
      throw error;
    }
  };

  // Specialized retrieve function for RAG (uses Retrieve API)
  const retrieveForRAG = async (
    query: string,
    options?: {
      pageSize?: number;
      userContext?: EnhancedKendraRequest['userContext'];
      documentRelevanceOverride?: EnhancedKendraRequest['documentRelevanceOverride'];
    }
  ): Promise<AxiosResponse<EnhancedRetrieveResponse>> => {
    return retrieveEnhanced({
      query,
      apiType: 'retrieve',
      pageSize: options?.pageSize || 100,
      userContext: options?.userContext,
      documentRelevanceOverride: options?.documentRelevanceOverride,
    }) as Promise<AxiosResponse<EnhancedRetrieveResponse>>;
  };

  // Specialized query function for search UI (uses Query API)
  const queryForSearch = async (
    query: string,
    options?: {
      pageSize?: number;
      pageNumber?: number;
      facets?: EnhancedKendraRequest['facets'];
      attributeFilter?: any;
      sortingConfiguration?: EnhancedKendraRequest['sortingConfiguration'];
      includeQuerySuggestions?: boolean;
      userContext?: EnhancedKendraRequest['userContext'];
    }
  ): Promise<AxiosResponse<EnhancedQueryResponse>> => {
    return retrieveEnhanced({
      query,
      apiType: 'query',
      pageSize: options?.pageSize || 10,
      pageNumber: options?.pageNumber || 1,
      facets: options?.facets,
      attributeFilter: options?.attributeFilter,
      sortingConfiguration: options?.sortingConfiguration,
      includeQuerySuggestions: options?.includeQuerySuggestions,
      userContext: options?.userContext,
    }) as Promise<AxiosResponse<EnhancedQueryResponse>>;
  };

  // Faceted search helper
  const searchWithFacets = async (
    query: string,
    facetKeys: string[],
    filters?: Record<string, string[]>
  ): Promise<AxiosResponse<EnhancedQueryResponse>> => {
    const facets = facetKeys.map(key => ({
      DocumentAttributeKey: key,
      MaxResults: 10,
    }));
    
    // Build attribute filter from facet selections
    let attributeFilter;
    if (filters && Object.keys(filters).length > 0) {
      const filterConditions = Object.entries(filters).map(([key, values]) => ({
        OrAllFilters: values.map(value => ({
          EqualsTo: {
            Key: key,
            Value: { StringValue: value },
          },
        })),
      }));
      
      attributeFilter = filterConditions.length > 1
        ? { AndAllFilters: filterConditions }
        : filterConditions[0];
    }
    
    return queryForSearch(query, {
      facets,
      attributeFilter,
      includeQuerySuggestions: true,
    });
  };

  // Get suggested queries
  const getSuggestions = async (
    partialQuery: string
  ): Promise<string[]> => {
    try {
      const response = await queryForSearch(partialQuery, {
        pageSize: 1,
        includeQuerySuggestions: true,
      });
      
      return response.data.SpellCorrectedQueries?.map(
        suggestion => suggestion.SuggestedQueryText || ''
      ).filter(Boolean) || [];
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  };

  return {
    retrieveEnhanced,
    retrieveForRAG,
    queryForSearch,
    searchWithFacets,
    getSuggestions,
    clearCache,
  };
};

export default useRagApiEnhanced;