import { RetrieveResultItem } from '@aws-sdk/client-kendra';
import { arrangeItems, filterQualityItems } from '../useRag';

// Mock test data representing different types of Kendra responses
const mockKendraResults: RetrieveResultItem[] = [
  {
    DocumentId: 'doc1',
    DocumentTitle: 'AWS Lambda Developer Guide',
    DocumentURI: 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro.html',
    Content: 'AWS Lambda is a compute service that lets you run code without provisioning or managing servers. Lambda runs your code on a high-availability compute infrastructure and performs all of the administration of the compute resources.',
    DocumentAttributes: [
      { Key: '_file_type', Value: { StringValue: 'html' } },
      { Key: '_language_code', Value: { StringValue: 'en' } },
      { Key: '_excerpt_page_number', Value: { LongValue: 1 } },
    ],
    ScoreAttributes: {
      ScoreConfidence: 'HIGH',
    },
  },
  {
    DocumentId: 'doc1',
    DocumentTitle: 'AWS Lambda Developer Guide',
    DocumentURI: 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro.html',
    Content: 'You can use Lambda to run code in response to events, such as changes to data in an Amazon Simple Storage Service (Amazon S3) bucket or an Amazon DynamoDB table.',
    DocumentAttributes: [
      { Key: '_file_type', Value: { StringValue: 'html' } },
      { Key: '_language_code', Value: { StringValue: 'en' } },
      { Key: '_excerpt_page_number', Value: { LongValue: 1 } },
    ],
    ScoreAttributes: {
      ScoreConfidence: 'HIGH',
    },
  },
  {
    DocumentId: 'doc2',
    DocumentTitle: 'Lambda Pricing',
    DocumentURI: 'https://aws.amazon.com/lambda/pricing/',
    Content: 'With AWS Lambda, you pay only for what you use. You are charged based on the number of requests for your functions and the duration.',
    DocumentAttributes: [
      { Key: '_file_type', Value: { StringValue: 'html' } },
      { Key: '_language_code', Value: { StringValue: 'en' } },
    ],
    ScoreAttributes: {
      ScoreConfidence: 'MEDIUM',
    },
  },
  {
    DocumentId: 'doc3',
    DocumentTitle: 'Comprehensive AWS Lambda Tutorial',
    DocumentURI: 'https://example.com/lambda-tutorial.pdf',
    Content: 'This comprehensive tutorial covers all aspects of AWS Lambda development, from basic concepts to advanced deployment strategies. Lambda is a serverless computing service provided by Amazon Web Services (AWS) that allows you to run code without provisioning or managing servers. The service automatically manages the compute resources required to run your code, scaling up or down based on demand. Lambda supports multiple programming languages including Python, Node.js, Java, C#, and Go. You can trigger Lambda functions through various AWS services such as S3, DynamoDB, API Gateway, and many others.',
    DocumentAttributes: [
      { Key: '_file_type', Value: { StringValue: 'pdf' } },
      { Key: '_language_code', Value: { StringValue: 'en' } },
      { Key: '_excerpt_page_number', Value: { LongValue: 5 } },
    ],
    ScoreAttributes: {
      ScoreConfidence: 'VERY_HIGH',
    },
  },
  {
    DocumentId: 'doc4',
    DocumentTitle: 'Short Note',
    DocumentURI: 'https://example.com/short-note.txt',
    Content: 'Lambda is serverless.',
    DocumentAttributes: [
      { Key: '_file_type', Value: { StringValue: 'txt' } },
      { Key: '_language_code', Value: { StringValue: 'en' } },
    ],
    ScoreAttributes: {
      ScoreConfidence: 'LOW',
    },
  },
];

