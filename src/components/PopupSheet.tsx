import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface PopupSheetProps {
  onClose: () => void;
  ariaLabel?: string;
  variant?: 'bottom' | 'center';
  maxWidthClass?: string;
  maxHeightClass?: string;
  className?: string;
  children: React.ReactNode;
}

export const PopupSheet: React.FC<PopupSheetProps> = ({
  onClose,
  ariaLabel,
  variant = 'bottom',
  maxWidthClass = 'max-w-lg',
  maxHeightClass = 'max-h-[min(85dvh,calc(100dvh-max(1rem,env(safe-area-inset-top))-0.75rem))]',
  className = '',
  children,
}) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    active: boolean;
    startedFromTop: boolean;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const canStartPullDown = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el) return true;
    if (el.closest('input, textarea, select, [data-no-sheet-drag="true"]')) {
      return false;
    }
    if (el.closest('[data-sheet-handle="true"]')) {
      return true;
    }
    // Check if the nearest scrollable container inside the sheet is scrolled to top
    let node: HTMLElement | null = el;
    const root = sheetRef.current;
    while (node && node !== root) {
      const style = window.getComputedStyle(node);
      const isScrollableY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight + 2;
      if (isScrollableY && node.scrollTop > 2) {
        return false;
      }
      node = node.parentElement;
    }
    return true;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!canStartPullDown(e.target)) return;

    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      active: false,
      startedFromTop: true,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;

    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    if (!st.active) {
      if (dy > 8 && dy > Math.abs(dx) * 1.15) {
        st.active = true;
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else if (Math.abs(dx) > 12 || dy < -10) {
        dragStateRef.current = null;
        return;
      } else {
        return;
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - st.lastTime);
    st.velocityY = (e.clientY - st.lastY) / dt;
    st.lastY = e.clientY;
    st.lastTime = now;

    setDragY(Math.max(0, dy));
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const wasActive = st.active;
    const dy = Math.max(0, e.clientY - st.startY);
    const vy = st.velocityY;
    dragStateRef.current = null;
    setIsDragging(false);

    if (!wasActive) return;

    if (dy >= 90 || (dy >= 36 && vy > 0.55)) {
      setDragY(460);
      window.setTimeout(() => {
        onClose();
      }, 160);
    } else {
      setDragY(0);
    }
  };

  const backdropFade = Math.max(0.15, 1 - dragY / 380);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      initial={{ opacity: 0 }}
      animate={{ opacity: backdropFade }}
      exit={{ opacity: 0 }}
      transition={{ duration: isDragging ? 0 : 0.18 }}
      onClick={onClose}
      className={`fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex justify-center ${
        variant === 'center'
          ? 'items-center pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4'
          : 'items-end sm:items-center pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[max(1rem,env(safe-area-inset-top))] pb-0 sm:p-4'
      }`}
    >
      <motion.div
        ref={sheetRef}
        initial={{ opacity: 0, y: variant === 'center' ? 16 : 36, scale: 0.98 }}
        animate={{ opacity: 1, y: dragY, scale: 1 }}
        transition={
          isDragging
            ? { duration: 0 }
            : { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }
        }
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{ backgroundColor: '#111114' }}
        className={`w-full ${maxWidthClass} ${maxHeightClass} border border-white/25 shadow-[0_28px_80px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden ${
          variant === 'center'
            ? 'rounded-3xl'
            : 'rounded-t-3xl sm:rounded-3xl border-b-0 sm:border-b pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0'
        } ${className}`}
      >
        <div
          data-sheet-handle="true"
          aria-hidden="true"
          className="flex justify-center pt-2.5 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-10 h-1 rounded-full bg-white/25" />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
};
