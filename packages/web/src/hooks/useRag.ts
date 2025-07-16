import { useMemo } from 'react';
import useChat from './useChat';
import useChatApi from './useChatApi';
import useRagApi from './useRagApi';
import { ShownMessage } from 'generative-ai-use-cases';
import { findModelByModelId } from './useModel';
import { getPrompter } from '../prompts';
import { RetrieveResultItem, DocumentAttribute } from '@aws-sdk/client-kendra';
import { cleanEncode } from '../utils/URLUtils';
import { useTranslation } from 'react-i18next';
import { RAG_CONFIG, collectMetrics, RAGMetrics, ConfidenceLevel, DocumentType } from '../config/ragSettings';

// Enhanced document metadata interface
interface DocumentMetadata {
  documentType: string;
  lastModified?: string;
  pageNumber?: number;
  confidence: string;
  language: string;
  sourceUri?: string;
  contentLength: number;
  relevanceScore: number;
}

// Extract metadata from document attributes
const extractDocumentMetadata = (item: RetrieveResultItem): DocumentMetadata => {
  const attributes = item.DocumentAttributes || [];
  
  const getAttributeValue = (key: string): string | number | undefined => {
    const attr = attributes.find(a => a.Key === key);
    return attr?.Value?.StringValue || attr?.Value?.LongValue;
  };

  const contentLength = item.Content?.length || 0;
  const confidence = item.ScoreAttributes?.ScoreConfidence || 'MEDIUM';
  
  // Calculate relevance score based on multiple factors
  const relevanceScore = calculateRelevanceScore(item);

  return {
    documentType: getAttributeValue('_file_type') as string || 'text',
    lastModified: getAttributeValue('_modified_at') as string,
    pageNumber: getAttributeValue('_excerpt_page_number') as number,
    confidence: confidence.toLowerCase(),
    language: getAttributeValue('_language_code') as string || 'unknown',
    sourceUri: getAttributeValue('_source_uri') as string,
    contentLength,
    relevanceScore,
  };
};

// 改善されたクエリ最適化エラーハンドリング
const handleQueryOptimization = (rawQuery: string, originalQuery: string): string => {
  const trimmed = rawQuery.trim();
  
  if (trimmed === 'INSUFFICIENT_QUERY') {
    console.warn('Query optimization returned INSUFFICIENT_QUERY', { originalQuery });
    return originalQuery;
  }
  
  if (trimmed.length < RAG_CONFIG.query.minLength) {
    console.warn('Query optimization returned too short query', { 
      optimized: trimmed, 
      original: originalQuery,
      minLength: RAG_CONFIG.query.minLength
    });
    return originalQuery;
  }
  
  if (trimmed.length > RAG_CONFIG.query.maxLength) {
    console.warn('Query optimization returned too long query', { 
      optimized: trimmed,
      maxLength: RAG_CONFIG.query.maxLength
    });
    return trimmed.substring(0, RAG_CONFIG.query.maxLength);
  }
  
  return trimmed;
};

// 設定ベースのスコアリング計算
const calculateRelevanceScore = (item: RetrieveResultItem): number => {
  let score = 0;
  const config = RAG_CONFIG.document.scoring;
  
  // Base score from Kendra confidence
  const confidence = item.ScoreAttributes?.ScoreConfidence as ConfidenceLevel;
  score += config.confidenceWeights[confidence] || config.confidenceWeights.LOW;
  
  // Content length factor
  const contentLength = item.Content?.length || 0;
  if (contentLength > config.contentLengthBonuses.long.threshold) {
    score += config.contentLengthBonuses.long.bonus;
  } else if (contentLength > config.contentLengthBonuses.medium.threshold) {
    score += config.contentLengthBonuses.medium.bonus;
  } else if (contentLength < config.contentLengthBonuses.short.threshold) {
    score += config.contentLengthBonuses.short.penalty;
  }
  
  // Document type factor
  const fileType = item.DocumentAttributes?.find(
    attr => attr.Key === '_file_type'
  )?.Value?.StringValue as DocumentType;
  if (fileType && config.documentTypeBonus[fileType] !== undefined) {
    score += config.documentTypeBonus[fileType];
  }
  
  // Title quality factor
  if (item.DocumentTitle && item.DocumentTitle.length > 10) {
    score += config.titleQualityBonus;
  }
  
  return Math.max(0, score);
};

