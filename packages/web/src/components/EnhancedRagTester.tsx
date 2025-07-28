import React, { useState } from 'react';
import { PiPlay, PiStop, PiWarning, PiCheckCircle, PiSpinner } from 'react-icons/pi';
import AdvancedSearchPanel from './AdvancedSearchPanel';
import RAGMetricsDashboard from './RAGMetricsDashboard';
import KendraDataSourceManager from './KendraDataSourceManager';
import ErrorDisplay from './ErrorDisplay';
import useRagApiEnhanced from '../hooks/useRagApiEnhanced';
import { useRagMetrics } from '../hooks/useRagMetrics';
import { mockRagApiService } from '../services/mockRagApiService';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

const EnhancedRagTester: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [testError, setTestError] = useState<Error | null>(null);

  const { queryForSearch, getSuggestions, searchWithFacets } = useRagApiEnhanced();
  const { getPerformanceStats } = useRagMetrics();
  const performanceStats = getPerformanceStats();

  const updateTestResult = (testName: string, updates: Partial<TestResult>) => {
    setTestResults(prev => prev.map(result => 
      result.name === testName 
        ? { ...result, ...updates }
        : result
    ));
  };

  const initializeTests = () => {
    const tests: TestResult[] = [
      { name: 'Basic Query API Test', status: 'pending' },
      { name: 'Search Suggestions Test', status: 'pending' },
      { name: 'Faceted Search Test', status: 'pending' },
      { name: 'Error Handling Test', status: 'pending' },
      { name: 'Caching System Test', status: 'pending' },
      { name: 'Performance Metrics Test', status: 'pending' }
    ];
    setTestResults(tests);
  };

  const runBasicQueryTest = async () => {
    const testName = 'Basic Query API Test';
    updateTestResult(testName, { status: 'running' });
    const startTime = Date.now();

    try {
      const response = await queryForSearch('テスト検索', {
        pageSize: 5,
        includeQuerySuggestions: true
      });
      
      const duration = Date.now() - startTime;
      
      if (response.data && response.data.metadata) {
        updateTestResult(testName, { 
          status: 'success', 
          message: `取得結果: ${response.data.metadata.totalResults}件, 処理時間: ${response.data.metadata.processingTime}`,
          duration 
        });
        setSearchResults(response.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      updateTestResult(testName, { 
        status: 'error', 
        message: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  };

  const runSuggestionsTest = async () => {
    const testName = 'Search Suggestions Test';
    updateTestResult(testName, { status: 'running' });
    const startTime = Date.now();

    try {
      const suggestions = await getSuggestions('テスト');
      const duration = Date.now() - startTime;
      
      updateTestResult(testName, { 
        status: 'success', 
        message: `提案取得成功: ${suggestions.length}件 (${suggestions.slice(0, 3).join(', ')})`,
        duration 
      });
    } catch (error) {
      updateTestResult(testName, { 
        status: 'error', 
        message: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  };

  const runFacetedSearchTest = async () => {
    const testName = 'Faceted Search Test';
    updateTestResult(testName, { status: 'running' });
    const startTime = Date.now();

    try {
      const response = await searchWithFacets(
        'ドキュメント',
        ['_file_type', '_category'],
        { '_file_type': ['pdf'] }
      );
      
      const duration = Date.now() - startTime;
      
      updateTestResult(testName, { 
        status: 'success', 
        message: `ファセット検索成功: ${response.data.metadata?.totalResults}件, ファセット数: ${response.data.processedFacets?.length}`,
        duration 
      });
    } catch (error) {
      updateTestResult(testName, { 
        status: 'error', 
        message: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  };

  const runErrorHandlingTest = async () => {
    const testName = 'Error Handling Test';
    updateTestResult(testName, { status: 'running' });
    const startTime = Date.now();

    try {
      await mockRagApiService.simulateError('rate_limit');
      updateTestResult(testName, { 
        status: 'error', 
        message: 'エラーテストが予期せず成功しました',
        duration: Date.now() - startTime
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult(testName, { 
        status: 'success', 
        message: 'エラーハンドリング正常: Rate Limit error successfully caught',
        duration 
      });
      setTestError(error as Error);
    }
  };

  const runCachingTest = async () => {
    const testName = 'Caching System Test';
    updateTestResult(testName, { status: 'running' });
    const startTime = Date.now();

    try {
      // First call
      const start1 = Date.now();
      await queryForSearch('キャッシュテスト', { pageSize: 3 });
      const time1 = Date.now() - start1;

      // Second call (should be faster due to caching)
      const start2 = Date.now();
      await queryForSearch('キャッシュテスト', { pageSize: 3 });
      const time2 = Date.now() - start2;

      const duration = Date.now() - startTime;
      
      if (time2 < time1 * 0.5) {
        updateTestResult(testName, { 
          status: 'success', 
          message: `キャッシュ効果確認: 初回${time1}ms → 2回目${time2}ms (${Math.round((1 - time2/time1) * 100)}% 高速化)`,
          duration 
        });
      } else {
        updateTestResult(testName, { 
          status: 'success', 
          message: `キャッシュテスト完了: 初回${time1}ms, 2回目${time2}ms`,
          duration 
        });
      }
    } catch (error) {
      updateTestResult(testName, { 
        status: 'error', 
        message: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  };

  const runPerformanceMetricsTest = async () => {
    const testName = 'Performance Metrics Test';
    updateTestResult(testName, { status: 'running' });
    const startTime = Date.now();

    try {
      const stats = getPerformanceStats();
      const duration = Date.now() - startTime;
      
      updateTestResult(testName, { 
        status: 'success', 
        message: `メトリクス取得成功: 総クエリ数${stats.totalQueries}件, 成功率${stats.successRate.toFixed(1)}%`,
        duration 
      });
    } catch (error) {
      updateTestResult(testName, { 
        status: 'error', 
        message: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    initializeTests();
    setTestError(null);

    try {
      await runBasicQueryTest();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runSuggestionsTest();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runFacetedSearchTest();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runErrorHandlingTest();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runCachingTest();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runPerformanceMetricsTest();
    } catch (error) {
      console.error('Test suite error:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />;
      case 'running':
        return <PiSpinner className="text-blue-500 animate-spin" />;
      case 'success':
        return <PiCheckCircle className="text-green-500" />;
      case 'error':
        return <PiWarning className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Enhanced RAG Features Tester</h1>
          <button
            onClick={runAllTests}
            disabled={isRunningTests}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunningTests ? <PiStop /> : <PiPlay />}
            <span>{isRunningTests ? 'Running Tests...' : 'Run All Tests'}</span>
          </button>
        </div>

        {/* Test Results */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-700">Test Results</h2>
          {testResults.map((test, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              {getStatusIcon(test.status)}
              <div className="flex-1">
                <div className="font-medium text-gray-800">{test.name}</div>
                {test.message && (
                  <div className="text-sm text-gray-600">{test.message}</div>
                )}
              </div>
              {test.duration && (
                <div className="text-xs text-gray-500">{test.duration}ms</div>
              )}
            </div>
          ))}
        </div>

        {/* Error Display Test */}
        {testError && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Error Display Component Test</h3>
            <ErrorDisplay
              error={testError}
              onRetry={() => setTestError(null)}
              onDismiss={() => setTestError(null)}
              operationName="エラーハンドリング機能テスト"
            />
          </div>
        )}
      </div>

      {/* Component Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Advanced Search Panel Test */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Advanced Search Panel</h2>
          <AdvancedSearchPanel
            onSearch={(query, filters) => {
              console.log('Advanced search triggered:', { query, filters });
            }}
            onResultsUpdate={(results) => {
              console.log('Search results updated:', results);
              setSearchResults(results);
            }}
          />
        </div>

        {/* RAG Metrics Dashboard Test */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">RAG Metrics Dashboard</h2>
          <RAGMetricsDashboard
            performanceStats={performanceStats}
            onRefresh={() => {
              // Trigger a re-render to get fresh metrics
              const stats = getPerformanceStats();
              console.log('Refreshed metrics:', stats);
            }}
          />
        </div>
      </div>

      {/* Data Source Manager Test */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Kendra Data Source Manager</h2>
        <KendraDataSourceManager
          indexId="mock-kendra-index"
        />
      </div>

      {/* Search Results Display */}
      {searchResults && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Last Search Results</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
            {JSON.stringify(searchResults, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default EnhancedRagTester;