import * as lambda from 'aws-lambda';
import {
  AttributeFilter,
  KendraClient,
  RetrieveCommand,
  QueryCommand,
  RetrieveCommandInput,
  QueryCommandInput,
  DocumentAttributeValueType,
  Facet,
  SortingConfiguration,
  DocumentRelevanceConfiguration,
} from '@aws-sdk/client-kendra';
import { RetrieveKendraRequest } from 'generative-ai-use-cases';

const INDEX_ID = process.env.INDEX_ID;
const LANGUAGE = process.env.LANGUAGE || 'ja';

// Enhanced request type with API selection and advanced options
interface EnhancedKendraRequest extends RetrieveKendraRequest {
  apiType?: 'retrieve' | 'query';
  pageSize?: number;
  pageNumber?: number;
  attributeFilter?: AttributeFilter;
  facets?: Facet[];
  userContext?: {
    token?: string;
    userId?: string;
    groups?: string[];
  };
  sortingConfiguration?: SortingConfiguration;
  documentRelevanceOverride?: DocumentRelevanceConfiguration[];
  includeQuerySuggestions?: boolean;
}

// Build attribute filter with language and custom filters
const buildAttributeFilter = (
  language: string,
  customFilter?: AttributeFilter
): AttributeFilter => {
  const languageFilter: AttributeFilter = {
    EqualsTo: {
      Key: '_language_code',
      Value: {
        StringValue: language,
      },
    },
  };

  if (!customFilter) {
    return languageFilter;
  }

  // Combine language filter with custom filters
  return {
    AndAllFilters: [languageFilter, customFilter],
  };
};

// Handle Retrieve API call with enhanced options
const handleRetrieveAPI = async (
  kendra: KendraClient,
  request: EnhancedKendraRequest
): Promise<any> => {
  const attributeFilter = buildAttributeFilter(LANGUAGE!, request.attributeFilter);

  const retrieveInput: RetrieveCommandInput = {
    IndexId: INDEX_ID,
    QueryText: request.query,
    AttributeFilter: attributeFilter,
    PageSize: request.pageSize || 100,
    PageNumber: request.pageNumber || 1,
  };

  // Add document relevance overrides if provided
  if (request.documentRelevanceOverride) {
    retrieveInput.DocumentRelevanceOverrideConfigurations = request.documentRelevanceOverride;
  }

  // Add user context for access control
  if (request.userContext) {
    retrieveInput.UserContext = {
      Token: request.userContext.token,
      UserId: request.userContext.userId,
      Groups: request.userContext.groups,
    };
  }

  const retrieveCommand = new RetrieveCommand(retrieveInput);
  const retrieveRes = await kendra.send(retrieveCommand);

  // Enhance response with metadata
  return {
    ...retrieveRes,
    metadata: {
      apiType: 'retrieve',
      totalResults: retrieveRes.ResultItems?.length || 0,
      queryId: retrieveRes.QueryId,
      processingTime: new Date().toISOString(),
    },
  };
};

// Handle Query API call with enhanced options
const handleQueryAPI = async (
  kendra: KendraClient,
  request: EnhancedKendraRequest
): Promise<any> => {
  const attributeFilter = buildAttributeFilter(LANGUAGE!, request.attributeFilter);

  const queryInput: QueryCommandInput = {
    IndexId: INDEX_ID,
    QueryText: request.query,
    AttributeFilter: attributeFilter,
    PageSize: request.pageSize || 100,
    PageNumber: request.pageNumber || 1,
  };

  // Add facets for faceted search
  if (request.facets && request.facets.length > 0) {
    queryInput.Facets = request.facets;
  }

  // Add sorting configuration
  if (request.sortingConfiguration) {
    queryInput.SortingConfiguration = request.sortingConfiguration;
  }

  // Add user context for access control
  if (request.userContext) {
    queryInput.UserContext = {
      Token: request.userContext.token,
      UserId: request.userContext.userId,
      Groups: request.userContext.groups,
    };
  }

  // Enable query suggestions
  if (request.includeQuerySuggestions) {
    queryInput.QueryResultTypeFilter = 'ANSWER';
    queryInput.SpellCorrectionConfiguration = {
      IncludeQuerySpellCheckSuggestions: true,
    };
  }

  const queryCommand = new QueryCommand(queryInput);
  const queryRes = await kendra.send(queryCommand);

  // Process facet results for better client consumption
  const processedFacets = queryRes.FacetResults?.map(facet => ({
    documentAttributeKey: facet.DocumentAttributeKey,
    values: facet.DocumentAttributeValueCountPairs?.map(pair => ({
      value: pair.DocumentAttributeValue?.StringValue ||
             pair.DocumentAttributeValue?.LongValue ||
             pair.DocumentAttributeValue?.DateValue,
      count: pair.Count,
    })),
  }));

  // Enhance response with metadata and processed data
  return {
    ...queryRes,
    processedFacets,
    metadata: {
      apiType: 'query',
      totalResults: queryRes.TotalNumberOfResults || 0,
      queryId: queryRes.QueryId,
      processingTime: new Date().toISOString(),
      hasSuggestions: !!queryRes.SpellCorrectedQueries,
    },
  };
};

// Main handler with error handling and validation
exports.handler = async (
  event: lambda.APIGatewayProxyEvent
): Promise<lambda.APIGatewayProxyResult> => {
  try {
    const req = JSON.parse(event.body!) as EnhancedKendraRequest;
    
    // Validate required parameters
    if (!req.query) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'query is not specified' }),
      };
    }

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
    
    // Route to appropriate API based on request
    const apiType = req.apiType || 'retrieve'; // Default to Retrieve API for RAG
    let response;

    if (apiType === 'retrieve') {
      response = await handleRetrieveAPI(kendra, req);
    } else {
      response = await handleQueryAPI(kendra, req);
    }

    // Log performance metrics
    console.log('Kendra API call completed', {
      apiType,
      query: req.query.substring(0, 50), // Log first 50 chars only
      resultsCount: response.metadata.totalResults,
      queryId: response.metadata.queryId,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Kendra-Query-Id': response.metadata.queryId || '',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Kendra API error:', error);
    
    // Distinguish between different error types
    const statusCode = error.name === 'ValidationException' ? 400 : 500;
    const errorMessage = error.name === 'ValidationException' 
      ? 'Invalid request parameters'
      : 'Internal server error';

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};