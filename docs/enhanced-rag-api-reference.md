# Enhanced RAG API Reference

## 概要

このドキュメントでは、Enhanced RAG Featuresで提供される新しいAPI エンドポイントとフック関数の詳細な仕様について説明します。

## 📡 API エンドポイント

### 1. Query API (高速検索)

**エンドポイント**: `POST /api/rag/query`

**概要**: 高速な検索結果を取得します。Kendra Query APIを使用し、100トークンの制限内で効率的な検索を実行します。

#### リクエスト

```typescript
interface QueryRequest {
  query: string;                    // 検索クエリ (必須)
  options?: {
    pageSize?: number;              // 結果数 (デフォルト: 10, 最大: 100)
    pageNumber?: number;            // ページ番号 (デフォルト: 1)
    includeQuerySuggestions?: boolean; // 検索候補を含める (デフォルト: false)
    sortingConfiguration?: {
      documentAttributeKey: string;
      sortOrder: 'ASC' | 'DESC';
    };
    attributeFilter?: AttributeFilter; // フィルター条件
  };
}
```

#### レスポンス

```typescript
interface QueryResponse {
  success: boolean;
  data: {
    ResultItems?: QueryResultItem[];
    FacetResults?: FacetResult[];
    TotalNumberOfResults?: number;
    QueryId: string;
    SpellCorrectedQueries?: string[];
    // Enhanced metadata
    metadata: {
      apiType: 'query';
      totalResults: number;
      processingTime: number;
      hasSuggestions: boolean;
      queryId: string;
    };
  };
  error?: string;
}
```

#### 使用例

```typescript
const response = await fetch('/api/rag/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'machine learning',
    options: {
      pageSize: 20,
      includeQuerySuggestions: true
    }
  })
});

const result: QueryResponse = await response.json();
```

### 2. Retrieve API (詳細検索)

**エンドポイント**: `POST /api/rag/retrieve`

**概要**: 詳細な文書情報を取得します。Kendra Retrieve APIを使用し、200トークンの制限内でより詳細な検索を実行します。

#### リクエスト

```typescript
interface RetrieveRequest {
  query: string;                    // 検索クエリ (必須)
  options?: {
    pageSize?: number;              // 結果数 (デフォルト: 10, 最大: 100)
    pageNumber?: number;            // ページ番号 (デフォルト: 1)
    attributeFilter?: AttributeFilter; // フィルター条件
    requestedDocumentAttributes?: string[]; // 取得する属性
  };
}
```

#### レスポンス

```typescript
interface RetrieveResponse {
  success: boolean;
  data: {
    ResultItems?: RetrieveResultItem[];
    QueryId: string;
    // Enhanced metadata
    metadata: {
      apiType: 'retrieve';
      totalResults: number;
      processingTime: number;
      queryId: string;
    };
  };
  error?: string;
}
```

### 3. Suggestions API (検索候補)

**エンドポイント**: `GET /api/rag/suggestions`

**概要**: 入力されたクエリに基づいて検索候補を提供します。

#### リクエストパラメータ

```typescript
interface SuggestionsParams {
  q: string;                        // クエリ文字列 (必須, 最小3文字)
  limit?: number;                   // 候補数 (デフォルト: 5, 最大: 10)
  includePopular?: boolean;         // 人気キーワードを含める (デフォルト: false)
}
```

#### レスポンス

```typescript
interface SuggestionsResponse {
  success: boolean;
  data: {
    suggestions: string[];
    popularKeywords?: string[];
    metadata: {
      query: string;
      count: number;
      processingTime: number;
    };
  };
  error?: string;
}
```

#### 使用例

```typescript
// リアルタイム検索候補
const response = await fetch('/api/rag/suggestions?q=machine&limit=5');
const suggestions: SuggestionsResponse = await response.json();

// 結果: ['machine learning', 'machine vision', 'machine translation', ...]
```

### 4. Faceted Search API (ファセット検索)

**エンドポイント**: `POST /api/rag/faceted-search`

**概要**: ファセット（属性）を使用した高度な絞り込み検索を実行します。

#### リクエスト

```typescript
interface FacetedSearchRequest {
  query: string;                    // 検索クエリ (必須)
  facets: string[];                 // 取得するファセット (必須)
  filters?: Record<string, string[]>; // 適用するフィルター
  options?: {
    pageSize?: number;
    pageNumber?: number;
    sortingConfiguration?: SortingConfiguration;
  };
}
```

