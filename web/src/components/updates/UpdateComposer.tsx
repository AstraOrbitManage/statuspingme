import { useState, useRef, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { MarkdownPreview } from './MarkdownPreview';
import { LinkPreviewCompact } from './LinkPreviewCard';
import { LinkEmbedPopover } from './LinkEmbedPopover';
import { updatesApi, ApiRequestError } from '../../lib/api';
import type { Update } from '../../types';

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string;
}

interface UpdateComposerProps {
  projectId: string;
  onUpdatePosted?: (update: Update) => void;
  disabled?: boolean;
}

interface UploadedImage {
  id: string;
  url: string;
  filename: string;
  sizeBytes: number;
  progress?: number; // 0-100 during upload
  error?: string;
}

const MAX_CHARACTERS = 5000;
const MAX_IMAGES = 4;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UpdateComposer({
  projectId,
  onUpdatePosted,
  disabled = false,
}: UpdateComposerProps) {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [linkPreviewError, setLinkPreviewError] = useState<string | null>(null);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);

  const characterCount = content.length;
  const isOverLimit = characterCount > MAX_CHARACTERS;
  const canPost = content.trim().length > 0 && !isOverLimit && !disabled;
  const canAddMoreImages = uploadedImages.length < MAX_IMAGES;
  const isUploading = uploadedImages.some((img) => img.progress !== undefined && img.progress < 100);

  // Insert formatting at cursor position
  const insertFormatting = useCallback(
    (prefix: string, suffix: string = prefix) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      const before = content.substring(0, start);
      const after = content.substring(end);

      const newContent = `${before}${prefix}${selectedText}${suffix}${after}`;
      setContent(newContent);

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = selectedText
          ? start + prefix.length + selectedText.length + suffix.length
          : start + prefix.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [content]
  );

  const handleBold = () => insertFormatting('**');
  const handleItalic = () => insertFormatting('*');
  const handleLink = () => insertFormatting('[', '](url)');
  const handleList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const before = content.substring(0, lineStart);
    const after = content.substring(lineStart);

    setContent(`${before}- ${after}`);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 2, lineStart + 2);
    }, 0);
  };

  // Handle image upload
  const handleImageSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError(null);

    const filesToUpload = Array.from(files).slice(0, MAX_IMAGES - uploadedImages.length);

    for (const file of filesToUpload) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(`Invalid file type: ${file.name}. Only jpg, png, gif, webp allowed.`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`File too large: ${file.name}. Maximum size is 10MB.`);
        continue;
      }

      // Create temporary image entry with progress
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const tempImage: UploadedImage = {
        id: tempId,
        url: URL.createObjectURL(file), // Local preview
        filename: file.name,
        sizeBytes: file.size,
        progress: 0,
      };

      setUploadedImages((prev) => [...prev, tempImage]);

      try {
        // Upload the file
        const formData = new FormData();
        formData.append('image', file);

        // Get auth token from localStorage
        const token = localStorage.getItem('auth_token');

        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadedImages((prev) =>
              prev.map((img) =>
                img.id === tempId ? { ...img, progress } : img
              )
            );
          }
        });

        const result = await new Promise<UploadedImage>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve({
                  id: response.id,
                  url: response.url,
                  filename: response.filename,
                  sizeBytes: response.sizeBytes,
                });
              } catch {
                reject(new Error('Invalid response from server'));
              }
            } else {
              try {
                const error = JSON.parse(xhr.responseText);
                reject(new Error(error.error || 'Upload failed'));
              } catch {
                reject(new Error(`Upload failed: ${xhr.status}`));
              }
            }
          };
          xhr.onerror = () => reject(new Error('Network error'));

          xhr.open('POST', '/api/uploads/image');
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
          xhr.send(formData);
        });

        // Replace temp image with uploaded one
        setUploadedImages((prev) =>
          prev.map((img) => (img.id === tempId ? result : img))
        );

        // Revoke the object URL
        URL.revokeObjectURL(tempImage.url);
      } catch (error) {
        console.error('Upload error:', error);
        // Mark image as failed
        setUploadedImages((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? { ...img, progress: undefined, error: error instanceof Error ? error.message : 'Upload failed' }
              : img
          )
        );
      }
    }
  }, [uploadedImages.length]);

  // Remove an uploaded image
  const handleRemoveImage = useCallback((imageId: string) => {
    setUploadedImages((prev) => {
      const removed = prev.find((img) => img.id === imageId);
      if (removed && removed.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url);
      }
      return prev.filter((img) => img.id !== imageId);
    });
  }, []);

  // Trigger file input click
  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  // URL detection regex
  const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

  // Fetch link preview from API
  const fetchLinkPreview = useCallback(async (url: string) => {
    setLinkPreviewLoading(true);
    setLinkPreviewError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/links/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch preview');
      }

      const preview = await response.json();
      setLinkPreview(preview);
      setShowLinkPopover(false);
    } catch (error) {
      console.error('Link preview error:', error);
      setLinkPreviewError(error instanceof Error ? error.message : 'Failed to fetch preview');
    } finally {
      setLinkPreviewLoading(false);
    }
  }, []);

  // Handle link embed button click
  const handleLinkEmbedClick = () => {
    if (linkPreview) {
      // If there's already a preview, remove it
      setLinkPreview(null);
      setLinkPreviewError(null);
    } else {
      setShowLinkPopover(!showLinkPopover);
    }
  };

  // Handle URL submission from popover
  const handleLinkSubmit = (url: string) => {
    fetchLinkPreview(url);
  };

  // Remove link preview
  const handleRemoveLinkPreview = () => {
    setLinkPreview(null);
    setLinkPreviewError(null);
  };

  // Detect URLs in pasted text
  const detectAndFetchUrl = useCallback((text: string) => {
    // Don't auto-fetch if we already have a preview
    if (linkPreview || linkPreviewLoading) return;

    const matches = text.match(URL_REGEX);
    if (matches && matches.length > 0) {
      // Use the first URL found
      fetchLinkPreview(matches[0]);
    }
  }, [linkPreview, linkPreviewLoading, fetchLinkPreview]);

  const [postError, setPostError] = useState<string | null>(null);

  const handlePost = async () => {
    if (!canPost || isUploading) return;

    setIsPosting(true);
    setPostError(null);

    try {
      // Prepare the data for the API
      const successfulImages = uploadedImages.filter((img) => !img.error);
      
      const createData = {
        content,
        images: successfulImages.length > 0 
          ? successfulImages.map((img) => ({
              url: img.url,
              filename: img.filename,
              sizeBytes: img.sizeBytes,
            }))
          : undefined,
        link: linkPreview 
          ? {
              url: linkPreview.url,
              title: linkPreview.title || undefined,
              description: linkPreview.description || undefined,
              imageUrl: linkPreview.imageUrl || undefined,
            }
          : undefined,
      };

      // Call the real API
      const response = await updatesApi.create(projectId, createData);
      
      // Transform the response to match the Update type
      const newUpdate: Update = {
        id: response.update.id,
        projectId: response.update.projectId,
        content: response.update.content,
        createdAt: response.update.createdAt,
        authorId: response.update.authorId,
        authorName: response.update.authorName,
        images: response.update.images,
        link: response.update.link,
      };

      // Notify parent component
      onUpdatePosted?.(newUpdate);

      // Reset form on success
      setContent('');
      setUploadedImages([]);
      setUploadError(null);
      setLinkPreview(null);
      setLinkPreviewError(null);
      setShowLinkPopover(false);
      setIsExpanded(false);
      setIsPreview(false);
    } catch (error) {
      console.error('Failed to post update:', error);
      
      // Show error to user - don't clear form data on error
      const errorMessage = error instanceof ApiRequestError 
        ? error.message 
        : 'Failed to post update. Please try again.';
      setPostError(errorMessage);
    } finally {
      setIsPosting(false);
    }
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    // Only collapse if empty and no images
    if (!content.trim() && uploadedImages.length === 0) {
      setTimeout(() => {
        // Check if we're still focused on something in the composer
        if (!textareaRef.current?.contains(document.activeElement)) {
          setIsExpanded(false);
          setIsPreview(false);
        }
      }, 150);
    }
  };

  // Handle paste event for images and URLs
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    let pastedText = '';

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      } else if (item.type === 'text/plain') {
        pastedText = e.clipboardData?.getData('text/plain') || '';
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      imageFiles.forEach((f) => dt.items.add(f));
      handleImageSelect(dt.files);
    } else if (pastedText) {
      // Check for URLs in pasted text (after a small delay to let the paste complete)
      setTimeout(() => {
        detectAndFetchUrl(pastedText);
      }, 100);
    }
  }, [handleImageSelect, detectAndFetchUrl]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer?.files;
    if (files) {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        const dt = new DataTransfer();
        imageFiles.forEach((f) => dt.items.add(f));
        handleImageSelect(dt.files);
      }
    }
  }, [handleImageSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-white transition-all duration-200',
        isExpanded
          ? 'border-primary-300 shadow-sm ring-1 ring-primary-100'
          : 'border-gray-200 hover:border-gray-300',
        disabled && 'opacity-50 pointer-events-none'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleImageSelect(e.target.files)}
      />

      {/* Toolbar - visible when expanded */}
      {isExpanded && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
          <ToolbarButton onClick={handleBold} title="Bold (Ctrl+B)">
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton onClick={handleItalic} title="Italic (Ctrl+I)">
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton onClick={handleLink} title="Insert Link">
            <LinkIcon />
          </ToolbarButton>
          <ToolbarButton onClick={handleList} title="Bullet List">
            <ListIcon />
          </ToolbarButton>

          <div className="flex-1" />

          {/* Preview toggle */}
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className={cn(
              'px-3 py-1 text-sm rounded-md transition-colors',
              isPreview
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {isPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="relative">
        {isPreview ? (
          <div className="min-h-[120px] max-h-[400px] overflow-y-auto px-3 py-3 bg-gray-50 rounded-b-lg">
            <MarkdownPreview content={content} />
            {/* Show images in preview */}
            {uploadedImages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {uploadedImages.filter((img) => !img.error).map((img) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={img.filename}
                    className="h-20 w-20 object-cover rounded-md"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onPaste={handlePaste}
            placeholder="What's the latest on this project?"
            disabled={disabled || isPosting}
            className={cn(
              'w-full resize-none bg-transparent px-3 py-3 text-gray-900 placeholder-gray-400',
              'focus:outline-none',
              'transition-all duration-200',
              isExpanded ? 'min-h-[120px]' : 'min-h-[48px]'
            )}
          />
        )}
      </div>

      {/* Uploaded images preview */}
      {uploadedImages.length > 0 && !isPreview && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-2">
            {uploadedImages.map((img) => (
              <div key={img.id} className="relative group">
                <div className={cn(
                  'relative w-20 h-20 rounded-md overflow-hidden border',
                  img.error ? 'border-red-300 bg-red-50' : 'border-gray-200'
                )}>
                  <img
                    src={img.url}
                    alt={img.filename}
                    className={cn(
                      'w-full h-full object-cover',
                      img.progress !== undefined && img.progress < 100 && 'opacity-50'
                    )}
                  />
                  
                  {/* Upload progress overlay */}
                  {img.progress !== undefined && img.progress < 100 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="text-white text-xs font-medium">
                        {img.progress}%
                      </div>
                    </div>
                  )}

                  {/* Progress bar */}
                  {img.progress !== undefined && img.progress < 100 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                      <div 
                        className="h-full bg-primary-500 transition-all duration-200"
                        style={{ width: `${img.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error indicator */}
                  {img.error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-100/80">
                      <span className="text-red-500 text-xs text-center px-1">
                        Failed
                      </span>
                    </div>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 hover:bg-gray-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Upload error message */}
          {uploadError && (
            <div className="mt-2 text-sm text-red-600">
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* Link preview */}
      {(linkPreview || linkPreviewLoading || linkPreviewError) && !isPreview && (
        <div className="px-3 pb-2">
          {linkPreviewLoading ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <LoadingSpinner />
              <span className="text-sm text-gray-500">Fetching preview...</span>
            </div>
          ) : linkPreviewError ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50">
              <span className="text-sm text-red-600">{linkPreviewError}</span>
              <button
                type="button"
                onClick={handleRemoveLinkPreview}
                className="p-1 text-red-400 hover:text-red-600 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : linkPreview ? (
            <LinkPreviewCompact
              preview={linkPreview}
              onRemove={handleRemoveLinkPreview}
            />
          ) : null}
        </div>
      )}

      {/* Show link preview in preview mode too */}
      {linkPreview && isPreview && (
        <div className="px-3 pb-2">
          <LinkPreviewCompact preview={linkPreview} />
        </div>
      )}

      {/* Post error message */}
      {postError && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50">
            <span className="text-sm text-red-600">{postError}</span>
            <button
              type="button"
              onClick={() => setPostError(null)}
              className="p-1 text-red-400 hover:text-red-600 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Action bar - visible when expanded */}
      {isExpanded && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
          <div className="flex items-center gap-2 relative">
            {/* Image upload button */}
            <button
              type="button"
              onClick={handleImageButtonClick}
              disabled={!canAddMoreImages || isPosting}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded transition-colors',
                canAddMoreImages && !isPosting
                  ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  : 'text-gray-300 cursor-not-allowed'
              )}
              title={
                canAddMoreImages
                  ? `Add image (${uploadedImages.length}/${MAX_IMAGES})`
                  : `Maximum ${MAX_IMAGES} images`
              }
            >
              <ImageIcon />
            </button>
            {/* Link embed button */}
            <button
              ref={linkButtonRef}
              type="button"
              onClick={handleLinkEmbedClick}
              disabled={isPosting || linkPreviewLoading}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded transition-colors',
                linkPreview
                  ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
                  : showLinkPopover
                  ? 'text-primary-600 bg-gray-100'
                  : !isPosting && !linkPreviewLoading
                  ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  : 'text-gray-300 cursor-not-allowed'
              )}
              title={linkPreview ? 'Remove link preview' : 'Add link preview'}
            >
              <EmbedIcon />
            </button>
            {/* Link embed popover */}
            <LinkEmbedPopover
              isOpen={showLinkPopover}
              onClose={() => setShowLinkPopover(false)}
              onSubmit={handleLinkSubmit}
              isLoading={linkPreviewLoading}
              anchorRef={linkButtonRef}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Character count */}
            <span
              className={cn(
                'text-sm',
                isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400'
              )}
            >
              {characterCount.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()}
            </span>

            {/* Post button */}
            <Button
              onClick={handlePost}
              disabled={!canPost || isPosting || isUploading}
              size="sm"
            >
              {isPosting ? (
                <>
                  <LoadingSpinner />
                  Posting...
                </>
              ) : isUploading ? (
                <>
                  <LoadingSpinner />
                  Uploading...
                </>
              ) : (
                'Post Update'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Toolbar button component
function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  );
}

// Simple inline icons
function LinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function EmbedIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
