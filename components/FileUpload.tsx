import React, { useRef } from 'react';
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
  label: string;
  image: string | null;
  onImageChange: (base64: string | null) => void;
  className?: string;
  aspect?: 'square' | 'portrait' | 'landscape';
  minimal?: boolean;
  hint?: string; // New prop for AI suggestion text
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  image, 
  onImageChange, 
  className = "", 
  aspect = 'square',
  minimal = false,
  hint
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onImageChange(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const aspectClass = aspect === 'portrait' ? 'aspect-[3/4]' : aspect === 'landscape' ? 'aspect-[16/9]' : 'aspect-square';
  
  const containerClasses = minimal 
    ? `w-full h-full flex flex-col items-center justify-center transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-xl`
    : `w-full ${aspectClass} rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900 flex flex-col items-center justify-center transition-all overflow-hidden`;

  return (
    <div className={`relative group cursor-pointer h-full ${className}`} onClick={() => fileInputRef.current?.click()}>
      <div className={containerClasses}>
        {image ? (
          <>
            <img src={image} alt="Preview" className="w-full h-full object-cover rounded-xl" />
            <button 
              onClick={clearImage}
              className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-red-500 transition-colors z-20"
            >
              <X size={14} />
            </button>
            {/* Label overlay on image for context */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl">
               <span className="text-[10px] font-bold text-white uppercase tracking-wider">{label}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-zinc-400 dark:text-zinc-500 p-4 text-center w-full">
            {minimal ? (
               <div className="flex flex-col items-center justify-center gap-2 w-full">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-1">
                    <ImageIcon size={18} />
                  </div>
                  <div className="flex flex-col gap-0.5 max-w-full">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
                    {hint && (
                        <span className="text-[10px] leading-tight text-zinc-400 line-clamp-2 px-2 italic">
                            "{hint}"
                        </span>
                    )}
                  </div>
               </div>
            ) : (
               <>
                 <Camera className="w-6 h-6 mb-2 opacity-80" />
                 <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
               </>
            )}
          </div>
        )}
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
};

export default FileUpload;