#### レスポンス

```typescript
interface FacetedSearchResponse {
  success: boolean;
  data: {
    ResultItems?: QueryResultItem[];
    FacetResults?: FacetResult[];
    processedFacets?: ProcessedFacet[];
    TotalNumberOfResults?: number;
    QueryId: string;
    metadata: {
      apiType: 'query';
      totalResults: number;
      processingTime: number;
      appliedFilters: Record<string, string[]>;
      queryId: string;
    };
  };
  error?: string;
}
```

#### 使用例

```typescript
const response = await fetch('/api/rag/faceted-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'artificial intelligence',
    facets: ['_file_type', '_category', '_authors'],
    filters: {
      '_file_type': ['pdf', 'docx'],
      '_category': ['research', 'tutorial']
    }
  })
});
```

### 5. Data Sources API (データソース管理)

#### 5.1 データソース一覧取得

**エンドポイント**: `GET /api/rag/data-sources`

```typescript
interface DataSourcesResponse {
  success: boolean;
  data: {
    dataSources: DataSource[];
    metadata: {
      totalCount: number;
      lastUpdated: string;
    };
  };
  error?: string;
}

interface DataSource {
  id: string;
  name: string;
  type: 'S3' | 'SharePoint' | 'OneDrive' | 'Confluence' | 'Database';
  status: 'ACTIVE' | 'SYNCING' | 'ERROR' | 'INACTIVE';
  configuration?: {
    bucketName?: string;
    inclusionPrefixes?: string[];
    exclusionPrefixes?: string[];
  };
  statistics?: {
    documentsCount: number;
    lastSyncTime: string;
    nextSyncTime?: string;
    errorCount: number;
  };
  errorMessage?: string;
}
```

#### 5.2 データソース同期実行

**エンドポイント**: `POST /api/rag/data-sources/{id}/sync`

```typescript
interface SyncDataSourceRequest {
  force?: boolean;                  // 強制同期 (デフォルト: false)
}

interface SyncDataSourceResponse {
  success: boolean;
  data: {
    syncJobId: string;
    status: 'STARTED' | 'QUEUED';
    estimatedDuration?: number;
    message: string;
  };
  error?: string;
}
```

### 6. Metrics API (メトリクス)

**エンドポイント**: `GET /api/rag/metrics`

**概要**: RAGシステムのパフォーマンスメトリクスを取得します。

#### リクエストパラメータ

```typescript
interface MetricsParams {
  timeRange?: '1h' | '24h' | '7d' | '30d'; // デフォルト: '24h'
  granularity?: '5m' | '1h' | '1d';        // デフォルト: '1h'
  includeDetails?: boolean;                // デフォルト: false
}
```

#### レスポンス

```typescript
interface MetricsResponse {
  success: boolean;
  data: {
    summary: {
      totalQueries: number;
      successRate: number;
      averageResponseTime: number;
      queryOptimizationRate: number;
      cacheHitRate: number;
    };
    timeSeries?: MetricDataPoint[];
    popularQueries?: PopularQuery[];
    errorBreakdown?: ErrorBreakdown[];
    metadata: {
      timeRange: string;
      granularity: string;
      dataPoints: number;
      lastUpdated: string;
    };
  };
  error?: string;
}
```

## 🎣 カスタムフック (Custom Hooks)

### 1. useRagApiEnhanced

**概要**: Enhanced RAG APIを使用するためのメインフック

```typescript
const useRagApiEnhanced = () => {
  return {
    // Query API (高速検索)
    queryForSearch: (query: string, options?: QueryOptions) => Promise<QueryResponse>;
    
    // Retrieve API (詳細検索)  
    retrieveForRAG: (query: string, options?: RetrieveOptions) => Promise<RetrieveResponse>;
    
    // 検索候補取得
    getSuggestions: (query: string, limit?: number) => Promise<string[]>;
    
    // ファセット検索
    searchWithFacets: (
      query: string, 
      facets: string[], 
      filters?: Record<string, string[]>
    ) => Promise<FacetedSearchResponse>;
    
    // データソース管理
    getDataSources: () => Promise<DataSource[]>;
    syncDataSource: (id: string, force?: boolean) => Promise<SyncDataSourceResponse>;
    
    // ローディング状態
    loading: boolean;
    
    // エラー状態
    error: Error | null;
  };
};
```