// Sort items by relevance score
const sortItemsByRelevance = (items: RetrieveResultItem[]): RetrieveResultItem[] => {
  return items.sort((a, b) => {
    const scoreA = calculateRelevanceScore(a);
    const scoreB = calculateRelevanceScore(b);
    return scoreB - scoreA; // Sort descending
  });
};

// Enhanced document grouping with better context preservation
const groupDocumentsBySource = (items: RetrieveResultItem[]): Record<string, RetrieveResultItem[]> => {
  const groups: Record<string, RetrieveResultItem[]> = {};
  
  items.forEach(item => {
    const sourceKey = item.DocumentURI || item.DocumentId || 'unknown';
    if (!groups[sourceKey]) {
      groups[sourceKey] = [];
    }
    groups[sourceKey].push(item);
  });
  
  return groups;
};

// Merge items from the same document with improved context preservation
const mergeDocumentItems = (items: RetrieveResultItem[]): RetrieveResultItem => {
  if (items.length === 1) return items[0];
  
  // Sort by page number if available
  const sortedItems = items.sort((a, b) => {
    const pageA = a.DocumentAttributes?.find(attr => attr.Key === '_excerpt_page_number')?.Value?.LongValue || 0;
    const pageB = b.DocumentAttributes?.find(attr => attr.Key === '_excerpt_page_number')?.Value?.LongValue || 0;
    return pageA - pageB;
  });
  
  // Use the highest relevance item as base
  const baseItem = sortedItems.reduce((prev, current) => {
    return calculateRelevanceScore(current) > calculateRelevanceScore(prev) ? current : prev;
  });
  
  // Merge content with better context indicators
  const mergedContent = sortedItems
    .map((item, index) => {
      const pageNumber = item.DocumentAttributes?.find(
        attr => attr.Key === '_excerpt_page_number'
      )?.Value?.LongValue;
      
      const prefix = pageNumber ? `[Page ${pageNumber}] ` : '';
      const separator = index > 0 ? '\n\n...\n\n' : '';
      
      return separator + prefix + (item.Content || '');
    })
    .join('');
  
  return {
    ...baseItem,
    Content: mergedContent,
  };
};

// Enhanced key generation for document uniqueness
const uniqueKeyOfItem = (item: RetrieveResultItem): string => {
  const pageNumber =
    item.DocumentAttributes?.find(
      (a: DocumentAttribute) => a.Key === '_excerpt_page_number'
    )?.Value?.LongValue ?? '';
  const uri = item.DocumentURI || item.DocumentId || 'unknown';
  return `${uri}_${pageNumber}`;
};

// Enhanced arrangement with scoring and intelligent merging
export const arrangeItems = (
  items: RetrieveResultItem[]
): RetrieveResultItem[] => {
  if (items.length === 0) return [];
  
  // First, sort items by relevance
  const sortedItems = sortItemsByRelevance(items);
  
  // Group by document source
  const documentGroups = groupDocumentsBySource(sortedItems);
  
  // Merge items from the same document
  const mergedItems = Object.values(documentGroups).map(group => {
    return mergeDocumentItems(group);
  });
  
  // Final sort by relevance score
  return sortItemsByRelevance(mergedItems);
};

// Filter items based on quality thresholds
export const filterQualityItems = (
  items: RetrieveResultItem[],
  minContentLength: number = RAG_CONFIG.document.minContentLength,
  maxItems: number = RAG_CONFIG.document.maxDocuments
): RetrieveResultItem[] => {
  return items
    .filter(item => {
      const contentLength = item.Content?.length || 0;
      return contentLength >= minContentLength;
    })
    .slice(0, maxItems);
};

