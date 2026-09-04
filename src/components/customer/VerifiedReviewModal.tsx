import React, { useState } from 'react';
import { ApiClient } from '../../api/client';
import { Star, ShieldCheck, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';

interface VerifiedReviewModalProps {
  repairId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const VerifiedReviewModal: React.FC<VerifiedReviewModalProps> = ({
  repairId,
  onClose,
  onSuccess,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await ApiClient.submitReview({
        repairId,
        rating,
        comment: comment.trim(),
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit review');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Rate Your Technician</h3>
              <p className="text-xs text-slate-500">Verified Repair Transaction Review</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 5-Star Rating Selector */}
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                className="p-1.5 focus:outline-none transition-transform hover:scale-110 cursor-pointer"
              >
                <Star
                  className={`w-8 h-8 ${
                    (hoverRating !== null ? hoverRating >= star : rating >= star)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            {rating === 5 && 'Outstanding Work (5 Stars)'}
            {rating === 4 && 'Very Good Service (4 Stars)'}
            {rating === 3 && 'Average Experience (3 Stars)'}
            {rating === 2 && 'Needs Improvement (2 Stars)'}
            {rating === 1 && 'Unsatisfactory (1 Star)'}
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Your Feedback (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share details about the quality of the screen, turnaround speed, and technician professionalism..."
            rows={3}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Your review receives a <strong>Verified Customer</strong> badge attached to this repair job.</span>
        </div>

        <button
          id="submit-verified-review-btn"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? 'Publishing Review...' : 'Submit Verified Review'}
        </button>
      </div>
    </div>
  );
};
