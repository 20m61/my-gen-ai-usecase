// Mock service for enhanced RAG API testing
import { EnhancedQueryResponse, EnhancedRetrieveResponse } from '../hooks/useRagApiEnhanced';

// Sample mock data for testing
const mockRetrieveResponse: EnhancedRetrieveResponse = {
  ResultItems: [
    {
      Id: '1',
      DocumentId: 'doc-1',
      DocumentURI: 'https://example.com/document1.pdf',
      Content: 'これは最初のテスト文書です。Kendrの検索機能をテストするための内容が含まれています。',
      DocumentTitle: 'テスト文書 1',
      ScoreAttributes: {
        ScoreConfidence: 'HIGH'
      },
      DocumentAttributes: [
        { Key: '_file_type', Value: { StringValue: 'pdf' } },
        { Key: '_language_code', Value: { StringValue: 'ja' } },
        { Key: '_excerpt_page_number', Value: { LongValue: 1 } }
      ]
    },
    {
      Id: '2',
      DocumentId: 'doc-2',
      DocumentURI: 'https://example.com/document2.docx',
      Content: '二番目の文書では、より詳細な情報と技術的な内容を扱っています。',
      DocumentTitle: 'テスト文書 2',
      ScoreAttributes: {
        ScoreConfidence: 'MEDIUM'
      },
      DocumentAttributes: [
        { Key: '_file_type', Value: { StringValue: 'docx' } },
        { Key: '_language_code', Value: { StringValue: 'ja' } },
        { Key: '_excerpt_page_number', Value: { LongValue: 2 } }
      ]
    }
  ],
  QueryId: 'mock-query-id-retrieve',
  metadata: {
    apiType: 'retrieve',
    totalResults: 2,
    queryId: 'mock-query-id-retrieve',
    processingTime: '156ms'
  }
};

const mockQueryResponse: EnhancedQueryResponse = {
  ResultItems: [
    {
      Id: '1',
      Type: 'DOCUMENT',
      DocumentId: 'doc-1',
      DocumentURI: 'https://example.com/document1.pdf',
      DocumentTitle: { Text: 'テスト文書 1', Highlights: [] },
      DocumentExcerpt: { 
        Text: 'これは最初のテスト文書です。Kendrの検索機能をテストするための内容が含まれています。',
        Highlights: [{ BeginOffset: 15, EndOffset: 22, TopAnswer: false }]
      },
      ScoreAttributes: {
        ScoreConfidence: 'HIGH'
      },
      DocumentAttributes: [
        { Key: '_file_type', Value: { StringValue: 'pdf' } },
        { Key: '_category', Value: { StringValue: 'documentation' } },
        { Key: '_authors', Value: { StringValue: 'Test Author' } }
      ]
    }
  ],
  FacetResults: [
    {
      DocumentAttributeKey: '_file_type',
      DocumentAttributeValueType: 'STRING_VALUE',
      DocumentAttributeValueCountPairs: [
        { DocumentAttributeValue: { StringValue: 'pdf' }, Count: 5 },
        { DocumentAttributeValue: { StringValue: 'docx' }, Count: 3 },
        { DocumentAttributeValue: { StringValue: 'txt' }, Count: 2 }
      ]
    },
    {
      DocumentAttributeKey: '_category',
      DocumentAttributeValueType: 'STRING_VALUE', 
      DocumentAttributeValueCountPairs: [
        { DocumentAttributeValue: { StringValue: 'documentation' }, Count: 4 },
        { DocumentAttributeValue: { StringValue: 'technical' }, Count: 3 },
        { DocumentAttributeValue: { StringValue: 'guidelines' }, Count: 3 }
      ]
    }
  ],
  TotalNumberOfResults: 10,
  QueryId: 'mock-query-id-query',
  SpellCorrectedQueries: [
    { SuggestedQueryText: 'Kendra 検索機能' },
    { SuggestedQueryText: 'テスト文書 作成' }
  ],
  processedFacets: [
    {
      documentAttributeKey: '_file_type',
      values: [
        { value: 'pdf', count: 5 },
        { value: 'docx', count: 3 },
        { value: 'txt', count: 2 }
      ]
    },
    {
      documentAttributeKey: '_category', 
      values: [
        { value: 'documentation', count: 4 },
        { value: 'technical', count: 3 },
        { value: 'guidelines', count: 3 }
      ]
    }
  ],
  metadata: {
    apiType: 'query',
    totalResults: 10,
    queryId: 'mock-query-id-query',
    processingTime: '234ms',
    hasSuggestions: true
  }
};

