/**
 * Kendra RAG システム自動検証スイート
 * Developer Edition制限下での包括的テスト
 */

import { KendraClient } from '@aws-sdk/client-kendra';
import axios from 'axios';

interface TestConfig {
  kendraIndexId: string;
  apiEndpoint: string;
  authToken: string;
  testDataPath: string;
}

interface TestMetrics {
  testName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  errorMessage?: string;
  customMetrics?: Record<string, number>;
}

interface ValidationResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallDuration: number;
  metrics: TestMetrics[];
  summary: {
    performance: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    scalability: 'HIGH' | 'MEDIUM' | 'LOW';
    reliability: 'HIGH' | 'MEDIUM' | 'LOW';
    recommendations: string[];
  };
}

class KendraValidationSuite {
  private config: TestConfig;
  private kendra: KendraClient;
  private results: TestMetrics[] = [];

  constructor(config: TestConfig) {
    this.config = config;
    this.kendra = new KendraClient({});
  }

  /**
   * Phase 1: 基本機能検証
   */
  async runBasicFunctionalityTests(): Promise<TestMetrics[]> {
    const tests = [
      () => this.testDataSourceListing(),
      () => this.testDataSourceDetails(),
      () => this.testSyncJobManagement(),
      () => this.testBasicQueryExecution(),
      () => this.testQueryOptimization(),
      () => this.testDocumentRetrieval(),
      () => this.testResponseGeneration(),
      () => this.testMetricsCollection(),
    ];

    return this.executeTestSuite('基本機能検証', tests);
  }

  /**
   * Phase 2: 性能・制限値検証
   */
  async runPerformanceLimitTests(): Promise<TestMetrics[]> {
    const tests = [
      () => this.testQueryPerformanceBaseline(),
      () => this.testConcurrentQueries(3),
      () => this.testConcurrentQueries(5),
      () => this.testLargeDocumentHandling(),
      () => this.testDailyQueryLimitApproach(),
      () => this.testStorageLimitBehavior(),
    ];

    return this.executeTestSuite('性能・制限値検証', tests);
  }

  /**
   * Phase 3: ストレステスト
   */
  async runStressTests(): Promise<TestMetrics[]> {
    const tests = [
      () => this.testBurstLoad(),
      () => this.testSustainedLoad(),
      () => this.testComplexQueryLoad(),
      () => this.testMultiLanguageQueries(),
      () => this.testErrorRecovery(),
      () => this.testMemoryUsage(),
    ];

    return this.executeTestSuite('ストレステスト', tests);
  }

  /**
   * 包括的検証実行
   */
  async runFullValidation(): Promise<ValidationResults> {
    console.log('🚀 Kendra RAG 包括的検証開始...');
    const startTime = Date.now();

    try {
      // Phase 1: 基本機能
      console.log('📋 Phase 1: 基本機能検証');
      const basicTests = await this.runBasicFunctionalityTests();
      this.results.push(...basicTests);

      // Phase 2: 性能テスト
      console.log('📊 Phase 2: 性能・制限値検証');
      const performanceTests = await this.runPerformanceLimitTests();
      this.results.push(...performanceTests);

      // Phase 3: ストレステスト
      console.log('🔥 Phase 3: ストレステスト');
      const stressTests = await this.runStressTests();
      this.results.push(...stressTests);

      const endTime = Date.now();
      const overallDuration = endTime - startTime;

      return this.generateValidationReport(overallDuration);
    } catch (error) {
      console.error('検証実行エラー:', error);
      throw error;
    }
  }

  /**
   * 個別テストメソッド
   */
  private async testDataSourceListing(): Promise<TestMetrics> {
    return this.executeTest('データソース一覧取得', async () => {
      const response = await axios.post(`${this.config.apiEndpoint}/kendra/data-sources/list`, {
        IndexId: this.config.kendraIndexId,
        MaxResults: 50
      }, {
        headers: { Authorization: this.config.authToken }
      });

      const dataSources = response.data.SummaryItems || [];
      return {
        dataSourceCount: dataSources.length,
        responseSize: JSON.stringify(response.data).length
      };
    });
  }

  private async testDataSourceDetails(): Promise<TestMetrics> {
    return this.executeTest('データソース詳細取得', async () => {
      // まずデータソース一覧を取得
      const listResponse = await axios.post(`${this.config.apiEndpoint}/kendra/data-sources/list`, {
        IndexId: this.config.kendraIndexId
      }, {
        headers: { Authorization: this.config.authToken }
      });

      const dataSources = listResponse.data.SummaryItems || [];
      if (dataSources.length === 0) {
        throw new Error('テスト用データソースが見つかりません');
      }

      const dataSourceId = dataSources[0].Id;
      const detailResponse = await axios.post(`${this.config.apiEndpoint}/kendra/data-sources/describe`, {
        Id: dataSourceId,
        IndexId: this.config.kendraIndexId
      }, {
        headers: { Authorization: this.config.authToken }
      });

      return {
        detailResponseSize: JSON.stringify(detailResponse.data).length,
        hasConfiguration: !!detailResponse.data.Configuration
      };
    });
  }

