"use client";

import { useCallback, useRef, useState } from "react";

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  disabled?: boolean;
}

export default function ImageUploader({
  onImageSelected,
  disabled,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setPreview(URL.createObjectURL(file));
      onImageSelected(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="w-full">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8
          flex flex-col items-center justify-center gap-4
          transition-colors cursor-pointer min-h-[200px]
          ${dragOver ? "border-blue-400 bg-blue-400/10" : "border-gray-600 hover:border-gray-400"}
          ${disabled ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt="Screenshot preview"
            className="max-h-[300px] rounded-lg object-contain"
          />
        ) : (
          <>
            <svg
              className="w-12 h-12 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-gray-400 text-center">
              <span className="text-white font-medium">Click to upload</span> or
              drag &amp; drop a lobby screenshot
            </p>
            <p className="text-gray-500 text-sm">PNG, JPG, or WebP</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
