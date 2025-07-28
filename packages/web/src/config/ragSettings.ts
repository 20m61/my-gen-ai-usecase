// RAG設定の外部化
export const RAG_CONFIG = {
  document: {
    minContentLength: 50,
    maxDocuments: 5,
    scoring: {
      confidenceWeights: {
        VERY_HIGH: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      } as const,
      contentLengthBonuses: {
        long: { threshold: 1000, bonus: 2 },
        medium: { threshold: 500, bonus: 1 },
        short: { threshold: 100, penalty: -1 },
      },
      documentTypeBonus: {
        pdf: 1,
        html: 0.5,
        txt: 0,
      } as const,
      titleQualityBonus: 0.5,
    },
  },
  query: {
    maxLength: 100,
    minLength: 3,
    fallbackStrategy: 'original' as const,
  },
  metrics: {
    enabled: true,
    logLevel: 'info' as const,
  },
} as const;

// 設定の型定義
export type RAGConfigType = typeof RAG_CONFIG;
export type ConfidenceLevel = keyof typeof RAG_CONFIG.document.scoring.confidenceWeights;
export type DocumentType = keyof typeof RAG_CONFIG.document.scoring.documentTypeBonus;

// メトリクス収集用の型定義
export interface RAGMetrics {
  queryOptimizationSuccess: boolean;
  documentsRetrieved: number;
  documentsAfterFiltering: number;
  averageDocumentScore: number;
  processingTime: number;
  timestamp: Date;
}

// メトリクス収集機能
export const collectMetrics = (metrics: RAGMetrics): void => {
  if (RAG_CONFIG.metrics.enabled) {
    console.log('RAG Metrics:', {
      ...metrics,
      timestamp: metrics.timestamp.toISOString(),
    });
    
    // 将来的にCloudWatch等への送信を追加
    // await sendMetricsToCloudWatch(metrics);
  }
};

// プリセット設定
export const RAG_PRESETS = {
  HIGH_PRECISION: {
    ...RAG_CONFIG,
    document: {
      ...RAG_CONFIG.document,
      minContentLength: 100,
      maxDocuments: 3,
      scoring: {
        ...RAG_CONFIG.document.scoring,
        confidenceWeights: {
          VERY_HIGH: 5,
          HIGH: 4,
          MEDIUM: 2,
          LOW: 0,
        } as const,
      },
    },
  },
  HIGH_RECALL: {
    ...RAG_CONFIG,
    document: {
      ...RAG_CONFIG.document,
      minContentLength: 20,
      maxDocuments: 10,
      scoring: {
        ...RAG_CONFIG.document.scoring,
        confidenceWeights: {
          VERY_HIGH: 3,
          HIGH: 2.5,
          MEDIUM: 2,
          LOW: 1.5,
        } as const,
      },
    },
  },
  BALANCED: RAG_CONFIG,
} as const;

// クエリ最適化エラーハンドリング
export const handleQueryOptimization = (rawQuery: string, originalQuery: string): string => {
  const trimmed = rawQuery.trim();
  
  if (trimmed === 'INSUFFICIENT_QUERY') {
    console.warn('Query optimization returned INSUFFICIENT_QUERY', { originalQuery });
    return originalQuery;
  }
  
  if (trimmed.length < RAG_CONFIG.query.minLength) {
    console.warn('Query optimization returned too short query', { 
      optimized: trimmed, 
      original: originalQuery,
      minLength: RAG_CONFIG.query.minLength 
    });
    return originalQuery;
  }
  
  if (trimmed.length > RAG_CONFIG.query.maxLength) {
    console.warn('Query optimization returned too long query', { 
      optimized: trimmed,
      maxLength: RAG_CONFIG.query.maxLength 
    });
    return trimmed.substring(0, RAG_CONFIG.query.maxLength);
  }
  
  return trimmed;
};