  private async testBasicQueryExecution(): Promise<TestMetrics> {
    return this.executeTest('基本クエリ実行', async () => {
      const testQueries = [
        '会社の基本方針について教えて',
        'プロジェクトの進捗状況',
        '技術仕様書の場所',
        '連絡先情報',
        '会議室の予約方法'
      ];

      const results = [];
      for (const query of testQueries) {
        const startTime = Date.now();
        const response = await axios.post(`${this.config.apiEndpoint}/rag/chat`, {
          content: query
        }, {
          headers: { Authorization: this.config.authToken }
        });
        const responseTime = Date.now() - startTime;
        
        results.push({
          query,
          responseTime,
          hasResponse: !!response.data,
          responseLength: response.data?.length || 0
        });
      }

      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const successRate = results.filter(r => r.hasResponse).length / results.length;

      return {
        averageResponseTime: avgResponseTime,
        successRate: successRate,
        totalQueries: testQueries.length
      };
    });
  }

  private async testQueryOptimization(): Promise<TestMetrics> {
    return this.executeTest('クエリ最適化機能', async () => {
      const testCases = [
        {
          original: 'プロジェクトの進行状況はどのような感じですか？',
          expected: 'プロジェクト進行状況'
        },
        {
          original: '会社の規則について詳しく教えてもらえませんか？',
          expected: '会社規則 詳細'
        },
        {
          original: 'AWS Lambdaの料金体系について知りたい',
          expected: 'AWS Lambda 料金体系'
        }
      ];

      let optimizationSuccessCount = 0;
      let totalOptimizationTime = 0;

      for (const testCase of testCases) {
        const startTime = Date.now();
        
        // クエリ最適化をテスト（実際のエンドポイントに応じて調整）
        const response = await axios.post(`${this.config.apiEndpoint}/rag/optimize-query`, {
          query: testCase.original
        }, {
          headers: { Authorization: this.config.authToken }
        });

        const optimizationTime = Date.now() - startTime;
        totalOptimizationTime += optimizationTime;

        if (response.data.optimizedQuery !== testCase.original) {
          optimizationSuccessCount++;
        }
      }

      return {
        optimizationSuccessRate: optimizationSuccessCount / testCases.length,
        averageOptimizationTime: totalOptimizationTime / testCases.length,
        totalTestCases: testCases.length
      };
    });
  }

  private async testConcurrentQueries(userCount: number): Promise<TestMetrics> {
    return this.executeTest(`${userCount}ユーザー同時クエリ`, async () => {
      const queries = [
        '技術文書の検索',
        '営業資料の確認',
        '法務文書の参照',
        '一般的な問い合わせ',
        '管理情報の取得'
      ].slice(0, userCount);

      const startTime = Date.now();
      const promises = queries.map(query => 
        axios.post(`${this.config.apiEndpoint}/rag/chat`, {
          content: query
        }, {
          headers: { Authorization: this.config.authToken }
        })
      );

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const maxResponseTime = endTime - startTime;

      return {
        concurrentUsers: userCount,
        successRate: successCount / userCount,
        maxResponseTime,
        totalDuration: maxResponseTime
      };
    });
  }

