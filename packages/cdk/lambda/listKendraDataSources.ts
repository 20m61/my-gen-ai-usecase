import * as lambda from 'aws-lambda';
import {
  KendraClient,
  ListDataSourcesCommand,
  DescribeDataSourceCommand,
  ListDataSourceSyncJobsCommand,
  StartDataSourceSyncJobCommand,
} from '@aws-sdk/client-kendra';

const INDEX_ID = process.env.INDEX_ID;

exports.handler = async (
  event: lambda.APIGatewayProxyEvent
): Promise<lambda.APIGatewayProxyResult> => {
  const path = event.path;
  const method = event.httpMethod;

  if (!INDEX_ID) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'INDEX_ID is not configured' }),
    };
  }

  const kendra = new KendraClient({});

  try {
    // データソース一覧取得
    if (path.includes('/list') && method === 'POST') {
      const req = JSON.parse(event.body || '{}');
      
      const command = new ListDataSourcesCommand({
        IndexId: INDEX_ID,
        MaxResults: req.MaxResults || 50,
        NextToken: req.NextToken,
      });

      const result = await kendra.send(command);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(result),
      };
    }

    // データソース詳細取得
    if (path.includes('/describe') && method === 'POST') {
      const req = JSON.parse(event.body || '{}');
      
      if (!req.Id) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Data source ID is required' }),
        };
      }

      const command = new DescribeDataSourceCommand({
        Id: req.Id,
        IndexId: INDEX_ID,
      });

      const result = await kendra.send(command);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(result),
      };
    }

    // 同期ジョブ履歴取得
    if (path.includes('/sync-jobs') && method === 'POST') {
      const req = JSON.parse(event.body || '{}');
      
      if (!req.Id) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Data source ID is required' }),
        };
      }

      const command = new ListDataSourceSyncJobsCommand({
        Id: req.Id,
        IndexId: INDEX_ID,
        MaxResults: req.MaxResults || 10,
        NextToken: req.NextToken,
        StartTimeFilter: req.StartTimeFilter,
        StatusFilter: req.StatusFilter,
      });

      const result = await kendra.send(command);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(result),
      };
    }

    // 同期ジョブ開始
    if (path.includes('/start-sync') && method === 'POST') {
      const req = JSON.parse(event.body || '{}');
      
      if (!req.Id) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Data source ID is required' }),
        };
      }

      const command = new StartDataSourceSyncJobCommand({
        Id: req.Id,
        IndexId: INDEX_ID,
      });

      const result = await kendra.send(command);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(result),
      };
    }

    // 不明なパス
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };

  } catch (error) {
    console.error('Kendra API error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};