'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** The browser's top layer escapes blurred cards and keeps keyboard focus inside. */
export function ReviewDialog({ children, label, onClose }: {
  children: ReactNode;
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  return createPortal(
    <dialog ref={ref} aria-label={label} onCancel={onClose}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-hidden rounded-xl border border-border p-0 text-fg shadow-2xl backdrop:bg-black/65"
      style={{ backgroundColor: 'hsl(var(--panel))' }}>
      <div className="flex max-h-[calc(100dvh-2rem-2px)] flex-col">{children}</div>
    </dialog>, document.body,
  );
}
