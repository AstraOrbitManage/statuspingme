import { useMemo } from 'react';
import { marked } from 'marked';
import { cn } from '../../lib/utils';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

// Configure marked for safe rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
});

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    if (!content.trim()) {
      return '<p class="text-gray-400 italic">Nothing to preview</p>';
    }
    return marked.parse(content) as string;
  }, [content]);

  return (
    <div
      className={cn(
        'markdown-preview text-gray-700',
        '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mb-3 [&_h1]:mt-4',
        '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mb-2 [&_h2]:mt-3',
        '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-3',
        '[&_p]:my-2 [&_p]:leading-relaxed',
        '[&_a]:text-primary-600 [&_a]:underline [&_a:hover]:text-primary-700',
        '[&_strong]:font-semibold [&_strong]:text-gray-900',
        '[&_em]:italic',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2',
        '[&_li]:my-1',
        '[&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
        '[&_pre]:bg-gray-100 [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre]:my-3',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:my-3',
        '[&_hr]:border-gray-200 [&_hr]:my-4',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
