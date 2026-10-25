import React, { useState } from 'react';
import {
  Star,
  Sparkles,
  CheckCircle2,
  X,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react';
import type { Task } from '@shared/types';
import { getApiBaseUrl, playNotificationChime } from '@shared/utils';

interface TaskReviewModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

const AVAILABLE_TAGS = [
  'Punctual & On Time',
  'Elderly Friendly & Gentle',
  'Fluent in Regional Language',
  'Thorough & Professional',
  'Clean & Safe Work',
  'Went Above & Beyond',
];

export const TaskReviewModal: React.FC<TaskReviewModalProps> = ({
  task,
  isOpen,
  onClose,
  onReviewSubmitted,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Elderly Friendly & Gentle', 'Punctual & On Time']);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/tasks/${task.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: task.client_id,
          partnerId: task.assigned_partner_id,
          rating,
          tags: selectedTags,
          feedbackText: feedback.trim() || null,
        }),
      });

      if (res.ok) {
        playNotificationChime('success');
        onReviewSubmitted();
        onClose();
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900/60">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Rate Service Experience</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Care provided for {task.parent?.parent_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 dark:bg-[#1E293B]/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="text-slate-400 text-[11px]">Completed Task:</div>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5">{task.title}</div>
            <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
              Caregiver: <span className="font-semibold text-blue-600 dark:text-blue-400">{task.assigned_partner?.full_name || 'Ground Partner'}</span>
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="text-center py-2">
            <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">How satisfied were you &amp; your parents?</div>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 transition transform hover:scale-110 cursor-pointer"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating ? 'text-amber-500 fill-amber-500 drop-shadow-xs' : 'text-slate-300 dark:text-slate-700'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
              {rating === 5 && 'Outstanding (5/5) — Exemplary Care & Dignity'}
              {rating === 4 && 'Very Good (4/5) — Smooth & Respectful'}
              {rating === 3 && 'Average (3/5) — Acceptable Standard'}
              {rating === 2 && 'Below Expectations (2/5)'}
              {rating === 1 && 'Unsatisfactory (1/5)'}
            </div>
          </div>

          {/* Tags Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-900 dark:text-white block mb-2">What went especially well?</label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-900 dark:text-white block mb-1">Your Feedback &amp; Parent Comments</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="e.g. The helper was gentle with mother, arrived punctually, and sent clear photos..."
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-5 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
