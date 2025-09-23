# Enhanced RAG Features Documentation

## 概要

このドキュメントでは、既存のKendra RAGシステムに追加された拡張機能について説明します。これらの機能により、より高度な検索体験、パフォーマンス監視、データソース管理、および包括的なテスト環境が提供されます。

## 📂 新規追加ファイル一覧

### フロントエンドコンポーネント
- **`/packages/web/src/components/AdvancedSearchPanel.tsx`** - 高度な検索機能UI
- **`/packages/web/src/components/RAGMetricsDashboard.tsx`** - パフォーマンス監視ダッシュボード
- **`/packages/web/src/components/KendraDataSourceManager.tsx`** - データソース管理UI
- **`/packages/web/src/components/ErrorDisplay.tsx`** - エラー表示・再試行コンポーネント
- **`/packages/web/src/components/EnhancedRagTester.tsx`** - 統合テストUI

### 拡張フック
- **`/packages/web/src/hooks/useRagApiEnhanced.ts`** - 拡張RAG API機能
- **`/packages/web/src/hooks/useErrorHandler.ts`** - エラーハンドリング
- **`/packages/web/src/hooks/useRagMetrics.ts`** - メトリクス管理
- **`/packages/web/src/hooks/useRagCache.ts`** - キャッシュ管理

### テスト・モックサービス
- **`/packages/web/src/services/mockRagApiService.ts`** - 開発・テスト用モックAPI
- **`/packages/web/src/components/__tests__/*.test.tsx`** - 包括的テストスイート

### 設定・ユーティリティ
- **`/packages/web/.env.local`** - 機能フラグ設定
- **`/packages/web/src/test-setup.ts`** - テスト環境設定

## 🚀 新機能詳細

### 1. Advanced Search Panel（高度な検索パネル）

#### 機能概要
- **ファセット検索**: ファイルタイプ、カテゴリ、作成者などによる絞り込み
- **リアルタイム検索候補**: 入力に応じた自動補完機能
- **ソート機能**: 作成日、更新日、関連性による並び替え
- **検索履歴**: 過去の検索クエリの保持・再利用

#### 技術仕様

```typescript
// ファイル: /packages/web/src/components/AdvancedSearchPanel.tsx

interface AdvancedSearchPanelProps {
  onSearch: (query: string, filters?: Record<string, string[]>) => void;
  onResultsUpdate?: (results: EnhancedQueryResponse) => void;
  className?: string;
}

// 使用例
<AdvancedSearchPanel
  onSearch={handleSearch}
  onResultsUpdate={handleResultsUpdate}
  className="my-4"
/>
```

#### 主要機能

1. **デバウンス検索候補** (300ms)
```typescript
const fetchSuggestions = useCallback(
  debounce(async (q: string) => {
    if (q.length > 2) {
      const suggestionsResult = await getSuggestions(q);
      setSuggestions(suggestionsResult);
      setShowSuggestions(suggestionsResult.length > 0);
    }
  }, 300),
  []
);
```

2. **ファセットフィルタリング**
```typescript
const COMMON_FACETS = [
  { key: '_file_type', label: 'ファイルタイプ' },
  { key: '_category', label: 'カテゴリ' },
  { key: '_authors', label: '作成者' },
  { key: '_language_code', label: '言語' },
  { key: '_created_at', label: '作成日' },
];
```

### 2. RAG Metrics Dashboard（パフォーマンス監視）

#### 機能概要
- **リアルタイムメトリクス**: クエリ数、成功率、平均応答時間
- **人気キーワード**: よく検索されるキーワードの表示
- **最適化率**: クエリ最適化の成功率
- **チャート表示**: パフォーマンス推移の可視化

#### 技術仕様

```typescript
// ファイル: /packages/web/src/components/RAGMetricsDashboard.tsx

interface RAGPerformanceStats {
  totalQueries: number;
  averageProcessingTime: number;
  averageDocumentScore: number;
  successRate: number;
  mostCommonQueries: string[];
  queryOptimizationSuccessRate: number;
}

// 使用例
<RAGMetricsDashboard
  performanceStats={stats}
  onRefresh={handleRefresh}
/>
```

#### メトリクス計算

