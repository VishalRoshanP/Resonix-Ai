/**
 * Client-side Image Compression Utility for RESONIX AI
 * Resizes and compresses photo uploads via HTML5 Canvas before transmission.
 */

export async function compressImage(file, options = {}) {
  const maxWidth = options.maxWidth || 1280;
  const maxHeight = options.maxHeight || 1280;
  const quality = options.quality ?? 0.8;
  const outputType = options.outputType || 'image/jpeg';

  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Provided file is not a valid image.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio scaling
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D context from canvas.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(outputType, quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas blob generation failed.'));
              return;
            }

            const originalSize = file.size;
            const compressedSize = blob.size;
            const savingsPercent = Math.max(
              0,
              Math.round(((originalSize - compressedSize) / originalSize) * 100)
            );

            const formatBytes = (bytes) => {
              if (bytes < 1024) return `${bytes} B`;
              if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
              return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
            };

            resolve({
              blob,
              dataUrl,
              fileName: file.name,
              mimeType: outputType,
              width,
              height,
              originalSize,
              compressedSize,
              savingsPercent,
              formattedOriginalSize: formatBytes(originalSize),
              formattedCompressedSize: formatBytes(compressedSize),
            });
          },
          outputType,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image into element.'));
      img.src = event.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}
