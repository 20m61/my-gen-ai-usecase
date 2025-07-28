import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ErrorDisplay from '../ErrorDisplay';

// Mock the error handler hook
vi.mock('../../hooks/useErrorHandler', () => ({
  default: () => ({
    parseError: vi.fn((error) => {
      if (error.message.includes('rate_limit')) {
        return {
          type: 'RATE_LIMIT',
          message: 'レート制限を超過しました。しばらく待ってから再試行してください。',
          retryable: true,
          retryDelay: 5000,
          userAction: '5秒後に自動再試行されます'
        };
      }
      if (error.message.includes('network')) {
        return {
          type: 'NETWORK_ERROR',
          message: 'ネットワークエラーが発生しました。',
          retryable: true,
          retryDelay: 2000,
          userAction: '接続を確認してください'
        };
      }
      return {
        type: 'UNKNOWN_ERROR',
        message: '予期しないエラーが発生しました。',
        retryable: false,
        userAction: 'サポートにお問い合わせください'
      };
    })
  })
}));

describe('ErrorDisplay', () => {
  const mockOnRetry = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders error message correctly', () => {
    const error = new Error('Test error message');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
        operationName="テスト操作"
      />
    );

    expect(screen.getByText('テスト操作でエラーが発生しました')).toBeInTheDocument();
  });

  test('shows retry button for retryable errors', () => {
    const error = new Error('rate_limit error');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByText('再試行')).toBeInTheDocument();
  });

  test('handles retry countdown', async () => {
    const error = new Error('rate_limit error');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    // Initially should show countdown
    expect(screen.getByText('再試行まで 5秒')).toBeInTheDocument();
    
    // Advance timer by 1 second
    vi.advanceTimersByTime(1000);
    
    await waitFor(() => {
      expect(screen.getByText('再試行まで 4秒')).toBeInTheDocument();
    });
  });

  test('enables retry button after countdown', async () => {
    const error = new Error('rate_limit error');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    const retryButton = screen.getByRole('button', { name: /再試行/ });
    expect(retryButton).toBeDisabled();

    // Advance timer by 5 seconds
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(screen.getByText('再試行')).toBeInTheDocument();
      expect(retryButton).not.toBeDisabled();
    });
  });

  test('calls onRetry when retry button is clicked', async () => {
    const error = new Error('network error');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    // Wait for countdown to finish
    vi.advanceTimersByTime(2000);
    
    await waitFor(() => {
      const retryButton = screen.getByRole('button', { name: /再試行/ });
      expect(retryButton).not.toBeDisabled();
      fireEvent.click(retryButton);
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  test('calls onDismiss when dismiss button is clicked', () => {
    const error = new Error('Test error');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: '' }); // X button has no text
    fireEvent.click(dismissButton);
    
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  test('shows user action when provided', () => {
    const error = new Error('network error');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByText('接続を確認してください')).toBeInTheDocument();
  });

  test('hides retry button for non-retryable errors', () => {
    const error = new Error('unknown error');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.queryByText('再試行')).not.toBeInTheDocument();
    expect(screen.getByText('サポートにお問い合わせください')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const error = new Error('Test error');
    
    const { container } = render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
        className="custom-error-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-error-class');
  });

  test('uses default operation name when not provided', () => {
    const error = new Error('Test error');
    
    render(
      <ErrorDisplay 
        error={error}
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByText('操作でエラーが発生しました')).toBeInTheDocument();
  });
});