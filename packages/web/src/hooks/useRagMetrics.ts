import { useState, useCallback } from 'react';
import { RetrieveResultItem } from '@aws-sdk/client-kendra';

// RAGメトリクス関連の型定義
export interface RAGQueryMetrics {
  queryId: string;
  originalQuery: string;
  optimizedQuery: string;
  queryOptimizationTime: number;
  retrievalTime: number;
  totalDocumentsRetrieved: number;
  documentsAfterFiltering: number;
  averageDocumentScore: number;
  averageConfidenceLevel: string;
  responseGenerationTime: number;
  totalProcessingTime: number;
  userSatisfaction?: number; // 1-5 scale
  timestamp: Date;
}

export interface RAGPerformanceStats {
  totalQueries: number;
  averageProcessingTime: number;
  averageDocumentScore: number;
  successRate: number;
  mostCommonQueries: string[];
  queryOptimizationSuccessRate: number;
}

// メトリクス収集のカスタムフック
export const useRagMetrics = () => {
  const [metrics, setMetrics] = useState<RAGQueryMetrics[]>([]);
  const [currentQueryMetrics, setCurrentQueryMetrics] = useState<Partial<RAGQueryMetrics>>({});

  // 新しいクエリの開始
  const startQuery = useCallback((queryId: string, originalQuery: string) => {
    const newMetrics: Partial<RAGQueryMetrics> = {
      queryId,
      originalQuery,
      timestamp: new Date(),
    };
    setCurrentQueryMetrics(newMetrics);
  }, []);

  // クエリ最適化の記録
  const recordQueryOptimization = useCallback((
    optimizedQuery: string,
    optimizationTime: number
  ) => {
    setCurrentQueryMetrics(prev => ({
      ...prev,
      optimizedQuery,
      queryOptimizationTime: optimizationTime,
    }));
  }, []);

  // 文書検索の記録
  const recordDocumentRetrieval = useCallback((
    items: RetrieveResultItem[],
    filteredItems: RetrieveResultItem[],
    retrievalTime: number
  ) => {
    const averageScore = filteredItems.length > 0
      ? filteredItems.reduce((sum, item) => {
          const confidence = item.ScoreAttributes?.ScoreConfidence || 'MEDIUM';
          const scoreMap = { VERY_HIGH: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return sum + (scoreMap[confidence as keyof typeof scoreMap] || 2);
        }, 0) / filteredItems.length
      : 0;

    const confidenceLevels = filteredItems.map(item => 
      item.ScoreAttributes?.ScoreConfidence || 'MEDIUM'
    );
    const mostCommonConfidence = confidenceLevels
      .sort((a, b) => 
        confidenceLevels.filter(c => c === b).length - 
        confidenceLevels.filter(c => c === a).length
      )[0] || 'MEDIUM';

    setCurrentQueryMetrics(prev => ({
      ...prev,
      retrievalTime,
      totalDocumentsRetrieved: items.length,
      documentsAfterFiltering: filteredItems.length,
      averageDocumentScore: averageScore,
      averageConfidenceLevel: mostCommonConfidence,
    }));
  }, []);

  // 回答生成の記録
  const recordResponseGeneration = useCallback((
    responseTime: number
  ) => {
    setCurrentQueryMetrics(prev => {
      const totalTime = (prev.queryOptimizationTime || 0) + 
                       (prev.retrievalTime || 0) + 
                       responseTime;
      
      return {
        ...prev,
        responseGenerationTime: responseTime,
        totalProcessingTime: totalTime,
      };
    });
  }, []);

  // クエリの完了と保存
  const completeQuery = useCallback((userSatisfaction?: number) => {
    if (currentQueryMetrics.queryId) {
      const completedMetrics: RAGQueryMetrics = {
        ...currentQueryMetrics,
        userSatisfaction,
      } as RAGQueryMetrics;

      setMetrics(prev => [...prev, completedMetrics]);
      
      // メトリクスをローカルストレージに保存
      const existingMetrics = JSON.parse(
        localStorage.getItem('ragMetrics') || '[]'
      );
      const updatedMetrics = [...existingMetrics, completedMetrics];
      localStorage.setItem('ragMetrics', JSON.stringify(updatedMetrics));
      
      setCurrentQueryMetrics({});
      
      return completedMetrics;
    }
    return null;
  }, [currentQueryMetrics]);

  // 後からユーザー満足度を更新
  const updateQuerySatisfaction = useCallback((queryId: string, satisfaction: number) => {
    // メモリ内のメトリクスを更新
    setMetrics(prev => prev.map(metric => 
      metric.queryId === queryId 
        ? { ...metric, userSatisfaction: satisfaction }
        : metric
    ));

    // ローカルストレージも更新
    const existingMetrics = JSON.parse(localStorage.getItem('ragMetrics') || '[]');
    const updatedMetrics = existingMetrics.map((metric: RAGQueryMetrics) =>
      metric.queryId === queryId
        ? { ...metric, userSatisfaction: satisfaction }
        : metric
    );
    localStorage.setItem('ragMetrics', JSON.stringify(updatedMetrics));
  }, []);

  // パフォーマンス統計の計算
  const getPerformanceStats = useCallback((): RAGPerformanceStats => {
    const allMetrics = [
      ...metrics,
      ...JSON.parse(localStorage.getItem('ragMetrics') || '[]')
    ];

    if (allMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageProcessingTime: 0,
        averageDocumentScore: 0,
        successRate: 0,
        mostCommonQueries: [],
        queryOptimizationSuccessRate: 0,
      };
    }

    const totalQueries = allMetrics.length;
    const averageProcessingTime = allMetrics.reduce(
      (sum, m) => sum + (m.totalProcessingTime || 0), 0
    ) / totalQueries;
    
    const averageDocumentScore = allMetrics.reduce(
      (sum, m) => sum + (m.averageDocumentScore || 0), 0
    ) / totalQueries;

    const successfulQueries = allMetrics.filter(
      m => (m.documentsAfterFiltering || 0) > 0
    ).length;
    const successRate = (successfulQueries / totalQueries) * 100;

    const queryOptimizationSuccesses = allMetrics.filter(
      m => m.optimizedQuery && m.optimizedQuery !== m.originalQuery
    ).length;
    const queryOptimizationSuccessRate = (queryOptimizationSuccesses / totalQueries) * 100;

    // 最も一般的なクエリパターンの抽出
    const queryTerms = allMetrics.flatMap(m => 
      m.originalQuery.toLowerCase().split(/\s+/).filter((term: string) => term.length > 3)
    );
    const termCounts = queryTerms.reduce((counts, term) => {
      counts[term] = (counts[term] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const mostCommonQueries = Object.entries(termCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([term]) => term);

    return {
      totalQueries,
      averageProcessingTime,
      averageDocumentScore,
      successRate,
      mostCommonQueries,
      queryOptimizationSuccessRate,
    };
  }, [metrics]);

  // メトリクスのクリア
  const clearMetrics = useCallback(() => {
    setMetrics([]);
    localStorage.removeItem('ragMetrics');
  }, []);

  return {
    startQuery,
    recordQueryOptimization,
    recordDocumentRetrieval,
    recordResponseGeneration,
    completeQuery,
    updateQuerySatisfaction,
    getPerformanceStats,
    clearMetrics,
    currentMetrics: currentQueryMetrics,
    allMetrics: metrics,
  };
};

// メトリクス可視化のためのヘルパー関数
export const formatMetricsForDisplay = (stats: RAGPerformanceStats) => ({
  performance: {
    'クエリ処理時間': `${stats.averageProcessingTime.toFixed(2)}ms`,
    '成功率': `${stats.successRate.toFixed(1)}%`,
    '平均文書スコア': stats.averageDocumentScore.toFixed(2),
    'クエリ最適化成功率': `${stats.queryOptimizationSuccessRate.toFixed(1)}%`,
  },
  usage: {
    '総クエリ数': stats.totalQueries.toString(),
    '人気キーワード': stats.mostCommonQueries.slice(0, 5).join(', '),
  },
});

export default useRagMetrics;