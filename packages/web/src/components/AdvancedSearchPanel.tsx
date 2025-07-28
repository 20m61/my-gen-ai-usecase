import React, { useState, useEffect, useCallback } from 'react';
import {
  PiMagnifyingGlass,
  PiFunnel,
  PiSortAscending,
  PiX,
  PiCaretDown,
  PiCaretUp,
  PiTag,
} from 'react-icons/pi';
import useRagApiEnhanced from '../hooks/useRagApiEnhanced';
import { EnhancedQueryResponse } from '../hooks/useRagApiEnhanced';
import { debounce } from 'lodash';

interface AdvancedSearchPanelProps {
  onSearch: (query: string, filters?: Record<string, string[]>) => void;
  onResultsUpdate?: (results: EnhancedQueryResponse) => void;
  className?: string;
}

interface FacetFilter {
  key: string;
  values: string[];
}

interface SortConfig {
  key: string;
  order: 'ASC' | 'DESC';
}

const COMMON_FACETS = [
  { key: '_file_type', label: 'ファイルタイプ' },
  { key: '_category', label: 'カテゴリ' },
  { key: '_authors', label: '作成者' },
  { key: '_language_code', label: '言語' },
  { key: '_created_at', label: '作成日' },
];

const SORT_OPTIONS = [
  { key: '_created_at', label: '作成日' },
  { key: '_last_updated_at', label: '更新日' },
  { key: '_score', label: '関連性' },
];

const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  onSearch,
  onResultsUpdate,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [facetFilters, setFacetFilters] = useState<FacetFilter[]>([]);
  const [availableFacets, setAvailableFacets] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const { queryForSearch, getSuggestions, searchWithFacets } = useRagApiEnhanced();

  // Debounced suggestion fetcher
  const fetchSuggestions = useCallback(
    debounce(async (q: string) => {
      if (q.length > 2) {
        const suggestionsResult = await getSuggestions(q);
        setSuggestions(suggestionsResult);
        setShowSuggestions(suggestionsResult.length > 0);
      }
    }, 300),
    []
  );

  useEffect(() => {
    fetchSuggestions(query);
  }, [query, fetchSuggestions]);

  // Execute search with filters and sorting
  const executeSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setShowSuggestions(false);

    try {
      // Build filters object
      const filters: Record<string, string[]> = {};
      facetFilters.forEach(filter => {
        if (filter.values.length > 0) {
          filters[filter.key] = filter.values;
        }
      });

      // Execute search based on mode
      let response;
      if (isAdvancedMode && (Object.keys(filters).length > 0 || sortConfig)) {
        response = await searchWithFacets(
          query,
          COMMON_FACETS.map(f => f.key),
          filters
        );
      } else {
        response = await queryForSearch(query, {
          includeQuerySuggestions: true,
        });
      }

      // Update facet options
      if (response.data.processedFacets) {
        setAvailableFacets(response.data.processedFacets);
      }

      // Notify parent components
      onSearch(query, filters);
      if (onResultsUpdate) {
        onResultsUpdate(response.data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle facet selection
  const toggleFacetValue = (facetKey: string, value: string) => {
    setFacetFilters(prev => {
      const existing = prev.find(f => f.key === facetKey);
      if (existing) {
        const values = existing.values.includes(value)
          ? existing.values.filter(v => v !== value)
          : [...existing.values, value];
        
        return prev.map(f => 
          f.key === facetKey ? { ...f, values } : f
        );
      } else {
        return [...prev, { key: facetKey, values: [value] }];
      }
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFacetFilters([]);
    setSortConfig(null);
  };

  // Get active filter count
  const activeFilterCount = facetFilters.reduce(
    (sum, filter) => sum + filter.values.length,
    0
  );

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeSearch()}
              placeholder="検索キーワードを入力..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <PiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          
          <button
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className={`p-2 rounded-lg transition-colors ${
              isAdvancedMode 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="高度な検索"
          >
            <PiFunnel />
          </button>
          
          <button
            onClick={executeSearch}
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '検索中...' : '検索'}
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(suggestion);
                  setShowSuggestions(false);
                  executeSearch();
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Search Panel */}
      {isAdvancedMode && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Active Filters Summary */}
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-700">
                {activeFilterCount}個のフィルターが適用中
              </span>
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <PiX className="text-xs" />
                <span>クリア</span>
              </button>
            </div>
          )}

          {/* Facet Filters */}
          {availableFacets.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-700 flex items-center space-x-2">
                <PiTag />
                <span>絞り込み</span>
              </h3>
              
              {availableFacets.map((facet) => {
                const facetConfig = COMMON_FACETS.find(f => f.key === facet.documentAttributeKey);
                if (!facetConfig || !facet.values || facet.values.length === 0) return null;

                const selectedValues = facetFilters.find(
                  f => f.key === facet.documentAttributeKey
                )?.values || [];

                return (
                  <div key={facet.documentAttributeKey} className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-600">
                      {facetConfig.label}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {facet.values.slice(0, 5).map((item: any) => {
                        const isSelected = selectedValues.includes(item.value);
                        return (
                          <button
                            key={item.value}
                            onClick={() => toggleFacetValue(
                              facet.documentAttributeKey!,
                              item.value
                            )}
                            className={`px-3 py-1 text-sm rounded-full transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {item.value}
                            {item.count && (
                              <span className="ml-1 opacity-75">
                                ({item.count})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sort Options */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-700 flex items-center space-x-2">
              <PiSortAscending />
              <span>並び替え</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => {
                const isActive = sortConfig?.key === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => {
                      if (isActive) {
                        setSortConfig({
                          key: option.key,
                          order: sortConfig.order === 'ASC' ? 'DESC' : 'ASC',
                        });
                      } else {
                        setSortConfig({
                          key: option.key,
                          order: 'DESC',
                        });
                      }
                    }}
                    className={`px-3 py-1 text-sm rounded-lg flex items-center space-x-1 transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isActive && (
                      sortConfig.order === 'ASC' ? <PiCaretUp /> : <PiCaretDown />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearchPanel;