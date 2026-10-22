import React, { useState } from 'react';
import {
  Star,
  Sparkles,
  CheckCircle2,
  X,
  MessageSquare,
  ThumbsUp
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
  'Fluent in Local Language',
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
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Rate Service Experience</h3>
              <p className="text-[11px] text-slate-500">Service for {task.parent?.parent_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
            <div className="text-slate-500">Service Task:</div>
            <div className="font-bold text-slate-900 mt-0.5">{task.title}</div>
            <div className="text-slate-600 text-[11px] mt-1">
              Helper: <span className="font-semibold text-indigo-700">{task.assigned_partner?.full_name || 'Ground Partner'}</span>
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="text-center py-2">
            <div className="text-xs font-bold text-slate-700 mb-2">How satisfied were you & your parents?</div>
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
                      star <= rating ? 'text-amber-400 fill-amber-400 drop-shadow-xs' : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-indigo-600 mt-1">
              {rating === 5 && 'Outstanding (5/5) — Highly Satisfied'}
              {rating === 4 && 'Very Good (4/5) — Smooth Care'}
              {rating === 3 && 'Average (3/5) — Acceptable'}
              {rating === 2 && 'Below Expectations (2/5)'}
              {rating === 1 && 'Unsatisfactory (1/5)'}
            </div>
          </div>

          {/* Tags Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">What went especially well?</label>
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
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
            <label className="text-xs font-bold text-slate-700 block mb-1">Your Feedback & Parent Comments</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs"
              rows={3}
              placeholder="e.g. The helper was so gentle with mother and explained the whole process clearly..."
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            >
              {isSubmitting ? 'Submitting...' : `Submit ${rating}★ Review`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
