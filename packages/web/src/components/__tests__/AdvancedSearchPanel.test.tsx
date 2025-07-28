import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import AdvancedSearchPanel from '../AdvancedSearchPanel';

// Mock the enhanced RAG API hook
vi.mock('../../hooks/useRagApiEnhanced', () => ({
  default: () => ({
    queryForSearch: vi.fn().mockResolvedValue({
      data: {
        ResultItems: [],
        metadata: {
          apiType: 'query',
          totalResults: 0,
          processingTime: '150ms',
          hasSuggestions: false
        }
      }
    }),
    getSuggestions: vi.fn().mockResolvedValue(['テスト提案1', 'テスト提案2']),
    searchWithFacets: vi.fn().mockResolvedValue({
      data: {
        ResultItems: [],
        processedFacets: [
          {
            documentAttributeKey: '_file_type',
            values: [
              { value: 'pdf', count: 5 },
              { value: 'docx', count: 3 }
            ]
          }
        ],
        metadata: {
          apiType: 'query',
          totalResults: 0,
          processingTime: '200ms',
          hasSuggestions: false
        }
      }
    })
  })
}));

// Mock lodash debounce
vi.mock('lodash', () => ({
  debounce: (fn: any) => fn
}));

describe('AdvancedSearchPanel', () => {
  const mockOnSearch = vi.fn();
  const mockOnResultsUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders search input and basic elements', () => {
    render(
      <AdvancedSearchPanel 
        onSearch={mockOnSearch}
        onResultsUpdate={mockOnResultsUpdate}
      />
    );

    expect(screen.getByPlaceholderText('検索キーワードを入力...')).toBeInTheDocument();
    expect(screen.getByText('検索')).toBeInTheDocument();
    expect(screen.getByTitle('高度な検索')).toBeInTheDocument();
  });

  test('handles search input and triggers search', async () => {
    render(
      <AdvancedSearchPanel 
        onSearch={mockOnSearch}
        onResultsUpdate={mockOnResultsUpdate}
      />
    );

    const searchInput = screen.getByPlaceholderText('検索キーワードを入力...');
    const searchButton = screen.getByText('検索');

    fireEvent.change(searchInput, { target: { value: 'テスト検索' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('テスト検索', {});
    });
  });

  test('toggles advanced mode', () => {
    render(
      <AdvancedSearchPanel 
        onSearch={mockOnSearch}
        onResultsUpdate={mockOnResultsUpdate}
      />
    );

    const advancedToggle = screen.getByTitle('高度な検索');
    
    fireEvent.click(advancedToggle);
    
    // Advanced mode should be activated (checking for change in button style)
    expect(advancedToggle).toHaveClass('bg-blue-100');
  });

  test('handles Enter key for search', async () => {
    render(
      <AdvancedSearchPanel 
        onSearch={mockOnSearch}
        onResultsUpdate={mockOnResultsUpdate}
      />
    );

    const searchInput = screen.getByPlaceholderText('検索キーワードを入力...');
    
    fireEvent.change(searchInput, { target: { value: 'テスト検索' } });
    fireEvent.keyPress(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('テスト検索', {});
    });
  });

  test('disables search button when loading', () => {
    render(
      <AdvancedSearchPanel 
        onSearch={mockOnSearch}
        onResultsUpdate={mockOnResultsUpdate}
      />
    );

    const searchInput = screen.getByPlaceholderText('検索キーワードを入力...');
    const searchButton = screen.getByText('検索');

    // Empty query should disable button
    expect(searchButton).toBeDisabled();

    // Non-empty query should enable button
    fireEvent.change(searchInput, { target: { value: 'テスト' } });
    expect(searchButton).not.toBeDisabled();
  });
});