```typescript
// ファイル: /packages/web/src/hooks/useRagMetrics.ts

export const getPerformanceStats = (): RAGPerformanceStats => {
  const cachedMetrics = getMetricsFromCache();
  
  return {
    totalQueries: cachedMetrics.length,
    averageProcessingTime: calculateAverageTime(cachedMetrics),
    successRate: calculateSuccessRate(cachedMetrics),
    queryOptimizationSuccessRate: calculateOptimizationRate(cachedMetrics),
    mostCommonQueries: extractPopularQueries(cachedMetrics),
    averageDocumentScore: calculateAverageScore(cachedMetrics)
  };
};
```

### 3. Kendra Data Source Manager（データソース管理）

#### 機能概要
- **データソース一覧**: 接続されたデータソースの表示
- **同期状況**: 各データソースの最終同期時刻・ステータス
- **手動同期**: データソースの手動更新機能
- **エラー監視**: 同期エラーの表示・対処

#### 技術仕様

```typescript
// ファイル: /packages/web/src/components/KendraDataSourceManager.tsx

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: 'ACTIVE' | 'SYNCING' | 'ERROR' | 'INACTIVE';
  lastSyncTime?: string;
  documentsCount?: number;
  errorMessage?: string;
}

// 使用例
<KendraDataSourceManager
  onRefresh={handleRefresh}
  className="mt-4"
/>
```

### 4. Enhanced API Hooks（拡張APIフック）

#### useRagApiEnhanced

高度なRAG機能のためのカスタムフック：

```typescript
// ファイル: /packages/web/src/hooks/useRagApiEnhanced.ts

const useRagApiEnhanced = () => {
  return {
    // Kendra Query API (制限: 100トークン、より高速)
    queryForSearch: async (query: string, options?: QueryOptions) => {
      // 一般的な検索用
    },
    
    // Kendra Retrieve API (制限: 200トークン、より詳細)
    retrieveForRAG: async (query: string) => {
      // RAG生成用の詳細文書取得
    },
    
    // 検索候補取得
    getSuggestions: async (query: string) => {
      // リアルタイム検索候補
    },
    
    // ファセット検索
    searchWithFacets: async (query: string, facets: string[], filters?: Record<string, string[]>) => {
      // 高度な絞り込み検索
    }
  };
};
```

#### useRagCache

LRUキャッシュによるパフォーマンス最適化：

```typescript
// ファイル: /packages/web/src/hooks/useRagCache.ts

const useRagCache = () => {
  return {
    get: (key: string) => cache.get(key),
    set: (key: string, value: any, ttl = 5 * 60 * 1000) => {
      cache.set(key, { value, expires: Date.now() + ttl });
    },
    clear: () => cache.clear(),
    getStats: () => ({
      size: cache.size,
      hitRate: calculateHitRate()
    })
  };
};
```

### 5. Mock API Service（開発・テスト用）

#### 機能概要
- **リアルなKendra API シミュレーション**
- **レスポンス時間の調整可能**
- **エラー状況のシミュレーション**
- **テストデータの生成**

#### 技術仕様

```typescript
// ファイル: /packages/web/src/services/mockRagApiService.ts

export class MockRagApiService {
  // レスポンス遅延のシミュレーション
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retrieve API のモック
  async retrieveForRAG(query: string): Promise<EnhancedRetrieveResponse> {
    await this.delay(Math.random() * 300 + 100); // 100-400ms
    return {
      ...mockRetrieveResponse,
      QueryId: `retrieve-${Date.now()}`,
      metadata: {
        apiType: 'retrieve',
        totalResults: mockRetrieveResponse.ResultItems?.length || 0,
        processingTime: Math.floor(Math.random() * 300 + 100),
        queryId: `retrieve-${Date.now()}`
      }
    };
  }

  // エラーシミュレーション
  async simulateError(errorType: 'network' | 'auth' | 'rate_limit' | 'server'): Promise<never> {
    const errorMessages = {
      network: 'ネットワークエラーが発生しました',
      auth: '認証エラー: 無効なトークンです',
      rate_limit: 'レート制限を超過しました',
      server: 'サーバーエラーが発生しました'
    };
    
    throw new Error(errorMessages[errorType]);
  }
}
```

#### 使用方法

```typescript
// 環境変数による制御
const shouldUseMockService = (): boolean => {
  return process.env.NODE_ENV === 'development' && 
         process.env.VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT?.includes('mock');
};

// 実際のAPIまたはモックAPIの選択
const apiService = shouldUseMockService() ? mockRagApiService : realRagApiService;
```

### 6. Comprehensive Test Suite（包括的テストスイート）

#### テスト構成

1. **単体テスト**
   - 各コンポーネントの独立テスト
   - フック関数のテスト
   - ユーティリティ関数のテスト

