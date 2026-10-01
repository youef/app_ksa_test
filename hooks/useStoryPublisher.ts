import { useCallback, useState } from 'react';
import { publishStorySlides, type PublishOutcome } from '@/lib/storyPublish';
import type { StorySlide } from '@/lib/storyTypes';

export function useStoryPublisher() {
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);

  const publish = useCallback(async (slides: StorySlide[]): Promise<PublishOutcome> => {
    setPublishing(true);
    setDone(0);

    try {
      const outcome = await publishStorySlides(slides, (completed, count) => {
        setDone(completed);
        setTotal(count);
        setStatus(`جاري رفع الشريحة ${completed} من ${count}...`);
      });

      if (outcome.publishedCount === 0) {
        setStatus('');
        return outcome;
      }

      if (outcome.failures.length === 0) {
        setStatus('تم النشر بنجاح!');
      } else {
        setStatus(`تم نشر ${outcome.publishedCount} من ${outcome.requestedCount}`);
      }

      return outcome;
    } finally {
      setPublishing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('');
    setDone(0);
    setTotal(0);
  }, []);

  return { publishing, status, done, total, publish, reset };
}

export type StoryPublisher = ReturnType<typeof useStoryPublisher>;
