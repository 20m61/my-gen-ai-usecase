/**
 * Kendra RAG パフォーマンス監視・分析ツール
 * リアルタイム性能監視とボトルネック特定
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

interface PerformanceMetric {
  timestamp: Date;
  operation: string;
  duration: number;
  success: boolean;
  details: Record<string, any>;
}

interface SystemResource {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  networkLatency: number;
}

interface BottleneckAnalysis {
  component: 'QueryOptimization' | 'KendraRetrieval' | 'LLMProcessing' | 'DocumentProcessing' | 'UIRendering';
  averageDuration: number;
  maxDuration: number;
  errorRate: number;
  recommendations: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface PerformanceReport {
  reportId: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  totalOperations: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number; // operations per minute
  bottlenecks: BottleneckAnalysis[];
  trends: {
    responseTimetrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
    errorRatetrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
    throughputTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  };
  costEstimate: {
    kendraQueries: number;
    kendraStorage: number; // GB
    bedrockTokens: number;
    lambdaInvocations: number;
    estimatedMonthlyCost: number; // USD
  };
  recommendations: string[];
}

class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private systemResources: SystemResource[] = [];
  private activeOperations: Map<string, number> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timer;

  constructor() {
    super();
  }

  /**
   * 監視開始
   */
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('📊 パフォーマンス監視開始');

    this.monitoringInterval = setInterval(() => {
      this.collectSystemResources();
    }, intervalMs);
  }

  /**
   * 監視停止
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    console.log('📊 パフォーマンス監視停止');
  }

  /**
   * 操作の開始をマーク
   */
  startOperation(operationId: string, operation: string): void {
    this.activeOperations.set(operationId, performance.now());
    this.emit('operationStarted', { operationId, operation });
  }

  /**
   * 操作の完了をマーク
   */
  endOperation(
    operationId: string, 
    operation: string, 
    success: boolean = true, 
    details: Record<string, any> = {}
  ): void {
    const startTime = this.activeOperations.get(operationId);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    this.activeOperations.delete(operationId);

    const metric: PerformanceMetric = {
      timestamp: new Date(),
      operation,
      duration,
      success,
      details
    };

    this.metrics.push(metric);
    this.emit('operationCompleted', metric);

    // メトリクス数の制限（メモリ管理）
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  /**
   * RAG操作の包括的測定
   */
  async measureRagOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    details: Record<string, any> = {}
  ): Promise<T> {
    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.startOperation(operationId, operation);
    
    try {
      const result = await fn();
      this.endOperation(operationId, operation, true, details);
      return result;
    } catch (error) {
      this.endOperation(operationId, operation, false, {
        ...details,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * システムリソース収集
   */
  private collectSystemResources(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const resource: SystemResource = {
      timestamp: new Date(),
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // マイクロ秒からミリ秒に変換
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      networkLatency: 0 // 実装に応じて測定
    };

    this.systemResources.push(resource);
    this.emit('resourceCollected', resource);

    // リソース履歴の制限
    if (this.systemResources.length > 3600) { // 1時間分
      this.systemResources = this.systemResources.slice(-1800);
    }
  }

  /**
   * ボトルネック分析
   */
  analyzeBottlenecks(timeRangeMinutes: number = 60): BottleneckAnalysis[] {
    const cutoffTime = new Date(Date.now() - timeRangeMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    const operationGroups = this.groupMetricsByOperation(recentMetrics);
    const bottlenecks: BottleneckAnalysis[] = [];

    for (const [operation, metrics] of operationGroups.entries()) {
      const durations = metrics.map(m => m.duration);
      const errors = metrics.filter(m => !m.success);

      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const errorRate = errors.length / metrics.length;

      let severity: BottleneckAnalysis['severity'] = 'LOW';
      const recommendations: string[] = [];

      // 性能閾値による分析
      if (averageDuration > 10000) {
        severity = 'CRITICAL';
        recommendations.push('重大な性能問題: 平均応答時間が10秒を超過');
      } else if (averageDuration > 5000) {
        severity = 'HIGH';
        recommendations.push('性能改善が必要: 平均応答時間が5秒を超過');
      } else if (averageDuration > 2000) {
        severity = 'MEDIUM';
        recommendations.push('性能監視が必要: 平均応答時間が2秒を超過');
      }

      // エラー率による分析
      if (errorRate > 0.1) {
        severity = 'CRITICAL';
        recommendations.push(`高いエラー率: ${(errorRate * 100).toFixed(1)}%`);
      } else if (errorRate > 0.05) {
        severity = severity === 'LOW' ? 'HIGH' : severity;
        recommendations.push(`エラー率が高め: ${(errorRate * 100).toFixed(1)}%`);
      }

      // 操作別の具体的推奨事項
      if (operation.includes('QueryOptimization')) {
        if (averageDuration > 1000) {
          recommendations.push('クエリ最適化アルゴリズムの改善を検討');
        }
      } else if (operation.includes('KendraRetrieval')) {
        if (averageDuration > 3000) {
          recommendations.push('Kendraインデックスの最適化を検討');
          recommendations.push('検索クエリの精度向上');
        }
      } else if (operation.includes('LLMProcessing')) {
        if (averageDuration > 5000) {
          recommendations.push('プロンプトの簡素化を検討');
          recommendations.push('ストリーミングレスポンスの導入');
        }
      }

      const component = this.mapOperationToComponent(operation);
      
      bottlenecks.push({
        component,
        averageDuration,
        maxDuration,
        errorRate,
        recommendations,
        severity
      });
    }

    return bottlenecks.sort((a, b) => {
      const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * パフォーマンスレポート生成
   */
  generatePerformanceReport(timeRangeMinutes: number = 60): PerformanceReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeRangeMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    const durations = recentMetrics.map(m => m.duration);
    const successfulOps = recentMetrics.filter(m => m.success);
    
    // 統計計算
    const totalOperations = recentMetrics.length;
    const averageResponseTime = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    const sortedDurations = durations.sort((a, b) => a - b);
    const p95ResponseTime = this.calculatePercentile(sortedDurations, 95);
    const p99ResponseTime = this.calculatePercentile(sortedDurations, 99);
    
    const errorRate = totalOperations > 0 
      ? (totalOperations - successfulOps.length) / totalOperations 
      : 0;
    
    const throughput = totalOperations / timeRangeMinutes; // per minute

    // トレンド分析
    const trends = this.analyzeTrends(timeRangeMinutes);

    // ボトルネック分析
    const bottlenecks = this.analyzeBottlenecks(timeRangeMinutes);

    // コスト推定
    const costEstimate = this.estimateCosts(recentMetrics);

    // 総合推奨事項
    const recommendations = this.generateRecommendations(
      averageResponseTime, 
      errorRate, 
      bottlenecks
    );

    return {
      reportId: `perf_${Date.now()}`,
      generatedAt: new Date(),
      timeRange: { start: startTime, end: endTime },
      totalOperations,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errorRate,
      throughput,
      bottlenecks,
      trends,
      costEstimate,
      recommendations
    };
  }

  /**
   * ヘルパーメソッド
   */
  private groupMetricsByOperation(metrics: PerformanceMetric[]): Map<string, PerformanceMetric[]> {
    const groups = new Map<string, PerformanceMetric[]>();
    
    for (const metric of metrics) {
      if (!groups.has(metric.operation)) {
        groups.set(metric.operation, []);
      }
      groups.get(metric.operation)!.push(metric);
    }
    
    return groups;
  }

  private mapOperationToComponent(operation: string): BottleneckAnalysis['component'] {
    if (operation.includes('QueryOptimization')) return 'QueryOptimization';
    if (operation.includes('KendraRetrieval')) return 'KendraRetrieval';
    if (operation.includes('LLMProcessing')) return 'LLMProcessing';
    if (operation.includes('DocumentProcessing')) return 'DocumentProcessing';
    return 'UIRendering';
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private analyzeTrends(timeRangeMinutes: number): PerformanceReport['trends'] {
    const halfRange = timeRangeMinutes / 2;
    const midpoint = new Date(Date.now() - halfRange * 60 * 1000);
    
    const firstHalf = this.metrics.filter(m => 
      m.timestamp < midpoint && 
      m.timestamp >= new Date(Date.now() - timeRangeMinutes * 60 * 1000)
    );
    const secondHalf = this.metrics.filter(m => m.timestamp >= midpoint);

    const firstHalfAvgTime = this.calculateAverageResponseTime(firstHalf);
    const secondHalfAvgTime = this.calculateAverageResponseTime(secondHalf);
    
    const firstHalfErrorRate = this.calculateErrorRate(firstHalf);
    const secondHalfErrorRate = this.calculateErrorRate(secondHalf);

    const responseTimeImprovement = (firstHalfAvgTime - secondHalfAvgTime) / firstHalfAvgTime;
    const errorRateImprovement = (firstHalfErrorRate - secondHalfErrorRate) / Math.max(firstHalfErrorRate, 0.001);

    return {
      responseTimetrend: responseTimeImprovement > 0.05 ? 'IMPROVING' : 
                        responseTimeImprovement < -0.05 ? 'DEGRADING' : 'STABLE',
      errorRatetrend: errorRateImprovement > 0.05 ? 'IMPROVING' : 
                     errorRateImprovement < -0.05 ? 'DEGRADING' : 'STABLE',
      throughputTrend: 'STABLE' // 簡略化
    };
  }

  private calculateAverageResponseTime(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
  }

  private calculateErrorRate(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.filter(m => !m.success).length / metrics.length;
  }

  private estimateCosts(metrics: PerformanceMetric[]): PerformanceReport['costEstimate'] {
    const kendraQueries = metrics.filter(m => m.operation.includes('Kendra')).length;
    const llmTokens = metrics
      .filter(m => m.operation.includes('LLM'))
      .reduce((sum, m) => sum + (m.details.tokens || 1000), 0); // 推定

    // Developer Edition料金
    const kendraStorage = 0.75; // GB (制限値)
    const lambdaInvocations = metrics.length;

    const estimatedMonthlyCost = 
      810 + // Kendra Developer Edition
      (llmTokens / 1000) * 0.008 + // Claude tokens (概算)
      (lambdaInvocations / 1000000) * 0.20; // Lambda (概算)

    return {
      kendraQueries,
      kendraStorage,
      bedrockTokens: llmTokens,
      lambdaInvocations,
      estimatedMonthlyCost
    };
  }

  private generateRecommendations(
    avgResponseTime: number, 
    errorRate: number, 
    bottlenecks: BottleneckAnalysis[]
  ): string[] {
    const recommendations: string[] = [];

    if (avgResponseTime > 5000) {
      recommendations.push('応答時間が長すぎます。キャッシュ戦略の導入を検討してください');
    }

    if (errorRate > 0.05) {
      recommendations.push('エラー率が高いです。エラーハンドリングの改善が必要です');
    }

    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'CRITICAL');
    if (criticalBottlenecks.length > 0) {
      recommendations.push('重大なボトルネックが検出されました。緊急対応が必要です');
    }

    recommendations.push('継続的な監視を行い、定期的にパフォーマンスレビューを実施してください');

    return recommendations;
  }

  /**
   * メトリクスのエクスポート
   */
  exportMetrics(): {
    metrics: PerformanceMetric[];
    systemResources: SystemResource[];
  } {
    return {
      metrics: [...this.metrics],
      systemResources: [...this.systemResources]
    };
  }

  /**
   * メトリクスのクリア
   */
  clearMetrics(): void {
    this.metrics = [];
    this.systemResources = [];
    this.activeOperations.clear();
  }
}

// グローバルモニターインスタンス
export const globalPerformanceMonitor = new PerformanceMonitor();

export {
  PerformanceMonitor,
  PerformanceMetric,
  SystemResource,
  BottleneckAnalysis,
  PerformanceReport
};