  private async testDailyQueryLimitApproach(): Promise<TestMetrics> {
    return this.executeTest('日次クエリ制限近接テスト', async () => {
      const testQueryCount = 100; // 制限の一部をテスト
      const batchSize = 10;
      let successCount = 0;
      let totalResponseTime = 0;

      for (let i = 0; i < testQueryCount; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, testQueryCount - i) }, (_, idx) => 
          `テストクエリ ${i + idx + 1}: サンプル文書検索`
        );

        const startTime = Date.now();
        const promises = batch.map(query => 
          axios.post(`${this.config.apiEndpoint}/rag/chat`, {
            content: query
          }, {
            headers: { Authorization: this.config.authToken }
          }).catch(() => null) // エラーを無視して継続
        );

        const results = await Promise.all(promises);
        const batchTime = Date.now() - startTime;
        
        successCount += results.filter(r => r !== null).length;
        totalResponseTime += batchTime;

        // レート制限を避けるため少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        totalQueries: testQueryCount,
        successfulQueries: successCount,
        successRate: successCount / testQueryCount,
        averageResponseTime: totalResponseTime / testQueryCount
      };
    });
  }

  private async testMemoryUsage(): Promise<TestMetrics> {
    return this.executeTest('メモリ使用量テスト', async () => {
      const initialMemory = process.memoryUsage();
      
      // 大量のクエリを実行してメモリ使用量を監視
      const queries = Array.from({ length: 50 }, (_, i) => 
        `長文コンテキストテスト ${i}: ` + 'A'.repeat(1000)
      );

      let maxMemoryDelta = 0;
      for (const query of queries) {
        await axios.post(`${this.config.apiEndpoint}/rag/chat`, {
          content: query
        }, {
          headers: { Authorization: this.config.authToken }
        }).catch(() => {}); // エラーを無視

        const currentMemory = process.memoryUsage();
        const memoryDelta = currentMemory.heapUsed - initialMemory.heapUsed;
        maxMemoryDelta = Math.max(maxMemoryDelta, memoryDelta);
      }

      return {
        initialMemoryMB: initialMemory.heapUsed / 1024 / 1024,
        maxMemoryDeltaMB: maxMemoryDelta / 1024 / 1024,
        queriesProcessed: queries.length
      };
    });
  }

  /**
   * ヘルパーメソッド
   */
  private async executeTest(testName: string, testFn: () => Promise<Record<string, number>>): Promise<TestMetrics> {
    const startTime = new Date();
    console.log(`  🧪 ${testName} 実行中...`);

    try {
      const customMetrics = await testFn();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`  ✅ ${testName} 完了 (${duration}ms)`);
      
      return {
        testName,
        startTime,
        endTime,
        duration,
        success: true,
        customMetrics
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`  ❌ ${testName} 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName,
        startTime,
        endTime,
        duration,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeTestSuite(suiteName: string, tests: (() => Promise<TestMetrics>)[]): Promise<TestMetrics[]> {
    console.log(`\n📋 ${suiteName} 開始 (${tests.length}テスト)`);
    const results: TestMetrics[] = [];

    for (const test of tests) {
      const result = await test();
      results.push(result);
    }

    const passedTests = results.filter(r => r.success).length;
    console.log(`📊 ${suiteName} 完了: ${passedTests}/${tests.length} テスト成功`);

    return results;
  }

  private generateValidationReport(overallDuration: number): ValidationResults {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    // 性能評価
    const avgResponseTime = this.calculateAverageResponseTime();
    const performance = 
      avgResponseTime < 2000 ? 'EXCELLENT' :
      avgResponseTime < 5000 ? 'GOOD' :
      avgResponseTime < 10000 ? 'FAIR' : 'POOR';

    // スケーラビリティ評価
    const concurrentTestResults = this.results.filter(r => r.testName.includes('同時クエリ'));
    const scalability = 
      concurrentTestResults.every(r => r.success) ? 'HIGH' :
      concurrentTestResults.some(r => r.success) ? 'MEDIUM' : 'LOW';

    // 信頼性評価
    const reliability = 
      passedTests / totalTests > 0.95 ? 'HIGH' :
      passedTests / totalTests > 0.85 ? 'MEDIUM' : 'LOW';

    // 推奨事項生成
    const recommendations = this.generateRecommendations(performance, scalability, reliability);

    return {
      totalTests,
      passedTests,
      failedTests,
      overallDuration,
      metrics: this.results,
      summary: {
        performance,
        scalability,
        reliability,
        recommendations
      }
    };
  }

  private calculateAverageResponseTime(): number {
    const responseTimeTests = this.results
      .filter(r => r.customMetrics?.averageResponseTime)
      .map(r => r.customMetrics!.averageResponseTime);
    
    return responseTimeTests.length > 0 
      ? responseTimeTests.reduce((sum, time) => sum + time, 0) / responseTimeTests.length
      : 0;
  }

  private generateRecommendations(
    performance: string, 
    scalability: string, 
    reliability: string
  ): string[] {
    const recommendations: string[] = [];

    if (performance === 'POOR') {
      recommendations.push('クエリ最適化アルゴリズムの改善を検討');
      recommendations.push('キャッシュ戦略の導入を推奨');
    }

    if (scalability === 'LOW') {
      recommendations.push('同時実行数の制限実装を推奨');
      recommendations.push('Enterprise Editionへのアップグレードを検討');
    }

    if (reliability === 'LOW') {
      recommendations.push('エラーハンドリングの強化が必要');
      recommendations.push('フォールバック機能の実装を推奨');
    }

    recommendations.push('継続的な監視とアラート設定の導入');
    recommendations.push('本番移行前の負荷テスト実施');

    return recommendations;
  }
}

// 使用例
export async function runKendraValidation(config: TestConfig): Promise<ValidationResults> {
  const suite = new KendraValidationSuite(config);
  return await suite.runFullValidation();
}

export { KendraValidationSuite, TestConfig, ValidationResults };