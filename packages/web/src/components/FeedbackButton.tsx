import React, { useState, useCallback } from 'react';
import { PiThumbsUp, PiThumbsDown, PiStar, PiX, PiCheck } from 'react-icons/pi';

interface FeedbackData {
  rating: number; // 1-5 stars
  helpful: boolean | null;
  comment?: string;
}

interface FeedbackButtonProps {
  onFeedback: (feedback: FeedbackData) => void;
  className?: string;
  compact?: boolean;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  onFeedback,
  className = '',
  compact = false
}) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);

  const handleSubmit = useCallback(() => {
    if (rating === 0 && helpful === null) return;

    const feedback: FeedbackData = {
      rating: rating || 3, // Default to 3 if not rated
      helpful: helpful,
      comment: comment.trim() || undefined,
    };

    onFeedback(feedback);
    setSubmitted(true);
    
    // Auto-hide after submission
    setTimeout(() => {
      setShowFeedback(false);
      setSubmitted(false);
      setRating(0);
      setHelpful(null);
      setComment('');
      setHoveredStar(0);
    }, 2000);
  }, [rating, helpful, comment, onFeedback]);

  const handleReset = useCallback(() => {
    setShowFeedback(false);
    setSubmitted(false);
    setRating(0);
    setHelpful(null);
    setComment('');
    setHoveredStar(0);
  }, []);

  if (submitted) {
    return (
      <div className={`flex items-center space-x-2 text-green-600 ${className}`}>
        <PiCheck className="text-sm" />
        <span className="text-xs">Thanks for your feedback!</span>
      </div>
    );
  }

  if (!showFeedback) {
    return (
      <button
        onClick={() => setShowFeedback(true)}
        className={`flex items-center space-x-1 text-gray-400 hover:text-gray-600 transition-colors ${className}`}
        title="Rate this response"
      >
        <PiStar className={compact ? 'text-sm' : 'text-base'} />
        {!compact && <span className="text-xs">Rate</span>}
      </button>
    );
  }

  return (
    <div className={`bg-white border rounded-lg shadow-lg p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-800">Rate this response</h4>
        <button
          onClick={handleReset}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <PiX className="text-sm" />
        </button>
      </div>

      {/* Star Rating */}
      <div className="space-y-2">
        <div className="flex items-center space-x-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className={`text-lg transition-colors ${
                star <= (hoveredStar || rating)
                  ? 'text-yellow-400'
                  : 'text-gray-300'
              }`}
            >
              <PiStar 
                className={
                  star <= (hoveredStar || rating) ? 'fill-current' : ''
                } 
              />
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500">
          {hoveredStar > 0 ? (
            hoveredStar === 1 ? 'Poor' :
            hoveredStar === 2 ? 'Fair' :
            hoveredStar === 3 ? 'Good' :
            hoveredStar === 4 ? 'Very Good' : 'Excellent'
          ) : (
            rating > 0 ? (
              rating === 1 ? 'Poor' :
              rating === 2 ? 'Fair' :
              rating === 3 ? 'Good' :
              rating === 4 ? 'Very Good' : 'Excellent'
            ) : 'Rate the quality of this response'
          )}
        </div>
      </div>

      {/* Helpful/Not Helpful */}
      <div className="space-y-2">
        <p className="text-xs text-gray-600">Was this response helpful?</p>
        <div className="flex space-x-2">
          <button
            onClick={() => setHelpful(true)}
            className={`flex items-center space-x-1 px-3 py-1 rounded text-xs transition-colors ${
              helpful === true
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200'
            } border`}
          >
            <PiThumbsUp className="text-sm" />
            <span>Yes</span>
          </button>
          <button
            onClick={() => setHelpful(false)}
            className={`flex items-center space-x-1 px-3 py-1 rounded text-xs transition-colors ${
              helpful === false
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200'
            } border`}
          >
            <PiThumbsDown className="text-sm" />
            <span>No</span>
          </button>
        </div>
      </div>

      {/* Optional Comment */}
      <div className="space-y-2">
        <label className="text-xs text-gray-600">
          Additional feedback (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us more about your experience..."
          className="w-full text-xs p-2 border border-gray-200 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          maxLength={500}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-2">
        <button
          onClick={handleReset}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={rating === 0 && helpful === null}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            rating > 0 || helpful !== null
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default FeedbackButton;