2. **統合テスト**
   - コンポーネント間の連携テスト
   - API統合テスト
   - エラーハンドリングテスト

3. **パフォーマンステスト**
   - レスポンス時間の測定
   - メモリ使用量の監視
   - キャッシュ効果の検証

#### テストファイル構成

```
src/
├── components/
│   └── __tests__/
│       ├── AdvancedSearchPanel.test.tsx
│       ├── RAGMetricsDashboard.test.tsx
│       ├── KendraDataSourceManager.test.tsx
│       ├── ErrorDisplay.test.tsx
│       └── EnhancedRagTester.test.tsx
├── hooks/
│   └── __tests__/
│       ├── useRagApiEnhanced.test.ts
│       ├── useErrorHandler.test.ts
│       └── useRagCache.test.ts
└── services/
    └── __tests__/
        └── mockRagApiService.test.ts
```

#### テスト実行

```bash
# 全テスト実行
npm run test

# 特定のテストファイル実行
npm run test -- AdvancedSearchPanel.test.tsx

# カバレッジ付きテスト実行
npm run test:coverage

# ウォッチモードでテスト実行
npm run test:watch
```

### 7. Enhanced RAG Tester（統合テストツール）

#### 機能概要
開発環境で `/test-rag` ルートにアクセスすることで、すべての拡張機能を包括的にテストできるUIツールです。

#### 実行されるテスト

1. **Basic Query API Test** - 基本的なクエリAPIの動作確認
2. **Search Suggestions Test** - 検索候補機能のテスト  
3. **Faceted Search Test** - ファセット検索のテスト
4. **Error Handling Test** - エラーハンドリングのテスト
5. **Caching System Test** - キャッシュシステムのテスト
6. **Performance Metrics Test** - パフォーマンス測定のテスト

#### 使用方法

```typescript
// 開発環境でのみ利用可能
// URL: http://localhost:3000/test-rag

const EnhancedRagTester: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>(initialTests);
  const [isRunning, setIsRunning] = useState(false);

  const runAllTests = async () => {
    setIsRunning(true);
    // 各テストを順次実行
    for (const test of tests) {
      await runIndividualTest(test);
    }
    setIsRunning(false);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Enhanced RAG Features Test Suite</h1>
      {/* テスト結果の表示 */}
    </div>
  );
};
```

## 🔧 セットアップ手順

### 1. 環境変数の設定

```bash
# /packages/web/.env.local
VITE_APP_ENABLE_RAG_OPTIMIZATION=true
VITE_APP_ENABLE_ADVANCED_SEARCH=true
VITE_APP_ENABLE_METRICS_DASHBOARD=true
VITE_APP_ENABLE_DATA_SOURCE_MANAGER=true
VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT=https://mock-api-endpoint/rag/kendra-enhanced
```

### 2. 依存関係のインストール

```bash
cd /packages/web
npm install
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

### 4. テスト環境の確認

```bash
# テストの実行
npm run test

# 開発環境でのテストUI確認
# http://localhost:3000/test-rag にアクセス
```

## 📊 機能フラグ設定

各機能は環境変数で個別に有効化/無効化できます：

| 環境変数 | 機能 | デフォルト |
|---------|------|-----------|
| `VITE_APP_ENABLE_RAG_OPTIMIZATION` | RAG最適化機能 | `false` |
| `VITE_APP_ENABLE_ADVANCED_SEARCH` | 高度な検索パネル | `false` |
| `VITE_APP_ENABLE_METRICS_DASHBOARD` | メトリクスダッシュボード | `false` |
| `VITE_APP_ENABLE_DATA_SOURCE_MANAGER` | データソース管理 | `false` |

## 🔍 API エンドポイント

### 新規追加エンドポイント

```typescript
// Query API (高速、制限: 100トークン)
POST /api/rag/query
{
  "query": "検索クエリ",
  "options": {
    "pageSize": 10,
    "includeQuerySuggestions": true
  }
}

// Retrieve API (詳細、制限: 200トークン)  
POST /api/rag/retrieve
{
  "query": "検索クエリ"
}

// 検索候補API
GET /api/rag/suggestions?q=検索キーワード

// ファセット検索API
POST /api/rag/faceted-search
{
  "query": "検索クエリ",
  "facets": ["_file_type", "_category"],
  "filters": {
    "_file_type": ["pdf", "docx"]
  }
}

