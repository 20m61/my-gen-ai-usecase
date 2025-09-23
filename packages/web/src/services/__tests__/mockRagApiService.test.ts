import { describe, test, expect, vi } from 'vitest';
import { mockRagApiService, shouldUseMockService } from '../mockRagApiService';

describe('Mock RAG API Service', () => {
  test('should determine when to use mock service', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalEndpoint = process.env.VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT;
    
    // Set up mock environment
    process.env.NODE_ENV = 'development';
    process.env.VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT = 'https://mock-api-endpoint/rag/kendra-enhanced';
    
    const result = shouldUseMockService();
    expect(result).toBe(true);
    
    // Restore environment
    process.env.NODE_ENV = originalEnv;
    process.env.VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT = originalEndpoint;
  });

  test('retrieveForRAG should return mock data', async () => {
    const result = await mockRagApiService.retrieveForRAG('テスト検索');
    
    expect(result).toBeDefined();
    expect(result.metadata.apiType).toBe('retrieve');
    expect(result.metadata.totalResults).toBeGreaterThan(0);
    expect(result.ResultItems).toBeDefined();
    expect(Array.isArray(result.ResultItems)).toBe(true);
  });

  test('queryForSearch should return mock data with suggestions', async () => {
    const result = await mockRagApiService.queryForSearch('ドキュメント検索', {
      pageSize: 5,
      includeQuerySuggestions: true
    });
    
    expect(result).toBeDefined();
    expect(result.metadata.apiType).toBe('query');
    expect(result.metadata.hasSuggestions).toBe(true);
    expect(result.SpellCorrectedQueries).toBeDefined();
    expect(Array.isArray(result.SpellCorrectedQueries)).toBe(true);
  });

  test('getSuggestions should return relevant suggestions', async () => {
    const suggestions = await mockRagApiService.getSuggestions('テスト');
    
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    
    // Should contain relevant suggestions
    const hasRelevantSuggestion = suggestions.some(suggestion => 
      suggestion.toLowerCase().includes('テスト') ||
      suggestion.includes('検索') ||
      suggestion.includes('kendra')
    );
    expect(hasRelevantSuggestion).toBe(true);
  });

  test('searchWithFacets should apply filters correctly', async () => {
    const result = await mockRagApiService.searchWithFacets(
      'PDF文書',
      ['_file_type', '_category'],
      { '_file_type': ['pdf'] }
    );
    
    expect(result).toBeDefined();
    expect(result.metadata.apiType).toBe('query');
    expect(result.processedFacets).toBeDefined();
    expect(Array.isArray(result.processedFacets)).toBe(true);
    
    // Should have facet data
    const hasFileTypeFacet = result.processedFacets?.some(facet =>
      facet.documentAttributeKey === '_file_type'
    );
    expect(hasFileTypeFacet).toBe(true);
  });

  test('simulateError should throw appropriate errors', async () => {
    const errorTypes = ['network', 'auth', 'rate_limit', 'server'] as const;
    
    for (const errorType of errorTypes) {
      await expect(mockRagApiService.simulateError(errorType))
        .rejects.toThrow();
    }
  });

  test('responses should have consistent structure', async () => {
    const retrieveResult = await mockRagApiService.retrieveForRAG('テスト');
    expect(retrieveResult.metadata).toHaveProperty('apiType');
    expect(retrieveResult.metadata).toHaveProperty('totalResults');
    expect(retrieveResult.metadata).toHaveProperty('processingTime');
    expect(retrieveResult.metadata).toHaveProperty('queryId');

    const queryResult = await mockRagApiService.queryForSearch('テスト');
    expect(queryResult.metadata).toHaveProperty('apiType');
    expect(queryResult.metadata).toHaveProperty('totalResults');
    expect(queryResult.metadata).toHaveProperty('processingTime');
    expect(queryResult.metadata).toHaveProperty('hasSuggestions');
  });

  test('should simulate realistic response times', async () => {
    const start = Date.now();
    await mockRagApiService.retrieveForRAG('テスト');
    const duration = Date.now() - start;
    
    // Should take at least 100ms but not too long
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThan(1000);
  });

  test('should return different query IDs for different requests', async () => {
    const result1 = await mockRagApiService.queryForSearch('クエリ1');
    const result2 = await mockRagApiService.queryForSearch('クエリ2');
    
    expect(result1.QueryId).toBeDefined();
    expect(result2.QueryId).toBeDefined();
    expect(result1.QueryId).not.toBe(result2.QueryId);
  });
});