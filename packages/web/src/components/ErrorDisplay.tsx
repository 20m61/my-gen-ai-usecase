import React, { useState, useEffect } from 'react';
import { 
  PiWarningCircle, 
  PiArrowClockwise, 
  PiInfo, 
  PiX,
  PiWifiSlash,
  PiShield,
  PiClock
} from 'react-icons/pi';
import useErrorHandler, { ErrorInfo } from '../hooks/useErrorHandler';

interface ErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  onDismiss?: () => void;
  operationName?: string;
  className?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  operationName = '操作',
  className = '',
}) => {
  const { parseError } = useErrorHandler();
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    const info = parseError(error);
    setErrorInfo(info);
    
    // Start countdown for retryable errors
    if (info.retryable && info.retryDelay && onRetry) {
      setCountdown(Math.ceil(info.retryDelay / 1000));
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [error, parseError, onRetry]);

  if (!errorInfo) return null;

  const getErrorIcon = () => {
    switch (errorInfo.type) {
      case 'RATE_LIMIT':
        return <PiClock className="text-yellow-500" />;
      case 'ACCESS_DENIED':
        return <PiShield className="text-red-500" />;
      case 'NETWORK_ERROR':
        return <PiWifiSlash className="text-orange-500" />;
      case 'SERVICE_UNAVAILABLE':
        return <PiWarningCircle className="text-red-500" />;
      default:
        return <PiWarningCircle className="text-amber-500" />;
    }
  };

  const getErrorColor = () => {
    switch (errorInfo.type) {
      case 'RATE_LIMIT':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'ACCESS_DENIED':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'NETWORK_ERROR':
        return 'border-orange-200 bg-orange-50 text-orange-800';
      case 'SERVICE_UNAVAILABLE':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'VALIDATION_ERROR':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-amber-200 bg-amber-50 text-amber-800';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getErrorColor()} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-xl mt-0.5">
          {getErrorIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium">
                {operationName}でエラーが発生しました
              </h3>
              <p className="mt-1 text-sm">
                {errorInfo.message}
              </p>
              
              {errorInfo.userAction && (
                <div className="mt-2 flex items-center space-x-2 text-sm">
                  <PiInfo className="flex-shrink-0" />
                  <span>{errorInfo.userAction}</span>
                </div>
              )}
            </div>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex-shrink-0 ml-2 text-current hover:opacity-70"
              >
                <PiX />
              </button>
            )}
          </div>
          
          {/* Action buttons */}
          {(errorInfo.retryable && onRetry) && (
            <div className="mt-3 flex items-center space-x-3">
              <button
                onClick={onRetry}
                disabled={countdown > 0}
                className="flex items-center space-x-2 px-3 py-1 bg-white border border-current rounded text-sm hover:bg-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PiArrowClockwise className={countdown > 0 ? 'animate-spin' : ''} />
                <span>
                  {countdown > 0 ? `再試行まで ${countdown}秒` : '再試行'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;