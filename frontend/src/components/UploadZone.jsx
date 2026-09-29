import { useId, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { ACCEPTED_EXTENSIONS } from '../utils/files';

/** Drag-and-drop area plus a "browse" button. Hands raw File objects to onFiles. */
export default function UploadZone({ onFiles, disabled = false }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child element; count them so the
  // highlight doesn't flicker as the pointer crosses the icon and text.
  const depth = useRef(0);

  function handleFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length && !disabled) onFiles(files);
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <UploadCloud className="size-6" aria-hidden="true" />
      </div>
      <p className="mt-4 font-medium text-slate-900">
        {dragging ? 'Drop files to upload' : 'Drag files here to add them to your corpus'}
      </p>
      <p className="mt-1 text-sm text-slate-500">PDF, DOCX or TXT · up to 10 MB each</p>
      <label htmlFor={inputId} className={`btn-secondary mt-5 ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}>
        Browse files
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="sr-only"
        disabled={disabled}
        aria-label="Choose files to upload"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Allow choosing the same file again after an error.
          e.target.value = '';
        }}
      />
    </div>
  );
}
