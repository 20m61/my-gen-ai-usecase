import React, { useCallback, useEffect, useState } from 'react';
import InputChatContent from './InputChatContent';
import useRagApiEnhanced from '../hooks/useRagApiEnhanced';
import { debounce } from 'lodash';
import { PiMagnifyingGlass, PiX } from 'react-icons/pi';

interface InputChatContentWithSuggestionsProps {
  content: string;
  disabled?: boolean;
  onChangeContent: (content: string) => void;
  onSend: () => void;
  onReset: () => void;
  canStop?: boolean;
  placeholder?: string;
  enableSuggestions?: boolean;
}

const InputChatContentWithSuggestions: React.FC<InputChatContentWithSuggestionsProps> = ({
  content,
  disabled,
  onChangeContent,
  onSend,
  onReset,
  canStop,
  placeholder,
  enableSuggestions = true,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const { getSuggestions } = useRagApiEnhanced();

  // Debounced suggestion fetcher
  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (!enableSuggestions || query.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        setLoadingSuggestions(false);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const suggestionsResult = await getSuggestions(query);
        setSuggestions(suggestionsResult);
        setShowSuggestions(suggestionsResult.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300),
    [enableSuggestions, getSuggestions]
  );

  useEffect(() => {
    fetchSuggestions(content);
  }, [content, fetchSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          onChangeContent(suggestions[selectedIndex]);
          setShowSuggestions(false);
          setSelectedIndex(-1);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, onChangeContent]);

  // Handle suggestion selection
  const selectSuggestion = useCallback((suggestion: string) => {
    onChangeContent(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  }, [onChangeContent]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full mb-2 w-full max-w-4xl bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-600 flex items-center">
              <PiMagnifyingGlass className="mr-1" />
              検索候補
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSuggestions(false);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <PiX />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  selectSuggestion(suggestion);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                  index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loadingSuggestions && enableSuggestions && content.length >= 3 && (
        <div className="absolute bottom-full mb-2 left-0 text-sm text-gray-500">
          検索候補を取得中...
        </div>
      )}

      {/* Original Input Component with keyboard handler */}
      <div onKeyDown={handleKeyDown}>
        <InputChatContent
          content={content}
          disabled={disabled}
          onChangeContent={onChangeContent}
          onSend={onSend}
          onReset={onReset}
          canStop={canStop}
          placeholder={placeholder || (enableSuggestions ? '質問を入力（3文字以上で候補表示）' : undefined)}
        />
      </div>
    </div>
  );
};

export default InputChatContentWithSuggestions;