// データソース管理API
GET /api/rag/data-sources
POST /api/rag/data-sources/{id}/sync
```

## 🚨 エラーハンドリング

### Error Display Component

```typescript
// 使用例
<ErrorDisplay
  error={error}
  onRetry={handleRetry}
  onDismiss={handleDismiss}
  operationName="文書検索"
/>
```

### エラータイプと対処

1. **NETWORK_ERROR** - ネットワーク接続エラー
   - 自動再試行: 2秒後
   - ユーザーアクション: 接続確認

2. **RATE_LIMIT** - レート制限エラー
   - 自動再試行: 5秒後
   - ユーザーアクション: 待機

3. **AUTH_ERROR** - 認証エラー  
   - 自動再試行: なし
   - ユーザーアクション: 再ログイン

4. **SERVER_ERROR** - サーバーエラー
   - 自動再試行: 3秒後
   - ユーザーアクション: サポート連絡

## 📈 パフォーマンス最適化

### 1. キャッシュ戦略

```typescript
// LRUキャッシュの実装
const cache = new Map<string, CacheItem>();
const TTL = 5 * 60 * 1000; // 5分

interface CacheItem {
  value: any;
  expires: number;
}
```

### 2. デバウンス処理

```typescript
// 検索候補のデバウンス (300ms)
const debouncedSuggestions = debounce(fetchSuggestions, 300);

// ファセット更新のデバウンス (150ms)
const debouncedFacetUpdate = debounce(updateFacets, 150);
```

### 3. レスポンス時間監視

```typescript
// パフォーマンス測定
const startTime = performance.now();
const result = await apiCall();
const duration = performance.now() - startTime;

// メトリクス記録
recordMetric({
  operation: 'search',
  duration,
  success: true,
  timestamp: Date.now()
});
```

## 🧪 テスト戦略

### 1. 単体テスト

```typescript
// コンポーネントテスト例
describe('AdvancedSearchPanel', () => {
  test('renders search input correctly', () => {
    render(<AdvancedSearchPanel onSearch={mockFn} />);
    expect(screen.getByPlaceholderText('検索キーワードを入力...')).toBeInTheDocument();
  });
  
  test('handles search suggestions', async () => {
    const mockSuggestions = jest.fn();
    render(<AdvancedSearchPanel onSearch={mockSuggestions} />);
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(mockSuggestions).toHaveBeenCalled();
    });
  });
});
```

### 2. 統合テスト

```typescript
// API統合テスト例
describe('RAG API Integration', () => {
  test('query and retrieve APIs work together', async () => {
    const queryResult = await queryForSearch('test query');
    expect(queryResult.data.ResultItems).toBeDefined();
    
    const retrieveResult = await retrieveForRAG('test query');
    expect(retrieveResult.ResultItems).toBeDefined();
  });
});
```

### 3. パフォーマンステスト

```typescript
// パフォーマンステスト例
describe('Performance Tests', () => {
  test('search response time under 1 second', async () => {
    const start = Date.now();
    await queryForSearch('performance test');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });
});
```

## 📋 今後の拡張予定

### Phase 1: 高度な分析機能
- セマンティック検索の実装
- 文書間の関係性分析
- トピックモデリング

### Phase 2: パーソナライゼーション
- ユーザー固有の検索履歴活用
- 個人の専門分野に応じた重み付け
- 学習する推薦システム

### Phase 3: 高度な可視化
- 検索結果の可視化
- 文書クラスタリング表示
- インタラクティブなダッシュボード

## 🛠️ トラブルシューティング

### よくある問題と解決方法

1. **テストが失敗する**
   ```bash
   # Vite設定の確認
   npm run test -- --reporter=verbose
   
   # キャッシュのクリア
   npm run test:clear-cache
   ```

2. **モックAPIが動作しない**
   ```bash
   # 環境変数の確認
   echo $VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT
   
   # 開発サーバーの再起動
   npm run dev
   ```

3. **TypeScriptエラー**
   ```bash
   # 型定義の確認
   npm run type-check
   
   # 依存関係の再インストール
   npm install
   ```

## 📞 サポート

### 技術サポート
- **開発チーム**: development-team@example.com
- **ドキュメント**: [内部Wiki](https://wiki.example.com/rag-enhanced)
- **Issues**: [GitHub Issues](https://github.com/example/generative-ai-use-cases/issues)

### 緊急時対応
- **システム障害**: support@example.com
- **セキュリティ問題**: security@example.com

---

このドキュメントは、Enhanced RAG Featuresの包括的なガイドです。機能の詳細や技術仕様について質問がある場合は、開発チームまでお問い合わせください。