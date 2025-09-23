import React, { useCallback, useEffect, useState } from 'react';
import InputChatContent from '../components/InputChatContent';
import InputChatContentWithSuggestions from '../components/InputChatContentWithSuggestions';
import AdvancedSearchPanel from '../components/AdvancedSearchPanel';
import KendraDataSourceManager from '../components/KendraDataSourceManager';
import { create } from 'zustand';
import useChat from '../hooks/useChat';
import useRag from '../hooks/useRag';
import useRagOptimized from '../hooks/useRagOptimized';
import useUserContext from '../hooks/useUserContext';
import { useLocation } from 'react-router-dom';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import BedrockIcon from '../assets/bedrock.svg?react';
import KendraIcon from '../assets/kendra.svg?react';
import { PiPlus, PiChartBar, PiGear, PiDatabase, PiLightningA } from 'react-icons/pi';
import { RagPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import queryString from 'query-string';
import { useTranslation } from 'react-i18next';
import RAGMetricsDashboard from '../components/RAGMetricsDashboard';

type StateType = {
  content: string;
  setContent: (c: string) => void;
};

const useRagPageState = create<StateType>((set) => {
  return {
    content: '',
    setContent: (s: string) => {
      set(() => ({
        content: s,
      }));
    },
  };
});

const RagPage: React.FC = () => {
  const { t } = useTranslation();
  const { content, setContent } = useRagPageState();
  const { pathname, search } = useLocation();
  const { getModelId, setModelId, forceToStop } = useChat(pathname);
  
  // Feature flags
  const useOptimizedRag = import.meta.env.VITE_APP_ENABLE_RAG_OPTIMIZATION === 'true';
  const enableAdvancedSearch = import.meta.env.VITE_APP_ENABLE_ADVANCED_SEARCH === 'true';
  const enableSuggestions = import.meta.env.VITE_APP_ENABLE_SUGGESTIONS !== 'false';
  const enableDataSourceManager = import.meta.env.VITE_APP_ENABLE_DATA_SOURCE_MANAGER === 'true';
  
  // Use optimized RAG if enabled
  const baseRag = useRag(pathname);
  const optimizedRag = useRagOptimized(pathname);
  const rag = useOptimizedRag ? optimizedRag : baseRag;
  
  const { postMessage, clear, loading, writing, messages, isEmpty, getPerformanceStats } = rag;
  const { scrollableContainer, setFollowing } = useFollow();
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const { userContext: _userContext } = useUserContext();
  const modelId = getModelId();
  
  // UI state
  const [showMetrics, setShowMetrics] = useState(false);
  const [showDataSources, setShowDataSources] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [performanceStats, setPerformanceStats] = useState(() => getPerformanceStats());

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    if (search !== '') {
      const params = queryString.parse(search) as RagPageQueryParams;
      setContent(params.content ?? '');
      setModelId(
        availableModels.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {
      setModelId(_modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels, modelId, search, setContent]);

  const onSend = useCallback(() => {
    setFollowing(true);
    postMessage(content);
    setContent('');
  }, [content, postMessage, setContent, setFollowing]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
  }, [clear, setContent]);

  const refreshMetrics = useCallback(() => {
    setPerformanceStats(getPerformanceStats());
  }, [getPerformanceStats]);

  const onStop = useCallback(() => {
    forceToStop();
  }, [forceToStop]);

  return (
    <>
      <div className={`${!isEmpty ? 'screen:pb-36' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {t('rag.title')}
        </div>

        <div className="mt-2 flex w-full items-end justify-center lg:mt-0">
          <div className="flex items-center space-x-2 lg:space-x-4">
            <Select
              value={modelId}
              onChange={setModelId}
              options={availableModels.map((m) => {
                return { value: m, label: modelDisplayName(m) };
              })}
            />
            
            {/* Optimization indicator */}
            {useOptimizedRag && (
              <div className="hidden lg:flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <PiLightningA className="mr-1" />
                最適化有効
              </div>
            )}
            
            {/* Control buttons */}
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className={`p-2 rounded-lg transition-colors ${
                showMetrics 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="パフォーマンスメトリクス"
            >
              <PiChartBar className="text-lg" />
            </button>
            
            {enableDataSourceManager && (
              <button
                onClick={() => setShowDataSources(!showDataSources)}
                className={`p-2 rounded-lg transition-colors ${
                  showDataSources 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="データソース管理"
              >
                <PiDatabase className="text-lg" />
              </button>
            )}
            
            {enableAdvancedSearch && (
              <button
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                className={`p-2 rounded-lg transition-colors ${
                  showAdvancedSearch 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="高度な検索"
              >
                <PiGear className="text-lg" />
              </button>
            )}
          </div>
        </div>

        {isEmpty && (
          <div className="relative flex h-[calc(100vh-9rem)] flex-col items-center justify-center">
            <div className="flex items-center gap-x-3">
              <KendraIcon className="size-[64px] fill-gray-400" />
              <PiPlus className="text-2xl text-gray-400" />
              <BedrockIcon className="fill-gray-400" />
            </div>
          </div>
        )}

        {/* Enhanced Feature Panels */}
        <div className="space-y-4 mx-4">
          {/* Advanced Search Panel */}
          {showAdvancedSearch && enableAdvancedSearch && (
            <AdvancedSearchPanel
              onSearch={(query, filters) => {
                setContent(query);
                console.log('Advanced search with filters:', filters);
              }}
              onResultsUpdate={(results) => {
                console.log('Search results updated:', results);
              }}
            />
          )}
          
          {/* Data Source Manager */}
          {showDataSources && enableDataSourceManager && (
            <KendraDataSourceManager
              indexId={import.meta.env.VITE_APP_KENDRA_INDEX_ID}
              className="mb-4"
            />
          )}
          
          {/* RAG Metrics Dashboard */}
          {showMetrics && (
            <RAGMetricsDashboard
              performanceStats={performanceStats}
              onRefresh={refreshMetrics}
            />
          )}
        </div>

        <div ref={scrollableContainer}>
          {messages.map((chat, idx) => (
            <div key={idx}>
              <ChatMessage
                idx={idx}
                chatContent={chat}
                loading={loading && idx === messages.length - 1}
              />
              <div className="w-full border-b border-gray-300"></div>
            </div>
          ))}
        </div>

        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        <div className="fixed bottom-0 z-0 flex w-full items-end justify-center lg:pr-64 print:hidden">
          {enableSuggestions ? (
            <InputChatContentWithSuggestions
              content={content}
              disabled={loading && !writing}
              onChangeContent={setContent}
              onSend={() => {
                if (!loading) {
                  onSend();
                  // メトリクス更新
                  setTimeout(refreshMetrics, 1000);
                } else {
                  onStop();
                }
              }}
              onReset={onReset}
              canStop={writing}
              enableSuggestions={enableSuggestions}
            />
          ) : (
            <InputChatContent
              content={content}
              disabled={loading && !writing}
              onChangeContent={setContent}
              onSend={() => {
                if (!loading) {
                  onSend();
                  // メトリクス更新
                  setTimeout(refreshMetrics, 1000);
                } else {
                  onStop();
                }
              }}
              onReset={onReset}
              canStop={writing}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default RagPage;
