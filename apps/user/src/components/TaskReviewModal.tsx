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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7DFD5] animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[#E7DFD5] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center border border-[#FDE68A]">
              <Star className="w-5 h-5 fill-[#B45309]" />
            </div>
            <div>
              <h3 className="font-display font-bold text-[#1C1917] text-base">Rate Service Experience</h3>
              <p className="text-[11px] text-[#574F49]">Care provided for {task.parent?.parent_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8C827A] hover:text-[#1C1917] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E7DFD5] text-xs">
            <div className="text-[#8C827A] text-[11px]">Completed Task:</div>
            <div className="font-bold text-[#1C1917] mt-0.5">{task.title}</div>
            <div className="text-[#574F49] text-[11px] mt-1">
              Caregiver: <span className="font-semibold text-[#C25E2E]">{task.assigned_partner?.full_name || 'Ground Partner'}</span>
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="text-center py-2">
            <div className="text-xs font-semibold text-[#1C1917] mb-2">How satisfied were you &amp; your parents?</div>
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
                      star <= rating ? 'text-[#B45309] fill-[#B45309] drop-shadow-xs' : 'text-[#E7DFD5]'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-semibold text-[#B45309] mt-1">
              {rating === 5 && 'Outstanding (5/5) — Exemplary Care & Dignity'}
              {rating === 4 && 'Very Good (4/5) — Smooth & Respectful'}
              {rating === 3 && 'Average (3/5) — Acceptable Standard'}
              {rating === 2 && 'Below Expectations (2/5)'}
              {rating === 1 && 'Unsatisfactory (1/5)'}
            </div>
          </div>

          {/* Tags Selection */}
          <div>
            <label className="text-xs font-semibold text-[#1C1917] block mb-2">What went especially well?</label>
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
                        ? 'bg-[#FBECE5] border-[#F5D3C4] text-[#A3481D]'
                        : 'bg-white border-[#E7DFD5] text-[#574F49] hover:bg-[#FAF7F2]'
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
            <label className="text-xs font-semibold text-[#1C1917] block mb-1">Your Feedback &amp; Parent Comments</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full filial-input text-xs"
              rows={3}
              placeholder="e.g. The helper was gentle with mother, arrived punctually, and sent clear photos..."
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#574F49] hover:bg-[#F5F1EB] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="filial-btn-primary text-xs py-2 px-5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
