import React, { useState, useEffect } from 'react';
import { 
  RAGPerformanceStats,
  RAGQueryMetrics 
} from '../hooks/useRagMetrics';
import { PiChartBar, PiClock, PiTarget, PiTrendUp, PiFileText, PiArrowClockwise } from 'react-icons/pi';

interface RAGMetricsDashboardProps {
  performanceStats: RAGPerformanceStats;
  onRefresh?: () => void;
  className?: string;
}

const MetricCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}> = ({ title, value, icon, trend, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color]} transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-full bg-white bg-opacity-50">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium opacity-75">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <p className="text-xs opacity-60 mt-1">{trend}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PerformanceChart: React.FC<{
  data: RAGQueryMetrics[];
}> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-500">
        <PiChartBar className="mr-2" />
        No data available
      </div>
    );
  }

  const maxTime = Math.max(...data.map(d => d.totalProcessingTime || 0));
  const recent = data.slice(-10); // 最新10件

  return (
    <div className="h-32 flex items-end space-x-2 px-4">
      {recent.map((item) => (
        <div
          key={item.queryId}
          className="flex-1 bg-blue-500 rounded-t opacity-75 hover:opacity-100 transition-opacity relative group"
          style={{
            height: `${((item.totalProcessingTime || 0) / maxTime) * 100}%`,
            minHeight: '8px'
          }}
        >
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            {item.totalProcessingTime?.toFixed(0)}ms
            <br />
            {item.documentsAfterFiltering} docs
          </div>
        </div>
      ))}
    </div>
  );
};

const RAGMetricsDashboard: React.FC<RAGMetricsDashboardProps> = ({
  performanceStats,
  onRefresh,
  className = ''
}) => {
  const [recentQueries, setRecentQueries] = useState<RAGQueryMetrics[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // ローカルストレージから最近のクエリを読み込み
    const metrics = JSON.parse(localStorage.getItem('ragMetrics') || '[]');
    setRecentQueries(metrics.slice(-20).reverse()); // 最新20件を逆順で
  }, [performanceStats]);

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getSuccessRateColor = (rate: number): 'green' | 'yellow' | 'red' => {
    if (rate >= 80) return 'green';
    if (rate >= 60) return 'yellow';
    return 'red';
  };

  const getResponseTimeColor = (time: number): 'green' | 'yellow' | 'red' => {
    if (time <= 2000) return 'green';
    if (time <= 5000) return 'yellow';
    return 'red';
  };

  if (!isExpanded) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PiChartBar className="text-xl text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-800">RAG Performance</h3>
              <p className="text-sm text-gray-600">
                {formatNumber(performanceStats.totalQueries)} queries • {performanceStats.successRate.toFixed(1)}% success
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <PiArrowClockwise />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(true)}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              Show Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PiChartBar className="text-xl text-blue-600" />
            <h3 className="font-semibold text-gray-800">RAG Performance Dashboard</h3>
          </div>
          <div className="flex space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <PiArrowClockwise />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(false)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Queries"
            value={formatNumber(performanceStats.totalQueries)}
            icon={<PiFileText className="text-blue-600" />}
            color="blue"
          />
          <MetricCard
            title="Success Rate"
            value={`${performanceStats.successRate.toFixed(1)}%`}
            icon={<PiTarget className="text-green-600" />}
            color={getSuccessRateColor(performanceStats.successRate)}
          />
          <MetricCard
            title="Avg Response Time"
            value={`${performanceStats.averageProcessingTime.toFixed(0)}ms`}
            icon={<PiClock className="text-yellow-600" />}
            color={getResponseTimeColor(performanceStats.averageProcessingTime)}
          />
          <MetricCard
            title="Optimization Rate"
            value={`${performanceStats.queryOptimizationSuccessRate.toFixed(1)}%`}
            icon={<PiTrendUp className="text-purple-600" />}
            color="blue"
          />
        </div>

        {/* Performance Chart */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3">Recent Query Performance</h4>
          <PerformanceChart data={recentQueries} />
          <div className="mt-2 text-xs text-gray-500 text-center">
            Response time (ms) for last {Math.min(recentQueries.length, 10)} queries
          </div>
        </div>

        {/* Popular Keywords */}
        {performanceStats.mostCommonQueries.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">Popular Keywords</h4>
            <div className="flex flex-wrap gap-2">
              {performanceStats.mostCommonQueries.slice(0, 8).map((keyword) => (
                <span
                  key={keyword}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Queries */}
        {recentQueries.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">Recent Queries</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentQueries.slice(0, 5).map((query) => (
                <div
                  key={query.queryId}
                  className="bg-white p-3 rounded border text-sm"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-800 truncate flex-1 mr-2">
                      {query.originalQuery}
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {query.totalProcessingTime?.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{query.documentsAfterFiltering} docs found</span>
                    <span>{new Date(query.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RAGMetricsDashboard;