#### 使用例

```typescript
import useRagApiEnhanced from '../hooks/useRagApiEnhanced';

const MyComponent = () => {
  const { 
    queryForSearch, 
    getSuggestions, 
    searchWithFacets, 
    loading, 
    error 
  } = useRagApiEnhanced();

  const handleSearch = async (query: string) => {
    try {
      const result = await queryForSearch(query, {
        pageSize: 20,
        includeQuerySuggestions: true
      });
      console.log('Search results:', result.data.ResultItems);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleFacetedSearch = async () => {
    const result = await searchWithFacets(
      'machine learning',
      ['_file_type', '_category'],
      { '_file_type': ['pdf'] }
    );
  };

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      {/* UI components */}
    </div>
  );
};
```

### 2. useRagCache

**概要**: RAGシステムのキャッシング機能を提供

```typescript
const useRagCache = () => {
  return {
    // キャッシュからの取得
    get: <T>(key: string) => T | null;
    
    // キャッシュへの保存
    set: <T>(key: string, value: T, ttl?: number) => void;
    
    // キャッシュの削除
    remove: (key: string) => void;
    
    // キャッシュのクリア
    clear: () => void;
    
    // キャッシュ統計の取得
    getStats: () => CacheStats;
    
    // キャッシュの有効性チェック
    isValid: (key: string) => boolean;
  };
};

interface CacheStats {
  size: number;
  hitRate: number;
  missRate: number;
  totalRequests: number;
  memoryUsage: number;
}
```

#### 使用例

```typescript
import { useRagCache } from '../hooks/useRagCache';

const MyComponent = () => {
  const { get, set, getStats } = useRagCache();

  const cachedSearch = async (query: string) => {
    const cacheKey = `search:${query}`;
    
    // キャッシュから取得を試行
    let results = get<SearchResults>(cacheKey);
    
    if (!results) {
      // キャッシュになければAPIから取得
      results = await queryForSearch(query);
      
      // 5分間キャッシュ
      set(cacheKey, results, 5 * 60 * 1000);
    }
    
    return results;
  };

  // キャッシュ統計の表示
  const stats = getStats();
  console.log(`Cache hit rate: ${stats.hitRate}%`);

  return <div>...</div>;
};
```

### 3. useRagMetrics

**概要**: RAGシステムのメトリクス管理と監視

```typescript
const useRagMetrics = () => {
  return {
    // メトリクスの記録
    recordQuery: (query: string, duration: number, success: boolean) => void;
    
    // パフォーマンス統計の取得
    getPerformanceStats: () => RAGPerformanceStats;
    
    // 時系列データの取得
    getTimeSeriesData: (timeRange: string) => MetricDataPoint[];
    
    // 人気クエリの取得
    getPopularQueries: (limit?: number) => PopularQuery[];
    
    // エラー統計の取得
    getErrorStats: () => ErrorStats;
    
    // メトリクスのリセット
    resetMetrics: () => void;
  };
};

interface RAGPerformanceStats {
  totalQueries: number;
  averageProcessingTime: number;
  averageDocumentScore: number;
  successRate: number;
  mostCommonQueries: string[];
  queryOptimizationSuccessRate: number;
}
```

#### 使用例

```typescript
import { useRagMetrics } from '../hooks/useRagMetrics';

const MetricsComponent = () => {
  const { 
    recordQuery, 
    getPerformanceStats, 
    getPopularQueries 
  } = useRagMetrics();

  const handleSearch = async (query: string) => {
    const startTime = Date.now();
    
    try {
      const results = await queryForSearch(query);
      const duration = Date.now() - startTime;
      
      // メトリクスを記録
      recordQuery(query, duration, true);
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      recordQuery(query, duration, false);
      throw error;
    }
  };

  const stats = getPerformanceStats();
  const popularQueries = getPopularQueries(10);

  return (
    <div>
      <h3>Performance Stats</h3>
      <p>Total Queries: {stats.totalQueries}</p>
      <p>Success Rate: {stats.successRate}%</p>
      <p>Avg Response Time: {stats.averageProcessingTime}ms</p>
      
      <h3>Popular Queries</h3>
      <ul>
        {popularQueries.map(q => (
          <li key={q.query}>{q.query} ({q.count})</li>
        ))}
      </ul>
    </div>
  );
};
```

