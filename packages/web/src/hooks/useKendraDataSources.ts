import { useState, useEffect, useCallback } from 'react';
import useHttp from './useHttp';

// Kendra データソース関連の型定義
export interface KendraDataSource {
  Id?: string;
  Name?: string;
  Type?: string;
  Status?: 'CREATING' | 'DELETING' | 'FAILED' | 'UPDATING' | 'ACTIVE';
  CreatedAt?: Date;
  UpdatedAt?: Date;
  Configuration?: {
    S3Configuration?: {
      BucketName?: string;
      InclusionPrefixes?: string[];
      ExclusionPatterns?: string[];
    };
    WebCrawlerConfiguration?: {
      Urls?: {
        SeedUrlConfiguration?: {
          SeedUrls?: string[];
        };
      };
      MaxLinksPerPage?: number;
      MaxContentSizePerPageInMegaBytes?: number;
    };
    SharePointConfiguration?: {
      SharePointVersion?: string;
      Urls?: string[];
    };
    ConfluenceConfiguration?: {
      ServerUrl?: string;
      Version?: string;
    };
    SalesforceConfiguration?: {
      ServerUrl?: string;
    };
  };
  Description?: string;
  LanguageCode?: string;
  RoleArn?: string;
  Schedule?: string;
}

export interface DataSourceSyncJob {
  ExecutionId?: string;
  StartTime?: Date;
  EndTime?: Date;
  Status?: 'FAILED' | 'SUCCEEDED' | 'SYNCING' | 'INCOMPLETE' | 'STOPPING' | 'ABORTED' | 'SYNCING_INDEXING';
  ErrorMessage?: string;
  ErrorCode?: string;
  DataSourceErrorCode?: string;
  Metrics?: {
    DocumentsAdded?: string;
    DocumentsModified?: string;
    DocumentsDeleted?: string;
    DocumentsFailed?: string;
    DocumentsScanned?: string;
  };
}

// レスポンス型定義
interface ListDataSourcesResponse {
  SummaryItems?: {
    Id?: string;
    Name?: string;
    Type?: string;
    CreatedAt?: number;
    UpdatedAt?: number;
    Status?: string;
    LanguageCode?: string;
  }[];
  NextToken?: string;
}

interface DescribeDataSourceResponse {
  Id?: string;
  IndexId?: string;
  Name?: string;
  Type?: string;
  Configuration?: any;
  CreatedAt?: number;
  UpdatedAt?: number;
  Description?: string;
  Status?: string;
  Schedule?: string;
  RoleArn?: string;
  LanguageCode?: string;
  ErrorMessage?: string;
  CustomDocumentEnrichmentConfiguration?: any;
  VpcConfiguration?: any;
}

interface ListDataSourceSyncJobsResponse {
  History?: {
    ExecutionId?: string;
    StartTime?: number;
    EndTime?: number;
    Status?: string;
    ErrorMessage?: string;
    ErrorCode?: string;
    DataSourceErrorCode?: string;
    Metrics?: {
      DocumentsAdded?: string;
      DocumentsModified?: string;
      DocumentsDeleted?: string;
      DocumentsFailed?: string;
      DocumentsScanned?: string;
    };
  }[];
  NextToken?: string;
}

