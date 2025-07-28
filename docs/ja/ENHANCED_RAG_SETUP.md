# Enhanced RAG Features セットアップガイド

## 🚀 はじめに

このガイドでは、既存のKendra RAGシステムに追加された拡張機能のセットアップと使用方法について説明します。新しい開発者がプロジェクトに参加する際の参考資料としてもご利用ください。

## 📋 前提条件

### 必要なソフトウェア
- Node.js 18.x 以上
- npm 9.x 以上
- AWS CLI v2
- Git

### AWS 権限
- Amazon Kendra の読み取り権限
- Amazon Bedrock の実行権限
- CloudWatch Logs の読み取り権限

## 🔧 初期セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd my-gen-ai-usecase/packages/web
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local` ファイルを作成し、以下の設定を追加：

```bash
# Enhanced RAG Features の有効化
VITE_APP_ENABLE_RAG_OPTIMIZATION=true
VITE_APP_ENABLE_ADVANCED_SEARCH=true
VITE_APP_ENABLE_METRICS_DASHBOARD=true
VITE_APP_ENABLE_DATA_SOURCE_MANAGER=true

# API エンドポイント設定
VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT=https://your-api-gateway-url/rag/kendra-enhanced

# 開発環境でのモック API 使用（オプション）
# VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT=https://mock-api-endpoint/rag/kendra-enhanced

# デバッグ設定
VITE_APP_DEBUG_MODE=true
VITE_APP_LOG_LEVEL=info
```

### 4. TypeScript 設定の確認

`tsconfig.json` が正しく設定されていることを確認：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals"]
  },
  "include": [
    "src",
    "vite.config.ts"
  ],
  "references": [
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
```

## 🧪 テスト環境のセットアップ

### 1. Vitest 設定

`vite.config.ts` のテスト設定を確認：

```typescript
export default defineConfig(({ mode }) => ({
  // ... 他の設定
  test: {
    name: 'enhanced-rag-components',
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    deps: {
      inline: ['@testing-library/react', '@testing-library/jest-dom']
    }
  },
}));
```

### 2. テストセットアップファイル

`src/test-setup.ts` を作成：

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// グローバルなモック設定
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ResizeObserver のモック
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// IntersectionObserver のモック
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

### 3. テストの実行

```bash
# 全テストの実行
npm run test

# 特定のテストファイルの実行
npm run test -- AdvancedSearchPanel.test.tsx

# ウォッチモードでの実行
npm run test:watch

# カバレッジ付きでの実行
npm run test:coverage
```

## 🏃‍♂️ 開発サーバーの起動

### 1. 開発モードでの起動

```bash
npm run dev
```

### 2. 拡張機能の確認

ブラウザで `http://localhost:3000` にアクセスし、以下を確認：

- RAGチャットページで高度な検索パネルが表示される
- メトリクスダッシュボードが利用可能
- データソース管理画面にアクセスできる

### 3. テストUIの確認

開発環境では `http://localhost:3000/test-rag` にアクセスして、統合テストUIを確認できます。

## 🔍 機能別セットアップ詳細

### Advanced Search Panel（高度な検索パネル）

#### 必要な設定
```bash
VITE_APP_ENABLE_ADVANCED_SEARCH=true
```

#### 使用例
```typescript
import AdvancedSearchPanel from '../components/AdvancedSearchPanel';

const MyComponent = () => {
  const handleSearch = (query: string, filters?: Record<string, string[]>) => {
    console.log('Search:', query, filters);
  };

  return (
    <AdvancedSearchPanel
      onSearch={handleSearch}
      className="mb-4"
    />
  );
};
```

### RAG Metrics Dashboard（メトリクスダッシュボード）

#### 必要な設定
```bash
VITE_APP_ENABLE_METRICS_DASHBOARD=true
```

#### 使用例
```typescript
import RAGMetricsDashboard from '../components/RAGMetricsDashboard';
import { useRagMetrics } from '../hooks/useRagMetrics';

const MetricsPage = () => {
  const { getPerformanceStats } = useRagMetrics();
  const stats = getPerformanceStats();

  return (
    <RAGMetricsDashboard
      performanceStats={stats}
      onRefresh={() => window.location.reload()}
    />
  );
};
```

### Kendra Data Source Manager（データソース管理）

#### 必要な設定
```bash
VITE_APP_ENABLE_DATA_SOURCE_MANAGER=true
```

#### 使用例
```typescript
import KendraDataSourceManager from '../components/KendraDataSourceManager';

const AdminPage = () => {
  return (
    <div>
      <h1>データソース管理</h1>
      <KendraDataSourceManager
        onRefresh={() => console.log('Refreshing data sources')}
      />
    </div>
  );
};
```

## 🐛 モック API の使用

### 開発環境でのセットアップ

モックAPIを使用する場合の設定：

```bash
# .env.local
VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT=https://mock-api-endpoint/rag/kendra-enhanced
```

### モックサービスの制御

```typescript
// src/services/mockRagApiService.ts の設定

export const shouldUseMockService = (): boolean => {
  return process.env.NODE_ENV === 'development' && 
         process.env.VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT?.includes('mock');
};

// 異なるレスポンス時間のシミュレーション
export const setMockResponseDelay = (min: number, max: number) => {
  // 100-1000ms の範囲で調整可能
};
```

### モックデータのカスタマイズ

```typescript
// カスタムモックデータの追加
export const addCustomMockResponse = (query: string, response: any) => {
  customMockResponses.set(query, response);
};

// エラーシミュレーションの設定
export const enableErrorSimulation = (errorRate: number) => {
  mockErrorRate = errorRate; // 0.0 - 1.0
};
```

## 📊 メトリクスとログ