### 4. useErrorHandler

**概要**: エラーハンドリングと再試行ロジックを提供

```typescript
const useErrorHandler = () => {
  return {
    // エラーの解析
    parseError: (error: Error) => ParsedError;
    
    // 再試行可能かの判定
    isRetryable: (error: Error) => boolean;
    
    // 再試行の実行
    retry: <T>(fn: () => Promise<T>, maxRetries?: number) => Promise<T>;
    
    // エラーの報告
    reportError: (error: Error, context?: string) => void;
    
    // エラーの統計
    getErrorStats: () => ErrorStats;
  };
};

interface ParsedError {
  type: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  retryable: boolean;
  retryDelay?: number;
  userAction?: string;
}
```

#### 使用例

```typescript
import { useErrorHandler } from '../hooks/useErrorHandler';

const RobustComponent = () => {
  const { parseError, retry, reportError } = useErrorHandler();

  const robustSearch = async (query: string) => {
    try {
      return await retry(
        () => queryForSearch(query),
        3 // 最大3回まで再試行
      );
    } catch (error) {
      const parsedError = parseError(error);
      
      // エラーを報告
      reportError(error, 'search_operation');
      
      // ユーザーに分かりやすいエラーメッセージを表示
      showErrorMessage(parsedError.message);
      
      if (parsedError.userAction) {
        showUserAction(parsedError.userAction);
      }
    }
  };

  return <div>...</div>;
};
```

## 🔧 型定義

### 共通型定義

```typescript
// API レスポンスの基本型
interface BaseResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  metadata?: {
    timestamp: string;
    requestId: string;
    processingTime: number;
  };
}

// Kendra 検索結果アイテム
interface QueryResultItem {
  Id?: string;
  Type?: 'DOCUMENT' | 'QUESTION_ANSWER' | 'ANSWER';
  DocumentId?: string;
  DocumentTitle?: {
    Text?: string;
    Highlights?: TextWithHighlights[];
  };
  DocumentExcerpt?: {
    Text?: string;
    Highlights?: TextWithHighlights[];
  };
  DocumentURI?: string;
  DocumentAttributes?: DocumentAttribute[];
  ScoreAttributes?: ScoreAttributes;
  FeedbackToken?: string;
}

interface RetrieveResultItem {
  Id?: string;
  DocumentId?: string;
  DocumentTitle?: string;
  Content?: string;
  DocumentURI?: string;
  DocumentAttributes?: DocumentAttribute[];
  ScoreAttributes?: ScoreAttributes;
}

// 文書属性
interface DocumentAttribute {
  Key: string;
  Value: {
    StringValue?: string;
    StringListValue?: string[];
    LongValue?: number;
    DateValue?: Date;
  };
}

// スコア属性
interface ScoreAttributes {
  ScoreConfidence?: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// ファセット結果
interface FacetResult {
  DocumentAttributeKey?: string;
  DocumentAttributeValueType?: 'STRING_VALUE' | 'STRING_LIST_VALUE' | 'LONG_VALUE' | 'DATE_VALUE';
  DocumentAttributeValueCountPairs?: DocumentAttributeValueCountPair[];
}

interface DocumentAttributeValueCountPair {
  DocumentAttributeValue?: {
    StringValue?: string;
    LongValue?: number;
    DateValue?: Date;
  };
  Count?: number;
}

// 属性フィルター
interface AttributeFilter {
  AndAllFilters?: AttributeFilter[];
  OrAllFilters?: AttributeFilter[];
  NotFilter?: AttributeFilter;
  EqualsTo?: {
    Key: string;
    Value: {
      StringValue?: string;
      LongValue?: number;
      DateValue?: Date;
    };
  };
  ContainsAll?: {
    Key: string;
    Value: {
      StringValue?: string;
      StringListValue?: string[];
    };
  };
  ContainsAny?: {
    Key: string;
    Value: {
      StringValue?: string;
      StringListValue?: string[];
    };
  };
  GreaterThan?: {
    Key: string;
    Value: {
      LongValue?: number;
      DateValue?: Date;
    };
  };
  GreaterThanOrEquals?: {
    Key: string;
    Value: {
      LongValue?: number;
      DateValue?: Date;
    };
  };
  LessThan?: {
    Key: string;
    Value: {
      LongValue?: number;
      DateValue?: Date;
    };
  };
  LessThanOrEquals?: {
    Key: string;
    Value: {
      LongValue?: number;
      DateValue?: Date;
    };
  };
}
```

