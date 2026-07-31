import { useState, useRef } from 'react';
import { compressImage } from '../../utils/imageCompressor';
import Button from '../ui/Button';

export default function PhotoCaptureWidget({ onPhotoSelected, onSkip }) {
  const [compressedResult, setCompressedResult] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionError, setCompressionError] = useState(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const processFile = async (file) => {
    if (!file) return;
    setIsCompressing(true);
    setCompressionError(null);

    try {
      const result = await compressImage(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
      });

      setCompressedResult(result);
      if (onPhotoSelected) {
        onPhotoSelected(result);
      }
    } catch (err) {
      setCompressionError(err.message || 'Image compression failed.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemove = () => {
    setCompressedResult(null);
    setCompressionError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (onPhotoSelected) {
      onPhotoSelected(null);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 text-center space-y-4 shadow-sm animate-fade-in">
      {/* Hidden File Inputs */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFileChange}
        className="hidden"
        id="camera-capture-input"
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handleFileChange}
        className="hidden"
        id="gallery-upload-input"
      />

      {/* Title & Description */}
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-xl">
            add_a_photo
          </span>
          <span className="font-bold text-primary text-sm">Disaster Photo (Optional)</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-surface-container text-on-surface-variant">
          Optional
        </span>
      </div>

      {/* State 1: Compressing Spinner */}
      {isCompressing && (
        <div className="py-6 space-y-2 text-secondary font-semibold text-xs flex flex-col items-center">
          <span className="material-symbols-outlined text-2xl animate-spin">sync</span>
          <span>Compressing photo with HTML5 Canvas...</span>
        </div>
      )}

      {/* State 2: Display Image Preview & Details */}
      {!isCompressing && compressedResult && (
        <div className="space-y-3">
          <div className="relative group rounded-xl overflow-hidden border border-secondary/40 shadow-sm max-h-56 bg-black flex items-center justify-center">
            <img
              src={compressedResult.dataUrl}
              alt="Disaster site preview"
              className="max-h-56 object-contain w-full"
            />

            {/* Delete / Trash Button Overlay */}
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-error text-white shadow-md hover:bg-[#a01616] transition-colors cursor-pointer"
              title="Remove Photo"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>

          {/* Compression Info Badge */}
          <div className="p-3 bg-surface-container/60 border border-outline-variant rounded-xl text-left text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-primary">
              <span className="truncate max-w-[200px]">{compressedResult.fileName}</span>
              <span className="text-emerald-400 text-2xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                {compressedResult.savingsPercent}% Reduced
              </span>
            </div>
            <div className="text-2xs text-on-surface-variant flex justify-between">
              <span>Size: <strong className="text-primary">{compressedResult.formattedCompressedSize}</strong> (from {compressedResult.formattedOriginalSize})</span>
              <span>Res: {compressedResult.width}×{compressedResult.height}</span>
            </div>
          </div>
        </div>
      )}

      {/* State 3: Capture / Upload Buttons when No Image */}
      {!isCompressing && !compressedResult && (
        <div className="grid grid-cols-2 gap-3">
          {/* Camera Button */}
          <label
            htmlFor="camera-capture-input"
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border border-outline-variant bg-surface-container/40 hover:bg-surface-container text-primary cursor-pointer transition-all hover:border-secondary/50"
          >
            <span className="material-symbols-outlined text-2xl text-secondary">
              photo_camera
            </span>
            <span className="text-xs font-bold">Use Camera</span>
          </label>

          {/* Gallery Button */}
          <label
            htmlFor="gallery-upload-input"
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border border-outline-variant bg-surface-container/40 hover:bg-surface-container text-primary cursor-pointer transition-all hover:border-secondary/50"
          >
            <span className="material-symbols-outlined text-2xl text-secondary">
              collections
            </span>
            <span className="text-xs font-bold">Choose Gallery</span>
          </label>
        </div>
      )}

      {/* Error Message */}
      {compressionError && (
        <p className="text-xs text-error font-medium">{compressionError}</p>
      )}

      {/* Skip Button Option */}
      {!compressedResult && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer pt-1"
        >
          Skip photo attachment →
        </button>
      )}
    </div>
  );
}
