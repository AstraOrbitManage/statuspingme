import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import type { UpdateImage } from '../../types';

interface UpdateImageGalleryProps {
  images: UpdateImage[];
  className?: string;
}

export function UpdateImageGallery({ images, className }: UpdateImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  
  if (!images || images.length === 0) return null;

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;

  const getGridClass = () => {
    switch (images.length) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
      case 4:
      default:
        return 'grid-cols-2';
    }
  };

  const getImageClass = (index: number, total: number) => {
    // For 3 images, make the third one span 2 columns
    if (total === 3 && index === 2) {
      return 'col-span-2';
    }
    return '';
  };

  const goToPrevious = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : images.length - 1);
  }, [selectedIndex, images.length]);

  const goToNext = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex(selectedIndex < images.length - 1 ? selectedIndex + 1 : 0);
  }, [selectedIndex, images.length]);

  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, closeLightbox, goToPrevious, goToNext]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    
    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <>
      <div
        className={cn(
          'grid gap-2 rounded-lg overflow-hidden',
          getGridClass(),
          className
        )}
      >
        {images.slice(0, 4).map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={cn(
              'relative aspect-video overflow-hidden rounded-lg bg-gray-100',
              'hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500',
              'min-h-[44px]', // Touch-friendly minimum
              getImageClass(index, images.length),
              // Make single image taller
              images.length === 1 && 'aspect-[16/9] max-h-80'
            )}
          >
            <img
              src={image.url}
              alt={image.filename || `Image ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Show +N badge for remaining images */}
            {images.length > 4 && index === 3 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-2xl font-semibold">
                  +{images.length - 4}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox Modal - Touch-friendly with swipe support */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button - larger touch target */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 w-11 h-11 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
            aria-label="Close lightbox"
          >
            <XIcon className="w-6 h-6 text-white" />
          </button>

          {/* Navigation arrows - only show if multiple images */}
          {images.length > 1 && (
            <>
              {/* Previous button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeftIcon className="w-6 h-6 text-white" />
              </button>

              {/* Next button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                aria-label="Next image"
              >
                <ChevronRightIcon className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Image container */}
          <div 
            className="relative w-full h-full flex items-center justify-center p-4 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.filename || 'Full size image'}
              className="max-w-full max-h-full object-contain rounded-lg select-none"
              draggable={false}
            />
          </div>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/50 rounded-full text-white text-sm">
              {selectedIndex! + 1} / {images.length}
            </div>
          )}

          {/* Swipe hint on mobile */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/50 text-xs sm:hidden">
            Swipe to navigate
          </div>
        </div>
      )}
    </>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