const mockSuggestions = [
  'Kendra 検索機能の使い方',
  'テスト環境の設定方法',
  'RAG システムの最適化',
  'データソースの管理',
  '高度な検索オプション'
];

// Mock service class
export class MockRagApiService {
  private delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async retrieveForRAG(query: string): Promise<EnhancedRetrieveResponse> {
    console.log('🔍 Mock RAG Retrieve called with query:', query);
    await this.delay(Math.random() * 300 + 100); // Random delay 100-400ms

    return {
      ...mockRetrieveResponse,
      QueryId: `retrieve-${Date.now()}`,
      metadata: {
        ...mockRetrieveResponse.metadata,
        queryId: `retrieve-${Date.now()}`,
        processingTime: `${Math.floor(Math.random() * 200 + 100)}ms`
      }
    };
  }

  async queryForSearch(query: string, options?: any): Promise<EnhancedQueryResponse> {
    console.log('🔍 Mock RAG Query called with:', { query, options });
    await this.delay(Math.random() * 400 + 150); // Random delay 150-550ms

    return {
      ...mockQueryResponse,
      QueryId: `query-${Date.now()}`,
      metadata: {
        ...mockQueryResponse.metadata,
        queryId: `query-${Date.now()}`,
        processingTime: `${Math.floor(Math.random() * 300 + 150)}ms`
      }
    };
  }

  async searchWithFacets(query: string, facetKeys: string[], filters?: Record<string, string[]>): Promise<EnhancedQueryResponse> {
    console.log('🔍 Mock Faceted Search called with:', { query, facetKeys, filters });
    await this.delay(Math.random() * 500 + 200); // Random delay 200-700ms

    // Simulate filtered results
    let filteredResults = mockQueryResponse.ResultItems || [];
    if (filters && Object.keys(filters).length > 0) {
      // Simple filter simulation
      filteredResults = filteredResults.slice(0, Math.max(1, filteredResults.length - 1));
    }

    return {
      ...mockQueryResponse,
      ResultItems: filteredResults,
      QueryId: `faceted-${Date.now()}`,
      TotalNumberOfResults: filteredResults.length,
      metadata: {
        ...mockQueryResponse.metadata,
        queryId: `faceted-${Date.now()}`,
        totalResults: filteredResults.length,
        processingTime: `${Math.floor(Math.random() * 400 + 200)}ms`
      }
    };
  }

  async getSuggestions(partialQuery: string): Promise<string[]> {
    console.log('💡 Mock Suggestions called with:', partialQuery);
    await this.delay(Math.random() * 200 + 50); // Random delay 50-250ms

    // Filter suggestions based on partial query
    return mockSuggestions.filter(suggestion => 
      suggestion.toLowerCase().includes(partialQuery.toLowerCase())
    ).slice(0, 5);
  }

  // Simulate API errors for testing error handling
  async simulateError(errorType: 'network' | 'auth' | 'rate_limit' | 'server'): Promise<never> {
    await this.delay(1000);

    const errors = {
      network: { message: 'Network Error', code: 'NETWORK_ERROR' },
      auth: { message: 'Authentication Failed', code: 'AUTH_ERROR', status: 401 },
      rate_limit: { message: 'Rate Limit Exceeded', code: 'RATE_LIMIT', status: 429 },
      server: { message: 'Internal Server Error', code: 'SERVER_ERROR', status: 500 }
    };

    throw new Error(JSON.stringify(errors[errorType]));
  }
}

// Singleton instance
export const mockRagApiService = new MockRagApiService();

// Helper to determine if we should use mock service
export const shouldUseMockService = (): boolean => {
  return import.meta.env.NODE_ENV === 'development' && 
         import.meta.env.VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT?.includes('mock');
};