## 📚 エラーコード

### HTTP ステータスコード

| コード | 説明 | 対処方法 |
|--------|------|----------|
| 200 | 成功 | - |
| 400 | 不正なリクエスト | リクエストパラメータを確認 |
| 401 | 認証エラー | 認証トークンを更新 |
| 403 | 認可エラー | 権限を確認 |
| 429 | レート制限 | 再試行間隔を調整 |
| 500 | サーバーエラー | サーバーログを確認 |
| 503 | サービス利用不可 | Kendraサービスの状態を確認 |

### カスタムエラーコード

```typescript
enum RAGErrorCode {
  // クエリ関連
  INVALID_QUERY = 'INVALID_QUERY',
  QUERY_TOO_SHORT = 'QUERY_TOO_SHORT',
  QUERY_TOO_LONG = 'QUERY_TOO_LONG',
  
  // 検索関連
  NO_RESULTS_FOUND = 'NO_RESULTS_FOUND',
  SEARCH_TIMEOUT = 'SEARCH_TIMEOUT',
  INVALID_FACET = 'INVALID_FACET',
  
  // キャッシュ関連
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_FULL = 'CACHE_FULL',
  
  // データソース関連
  DATA_SOURCE_NOT_FOUND = 'DATA_SOURCE_NOT_FOUND',
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  SYNC_FAILED = 'SYNC_FAILED',
  
  // メトリクス関連
  METRICS_UNAVAILABLE = 'METRICS_UNAVAILABLE',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
}
```

## 🧪 テスト用のモック

### MockRagApiService

```typescript
export class MockRagApiService {
  // テスト設定
  private config = {
    responseDelay: { min: 100, max: 400 },
    errorRate: 0.1,
    cacheEnabled: true,
  };

  // レスポンス遅延の設定
  setResponseDelay(min: number, max: number): void {
    this.config.responseDelay = { min, max };
  }

  // エラー率の設定
  setErrorRate(rate: number): void {
    this.config.errorRate = Math.max(0, Math.min(1, rate));
  }

  // カスタムレスポンスの追加
  addCustomResponse(query: string, response: any): void {
    this.customResponses.set(query, response);
  }

  // エラーシミュレーション
  async simulateError(type: 'network' | 'auth' | 'rate_limit' | 'server'): Promise<never> {
    const errors = {
      network: new Error('Network connection failed'),
      auth: new Error('Authentication failed'),
      rate_limit: new Error('Rate limit exceeded'),
      server: new Error('Internal server error')
    };
    
    throw errors[type];
  }
}
```

### テスト用のヘルパー関数

```typescript
// テストデータの生成
export const generateMockSearchResults = (count: number): QueryResultItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    Id: `doc-${i}`,
    Type: 'DOCUMENT',
    DocumentId: `document-${i}`,
    DocumentTitle: {
      Text: `Document Title ${i + 1}`,
      Highlights: []
    },
    DocumentExcerpt: {
      Text: `This is the excerpt for document ${i + 1}...`,
      Highlights: []
    },
    DocumentURI: `https://example.com/doc-${i}.pdf`,
    ScoreAttributes: {
      ScoreConfidence: Math.random() > 0.5 ? 'HIGH' : 'MEDIUM'
    }
  }));
};

// メトリクスのモックデータ生成
export const generateMockMetrics = (): RAGPerformanceStats => ({
  totalQueries: Math.floor(Math.random() * 1000) + 100,
  averageProcessingTime: Math.floor(Math.random() * 300) + 100,
  averageDocumentScore: Math.random() * 0.3 + 0.7,
  successRate: Math.random() * 10 + 90,
  mostCommonQueries: [
    'machine learning',
    'artificial intelligence', 
    'data science',
    'neural networks',
    'deep learning'
  ],
  queryOptimizationSuccessRate: Math.random() * 20 + 75
});
```

---

この API リファレンスを参考に、Enhanced RAG Features を効果的に活用してください。詳細な使用例やトラブルシューティングについては、他のドキュメントもご参照ください。