### メトリクス収集の設定

```typescript
// src/hooks/useRagMetrics.ts の設定

export const configureMetrics = {
  // メトリクス保持期間（ミリ秒）
  retentionPeriod: 24 * 60 * 60 * 1000, // 24時間
  
  // メトリクス収集間隔（ミリ秒）
  collectionInterval: 5 * 60 * 1000, // 5分
  
  // 最大メトリクス数
  maxMetricsCount: 1000
};
```

### ログレベルの設定

```bash
# .env.local
VITE_APP_LOG_LEVEL=debug  # debug, info, warn, error
```

### カスタムログの追加

```typescript
import { logger } from '../utils/logger';

// 使用例
logger.info('Search completed', { query, resultCount, duration });
logger.error('API error occurred', { error: error.message });
logger.debug('Cache hit', { key, value });
```

## 🔧 カスタマイズ

### コンポーネントのスタイリング

```typescript
// Tailwind CSS クラスを使用
<AdvancedSearchPanel
  className="bg-gray-50 rounded-lg shadow-md p-4"
  onSearch={handleSearch}
/>

// カスタムCSSの追加
<RAGMetricsDashboard
  performanceStats={stats}
  className="custom-dashboard"
  onRefresh={handleRefresh}
/>
```

### API エンドポイントのカスタマイズ

```typescript
// src/hooks/useRagApiEnhanced.ts

const API_ENDPOINTS = {
  query: process.env.VITE_APP_RAG_QUERY_ENDPOINT || '/api/rag/query',
  retrieve: process.env.VITE_APP_RAG_RETRIEVE_ENDPOINT || '/api/rag/retrieve',
  suggestions: process.env.VITE_APP_RAG_SUGGESTIONS_ENDPOINT || '/api/rag/suggestions',
  facetedSearch: process.env.VITE_APP_RAG_FACETED_SEARCH_ENDPOINT || '/api/rag/faceted-search'
};
```

### キャッシュ設定のカスタマイズ

```typescript
// src/hooks/useRagCache.ts

export const cacheConfig = {
  // デフォルト TTL（ミリ秒）
  defaultTTL: 5 * 60 * 1000, // 5分
  
  // 最大キャッシュサイズ
  maxSize: 100,
  
  // キャッシュキーのプレフィックス
  keyPrefix: 'rag_',
  
  // キャッシュの永続化（localStorage使用）
  persistent: true
};
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. TypeScript エラー

**問題**: `Property 'xxx' does not exist on type 'yyy'`

**解決方法**:
```bash
# 型定義ファイルの確認
ls -la src/@types/

# 型チェックの実行
npm run type-check

# 必要に応じて型定義を追加
# src/@types/enhanced-rag.d.ts
```

#### 2. テストが失敗する

**問題**: `ReferenceError: TextEncoder is not defined`

**解決方法**:
```bash
# Node.js のバージョン確認
node --version  # 18.x 以上であることを確認

# テストセットアップファイルに追加
# src/test-setup.ts
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
```

#### 3. 環境変数が読み込まれない

**問題**: `process.env.VITE_APP_XXX` が `undefined`

**解決方法**:
```bash
# .env.local ファイルの場所確認
ls -la .env.local

# ファイル内容の確認
cat .env.local

# 開発サーバーの再起動
npm run dev
```

#### 4. モック API が動作しない

**問題**: API呼び出しが実際のサーバーに送信される

**解決方法**:
```typescript
// shouldUseMockService 関数の確認
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ENDPOINT:', process.env.VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT);
console.log('Should use mock:', shouldUseMockService());
```

#### 5. キャッシュが機能しない

**問題**: 同じクエリでも毎回API呼び出しが発生

**解決方法**:
```typescript
// キャッシュの状態確認
import { useRagCache } from '../hooks/useRagCache';

const { getStats } = useRagCache();
console.log('Cache stats:', getStats());

// キャッシュのクリア
const { clear } = useRagCache();
clear();
```

### デバッグのヒント

#### 1. ブラウザの開発者ツール

```javascript
// コンソールでのデバッグ
localStorage.setItem('debug', 'rag:*');

// ネットワークタブでAPI呼び出しの確認
// - リクエストURL
// - レスポンス内容
// - レスポンス時間
```

#### 2. React Developer Tools

- コンポーネントの状態確認
- プロパティの検証
- 再レンダリングの追跡

#### 3. ログの活用

```typescript
// デバッグログの有効化
console.log('Enhanced RAG Debug Mode:', process.env.VITE_APP_DEBUG_MODE);

// 詳細ログの確認
import { logger } from '../utils/logger';
logger.setLevel('debug');
```

## 📚 追加リソース

### ドキュメント
- [Enhanced RAG Features Documentation](../enhanced-rag-features.md)
- [Kendra RAG Architecture](../KENDRA_RAG_ARCHITECTURE.md)
- [RAG Improvements Summary](../RAG_IMPROVEMENTS_SUMMARY.md)

### 外部リンク
- [Amazon Kendra Developer Guide](https://docs.aws.amazon.com/kendra/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Documentation](https://vitest.dev/)

### コミュニティ
- [GitHub Discussions](https://github.com/example/generative-ai-use-cases/discussions)
- [Internal Slack Channel](https://company.slack.com/channels/rag-development)

## 📞 サポート

質問や問題がある場合は、以下にお問い合わせください：

- **技術サポート**: tech-support@example.com
- **開発チーム**: dev-team@example.com
- **緊急時**: emergency@example.com

---

このセットアップガイドに従って、Enhanced RAG Features を正常に動作させることができます。追加の質問や問題がある場合は、お気軽にサポートチームまでお問い合わせください。