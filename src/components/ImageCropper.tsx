"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  imageSrc: string;
  onCropConfirm: (crop: CropRect | null) => void;
  label?: string;
}

/**
 * Lets users draw a rectangle on a screenshot to select the region
 * containing player names. Dramatically reduces OCR noise.
 */
export default function ImageCropper({
  imageSrc,
  onCropConfirm,
  label = "Draw a box around the player names",
}: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [naturalSize, setNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  // Get mouse position relative to the image, accounting for display scaling
  const getRelativePos = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const img = imgRef.current;
      if (!img) return { x: 0, y: 0 };
      const rect = img.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const pos = getRelativePos(e);
      setStart(pos);
      setCurrent(pos);
      setDrawing(true);
      setCrop(null);
    },
    [getRelativePos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return;
      setCurrent(getRelativePos(e));
    },
    [drawing, getRelativePos]
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing || !start || !current || !imgRef.current || !naturalSize)
      return;
    setDrawing(false);

    const img = imgRef.current;
    const displayW = img.clientWidth;
    const displayH = img.clientHeight;

    // Convert display coords to natural image coords
    const scaleX = naturalSize.w / displayW;
    const scaleY = naturalSize.h / displayH;

    const x = Math.min(start.x, current.x) * scaleX;
    const y = Math.min(start.y, current.y) * scaleY;
    const width = Math.abs(current.x - start.x) * scaleX;
    const height = Math.abs(current.y - start.y) * scaleY;

    // Ignore tiny selections (accidental clicks)
    if (width < 20 || height < 10) {
      setCrop(null);
      return;
    }

    setCrop({ x, y, width, height });
  }, [drawing, start, current, naturalSize]);

  // Selection rectangle in display coordinates
  const selectionStyle =
    start && current
      ? {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        }
      : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400 text-center">{label}</p>

      <div
        ref={containerRef}
        className="relative inline-block w-full cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (drawing) handleMouseUp();
        }}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Screenshot to crop"
          className="w-full rounded-lg"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNaturalSize({
              w: img.naturalWidth,
              h: img.naturalHeight,
            });
          }}
        />

        {/* Dark overlay outside selection */}
        {selectionStyle && (
          <div className="absolute inset-0 bg-black/50 rounded-lg pointer-events-none" />
        )}

        {/* Selection rectangle */}
        {selectionStyle && (
          <div
            className="absolute border-2 border-purple-400 bg-purple-400/10 pointer-events-none"
            style={{
              left: selectionStyle.left,
              top: selectionStyle.top,
              width: selectionStyle.width,
              height: selectionStyle.height,
            }}
          />
        )}

        {/* Clear selection area (cut-out in overlay) */}
        {selectionStyle && !drawing && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: selectionStyle.left,
              top: selectionStyle.top,
              width: selectionStyle.width,
              height: selectionStyle.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
            }}
          />
        )}
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => onCropConfirm(crop)}
          className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold
                     rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!crop}
        >
          Extract from selection
        </button>
        <button
          onClick={() => onCropConfirm(null)}
          className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold
                     rounded-lg transition-colors"
        >
          Use full image
        </button>
        <button
          onClick={() => {
            setCrop(null);
            setStart(null);
            setCurrent(null);
          }}
          className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400
                     rounded-lg transition-colors border border-gray-700"
        >
          Clear
        </button>
      </div>

      {crop && (
        <p className="text-xs text-gray-500 text-center">
          Selection: {Math.round(crop.width)} × {Math.round(crop.height)}px
        </p>
      )}
    </div>
  );
}