describe('useRag utility functions', () => {
  describe('arrangeItems', () => {
    it('should merge items from the same document', () => {
      const result = arrangeItems(mockKendraResults);
      
      // Should have 4 unique documents (doc1 merged, doc2, doc3, doc4)
      expect(result).toHaveLength(4);
      
      // Find the merged doc1 item
      const mergedDoc1 = result.find(item => item.DocumentId === 'doc1');
      expect(mergedDoc1).toBeDefined();
      expect(mergedDoc1?.Content).toContain('AWS Lambda is a compute service');
      expect(mergedDoc1?.Content).toContain('You can use Lambda to run code');
    });

    it('should sort items by relevance score', () => {
      const result = arrangeItems(mockKendraResults);
      
      // First item should be the highest scoring one (doc3 with VERY_HIGH confidence)
      expect(result[0].DocumentId).toBe('doc3');
      expect(result[0].ScoreAttributes?.ScoreConfidence).toBe('VERY_HIGH');
      
      // Last item should be the lowest scoring one (doc4 with LOW confidence and short content)
      expect(result[result.length - 1].DocumentId).toBe('doc4');
      expect(result[result.length - 1].ScoreAttributes?.ScoreConfidence).toBe('LOW');
    });

    it('should preserve page numbers in merged content', () => {
      const result = arrangeItems(mockKendraResults);
      
      const mergedDoc1 = result.find(item => item.DocumentId === 'doc1');
      expect(mergedDoc1?.Content).toContain('[Page 1]');
    });
  });

  describe('filterQualityItems', () => {
    it('should filter out short content items', () => {
      const arranged = arrangeItems(mockKendraResults);
      const filtered = filterQualityItems(arranged, 50, 10);
      
      // Should exclude doc4 which has very short content
      expect(filtered.find(item => item.DocumentId === 'doc4')).toBeUndefined();
    });

    it('should limit to maximum number of items', () => {
      const arranged = arrangeItems(mockKendraResults);
      const filtered = filterQualityItems(arranged, 10, 2);
      
      expect(filtered).toHaveLength(2);
    });

    it('should return items sorted by relevance', () => {
      const arranged = arrangeItems(mockKendraResults);
      const filtered = filterQualityItems(arranged, 10, 3);
      
      // Should return top 3 items by relevance
      expect(filtered).toHaveLength(3);
      expect(filtered[0].DocumentId).toBe('doc3'); // Highest scored
    });
  });
});

// Test cases for different query scenarios
export const testQueries = [
  {
    input: 'What is AWS Lambda?',
    expected: 'AWS Lambda definition serverless compute',
    description: 'Basic definitional query'
  },
  {
    input: 'How much does Lambda cost?',
    expected: 'Lambda pricing cost billing',
    description: 'Pricing inquiry'
  },
  {
    input: 'Lambda deployment best practices',
    expected: 'Lambda deployment best practices',
    description: 'Best practices query'
  },
  {
    input: 'Can you explain Lambda triggers?',
    expected: 'Lambda triggers events',
    description: 'Explanatory query transformation'
  },
  {
    input: 'Tell me about Lambda cold starts',
    expected: 'Lambda cold starts performance',
    description: 'Performance-related query'
  },
];

// Mock document scenarios for testing different confidence levels
export const mockDocumentScenarios = {
  highConfidence: {
    documents: [
      {
        ...mockKendraResults[2], // doc3 with VERY_HIGH confidence
        Content: 'This is a comprehensive guide to AWS Lambda with detailed explanations and examples.',
      },
    ],
    expectedBehavior: 'Should provide confident, detailed answer',
  },
  
  lowConfidence: {
    documents: [
      {
        ...mockKendraResults[4], // doc4 with LOW confidence
        Content: 'Lambda might be related to serverless computing.',
      },
    ],
    expectedBehavior: 'Should indicate lower confidence in response',
  },
  
  contradictory: {
    documents: [
      {
        DocumentId: 'doc_a',
        DocumentTitle: 'Lambda Guide A',
        Content: 'Lambda functions have a maximum execution time of 15 minutes.',
        ScoreAttributes: { ScoreConfidence: 'HIGH' },
      },
      {
        DocumentId: 'doc_b',
        DocumentTitle: 'Lambda Guide B',
        Content: 'Lambda functions can run for up to 900 seconds (15 minutes).',
        ScoreAttributes: { ScoreConfidence: 'HIGH' },
      },
    ],
    expectedBehavior: 'Should present both perspectives with citations',
  },
  
  insufficient: {
    documents: [],
    expectedBehavior: 'Should indicate insufficient information',
  },
};