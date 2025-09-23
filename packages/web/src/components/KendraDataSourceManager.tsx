import React, { useState, useEffect } from 'react';
import { useKendraDataSources, KendraDataSource, DataSourceSyncJob } from '../hooks/useKendraDataSources';
import { 
  PiDatabase, 
  PiGlobe, 
  PiArrowClockwise, 
  PiPlay, 
  PiInfo, 
  PiWarningCircle,
  PiCheckCircle,
  PiSpinner,
  PiX,
  PiCaretDown,
  PiCaretRight
} from 'react-icons/pi';

interface KendraDataSourceManagerProps {
  indexId?: string;
  className?: string;
}

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'ACTIVE':
        return <PiCheckCircle className="text-green-500" />;
      case 'CREATING':
      case 'UPDATING':
        return <PiSpinner className="text-blue-500 animate-spin" />;
      case 'FAILED':
        return <PiWarningCircle className="text-red-500" />;
      case 'DELETING':
        return <PiX className="text-red-500" />;
      default:
        return <PiInfo className="text-gray-500" />;
    }
  };

  return (
    <div className="flex items-center" title={status}>
      {getStatusIcon()}
    </div>
  );
};

const DataSourceCard: React.FC<{
  dataSource: KendraDataSource;
  onShowDetails: (id: string) => void;
  onStartSync: (id: string) => void;
  isExpanded: boolean;
}> = ({ dataSource, onShowDetails, onStartSync, isExpanded }) => {
  const [syncJobs, setSyncJobs] = useState<DataSourceSyncJob[]>([]);
  const [loadingSyncJobs, setLoadingSyncJobs] = useState(false);
  const { fetchSyncJobs, getDataSourceTypeLabel, extractConnectionUrls } = useKendraDataSources();

  useEffect(() => {
    if (isExpanded && dataSource.Id) {
      setLoadingSyncJobs(true);
      fetchSyncJobs(dataSource.Id).then(jobs => {
        setSyncJobs(jobs);
        setLoadingSyncJobs(false);
      });
    }
  }, [isExpanded, dataSource.Id, fetchSyncJobs]);

  const urls = extractConnectionUrls(dataSource);

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <StatusIcon status={dataSource.Status || 'UNKNOWN'} />
          <div>
            <h3 className="font-medium text-gray-800">{dataSource.Name}</h3>
            <p className="text-sm text-gray-600">
              {getDataSourceTypeLabel(dataSource.Type || '')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => dataSource.Id && onStartSync(dataSource.Id)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Start Sync"
          >
            <PiPlay />
          </button>
          <button
            onClick={() => dataSource.Id && onShowDetails(dataSource.Id)}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded transition-colors"
          >
            {isExpanded ? <PiCaretDown /> : <PiCaretRight />}
          </button>
        </div>
      </div>

      {/* Connection URLs */}
      {urls.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Connected to:</p>
          {urls.slice(0, 3).map((url, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <PiGlobe className="text-blue-500 text-xs" />
              <span className="text-gray-700 truncate">{url}</span>
            </div>
          ))}
          {urls.length > 3 && (
            <p className="text-xs text-gray-500">+{urls.length - 3} more...</p>
          )}
        </div>
      )}

      {/* Status and Timestamps */}
      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
        <div>
          <span className="font-medium">Status:</span> {dataSource.Status}
        </div>
        <div>
          <span className="font-medium">Language:</span> {dataSource.LanguageCode}
        </div>
        {dataSource.CreatedAt && (
          <div>
            <span className="font-medium">Created:</span> {dataSource.CreatedAt.toLocaleDateString()}
          </div>
        )}
        {dataSource.UpdatedAt && (
          <div>
            <span className="font-medium">Updated:</span> {dataSource.UpdatedAt.toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t pt-3 space-y-3">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Recent Sync Jobs</h4>
            {loadingSyncJobs ? (
              <div className="flex items-center space-x-2 text-gray-500">
                <PiSpinner className="animate-spin" />
                <span>Loading sync jobs...</span>
              </div>
            ) : syncJobs.length > 0 ? (
              <div className="space-y-2">
                {syncJobs.slice(0, 3).map((job, index) => (
                  <div key={job.ExecutionId || index} className="bg-gray-50 rounded p-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${
                        job.Status === 'SUCCEEDED' ? 'text-green-600' :
                        job.Status === 'FAILED' ? 'text-red-600' :
                        job.Status === 'SYNCING' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {job.Status}
                      </span>
                      {job.StartTime && (
                        <span className="text-gray-500">
                          {job.StartTime.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {job.Metrics && (
                      <div className="mt-1 text-xs text-gray-600">
                        Added: {job.Metrics.DocumentsAdded || '0'} |
                        Modified: {job.Metrics.DocumentsModified || '0'} |
                        Failed: {job.Metrics.DocumentsFailed || '0'}
                      </div>
                    )}
                    {job.ErrorMessage && (
                      <div className="mt-1 text-xs text-red-600">
                        Error: {job.ErrorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No sync jobs found</p>
            )}
          </div>

          {dataSource.Description && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Description</h4>
              <p className="text-sm text-gray-600">{dataSource.Description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const KendraDataSourceManager: React.FC<KendraDataSourceManagerProps> = ({
  indexId,
  className = ''
}) => {
  const [expandedDataSource, setExpandedDataSource] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    dataSources,
    loading,
    error,
    fetchDataSources,
    startSyncJob,
  } = useKendraDataSources(indexId);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDataSources();
    setRefreshing(false);
  };

  const handleShowDetails = (dataSourceId: string) => {
    setExpandedDataSource(
      expandedDataSource === dataSourceId ? null : dataSourceId
    );
  };

  const handleStartSync = async (dataSourceId: string) => {
    const success = await startSyncJob(dataSourceId);
    if (success) {
      // Refresh data after starting sync
      setTimeout(handleRefresh, 1000);
    }
  };

  if (!indexId) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-yellow-800">
          <PiWarningCircle />
          <span>No Kendra index configured</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PiDatabase className="text-xl text-blue-600" />
            <h3 className="font-semibold text-gray-800">Data Sources</h3>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            <PiArrowClockwise className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-800">
              <PiWarningCircle />
              <span>Error: {error}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-3 text-gray-500">
              <PiSpinner className="animate-spin text-xl" />
              <span>Loading data sources...</span>
            </div>
          </div>
        ) : dataSources.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <PiDatabase className="mx-auto text-4xl mb-3 opacity-50" />
            <p>No data sources found</p>
            <p className="text-sm">Configure data sources in your Kendra index</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Found {dataSources.length} data source{dataSources.length !== 1 ? 's' : ''}
            </div>
            {dataSources.map((dataSource) => (
              <DataSourceCard
                key={dataSource.Id}
                dataSource={dataSource}
                onShowDetails={handleShowDetails}
                onStartSync={handleStartSync}
                isExpanded={expandedDataSource === dataSource.Id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KendraDataSourceManager;