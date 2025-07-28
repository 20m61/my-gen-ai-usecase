import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export interface ErrorInfo {
  type: 'RATE_LIMIT' | 'ACCESS_DENIED' | 'SERVICE_UNAVAILABLE' | 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  originalError?: any;
  retryable: boolean;
  retryDelay?: number;
  userAction?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

const useErrorHandler = (retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) => {
  const { t } = useTranslation();
  const [retryAttempts, setRetryAttempts] = useState<Map<string, number>>(new Map());

  // Parse error and return structured error info
  const parseError = useCallback((error: any, context?: string): ErrorInfo => {
    // Handle Axios errors
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 429:
          return {
            type: 'RATE_LIMIT',
            message: t('error.rateLimit', 'リクエスト制限に達しました。しばらく待ってから再試行してください。'),
            originalError: error,
            retryable: true,
            retryDelay: 5000, // 5 seconds
            userAction: t('error.action.waitAndRetry', '数秒待ってから再試行してください'),
          };
          
        case 403:
          return {
            type: 'ACCESS_DENIED',
            message: t('error.accessDenied', 'アクセス権限がありません。管理者にお問い合わせください。'),
            originalError: error,
            retryable: false,
            userAction: t('error.action.contactAdmin', '管理者に連絡してください'),
          };
          
        case 400:
          const isValidationError = data?.error?.includes('ValidationException') || 
                                 data?.details?.includes('Invalid');
          return {
            type: 'VALIDATION_ERROR',
            message: isValidationError 
              ? t('error.validation', '入力内容を確認してください。')
              : t('error.badRequest', 'リクエストが正しくありません。'),
            originalError: error,
            retryable: false,
            userAction: t('error.action.checkInput', '入力内容を確認して再試行してください'),
          };
          
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: 'SERVICE_UNAVAILABLE',
            message: t('error.serviceUnavailable', 'サービスが一時的に利用できません。しばらく待ってから再試行してください。'),
            originalError: error,
            retryable: true,
            retryDelay: 10000, // 10 seconds
            userAction: t('error.action.retry', '少し時間をおいて再試行してください'),
          };
          
        default:
          return {
            type: 'UNKNOWN',
            message: t('error.unknown', '予期しないエラーが発生しました。'),
            originalError: error,
            retryable: true,
            retryDelay: 3000,
            userAction: t('error.action.retry', '再試行してください'),
          };
      }
    }
    
    // Handle network errors
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
      return {
        type: 'NETWORK_ERROR',
        message: t('error.network', 'ネットワーク接続を確認してください。'),
        originalError: error,
        retryable: true,
        retryDelay: 5000,
        userAction: t('error.action.checkConnection', 'インターネット接続を確認してください'),
      };
    }
    
    // Handle AWS SDK specific errors
    if (error.name) {
      switch (error.name) {
        case 'ThrottlingException':
          return {
            type: 'RATE_LIMIT',
            message: t('error.throttling', 'リクエストが多すぎます。しばらく待ってから再試行してください。'),
            originalError: error,
            retryable: true,
            retryDelay: 10000,
            userAction: t('error.action.waitLonger', '少し長く待ってから再試行してください'),
          };
          
        case 'AccessDeniedException':
          return {
            type: 'ACCESS_DENIED',
            message: t('error.kendraAccess', 'Kendraへのアクセス権限がありません。'),
            originalError: error,
            retryable: false,
            userAction: t('error.action.contactAdmin', '管理者に連絡してください'),
          };
          
        case 'ValidationException':
          return {
            type: 'VALIDATION_ERROR',
            message: t('error.kendraValidation', 'クエリの形式が正しくありません。'),
            originalError: error,
            retryable: false,
            userAction: t('error.action.reformulateQuery', 'クエリを見直してください'),
          };
      }
    }
    
    // Default error
    return {
      type: 'UNKNOWN',
      message: error.message || t('error.generic', '操作に失敗しました。'),
      originalError: error,
      retryable: true,
      retryDelay: 3000,
      userAction: t('error.action.retry', '再試行してください'),
    };
  }, [t]);

  // Calculate retry delay with exponential backoff
  const calculateRetryDelay = useCallback((attempt: number, baseDelay: number): number => {
    const delay = baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
    return Math.min(delay, retryConfig.maxDelay);
  }, [retryConfig]);

  // Execute function with retry logic
  const withRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    operationId: string,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> => {
    const config = { ...retryConfig, ...customRetryConfig };
    const currentAttempt = retryAttempts.get(operationId) || 0;
    
    try {
      const result = await operation();
      // Reset retry count on success
      setRetryAttempts(prev => {
        const newMap = new Map(prev);
        newMap.delete(operationId);
        return newMap;
      });
      return result;
    } catch (error) {
      const errorInfo = parseError(error, operationId);
      
      console.error(`Operation ${operationId} failed (attempt ${currentAttempt + 1}):`, errorInfo);
      
      // Check if we should retry
      if (errorInfo.retryable && currentAttempt < config.maxRetries) {
        const delay = errorInfo.retryDelay || calculateRetryDelay(currentAttempt, config.baseDelay);
        
        console.log(`Retrying ${operationId} in ${delay}ms (attempt ${currentAttempt + 1}/${config.maxRetries})`);
        
        // Update retry count
        setRetryAttempts(prev => {
          const newMap = new Map(prev);
          newMap.set(operationId, currentAttempt + 1);
          return newMap;
        });
        
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(operation, operationId, customRetryConfig);
      }
      
      // Max retries exceeded or non-retryable error
      setRetryAttempts(prev => {
        const newMap = new Map(prev);
        newMap.delete(operationId);
        return newMap;
      });
      
      throw errorInfo;
    }
  }, [retryAttempts, retryConfig, parseError, calculateRetryDelay]);

  // Get user-friendly error message
  const getErrorMessage = useCallback((error: any): string => {
    const errorInfo = parseError(error);
    return errorInfo.message;
  }, [parseError]);

  // Check if error is retryable
  const isRetryable = useCallback((error: any): boolean => {
    const errorInfo = parseError(error);
    return errorInfo.retryable;
  }, [parseError]);

  // Get retry attempts for an operation
  const getRetryAttempts = useCallback((operationId: string): number => {
    return retryAttempts.get(operationId) || 0;
  }, [retryAttempts]);

  // Clear retry attempts
  const clearRetryAttempts = useCallback((operationId?: string) => {
    if (operationId) {
      setRetryAttempts(prev => {
        const newMap = new Map(prev);
        newMap.delete(operationId);
        return newMap;
      });
    } else {
      setRetryAttempts(new Map());
    }
  }, []);

  return {
    parseError,
    withRetry,
    getErrorMessage,
    isRetryable,
    getRetryAttempts,
    clearRetryAttempts,
  };
};

export default useErrorHandler;