// Kendra データソース管理のカスタムフック
export const useKendraDataSources = (indexId?: string) => {
  const [dataSources, setDataSources] = useState<KendraDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const http = useHttp();

  // データソース一覧を取得
  const fetchDataSources = useCallback(async () => {
    if (!indexId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await http.post<ListDataSourcesResponse>('/kendra/data-sources/list', {
        IndexId: indexId,
        MaxResults: 50
      });

      const dataSources: KendraDataSource[] = response.data.SummaryItems?.map(item => ({
        Id: item.Id,
        Name: item.Name,
        Type: item.Type,
        Status: item.Status as any,
        CreatedAt: item.CreatedAt ? new Date(item.CreatedAt * 1000) : undefined,
        UpdatedAt: item.UpdatedAt ? new Date(item.UpdatedAt * 1000) : undefined,
        LanguageCode: item.LanguageCode,
      })) || [];

      setDataSources(dataSources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data sources');
      console.error('Error fetching data sources:', err);
    } finally {
      setLoading(false);
    }
  }, [indexId, http]);

  // 特定データソースの詳細を取得
  const fetchDataSourceDetails = useCallback(async (dataSourceId: string): Promise<KendraDataSource | null> => {
    if (!indexId) return null;

    try {
      const response = await http.post<DescribeDataSourceResponse>('/kendra/data-sources/describe', {
        Id: dataSourceId,
        IndexId: indexId
      });

      const data = response.data;
      return {
        Id: data.Id,
        Name: data.Name,
        Type: data.Type,
        Status: data.Status as any,
        CreatedAt: data.CreatedAt ? new Date(data.CreatedAt * 1000) : undefined,
        UpdatedAt: data.UpdatedAt ? new Date(data.UpdatedAt * 1000) : undefined,
        Configuration: data.Configuration,
        Description: data.Description,
        LanguageCode: data.LanguageCode,
        RoleArn: data.RoleArn,
        Schedule: data.Schedule,
      };
    } catch (err) {
      console.error('Error fetching data source details:', err);
      return null;
    }
  }, [indexId, http]);

  // データソースの同期履歴を取得
  const fetchSyncJobs = useCallback(async (dataSourceId: string): Promise<DataSourceSyncJob[]> => {
    if (!indexId) return [];

    try {
      const response = await http.post<ListDataSourceSyncJobsResponse>('/kendra/data-sources/sync-jobs', {
        Id: dataSourceId,
        IndexId: indexId,
        MaxResults: 10
      });

      return response.data.History?.map(job => ({
        ExecutionId: job.ExecutionId,
        StartTime: job.StartTime ? new Date(job.StartTime * 1000) : undefined,
        EndTime: job.EndTime ? new Date(job.EndTime * 1000) : undefined,
        Status: job.Status as any,
        ErrorMessage: job.ErrorMessage,
        ErrorCode: job.ErrorCode,
        DataSourceErrorCode: job.DataSourceErrorCode,
        Metrics: job.Metrics,
      })) || [];
    } catch (err) {
      console.error('Error fetching sync jobs:', err);
      return [];
    }
  }, [indexId, http]);

  // 同期ジョブを開始
  const startSyncJob = useCallback(async (dataSourceId: string): Promise<boolean> => {
    if (!indexId) return false;

    try {
      await http.post('/kendra/data-sources/start-sync', {
        Id: dataSourceId,
        IndexId: indexId
      });
      return true;
    } catch (err) {
      console.error('Error starting sync job:', err);
      return false;
    }
  }, [indexId, http]);

  // 初回ロード
  useEffect(() => {
    if (indexId) {
      fetchDataSources();
    }
  }, [indexId, fetchDataSources]);

  // データソースタイプ別の表示名を取得
  const getDataSourceTypeLabel = useCallback((type: string) => {
    const typeLabels: Record<string, string> = {
      'S3': 'Amazon S3',
      'SHAREPOINT': 'Microsoft SharePoint',
      'CONFLUENCE': 'Atlassian Confluence',
      'GOOGLEDRIVE': 'Google Drive',
      'WEBCRAWLER': 'Web Crawler',
      'WORKDOCS': 'Amazon WorkDocs',
      'FSX': 'Amazon FSx',
      'SLACK': 'Slack',
      'SALESFORCE': 'Salesforce',
      'ONEDRIVE': 'Microsoft OneDrive',
      'SERVICENOW': 'ServiceNow',
      'DATABASE': 'Database',
      'CUSTOM': 'Custom',
    };
    return typeLabels[type] || type;
  }, []);

  // 接続先URL/サイトを抽出
  const extractConnectionUrls = useCallback((dataSource: KendraDataSource): string[] => {
    const config = dataSource.Configuration;
    const urls: string[] = [];

    if (config?.S3Configuration?.BucketName) {
      urls.push(`s3://${config.S3Configuration.BucketName}`);
    }

    if (config?.WebCrawlerConfiguration?.Urls?.SeedUrlConfiguration?.SeedUrls) {
      urls.push(...config.WebCrawlerConfiguration.Urls.SeedUrlConfiguration.SeedUrls);
    }

    if (config?.SharePointConfiguration?.Urls) {
      urls.push(...config.SharePointConfiguration.Urls);
    }

    if (config?.ConfluenceConfiguration?.ServerUrl) {
      urls.push(config.ConfluenceConfiguration.ServerUrl);
    }

    if (config?.SalesforceConfiguration?.ServerUrl) {
      urls.push(config.SalesforceConfiguration.ServerUrl);
    }

    return urls;
  }, []);

  return {
    dataSources,
    loading,
    error,
    fetchDataSources,
    fetchDataSourceDetails,
    fetchSyncJobs,
    startSyncJob,
    getDataSourceTypeLabel,
    extractConnectionUrls,
  };
};

export default useKendraDataSources;