import { useMemo } from 'react';
import useChat from './useChat';
import useChatApi from './useChatApi';
import useRagApi from './useRagApi';
import { ShownMessage } from 'generative-ai-use-cases';
import { findModelByModelId } from './useModel';
import { getPrompter } from '../prompts';
import { RetrieveResultItem } from '@aws-sdk/client-kendra';
import { cleanEncode } from '../utils/URLUtils';
import { useTranslation } from 'react-i18next';
import { RAG_CONFIG, collectMetrics, RAGMetrics, ConfidenceLevel, DocumentType, handleQueryOptimization } from '../config/ragSettings';
import { useRagMetrics } from './useRagMetrics';



// Note: handleQueryOptimization function is now imported from ragSettings.ts

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
  const {
    startQuery,
    recordQueryOptimization,
    recordDocumentRetrieval,
    recordResponseGeneration,
    completeQuery,
    updateQuerySatisfaction,
    getPerformanceStats,
  } = useRagMetrics();
  
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);

  return {
    isEmpty,
    clear,
    loading,
    writing,
    messages,
    getPerformanceStats,
    updateQuerySatisfaction,
    postMessage: async (content: string) => {
      const model = findModelByModelId(modelId);

      if (!model) {
        console.error(`model not found for ${modelId}`);
        return;
      }
      const prevQueries = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

      // メトリクス記録開始
      const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      startQuery(queryId, content);

      // When retrieving from Kendra, display the loading
      setLoading(true);
      pushMessage('user', content);
      pushMessage('assistant', t('rag.retrieving'));

      // Generate optimized search query with improved error handling
      let query: string;
      const startTime = Date.now();
      const queryOptimizationStart = Date.now();
      
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
        const queryOptimizationTime = Date.now() - queryOptimizationStart;
        recordQueryOptimization(query, queryOptimizationTime);
        console.log('Optimized query:', { original: content, optimized: query, time: queryOptimizationTime });
      } catch (error) {
        console.error('Query optimization error:', error);
        query = content; // Fallback to original query
        const queryOptimizationTime = Date.now() - queryOptimizationStart;
        recordQueryOptimization(query, queryOptimizationTime);
      }

      // Retrieve reference documents from Kendra and set them as the system prompt
      let items: RetrieveResultItem[] = [];
      const retrievalStart = Date.now();
      try {
        const retrievedItems = await retrieve(query);
        const retrievalTime = Date.now() - retrievalStart;
        const arrangedItems = arrangeItems(retrievedItems.data.ResultItems ?? []);
        
        // Apply quality filtering to get the most relevant items
        items = filterQualityItems(arrangedItems);
        
        // メトリクス記録：文書検索
        recordDocumentRetrieval(
          retrievedItems.data.ResultItems ?? [],
          items,
          retrievalTime
        );
        
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
      
      const responseGenerationStart = Date.now();
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
          // メトリクス記録：回答生成時間
          const responseGenerationTime = Date.now() - responseGenerationStart;
          recordResponseGeneration(responseGenerationTime);
          
          // クエリ完了（満足度は後で更新される）
          completeQuery();
          
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
