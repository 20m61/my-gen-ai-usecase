import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LAMBDA_RUNTIME_NODEJS } from '../../consts';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export interface RagEnhancedProps {
  readonly kendraIndexId: string;
  readonly kendraIndexArn: string;
  readonly kendraIndexLanguage: string;
  readonly userPool: UserPool;
  readonly api: RestApi;
  readonly enableMonitoring?: boolean;
}

/**
 * Enhanced RAG construct with optimized Kendra integration
 */
export class RagEnhanced extends Construct {
  public readonly enhancedRetrieveFunction: NodejsFunction;
  public readonly dataSourceManagerFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: RagEnhancedProps) {
    super(scope, id);

    const {
      kendraIndexId,
      kendraIndexArn,
      kendraIndexLanguage,
      userPool,
      api,
      enableMonitoring = true,
    } = props;

    // Enhanced Retrieve Function (supports both Query and Retrieve APIs)
    this.enhancedRetrieveFunction = new NodejsFunction(this, 'EnhancedRetrieve', {
      runtime: LAMBDA_RUNTIME_NODEJS,
      entry: './lambda/retrieveKendraEnhanced.ts',
      timeout: Duration.seconds(30),
      memorySize: 512,
      bundling: {
        externalModules: [], // Bundle AWS SDK for latest features
      },
      environment: {
        INDEX_ID: kendraIndexId,
        LANGUAGE: kendraIndexLanguage,
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    });

    // Grant necessary permissions
    this.enhancedRetrieveFunction.role?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [kendraIndexArn],
        actions: [
          'kendra:Query',
          'kendra:Retrieve',
          'kendra:GetQuerySuggestions',
        ],
      })
    );

    // Data Source Manager Function
    this.dataSourceManagerFunction = new NodejsFunction(this, 'DataSourceManager', {
      runtime: LAMBDA_RUNTIME_NODEJS,
      entry: './lambda/listKendraDataSources.ts',
      timeout: Duration.seconds(30),
      memorySize: 256,
      bundling: {
        externalModules: [],
      },
      environment: {
        INDEX_ID: kendraIndexId,
      },
    });

    // Grant data source management permissions
    this.dataSourceManagerFunction.role?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [
          kendraIndexArn,
          `${kendraIndexArn}/*`, // For data sources under the index
        ],
        actions: [
          'kendra:ListDataSources',
          'kendra:DescribeDataSource',
          'kendra:ListDataSourceSyncJobs',
          'kendra:StartDataSourceSyncJob',
        ],
      })
    );

    // API Gateway integration
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'EnhancedAuthorizer', {
      cognitoUserPools: [userPool],
    });

    const commonAuthorizerProps = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer,
    };

    // Get or create RAG resource
    const ragResource = api.root.getResource('rag') || api.root.addResource('rag');

    // Enhanced retrieve endpoint
    const enhancedResource = ragResource.addResource('kendra-enhanced');
    enhancedResource.addMethod(
      'POST',
      new LambdaIntegration(this.enhancedRetrieveFunction),
      commonAuthorizerProps
    );

    // Data source management endpoints
    const dataSourceResource = ragResource.addResource('kendra');
    const dataSourcesResource = dataSourceResource.addResource('data-sources');
    
    // POST: /rag/kendra/data-sources/list
    const listResource = dataSourcesResource.addResource('list');
    listResource.addMethod(
      'POST',
      new LambdaIntegration(this.dataSourceManagerFunction),
      commonAuthorizerProps
    );

    // POST: /rag/kendra/data-sources/describe
    const describeResource = dataSourcesResource.addResource('describe');
    describeResource.addMethod(
      'POST',
      new LambdaIntegration(this.dataSourceManagerFunction),
      commonAuthorizerProps
    );

    // POST: /rag/kendra/data-sources/sync-jobs
    const syncJobsResource = dataSourcesResource.addResource('sync-jobs');
    syncJobsResource.addMethod(
      'POST',
      new LambdaIntegration(this.dataSourceManagerFunction),
      commonAuthorizerProps
    );

    // POST: /rag/kendra/data-sources/start-sync
    const startSyncResource = dataSourcesResource.addResource('start-sync');
    startSyncResource.addMethod(
      'POST',
      new LambdaIntegration(this.dataSourceManagerFunction),
      commonAuthorizerProps
    );

    // CloudWatch monitoring (optional)
    if (enableMonitoring) {
      // Error rate alarm
      const errorRateAlarm = new cloudwatch.Alarm(this, 'EnhancedKendraErrorRateAlarm', {
        metric: this.enhancedRetrieveFunction.metricErrors({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'Enhanced Kendra function error rate is too high',
      });

      // Latency alarm
      const latencyAlarm = new cloudwatch.Alarm(this, 'EnhancedKendraLatencyAlarm', {
        metric: this.enhancedRetrieveFunction.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: cloudwatch.Stats.P99,
        }),
        threshold: 5000, // 5 seconds
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'Enhanced Kendra function latency is too high',
      });

      // Throttle alarm
      const throttleAlarm = new cloudwatch.Alarm(this, 'EnhancedKendraThrottleAlarm', {
        metric: this.enhancedRetrieveFunction.metricThrottles({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'Enhanced Kendra function is being throttled',
      });

      // Output alarm ARNs for notification setup
      new cdk.CfnOutput(this, 'ErrorRateAlarmArn', {
        value: errorRateAlarm.alarmArn,
        description: 'ARN of the Enhanced Kendra error rate alarm',
      });

      new cdk.CfnOutput(this, 'LatencyAlarmArn', {
        value: latencyAlarm.alarmArn,
        description: 'ARN of the Enhanced Kendra latency alarm',
      });

      new cdk.CfnOutput(this, 'ThrottleAlarmArn', {
        value: throttleAlarm.alarmArn,
        description: 'ARN of the Enhanced Kendra throttle alarm',
      });
    }

    // Output the enhanced endpoint
    new cdk.CfnOutput(this, 'EnhancedKendraEndpoint', {
      value: `${api.url}rag/kendra-enhanced`,
      description: 'Enhanced Kendra API endpoint for RAG',
    });

    new cdk.CfnOutput(this, 'DataSourceManagerEndpoint', {
      value: `${api.url}rag/kendra/data-sources`,
      description: 'Kendra data source management API endpoint',
    });
  }
}