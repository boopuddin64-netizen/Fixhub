import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, Sparkles } from 'lucide-react';
import { ApiClient } from '../../../api/client';

interface PhotoEvidenceUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export const PhotoEvidenceUploader: React.FC<PhotoEvidenceUploaderProps> = ({
  photos,
  onChange,
  maxPhotos = 3,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compress image client-side to ensure lightweight bandwidth consumption on Nigerian mobile networks
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(img.src);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) return;

    const toProcess = fileArray.slice(0, remainingSlots);
    setIsProcessing(true);

    try {
      const compressedList = await Promise.all(toProcess.map(compressImage));
      
      const uploadedUrls: string[] = [];
      for (const base64 of compressedList) {
        const res = await ApiClient.uploadAttachment({
          fileData: base64,
          type: 'IMAGE',
          mimeType: 'image/jpeg'
        });
        uploadedUrls.push(res.url);
      }
      
      onChange([...photos, ...uploadedUrls].slice(0, maxPhotos));
    } catch (err) {
      console.error('Error processing photos:', err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    onChange(next);
  };

  const sampleDamagePhotos = [
    {
      label: 'Cracked Front Glass',
      url: 'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: 'Shattered Display',
      url: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: 'Back Glass Cracked',
      url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
    },
  ];

  const addSamplePhoto = (url: string) => {
    if (photos.length >= maxPhotos) return;
    onChange([...photos, url].slice(0, maxPhotos));
  };

  return (
    <div id="photo-evidence-uploader" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-slate-800">
            Add Photos <span className="text-slate-400 font-normal">({photos.length}/{maxPhotos} max)</span>
          </label>
          <p className="text-[11px] text-slate-500">
            Clear photos of damage help technicians give exact, non-fluctuating quotes.
          </p>
        </div>
      </div>

      {/* Photo Grid & Upload Slot */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {/* Uploaded Thumbnails */}
        {photos.map((photoUrl, idx) => (
          <div
            key={idx}
            className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs"
          >
            <img
              src={photoUrl}
              alt={`Evidence ${idx + 1}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/80 hover:bg-red-600 text-white transition-colors cursor-pointer"
              title="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/70 text-white text-[9px] font-mono">
              #{idx + 1}
            </span>
          </div>
        ))}

        {/* Upload Trigger Button */}
        {photos.length < maxPhotos && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-2 cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 scale-95'
                : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50 bg-slate-50/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {isProcessing ? (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                  <Camera className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
                  Add Photo
                </span>
                <span className="text-[9px] text-slate-400 text-center">Camera / files</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick Sample Photos for Fast Testing / Demo */}
      {photos.length < maxPhotos && (
        <div className="pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Or test with sample damage photo:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sampleDamagePhotos.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => addSamplePhoto(sample.url)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-medium border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{sample.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
