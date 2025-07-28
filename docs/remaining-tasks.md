# 🚧 残る実装課題と推奨事項

## 📋 概要

Kendra RAGシステムの包括的な改善は完了しましたが、本番環境での完全な動作のために以下の課題が残っています。

## 🔴 高優先度タスク

### 1. CDKスタックへの統合
**現状**: 新しいLambda関数（`retrieveKendraEnhanced.ts`）が作成されたが、CDKスタックに未統合

**必要な作業**:
```typescript
// packages/cdk/lib/constructs/rag.ts に追加
const enhancedKendraFunction = new NodejsFunction(this, 'RetrieveKendraEnhanced', {
  entry: join(__dirname, '../../lambda/retrieveKendraEnhanced.ts'),
  runtime: Runtime.NODEJS_18_X,
  timeout: Duration.seconds(30),
  memorySize: 512,
  environment: {
    INDEX_ID: kendraIndex.attrId,
    LANGUAGE: 'ja',
  },
});

// 権限付与
kendraIndex.grantRead(enhancedKendraFunction);

// API Gateway統合
const kendraEnhancedIntegration = new LambdaIntegration(enhancedKendraFunction);
ragApi.root.addResource('kendra-enhanced').addMethod('POST', kendraEnhancedIntegration);
```

### 2. 既存コンポーネントへの統合
**現状**: 新機能が独立したフックとして存在するが、既存のRAGページに未統合

**必要な作業**:
- `RagPage.tsx`に`useRagOptimized`を統合
- `AdvancedSearchPanel`コンポーネントの追加オプション
- 既存の`useRag`から`useRagOptimized`への段階的移行

```typescript
// packages/web/src/pages/RagPage.tsx
import useRagOptimized from '../hooks/useRagOptimized';
import AdvancedSearchPanel from '../components/AdvancedSearchPanel';

// 条件付きで新機能を有効化
const useOptimizedRag = process.env.VITE_APP_ENABLE_RAG_OPTIMIZATION === 'true';
const rag = useOptimizedRag ? useRagOptimized(pathname) : useRag(pathname);
```

## 🟡 中優先度タスク

### 3. 環境変数の設定
**必要な環境変数**:
```bash
# .env.local
VITE_APP_RAG_KENDRA_RETRIEVE_ENDPOINT=https://your-api-gateway-url/rag/kendra-enhanced
VITE_APP_ENABLE_RAG_OPTIMIZATION=true
VITE_APP_ENABLE_ADVANCED_SEARCH=true
VITE_APP_ENABLE_USER_CONTEXT=true
```

**CDK出力の追加**:
```typescript
new CfnOutput(this, 'KendraEnhancedEndpoint', {
  value: `${ragApi.url}kendra-enhanced`,
  description: 'Enhanced Kendra API endpoint for RAG',
});
```

### 4. エラーハンドリングの強化
**推奨実装**:
```typescript
// グローバルエラーハンドラー
const handleKendraError = (error: any) => {
  if (error.response?.status === 429) {
    // レート制限エラー
    return { retry: true, delay: 1000 };
  }
  if (error.response?.status === 403) {
    // アクセス権限エラー
    return { retry: false, message: 'アクセス権限がありません' };
  }
  // デフォルトフォールバック
  return { retry: false, fallback: true };
};
```

### 5. 監視・アラート設定
**CloudWatch設定**:
```typescript
// CDKでのアラーム設定
new Alarm(this, 'KendraErrorRateAlarm', {
  metric: enhancedKendraFunction.metricErrors(),
  threshold: 5,
  evaluationPeriods: 2,
});

new Alarm(this, 'KendraLatencyAlarm', {
  metric: enhancedKendraFunction.metricDuration(),
  threshold: 5000, // 5秒
  evaluationPeriods: 3,
});
```

## 🟢 低優先度タスク

### 6. Enterprise Edition移行ガイド
**作成すべきドキュメント**:
- 移行前チェックリスト
- データ移行手順
- ダウンタイム最小化戦略
- コスト比較分析
- 移行後の検証手順

## 🧪 テスト・検証タスク

### 統合テスト
```bash
# 新機能の統合テスト
npm test -- --testPathPattern="useRagOptimized"
npm test -- --testPathPattern="AdvancedSearchPanel"
npm test -- --testPathPattern="useUserContext"
```

### E2Eテスト
```typescript
// cypress/e2e/rag-enhanced.cy.ts
describe('Enhanced RAG Features', () => {
  it('should use cache for repeated queries', () => {
    cy.visit('/rag');
    cy.get('[data-testid="query-input"]').type('test query');
    cy.get('[data-testid="submit"]').click();
    
    // 2回目は即座に結果が表示される
    cy.get('[data-testid="query-input"]').clear().type('test query');
    cy.get('[data-testid="response"]').should('be.visible');
  });
});
```

### パフォーマンステスト
```bash
# Artillery設定
config:
  target: "https://your-api-endpoint"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Load test"
```

## 📊 推定工数

| タスク | 推定時間 | 優先度 |
|--------|----------|--------|
| CDK統合 | 2-3時間 | 高 |
| コンポーネント統合 | 3-4時間 | 高 |
| 環境変数設定 | 1時間 | 中 |
| エラーハンドリング | 2-3時間 | 中 |
| 監視設定 | 2時間 | 中 |
| 移行ガイド作成 | 4時間 | 低 |
| テスト実装 | 4-6時間 | 中 |

**合計推定時間**: 18-24時間

## 🎯 推奨実装順序

1. **Phase 1** (必須): CDK統合 → 環境変数設定
2. **Phase 2** (推奨): エラーハンドリング → 基本的な統合テスト
3. **Phase 3** (運用準備): 監視設定 → コンポーネント統合
4. **Phase 4** (最適化): パフォーマンステスト → 移行ガイド作成

## 💡 追加の推奨事項

### A/Bテスト戦略
```typescript
// 段階的ロールアウト
const enabledUsers = ['user1', 'user2', 'test-group'];
const isOptimizedEnabled = enabledUsers.includes(currentUser.id) || 
                          Math.random() < 0.1; // 10%のユーザーに展開
```

### フィーチャーフラグ
```typescript
const features = {
  enhancedSearch: process.env.VITE_APP_FEATURE_ENHANCED_SEARCH === 'true',
  userContext: process.env.VITE_APP_FEATURE_USER_CONTEXT === 'true',
  performanceOptimization: process.env.VITE_APP_FEATURE_OPTIMIZATION === 'true',
};
```

### ロールバック計画
1. 環境変数でのフィーチャー無効化
2. 以前のLambda関数バージョンへの切り替え
3. キャッシュクリア手順

これらの課題を順次対応することで、Kendra RAGシステムの改善を本番環境で安全に展開できます。