const useRag = (id: string) => {
  const { t } = useTranslation();

  const {
    getModelId,
    messages,
    postChat,
    clear,
    loading,
    writing,
    setLoading,
    updateSystemContext,
    popMessage,
    pushMessage,
    isEmpty,
  } = useChat(id);

  const modelId = getModelId();
  const { retrieve } = useRagApi();
  const { predict } = useChatApi();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);

  return {
    isEmpty,
    clear,
    loading,
    writing,
    messages,
    postMessage: async (content: string) => {
      const model = findModelByModelId(modelId);

      if (!model) {
        console.error(`model not found for ${modelId}`);
        return;
      }
      const prevQueries = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

      // When retrieving from Kendra, display the loading
      setLoading(true);
      pushMessage('user', content);
      pushMessage('assistant', t('rag.retrieving'));

      // Generate optimized search query with improved error handling
      let query: string;
      const startTime = Date.now();
      
      try {
        const rawQuery = await predict({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompter.ragPrompt({
                promptType: 'RETRIEVE',
                retrieveQueries: [...prevQueries, content],
              }),
            },
          ],
          id: id,
        });
        
        query = handleQueryOptimization(rawQuery, content);
        console.log('Optimized query:', { original: content, optimized: query });
      } catch (error) {
        console.error('Query optimization error:', error);
        query = content; // Fallback to original query
      }

      // Retrieve reference documents from Kendra and set them as the system prompt
      let items: RetrieveResultItem[] = [];
      try {
        const retrievedItems = await retrieve(query);
        const arrangedItems = arrangeItems(retrievedItems.data.ResultItems ?? []);
        
        // Apply quality filtering to get the most relevant items
        items = filterQualityItems(arrangedItems);
        
        const processingTime = Date.now() - startTime;
        
        // Collect metrics
        const metrics: RAGMetrics = {
          queryOptimizationSuccess: query !== content,
          documentsRetrieved: retrievedItems.data.ResultItems?.length || 0,
          documentsAfterFiltering: items.length,
          averageDocumentScore: items.reduce((sum, item) => sum + calculateRelevanceScore(item), 0) / items.length,
          processingTime,
          timestamp: new Date(),
        };
        
        collectMetrics(metrics);
        
        // Log document metadata for debugging
        console.log('Retrieved documents:', items.map(item => ({
          title: item.DocumentTitle,
          score: calculateRelevanceScore(item),
          confidence: item.ScoreAttributes?.ScoreConfidence,
          contentLength: item.Content?.length,
        })));
      } catch (error) {
        popMessage();
        pushMessage('assistant', t('rag.errorRetrieval'));
        setLoading(false);
        return;
      }

      if (items.length == 0) {
        popMessage();
        pushMessage('assistant', t('rag.noDocuments'));
        setLoading(false);
        return;
      }

      updateSystemContext(
        prompter.ragPrompt({
          promptType: 'SYSTEM_CONTEXT',
          referenceItems: items,
        })
      );

      // After hiding the loading, execute the POST processing of the normal chat
      popMessage();
      popMessage();
      postChat(
        content,
        false,
        (messages: ShownMessage[]) => {
          // Preprocessing: Few-shot is used, so delete the footnote from the past logs
          return messages.map((message) => ({
            ...message,
            content: message.content
              .replace(/\[\^0\]:[\s\S]*/s, '') // Delete the footnote at the end of the sentence
              .replace(/\[\^(\d+)\]/g, '') // Delete the footnote anchor in the sentence
              .trim(), // Delete the leading and trailing spaces
          }));
        },
        (message: string) => {
          // Postprocessing: Add the footnote
          const footnote = items
            .map((item, idx) => {
              // If there is a reference page number, set it as an anchor link
              const _excerpt_page_number = item.DocumentAttributes?.find(
                (attr) => attr.Key === '_excerpt_page_number'
              )?.Value?.LongValue;
              return message.includes(`[^${idx}]`)
                ? `[^${idx}]: [${item.DocumentTitle}${
                    _excerpt_page_number
                      ? `(${_excerpt_page_number} ${t('rag.page')})`
                      : ''
                  }](
                  ${item.DocumentURI ? cleanEncode(item.DocumentURI) : ''}${
                    _excerpt_page_number ? `#page=${_excerpt_page_number}` : ''
                  })`
                : '';
            })
            .filter((x) => x)
            .join('\n');
          return message + '\n' + footnote;
        }
      );
    },
  };
};

export default useRag;
