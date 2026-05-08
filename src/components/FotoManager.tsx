import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Upload, Trash2, Loader2, Image as ImageIcon, X, Sparkles, Download, AlertCircle, CheckCircle, Sliders, Sun, RotateCcw, Share2, ExternalLink, Maximize, Minimize, ChevronLeft, ChevronRight, Layers, ZoomIn, ZoomOut, Plus, Minus, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { showAlert } from '../services/alertService';

// New Panel Component
const Panel: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  openPanel: string | null;
  setOpenPanel: (id: string | null) => void;
  children: React.ReactNode;
}> = ({ id, title, icon, openPanel, setOpenPanel, children }) => {
  const isOpen = openPanel === id;
  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setOpenPanel(isOpen ? null : id)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-bold text-sm text-gray-700">{title}</span>
        </div>
        <ChevronRight
          size={18}
          className={`text-gray-400 transition-transform ${
            isOpen ? 'rotate-90' : 'rotate-0'
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface PhotoPreview {
  id: string;
  originalUrl: string;
  previewUrl: string;
  title: string;
  metadata?: {
    name?: string;
    parent?: string;
    description?: string;
    tags?: string;
  };
}

interface SelectedFile {
  id: string;
  fileData: string;
  name: string;
}

type ColorizeStyle = 'warm' | 'cool' | 'vintage' | 'vivid' | 'bw' | 'ocean' | 'sunset' | 'forest' | 'art' | 'sketch' | 'oil_painting' | 'pop_art';

interface RelightingDir {
  id: string;
  label: string;
}

const RELIGHTING_DIRECTIONS: RelightingDir[] = [
  { id: 'top', label: 'Top' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'top-left', label: 'Top-L' },
  { id: 'top-right', label: 'Top-R' },
  { id: 'bottom-left', label: 'Bottom-L' },
  { id: 'bottom-right', label: 'Bottom-R' },
];

const MAX_PREVIEW_SIZE = 1200; // Ukuran untuk preview agar lancar
const DEFAULT_WATERMARK_POSITION: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center' | 'bottom-center' | 'top-center' = 'bottom-center';
const DEFAULT_WATERMARK_SIZE = 0.15;

export const FotoManager: React.FC<{
  canView?: boolean;
  canUpload?: boolean;
  canSave?: boolean;
  canDelete?: boolean;
  canEditSettings?: boolean;
  canResetSettings?: boolean;
  canReorder?: boolean;
}> = ({
  canView = true,
  canUpload = true,
  canSave = true,
  canDelete = true,
  canEditSettings = true,
  canResetSettings = true,
  canReorder = true,
}) => {
  // Desktop state
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // File selection and preview (Don't load files from localStorage anymore to avoid crash)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [processedPreviews, setProcessedPreviews] = useState<PhotoPreview[]>([]);
  const [processingPreviews, setProcessingPreviews] = useState(false);

  // Tool selection state
  const [activeTab, setActiveTab] = useState<'adjust' | 'filter' | 'watermark' | 'relight' | 'ai'>('watermark');
  const [openPanel, setOpenPanel] = useState<string | null>('watermark');
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [desktopZoom, setDesktopZoom] = useState(1);
  const [desktopPan, setDesktopPan] = useState({ x: 0, y: 0 });
  const [isDesktopPanning, setIsDesktopPanning] = useState(false);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const desktopPreviewRef = useRef<HTMLDivElement>(null);
  const zoomHoldIntervalRef = useRef<number | null>(null);
  const processingRunRef = useRef(0);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  // Persistence Helper
  const getSaved = (key: string, def: any) => {
    const s = localStorage.getItem(`foto_edit_${key}`);
    if (!s) return def;
    try { return JSON.parse(s); } catch { return s; }
  };
  const save = (key: string, val: any) => {
    try {
      localStorage.setItem(`foto_edit_${key}`, JSON.stringify(val));
    } catch (err) {
      console.warn(`Gagal menyimpan ${key} ke localStorage:`, err);
    }
  };

  // Watermark state
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(() => getSaved('watermark_enabled', true));
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(() => getSaved('watermark_url', '/watermark.png'));
  const [watermarkPosition, setWatermarkPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center' | 'bottom-center' | 'top-center'>(() => getSaved('watermark_pos', DEFAULT_WATERMARK_POSITION));
  const [watermarkOpacity, setWatermarkOpacity] = useState(() => getSaved('watermark_opacity', 0));
  const [watermarkSize, setWatermarkSize] = useState(() => getSaved('watermark_size', DEFAULT_WATERMARK_SIZE));

  // Filter state
  const [filterBrightness, setFilterBrightness] = useState(() => getSaved('brightness', 100));
  const [filterContrast, setFilterContrast] = useState(() => getSaved('contrast', 100));
  const [filterSaturate, setFilterSaturate] = useState(() => getSaved('saturate', 100));
  const [filterGrayscale, setFilterGrayscale] = useState(() => getSaved('grayscale', 0));
  const [filterSepia, setFilterSepia] = useState(() => getSaved('sepia', 0));
  const [filterSmooth, setFilterSmooth] = useState(() => getSaved('smooth', 0));
  const [filterSkinBright, setFilterSkinBright] = useState(() => getSaved('skin_bright', 0));
  const [filterSkinTone, setFilterSkinTone] = useState(() => getSaved('skin_tone', 0));
  const [filterSharpness, setFilterSharpness] = useState(() => getSaved('sharpness', 0));
  const [filterSkyColor, setFilterSkyColor] = useState<string>(() => getSaved('sky_color', '#87CEEB'));
  const [filterSkyIntensity, setFilterSkyIntensity] = useState(() => getSaved('sky_intensity', 0));
  const [filterSkyBrightness, setFilterSkyBrightness] = useState(() => getSaved('sky_brightness', 100));
  const [skyColorEnabled, setSkyColorEnabled] = useState<boolean>(() => getSaved('sky_enabled', false));

  // Colorize state
  const [colorizeStyle, setColorizeStyle] = useState<ColorizeStyle>(() => getSaved('colorize_style', 'warm'));
  const [colorizeIntensity, setColorizeIntensity] = useState(() => getSaved('colorize_intensity', 0));

  // Relighting state
  const [relightDirs, setRelightDirs] = useState<string[]>(() => getSaved('relight_dirs', []));
  const [relightIntensity, setRelightIntensity] = useState(() => getSaved('relight_intensity', 0));
  const [relightWarmth, setRelightWarmth] = useState(() => getSaved('relight_warmth', 0));

  // Save settings when changed (EXCLUDE files to prevent QuotaExceededError/Blank Page)
  useEffect(() => {
    try {
      save('watermark_enabled', watermarkEnabled);
      save('watermark_url', watermarkUrl);
      save('watermark_pos', watermarkPosition);
      save('watermark_opacity', watermarkOpacity);
      save('watermark_size', watermarkSize);
      save('brightness', filterBrightness);
      save('contrast', filterContrast);
      save('saturate', filterSaturate);
      save('grayscale', filterGrayscale);
      save('sepia', filterSepia);
      save('colorize_style', colorizeStyle);
      save('colorize_intensity', colorizeIntensity);
      save('relight_dirs', relightDirs);
      save('relight_intensity', relightIntensity);
      save('relight_warmth', relightWarmth);
      save('smooth', filterSmooth);
      save('skin_bright', filterSkinBright);
      save('skin_tone', filterSkinTone);
      save('sharpness', filterSharpness);
      save('sky_color', filterSkyColor);
      save('sky_intensity', filterSkyIntensity);
      save('sky_brightness', filterSkyBrightness);
      save('sky_enabled', skyColorEnabled);
      // save('files', selectedFiles); // REMOVED: Saving large Base64 arrays crashes mobile browsers
    } catch (e) {
      console.error("Gagal menyimpan pengaturan:", e);
    }
  }, [watermarkEnabled, watermarkUrl, watermarkPosition, watermarkOpacity, watermarkSize, filterBrightness, filterContrast, filterSaturate, filterGrayscale, filterSepia, colorizeStyle, colorizeIntensity, relightDirs, relightIntensity, relightWarmth]);

  const toggleRelightDir = (dir: string) => {
    setRelightDirs(prev => 
      prev.includes(dir) ? prev.filter(d => d !== dir) : [...prev, dir]
    );
  };

  const resetAdjust = () => {
    setFilterBrightness(100);
    setFilterContrast(100);
    setFilterSaturate(100);
    setFilterGrayscale(0);
    setFilterSepia(0);
    setFilterSmooth(0);
    setFilterSkinBright(0);
    setFilterSkinTone(0);
    setFilterSharpness(0);
    setFilterSkyColor('#87CEEB');
    setFilterSkyIntensity(0);
  };

  const resetFilter = () => {
    setColorizeStyle('warm');
    setColorizeIntensity(0);
  };

  const resetWatermark = () => {
    setWatermarkEnabled(true);
    setWatermarkUrl('/watermark.png');
    setWatermarkPosition(DEFAULT_WATERMARK_POSITION);
    setWatermarkOpacity(0);
    setWatermarkSize(DEFAULT_WATERMARK_SIZE);
  };

  useEffect(() => {
    // Saat halaman masih bersih (belum ada foto), gunakan default reset watermark.
    if (selectedFiles.length === 0) {
      setWatermarkEnabled(true);
      setWatermarkUrl('/watermark.png');
      setWatermarkPosition(DEFAULT_WATERMARK_POSITION);
      setWatermarkOpacity(0);
      setWatermarkSize(DEFAULT_WATERMARK_SIZE);
    }
  }, [selectedFiles.length]);

  const resetRelight = () => {
    setRelightDirs([]);
    setRelightIntensity(0);
    setRelightWarmth(0);
  };

  const resetAI = () => {
    setFilterSmooth(0);
    setFilterSkinBright(0);
    setFilterSkinTone(0);
    setFilterSharpness(0);
    setFilterSkyColor('#87CEEB');
    setFilterSkyIntensity(0);
    setFilterSkyBrightness(100);
    setSkyColorEnabled(false);
  };

  const applyEffects = useCallback((mainImageUrl: string, watermarkImageUrl: string | null, maxSize?: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const mainImg = new window.Image();
      mainImg.crossOrigin = "anonymous";
      
      mainImg.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Gagal mendapatkan context canvas'));
          return;
        }

        let width = mainImg.width;
        let height = mainImg.height;

        if (maxSize && (width > maxSize || height > maxSize)) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // 1. Basic Filters
        ctx.filter = `brightness(${filterBrightness}%) contrast(${filterContrast}%) saturate(${filterSaturate}%) grayscale(${filterGrayscale}%) sepia(${filterSepia}%)`;
        ctx.drawImage(mainImg, 0, 0, width, height);
        ctx.filter = 'none';

        // 1.5 Skin Smoothing & Brightening & Tone (AI-Skin)
        if (filterSmooth > 0 || filterSkinBright > 0 || filterSkinTone > 0) {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          
          const blurCanvas = document.createElement('canvas');
          blurCanvas.width = width;
          blurCanvas.height = height;
          const blurCtx = blurCanvas.getContext('2d');
          
          if (blurCtx) {
            blurCtx.filter = `blur(${Math.max(1, (filterSmooth / 100) * 4)}px)`;
            blurCtx.drawImage(canvas, 0, 0);
            const blurData = blurCtx.getImageData(0, 0, width, height).data;

            const smoothIntensity = filterSmooth / 100;
            const brightIntensity = filterSkinBright / 100;
            const toneIntensity = filterSkinTone / 100;
            
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              
              const isSkin = r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15;
              
              if (isSkin) {
                // 1. Smoothing
                if (filterSmooth > 0) {
                  data[i] = r * (1 - smoothIntensity) + blurData[i] * smoothIntensity;
                  data[i+1] = g * (1 - smoothIntensity) + blurData[i+1] * smoothIntensity;
                  data[i+2] = b * (1 - smoothIntensity) + blurData[i+2] * smoothIntensity;
                }
                
                // 2. Brightening (Lighten skin specifically)
                if (filterSkinBright > 0) {
                  data[i] = Math.min(255, data[i] + (255 - data[i]) * brightIntensity * 0.3);
                  data[i+1] = Math.min(255, data[i+1] + (255 - data[i+1]) * brightIntensity * 0.3);
                  data[i+2] = Math.min(255, data[i+2] + (255 - data[i+2]) * brightIntensity * 0.3);
                }

                // 3. Skin Tone Uniformity (Target a healthy peachy tone)
                if (filterSkinTone > 0) {
                  const targetR = 230, targetG = 190, targetB = 170;
                  data[i] = data[i] * (1 - toneIntensity * 0.5) + targetR * (toneIntensity * 0.5);
                  data[i+1] = data[i+1] * (1 - toneIntensity * 0.5) + targetG * (toneIntensity * 0.5);
                  data[i+2] = data[i+2] * (1 - toneIntensity * 0.5) + targetB * (toneIntensity * 0.5);
                }
              }
            }
            ctx.putImageData(imgData, 0, 0);
          }
        }

        // 1.6 HD Sharpness (Unsharp Masking technique)
        if (filterSharpness > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'overlay';
          ctx.globalAlpha = (filterSharpness / 100) * 0.5;
          ctx.filter = 'contrast(150%) brightness(110%) saturate(120%)';
          ctx.drawImage(canvas, 0, 0);
          ctx.restore();
          
          // Apply a subtle sharpen filter via CSS context if possible, otherwise use manual kernel
          // Since we are on canvas, we use a trick: high contrast overlay + slight shift
          ctx.save();
          ctx.globalAlpha = (filterSharpness / 100) * 0.2;
          ctx.drawImage(canvas, -1, -1);
          ctx.globalCompositeOperation = 'difference';
          ctx.drawImage(canvas, 0, 0);
          ctx.restore();
        }

        // 1.7 Sky Color Adjustment
        if (skyColorEnabled && filterSkyIntensity > 0) {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          
          const rTarget = parseInt(filterSkyColor.slice(1, 3), 16);
          const gTarget = parseInt(filterSkyColor.slice(3, 5), 16);
          const bTarget = parseInt(filterSkyColor.slice(5, 7), 16);
          const intensity = filterSkyIntensity / 100;
          const skyBright = filterSkyBrightness / 100;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];

            const isSky = (b > r && b > g && (r+g+b) > 300) || ((r+g+b) > 600);
            
            if (isSky) {
              // 1. Color Tinting
              data[i] = (r * (1 - intensity * 0.5) + rTarget * (intensity * 0.5)) * skyBright;
              data[i+1] = (g * (1 - intensity * 0.5) + gTarget * (intensity * 0.5)) * skyBright;
              data[i+2] = (b * (1 - intensity * 0.5) + bTarget * (intensity * 0.5)) * skyBright;
              
              // Ensure bounds
              data[i] = Math.min(255, data[i]);
              data[i+1] = Math.min(255, data[i+1]);
              data[i+2] = Math.min(255, data[i+2]);
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        // 2. Relighting
        if (relightDirs.length > 0) {
          const warmthColor = relightWarmth > 0 
            ? `rgba(255, ${150 + (1 - relightWarmth/100) * 105}, 50,` 
            : `rgba(150, 200, 255,`;
            
          relightDirs.forEach(dir => {
            let gradient;
            const opacity = (relightIntensity / 100) * 0.5;
            
            switch(dir) {
              case 'top': gradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.6); break;
              case 'left': gradient = ctx.createLinearGradient(0, 0, canvas.width * 0.6, 0); break;
              case 'right': gradient = ctx.createLinearGradient(canvas.width, 0, canvas.width * 0.4, 0); break;
              case 'bottom': gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height * 0.4); break;
              case 'top-left': gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, canvas.width); break;
              case 'top-right': gradient = ctx.createRadialGradient(canvas.width, 0, 0, canvas.width, 0, canvas.width); break;
              case 'bottom-left': gradient = ctx.createRadialGradient(0, canvas.height, 0, 0, canvas.height, canvas.width); break;
              case 'bottom-right': gradient = ctx.createRadialGradient(canvas.width, canvas.height, 0, canvas.width, canvas.height, canvas.width); break;
              default: gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            }
            
            gradient.addColorStop(0, `${warmthColor} ${opacity})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
          });
        }

        // 3. Colorize Styles
        if (colorizeIntensity > 0) {
          let hsl = '0, 0%, 0%';
          let composite: GlobalCompositeOperation = 'color';
          
          switch(colorizeStyle) {
            case 'warm': hsl = '30, 70%, 50%'; break;
            case 'cool': hsl = '200, 70%, 50%'; break;
            case 'vintage': hsl = '40, 50%, 40%'; break;
            case 'vivid': hsl = '0, 0%, 100%'; composite = 'overlay'; break;
            case 'bw': hsl = '0, 0%, 0%'; break;
            case 'ocean': hsl = '180, 80%, 40%'; break;
            case 'sunset': hsl = '10, 90%, 50%'; break;
            case 'forest': hsl = '120, 50%, 30%'; break;
            case 'art': hsl = '280, 60%, 50%'; composite = 'multiply'; break;
            case 'sketch': hsl = '0, 0%, 50%'; composite = 'luminosity'; break;
            case 'oil_painting': hsl = '45, 80%, 40%'; composite = 'soft-light'; break;
            case 'pop_art': hsl = '330, 90%, 60%'; composite = 'screen'; break;
          }

          ctx.save();
          ctx.globalCompositeOperation = composite;
          ctx.globalAlpha = colorizeIntensity / 100;
          ctx.fillStyle = `hsl(${hsl})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        }

        // 4. Watermark
        if (!watermarkEnabled) {
          resolve(canvas.toDataURL('image/jpeg', 0.85));
          return;
        }
        const effectiveWatermark = watermarkUrl || '/watermark.png';
        const watermarkImg = new window.Image();
        watermarkImg.crossOrigin = "anonymous";
        watermarkImg.onload = () => {
          const minSide = Math.min(canvas.width, canvas.height);
          const wScale = (minSide * watermarkSize * 2.5) / watermarkImg.width; 
          const wWidth = watermarkImg.width * wScale;
          const wHeight = watermarkImg.height * wScale;
          
          // Calculate height at 10% size as reference for center-anchoring
          const wHeight10 = watermarkImg.height * ((minSide * 0.1 * 2.5) / watermarkImg.width);
          
          let x = 0, y = 0;
          const paddingX = minSide * 0.04;
          
          switch (watermarkPosition) {
            case 'bottom-right': 
              x = canvas.width - wWidth - paddingX; 
              y = canvas.height - (wHeight10 + wHeight) / 2 + (wHeight * 0.2); 
              break;
            case 'bottom-left': 
              x = paddingX; 
              y = canvas.height - (wHeight10 + wHeight) / 2 + (wHeight * 0.2); 
              break;
            case 'top-right': 
              x = canvas.width - wWidth - paddingX; 
              y = (wHeight10 - wHeight) / 2 - (wHeight * 0.2); 
              break;
            case 'top-left': 
              x = paddingX; 
              y = (wHeight10 - wHeight) / 2 - (wHeight * 0.2); 
              break;
            case 'center': 
              x = (canvas.width - wWidth) / 2; 
              y = (canvas.height - wHeight) / 2; 
              break;
            case 'bottom-center': 
              x = (canvas.width - wWidth) / 2; 
              y = canvas.height - (wHeight10 + wHeight) / 2 + (wHeight * 0.2); 
              break;
            case 'top-center': 
              x = (canvas.width - wWidth) / 2; 
              y = (wHeight10 - wHeight) / 2 - (wHeight * 0.2); 
              break;
          }

          // Ensure watermark stays within canvas bounds
          x = Math.max(0, Math.min(x, canvas.width - wWidth));
          y = Math.max(0, Math.min(y, canvas.height - wHeight));
          
          ctx.globalAlpha = 1 - watermarkOpacity;
          ctx.drawImage(watermarkImg, x, y, wWidth, wHeight);
          ctx.globalAlpha = 1.0;
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        watermarkImg.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.85));
        watermarkImg.src = effectiveWatermark;
      };
      mainImg.onerror = () => reject(new Error('Gagal memuat foto utama'));
      mainImg.src = mainImageUrl;
    });
  }, [watermarkEnabled, watermarkPosition, watermarkSize, watermarkOpacity, filterBrightness, filterContrast, filterSaturate, filterGrayscale, filterSepia, filterSmooth, filterSkinBright, filterSkinTone, filterSharpness, filterSkyColor, filterSkyIntensity, filterSkyBrightness, skyColorEnabled, colorizeStyle, colorizeIntensity, relightDirs, relightIntensity, relightWarmth]);

  const processFiles = async (items: SelectedFile[], append = false, runId?: number) => {
    if (items.length === 0) {
      if (!append) setProcessedPreviews([]);
      return;
    }
    
    // Saat edit massal, jangan reset preview lama agar UI tidak blank/refresh.
    setProcessingPreviews(true);

    try {
      for (let i = 0; i < items.length; i++) {
        if (runId !== undefined && runId !== processingRunRef.current) return;
        const item = items[i];
        try {
          const finalUrl = await applyEffects(item.fileData, watermarkUrl, MAX_PREVIEW_SIZE);
          const newPreview = { 
            id: item.id,
            originalUrl: item.fileData, 
            previewUrl: finalUrl, 
            title: item.name 
          };
          
          if (append) {
            setProcessedPreviews(prev => [...prev, newPreview]);
          } else {
            setProcessedPreviews(prev => {
              const next = [...prev];
              next[i] = newPreview;
              return next;
            });
          }
          
          // Small delay to allow UI thread to breathe and prevent blank screen/freeze
          await new Promise(resolve => setTimeout(resolve, 25));
        } catch (innerErr) {
          console.error("Processing error:", innerErr);
        }
      }
    } catch (err) {
      console.error("Batch processing error:", err);
    } finally {
      setProcessingPreviews(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedFiles.length === 0) {
        setProcessedPreviews([]);
        return;
      }
      const runId = Date.now();
      processingRunRef.current = runId;
      processFiles(selectedFiles, false, runId);
    }, 280);
    return () => clearTimeout(timer);
  }, [watermarkEnabled, watermarkUrl, watermarkPosition, watermarkOpacity, watermarkSize, filterBrightness, filterContrast, filterSaturate, filterGrayscale, filterSepia, filterSmooth, filterSkinBright, filterSkinTone, filterSharpness, filterSkyColor, filterSkyIntensity, filterSkyBrightness, skyColorEnabled, colorizeStyle, colorizeIntensity, relightDirs, relightIntensity, relightWarmth]);

  const handleIncomingFiles = async (files: File[]) => {
    if (!canUpload) {
      showAlert('Role Anda tidak memiliki izin upload foto.', 'info');
      return;
    }
    if (files.length === 0) return;
    
    setProcessingPreviews(true);
    const newItems: SelectedFile[] = [];
    
    for (const file of files) {
      // Basic check for very large files (> 15MB) to prevent crash
      if (file.size > 15 * 1024 * 1024) {
        showAlert(`Foto ${file.name} terlalu besar (di atas 15MB), mungkin akan menyebabkan performa lambat.`, 'info');
      }
      
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      newItems.push({ id: `${Date.now()}-${Math.random()}-${file.name}`, fileData: base64, name: file.name });
    }
    
    setSelectedFiles(prev => {
      const firstNewIndex = prev.length;
      const merged = [...prev, ...newItems];
      if (newItems.length > 0 && isDesktop) {
        setActivePreviewIndex(firstNewIndex);
        setDesktopZoom(1);
      }
      return merged;
    });
    await processFiles(newItems, true);
  };

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await handleIncomingFiles(files);
    if (e.target) e.target.value = '';
  };

  const moveItem = <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const handlePhotoDropReorder = (dropIndex: number) => {
    if (!canReorder) return;
    if (draggedPhotoIndex === null || draggedPhotoIndex === dropIndex) {
      setDraggedPhotoIndex(null);
      return;
    }
    setSelectedFiles(prev => moveItem(prev, draggedPhotoIndex, dropIndex));
    setProcessedPreviews(prev => moveItem(prev, draggedPhotoIndex, dropIndex));
    setActivePreviewIndex(dropIndex);
    setDraggedPhotoIndex(null);
  };

  const handleDownloadSingle = async (index: number) => {
    if (!canSave) {
      showAlert('Role Anda tidak memiliki izin simpan foto.', 'info');
      return;
    }
    const item = selectedFiles[index];
    if (!item) return;
    
    showAlert('Menyiapkan foto...', 'info');
    try {
      const finalUrl = await applyEffects(item.fileData, watermarkUrl);
      const link = document.createElement('a');
      link.href = finalUrl;
      link.download = `Edited-${item.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showAlert('Foto berhasil diunduh', 'success');
    } catch (err) {
      showAlert('Gagal mengunduh foto');
    }
  };

  const handleDownloadAll = async () => {
    if (!canSave) {
      showAlert('Role Anda tidak memiliki izin simpan foto.', 'info');
      return;
    }
    showAlert('Menyiapkan semua foto...', 'info');
    for (let i = 0; i < selectedFiles.length; i++) {
      const item = selectedFiles[i];
      try {
        const finalUrl = await applyEffects(item.fileData, watermarkUrl);
        const link = document.createElement('a');
        link.href = finalUrl;
        link.download = `Edited-${item.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error("Download error:", err);
      }
    }
    showAlert(`Berhasil mendownload ${selectedFiles.length} foto`, 'success');
  };

  const handleResetAllSettings = () => {
    if (!canResetSettings) {
      showAlert('Role Anda tidak memiliki izin reset pengaturan.', 'info');
      return;
    }
    resetAdjust();
    resetAI();
    resetFilter();
    resetWatermark();
    resetRelight();
    showAlert('Semua pengaturan berhasil direset', 'success');
  };

  const handleRemoveSpecificFile = (index: number) => {
    if (!canDelete) {
      showAlert('Role Anda tidak memiliki izin hapus foto.', 'info');
      return;
    }
    setSelectedFiles(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setProcessedPreviews(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    
    // Adjust activePreviewIndex for desktop
    if (activePreviewIndex >= index && activePreviewIndex > 0) {
      setActivePreviewIndex(prev => prev - 1);
    }
    
    setActivePhotoId(null);
  };

  const handleDesktopPrev = () => {
    setActivePreviewIndex((prev) => {
      if (processedPreviews.length === 0) return 0;
      return prev === 0 ? processedPreviews.length - 1 : prev - 1;
    });
    setDesktopZoom(1);
    setDesktopPan({ x: 0, y: 0 });
  };

  const handleDesktopNext = () => {
    setActivePreviewIndex((prev) => {
      if (processedPreviews.length === 0) return 0;
      return prev === processedPreviews.length - 1 ? 0 : prev + 1;
    });
    setDesktopZoom(1);
    setDesktopPan({ x: 0, y: 0 });
  };

  const handleDesktopZoomIn = () => {
    setDesktopZoom((prev) => Math.min(prev + 0.2, 3));
  };

  const handleDesktopZoomOut = () => {
    setDesktopZoom((prev) => Math.max(prev - 0.2, 0.6));
  };

  const handleDesktopFullscreen = async () => {
    if (!desktopPreviewRef.current) return;
    if (!document.fullscreenElement) {
      await desktopPreviewRef.current.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  };

  const handleDesktopPanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentDesktopPreview) return;
    e.preventDefault();
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOriginRef.current = { ...desktopPan };
    setIsDesktopPanning(true);
  };

  const getPanBounds = () => {
    const rect = desktopPreviewRef.current?.getBoundingClientRect();
    if (!rect) return { maxX: 0, maxY: 0 };
    const maxX = Math.max(0, (rect.width * (desktopZoom - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (desktopZoom - 1)) / 2);
    return { maxX, maxY };
  };

  const clampPan = (x: number, y: number) => {
    const { maxX, maxY } = getPanBounds();
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const startDesktopZoomHold = (direction: 'in' | 'out') => {
    if (zoomHoldIntervalRef.current !== null) {
      window.clearInterval(zoomHoldIntervalRef.current);
    }
    if (direction === 'in') handleDesktopZoomIn();
    if (direction === 'out') handleDesktopZoomOut();
    zoomHoldIntervalRef.current = window.setInterval(() => {
      if (direction === 'in') handleDesktopZoomIn();
      if (direction === 'out') handleDesktopZoomOut();
    }, 90);
  };

  const stopDesktopZoomHold = () => {
    if (zoomHoldIntervalRef.current !== null) {
      window.clearInterval(zoomHoldIntervalRef.current);
      zoomHoldIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (processedPreviews.length === 0) {
      setActivePreviewIndex(0);
      return;
    }
    if (activePreviewIndex > processedPreviews.length - 1) {
      setActivePreviewIndex(processedPreviews.length - 1);
    }
  }, [processedPreviews.length, activePreviewIndex]);

  useEffect(() => {
    return () => stopDesktopZoomHold();
  }, []);

  useEffect(() => {
    if (!isDesktopPanning) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const nextPan = clampPan(panOriginRef.current.x + dx, panOriginRef.current.y + dy);
      setDesktopPan(nextPan);
    };
    const handleMouseUp = () => setIsDesktopPanning(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDesktopPanning]);

  useEffect(() => {
    setDesktopPan({ x: 0, y: 0 });
  }, [activePreviewIndex]);

  useEffect(() => {
    setDesktopPan((prev) => {
      if (desktopZoom <= 1) return { x: 0, y: 0 };
      return clampPan(prev.x, prev.y);
    });
  }, [desktopZoom]);

  const currentDesktopPreview = processedPreviews[activePreviewIndex] ?? processedPreviews[0] ?? null;

  if (!canView) return <div className="flex flex-col items-center justify-center py-20 px-4"><AlertCircle className="text-red-500 mb-4" size={40} /><h3 className="font-semibold text-gray-700">Akses Dibatasi</h3></div>;

  if (isDesktop) {
    return (
      <div className="fixed inset-0 top-[74px] bottom-[80px] bg-[#F8F9FE] flex items-stretch justify-center p-6 gap-6 z-[50] overflow-hidden">
            {/* Left Sidebar: Pilih Foto Only */}
            <div className="w-[280px] bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-md">
                <div className="flex items-center gap-2 text-gray-800 font-bold">
                  <Upload size={18} className="text-indigo-500" />
                  <span>Pilih Foto</span>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canUpload}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {processedPreviews.map((preview, idx) => (
                  <div 
                    key={preview.id}
                    draggable={canReorder}
                    onDragStart={() => setDraggedPhotoIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handlePhotoDropReorder(idx)}
                    onDragEnd={() => setDraggedPhotoIndex(null)}
                    onClick={() => setActivePreviewIndex(idx)}
                    className={`flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                      activePreviewIndex === idx ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="relative">
                      <img src={preview.previewUrl} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800 truncate">{preview.title}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveSpecificFile(idx); }}
                        disabled={!canDelete}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDownloadSingle(idx); }}
                        disabled={!canSave}
                        className="p-1 text-gray-300 hover:text-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {processedPreviews.length === 0 && (
                  <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                    <ImageIcon size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400">Belum ada foto</p>
                  </div>
                )}
              </div>
            </div>

            {/* Main Area: Preview Area */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
              <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handleFileSelection} />
              
              {/* Large Preview Area */}
              <div className="flex-1 flex flex-col min-h-0">
                <div
                  ref={desktopPreviewRef}
                  onMouseDown={handleDesktopPanStart}
                  onWheel={(e) => {
                    if (!currentDesktopPreview) return;
                    e.preventDefault();
                    if (e.deltaY < 0) {
                      handleDesktopZoomOut();
                    } else {
                      handleDesktopZoomIn();
                    }
                  }}
                  className={`group flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex items-center justify-center p-3 relative transition-colors ${
                    isDesktopPanning ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                >
                  {currentDesktopPreview ? (
                    <>
                      <img 
                        src={currentDesktopPreview.previewUrl} 
                        className="w-full h-full object-contain transition-transform duration-300" 
                        style={{ transform: `translate(${desktopPan.x}px, ${desktopPan.y}px) scale(${desktopZoom})` }}
                        draggable={false}
                        alt="Main Preview"
                      />

                      <button
                        onClick={handleDesktopPrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={handleDesktopNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60"
                      >
                        <ChevronRight size={18} />
                      </button>

                      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-2 rounded-2xl flex items-center gap-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onMouseDown={() => startDesktopZoomHold('out')}
                          onMouseUp={stopDesktopZoomHold}
                          onMouseLeave={stopDesktopZoomHold}
                          onTouchStart={() => startDesktopZoomHold('out')}
                          onTouchEnd={stopDesktopZoomHold}
                          className="hover:text-indigo-300 transition-colors"
                        >
                          <ZoomOut size={18} />
                        </button>
                        <button
                          onMouseDown={() => startDesktopZoomHold('in')}
                          onMouseUp={stopDesktopZoomHold}
                          onMouseLeave={stopDesktopZoomHold}
                          onTouchStart={() => startDesktopZoomHold('in')}
                          onTouchEnd={stopDesktopZoomHold}
                          className="hover:text-indigo-300 transition-colors"
                        >
                          <ZoomIn size={18} />
                        </button>
                        <button onClick={handleDesktopFullscreen} className="hover:text-indigo-300 transition-colors"><Maximize size={18} /></button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-gray-300">
                      <ImageIcon size={64} className="opacity-20" />
                      <p className="font-medium">Pilih foto untuk mulai mengedit</p>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!canUpload}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold shadow-lg shadow-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Pilih Foto
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Thumbnail Strip (Moved here from Right Sidebar) */}
              <div className="h-32 flex-none flex gap-3 overflow-x-auto no-scrollbar p-2">
                {processedPreviews.map((preview, idx) => (
                  <button 
                    key={preview.id}
                    onClick={() => setActivePreviewIndex(idx)}
                    className={`flex-none w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all ${
                      activePreviewIndex === idx ? 'border-indigo-500 scale-105 shadow-lg' : 'border-white hover:border-gray-200'
                    }`}
                  >
                    <img src={preview.previewUrl} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right Tools Sidebar */}
            <div className="w-[380px] bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                {/* Top Action Buttons */}
                <div className="p-4 border-b border-gray-100 flex gap-3 bg-gray-50/30">
                  <button 
                    onClick={handleDownloadAll}
                    disabled={!canSave || selectedFiles.length === 0}
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-[13px] shadow-lg shadow-indigo-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Simpan Semua
                  </button>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <button 
                      onClick={() => { 
                        if (confirm('Hapus semua foto?')) {
                          setSelectedFiles([]); 
                          setProcessedPreviews([]); 
                          resetAdjust();
                          resetFilter();
                          resetWatermark();
                          resetRelight();
                        }
                      }}
                      disabled={!canDelete || selectedFiles.length === 0}
                      className="w-full bg-red-500 text-white py-2.5 rounded-xl font-bold text-[13px] shadow-lg shadow-red-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Hapus Semua
                    </button>
                    <button
                      onClick={handleResetAllSettings}
                      disabled={!canResetSettings}
                      className="w-full py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold text-[10px] border border-gray-200 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Reset semua pengaturan"
                    >
                      Reset Setting
                    </button>
                  </div>
                </div>

                {/* Accordion Panels */}
                <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2 ${!canEditSettings ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Panel id="watermark" title="Watermark" icon={<Layers size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
                    <div className="space-y-5 pb-4">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Aktifkan Watermark</span>
                        <button 
                          onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${watermarkEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${watermarkEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      <div className={`space-y-5 transition-opacity duration-300 ${watermarkEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div className="flex items-center gap-3">
                          <label className="flex-1 flex items-center justify-center h-16 border-2 border-dashed border-gray-100 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                            {watermarkUrl ? (
                              <img src={watermarkUrl} alt="Watermark" className="max-h-full object-contain p-2" />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Upload size={14} className="text-gray-400" />
                                <span className="text-[8px] font-bold text-gray-400">Pilih Logo</span>
                              </div>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0];
                              if(f) {
                                const r = new FileReader();
                                r.onload = (ev) => setWatermarkUrl(ev.target?.result as string);
                                r.readAsDataURL(f);
                              }
                            }} />
                          </label>
                          {watermarkUrl && watermarkUrl !== '/watermark.png' && (
                            <button onClick={() => setWatermarkUrl('/watermark.png')} className="p-3 bg-red-50 text-red-500 rounded-xl active:scale-90">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Posisi</span>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { id: 'top-left', label: 'Atas Kiri' }, { id: 'top-center', label: 'Atas Tengah' }, { id: 'top-right', label: 'Atas Kanan' },
                                { id: 'bottom-left', label: 'Bawah Kiri' }, { id: 'bottom-center', label: 'Bawah Tengah' }, { id: 'bottom-right', label: 'Bawah Kanan' },
                                { id: 'center', label: 'Tengah' }
                              ].map(pos => (
                                <button 
                                  key={pos.id} 
                                  onClick={() => setWatermarkPosition(pos.id as any)}
                                  className={`py-1.5 rounded-lg text-[8px] font-bold border transition-all ${
                                    watermarkPosition === pos.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-100'
                                  }`}
                                >
                                  {pos.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Ukuran</span>
                            <input type="range" min="0.05" max="0.5" step="0.05" value={watermarkSize} onChange={(e) => setWatermarkSize(parseFloat(e.target.value))} className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                            <span className="text-[11px] font-black text-indigo-500 w-8 text-right">{Math.round(watermarkSize * 100)}%</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Transparansi</span>
                            <input type="range" min="0" max="1" step="0.01" value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))} className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                            <span className="text-[11px] font-black text-indigo-500 w-8 text-right">{Math.round(watermarkOpacity * 100)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button onClick={resetWatermark} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          <RotateCcw size={12} />
                          Reset
                        </button>
                      </div>
                    </div>
                  </Panel>

                  <Panel id="adjust" title="Penyesuaian" icon={<Sliders size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
                    <div className="space-y-4 pb-4">
                      {[
                        { label: 'Kecerahan', val: filterBrightness, set: setFilterBrightness, max: 200 },
                        { label: 'Kontras', val: filterContrast, set: setFilterContrast, max: 200 },
                        { label: 'Saturasi', val: filterSaturate, set: setFilterSaturate, max: 200 },
                        { label: 'Grayscale', val: filterGrayscale, set: setFilterGrayscale, max: 100 },
                        { label: 'Sepia', val: filterSepia, set: setFilterSepia, max: 100 }
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">{item.label}</span>
                          <input 
                            type="range" min="0" max={item.max} 
                            value={item.val} 
                            onChange={(e) => item.set(parseInt(e.target.value))} 
                            className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                          />
                          <span className="text-[11px] font-black text-indigo-500 w-8 text-right">{item.val}</span>
                        </div>
                      ))}
                      <div className="flex justify-end pt-2">
                        <button onClick={resetAdjust} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          <RotateCcw size={12} />
                          Reset
                        </button>
                      </div>
                    </div>
                  </Panel>

                  <Panel id="ai" title="AI" icon={<Sparkles size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
                    <div className="space-y-4 pb-4">
                      {[
                        { label: 'Mulus', val: filterSmooth, set: setFilterSmooth, max: 100 },
                        { label: 'Cerah', val: filterSkinBright, set: setFilterSkinBright, max: 100 },
                        { label: 'Rata', val: filterSkinTone, set: setFilterSkinTone, max: 100 },
                        { label: 'HD Mode', val: filterSharpness, set: setFilterSharpness, max: 100 }
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">{item.label}</span>
                          <input 
                            type="range" min="0" max={item.max} 
                            value={item.val} 
                            onChange={(e) => item.set(parseInt(e.target.value))} 
                            className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                          />
                          <span className="text-[11px] font-black text-indigo-500 w-8 text-right">{item.val}</span>
                        </div>
                      ))}

                      {/* Sky Color Control */}
                      <div className="flex flex-col gap-3 pt-2 border-t border-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-24 shrink-0 flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={skyColorEnabled} 
                              onChange={(e) => setSkyColorEnabled(e.target.checked)}
                              className="w-4 h-4 accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-gray-600">Warna Awan</span>
                          </div>
                          <div className={`flex gap-2 flex-1 transition-opacity ${skyColorEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                            {['#87CEEB', '#00BFFF', '#4682B4', '#FFB6C1', '#DDA0DD', '#F0E68C'].map(color => (
                              <button 
                                key={color} 
                                onClick={() => setFilterSkyColor(color)}
                                className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-90 ${filterSkyColor === color ? 'border-indigo-600 scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            <input 
                              type="color" 
                              value={filterSkyColor} 
                              onChange={(e) => setFilterSkyColor(e.target.value)}
                              className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer overflow-hidden rounded-full"
                            />
                          </div>
                        </div>
                        <div className={`space-y-3 transition-opacity ${skyColorEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Pekat Awan</span>
                            <input 
                              type="range" min="0" max="100" 
                              value={filterSkyIntensity} 
                              onChange={(e) => setFilterSkyIntensity(parseInt(e.target.value))} 
                              className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                            />
                            <span className="text-[11px] font-black text-indigo-500 w-8 text-right">{filterSkyIntensity}%</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Kecerahan Awan</span>
                            <input 
                              type="range" min="0" max="200" 
                              value={filterSkyBrightness} 
                              onChange={(e) => setFilterSkyBrightness(parseInt(e.target.value))} 
                              className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                            />
                            <span className="text-[11px] font-black text-indigo-500 w-8 text-right">{filterSkyBrightness}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button onClick={resetAI} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          <RotateCcw size={12} />
                          Reset
                        </button>
                      </div>
                    </div>
                  </Panel>

                  <Panel id="filter" title="Filter" icon={<Sun size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
                    <div className="space-y-4 pb-4">
                      <div className="grid grid-cols-4 gap-2">
                        {(['warm', 'cool', 'vintage', 'vivid', 'bw', 'ocean', 'sunset', 'forest', 'art', 'sketch', 'oil_painting', 'pop_art'] as ColorizeStyle[]).map(style => (
                          <button 
                            key={style} 
                            onClick={() => setColorizeStyle(style)} 
                            className={`py-2 rounded-xl text-[8px] font-bold capitalize transition-all border ${
                              colorizeStyle === style ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                        <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Intensitas</span>
                        <input 
                          type="range" min="0" max="100" 
                          value={colorizeIntensity} 
                          onChange={(e) => setColorizeIntensity(parseInt(e.target.value))} 
                          className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                        />
                        <span className="text-[11px] font-black text-indigo-500 w-8 text-right">{colorizeIntensity}%</span>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button onClick={resetFilter} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          <RotateCcw size={12} />
                          Reset
                        </button>
                      </div>
                    </div>
                  </Panel>

                  <Panel id="relight" title="Pencahayaan" icon={<Sun size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
                    <div className="space-y-5 pb-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Arah Cahaya</span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {RELIGHTING_DIRECTIONS.map(dir => (
                            <button 
                              key={dir.id} 
                              onClick={() => toggleRelightDir(dir.id)} 
                              className={`py-1.5 rounded-lg text-[8px] font-bold border transition-all ${
                                relightDirs.includes(dir.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-100'
                              }`}
                            >
                              {dir.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Intensitas</span>
                          <input type="range" min="0" max="100" value={relightIntensity} onChange={(e) => setRelightIntensity(parseInt(e.target.value))} className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                          <span className="text-[11px] font-black text-indigo-500 w-8 text-right">{relightIntensity}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Kehangatan</span>
                          <input type="range" min="0" max="100" value={relightWarmth} onChange={(e) => setRelightWarmth(parseInt(e.target.value))} className="flex-1 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                          <span className="text-[11px] font-black text-indigo-500 w-8 text-right">+{relightWarmth}</span>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button onClick={resetRelight} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          <RotateCcw size={12} />
                          Reset
                        </button>
                      </div>
                    </div>
                  </Panel>
                </div>

              </div>
            </div>
    );
  }

  // Original Mobile Layout
  return (
    <div 
      className="fixed left-0 right-0 bg-white flex flex-col overflow-hidden z-[50]"
      style={{ 
        top: '74px', // Tambahkan 2px untuk mengimbangi border-b-2 yang baru
        bottom: '80px', 
        overscrollBehaviorY: 'contain'
      }}
      onClick={() => setActivePhotoId(null)}
    >
      {/* Top Border line under header - Removed duplicate or adjusted to match */}
      <div className="w-full h-[0px] bg-gray-100 flex-none" />

      {/* Top 56%: Preview Grid */}
      <div className="h-[56%] flex flex-col p-4 overflow-hidden bg-gray-50/50">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {processingPreviews && processedPreviews.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Memuat...</p>
            </div>
          ) : processedPreviews.length > 0 ? (
            <div className={`grid gap-2 pb-10 ${
              processedPreviews.length === 1 ? 'grid-cols-1 h-full' :
              processedPreviews.length === 2 ? 'grid-cols-2' : 
              processedPreviews.length === 3 ? 'grid-cols-3' :
              'grid-cols-3'
            }`}>
              {processedPreviews.map((preview, index) => (
                <div 
                  key={preview.id} 
                  className={`relative group bg-gray-100/50 rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-pointer ${
                    processedPreviews.length === 1 ? 'h-full flex items-center justify-center' : 
                    'aspect-square'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoId(activePhotoId === preview.id ? null : preview.id);
                  }}
                >
                  <img src={preview.previewUrl} alt="Preview" className="w-full h-full object-contain" />
                  
                  {/* Action Buttons - Centered Row, smaller and only on click */}
                  <AnimatePresence>
                    {activePhotoId === preview.id && (
                      <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button 
                          onClick={() => handleRemoveSpecificFile(index)}
                          disabled={!canDelete}
                          className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDownloadSingle(index)}
                          disabled={!canSave}
                          className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                        >
                          <Download size={16} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <ImageIcon size={40} className="opacity-20" />
              <p className="italic text-sm">Belum ada foto dipilih</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom 44%: Tools */}
      <div className="h-[44%] bg-white border-t border-gray-100 flex flex-col overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom)]">
        {/* Row 1: Action Buttons */}
        <div className="p-2 flex items-center justify-between gap-2 border-b border-gray-50">
          <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handleFileSelection} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={!canUpload}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-white border border-gray-200 text-gray-700 py-1.5 rounded-xl active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Camera size={15} className="text-indigo-500" />
            <span className="text-[9px] font-bold">Foto</span>
          </button>

          <button 
            onClick={handleDownloadAll}
            disabled={!canSave || selectedFiles.length === 0}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-indigo-600 text-white py-1.5 rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            <Download size={15} />
            <span className="text-[9px] font-bold">Simpan</span>
          </button>
          
          <button 
            onClick={() => { 
              if (confirm('Hapus semua foto?')) {
                setSelectedFiles([]); 
                setProcessedPreviews([]); 
                resetAdjust();
                resetFilter();
                resetWatermark();
                resetRelight();
              }
            }}
            disabled={!canDelete || selectedFiles.length === 0}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-white border border-gray-200 text-gray-700 py-1.5 rounded-xl active:scale-95 transition-all shadow-sm disabled:opacity-30"
          >
            <Trash2 size={15} className="text-red-500" />
            <span className="text-[9px] font-bold">Hapus</span>
          </button>
        </div>

        {/* Row 2-3: Accordion Panels */}
        <div className={`flex-1 overflow-y-auto p-3 custom-scrollbar bg-white relative space-y-2 ${!canEditSettings ? 'opacity-50 pointer-events-none' : ''}`}>
          <Panel id="watermark" title="Watermark" icon={<Layers size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
            <div className="space-y-5 pb-4">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Aktifkan Watermark</span>
                <button 
                  onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${watermarkEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${watermarkEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className={`space-y-5 transition-opacity duration-300 ${watermarkEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center h-16 border-2 border-dashed border-gray-100 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                  {watermarkUrl ? (
                    <img src={watermarkUrl} alt="Watermark" className="max-h-full object-contain p-2" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload size={14} className="text-gray-400" />
                      <span className="text-[8px] font-bold text-gray-400">Pilih Logo</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if(f) {
                      const r = new FileReader();
                      r.onload = (ev) => setWatermarkUrl(ev.target?.result as string);
                      r.readAsDataURL(f);
                    }
                  }} />
                </label>
                {watermarkUrl && watermarkUrl !== '/watermark.png' && (
                  <button onClick={() => setWatermarkUrl('/watermark.png')} className="p-3 bg-red-50 text-red-500 rounded-xl active:scale-90">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Posisi</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'top-left', label: 'Atas Kiri' }, { id: 'top-center', label: 'Atas Tengah' }, { id: 'top-right', label: 'Atas Kanan' },
                      { id: 'bottom-left', label: 'Bawah Kiri' }, { id: 'bottom-center', label: 'Bawah Tengah' }, { id: 'bottom-right', label: 'Bawah Kanan' },
                      { id: 'center', label: 'Tengah' }
                    ].map(pos => (
                      <button 
                        key={pos.id} 
                        onClick={() => setWatermarkPosition(pos.id as any)}
                        className={`py-1.5 rounded-lg text-[8px] font-bold border transition-all ${
                          watermarkPosition === pos.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-100'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Ukuran</span>
                  <input type="range" min="0.05" max="0.5" step="0.05" value={watermarkSize} onChange={(e) => setWatermarkSize(parseFloat(e.target.value))} className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                  <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">{Math.round(watermarkSize * 100)}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Transparansi</span>
                  <input type="range" min="0" max="1" step="0.01" value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))} className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                  <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">{Math.round(watermarkOpacity * 100)}%</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={resetWatermark} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <RotateCcw size={12} />
                Reset
              </button>
            </div>
          </div>
          </Panel>

          <Panel id="adjust" title="Penyesuaian" icon={<Sliders size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
            <div className="space-y-4 pb-4">
              {[
                { label: 'Kecerahan', val: filterBrightness, set: setFilterBrightness, max: 200 },
                { label: 'Kontras', val: filterContrast, set: setFilterContrast, max: 200 },
                { label: 'Saturasi', val: filterSaturate, set: setFilterSaturate, max: 200 },
                { label: 'Grayscale', val: filterGrayscale, set: setFilterGrayscale, max: 100 },
                { label: 'Sepia', val: filterSepia, set: setFilterSepia, max: 100 }
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">{item.label}</span>
                  <input 
                    type="range" min="0" max={item.max} 
                    value={item.val} 
                    onChange={(e) => item.set(parseInt(e.target.value))} 
                    className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                  />
                  <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">{item.val}</span>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <button onClick={resetAdjust} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <RotateCcw size={12} />
                  Reset
                </button>
              </div>
            </div>
          </Panel>

          <Panel id="ai" title="AI" icon={<Sparkles size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
            <div className="space-y-4 pb-4">
              {[
                { label: 'Mulus', val: filterSmooth, set: setFilterSmooth, max: 100 },
                { label: 'Cerah', val: filterSkinBright, set: setFilterSkinBright, max: 100 },
                { label: 'Rata', val: filterSkinTone, set: setFilterSkinTone, max: 100 },
                { label: 'HD Mode', val: filterSharpness, set: setFilterSharpness, max: 100 }
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">{item.label}</span>
                  <input 
                    type="range" min="0" max={item.max} 
                    value={item.val} 
                    onChange={(e) => item.set(parseInt(e.target.value))} 
                    className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                  />
                  <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">{item.val}</span>
                </div>
              ))}

              {/* Sky Color Control */}
              <div className="flex flex-col gap-3 pt-2 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-24 shrink-0 flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={skyColorEnabled} 
                      onChange={(e) => setSkyColorEnabled(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-[11px] font-bold text-gray-600">Warna Awan</span>
                  </div>
                  <div className={`flex gap-2 flex-1 transition-opacity ${skyColorEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    {['#87CEEB', '#00BFFF', '#4682B4', '#FFB6C1', '#DDA0DD', '#F0E68C'].map(color => (
                      <button 
                        key={color} 
                        onClick={() => setFilterSkyColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-90 ${filterSkyColor === color ? 'border-indigo-600 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input 
                      type="color" 
                      value={filterSkyColor} 
                      onChange={(e) => setFilterSkyColor(e.target.value)}
                      className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer overflow-hidden rounded-full"
                    />
                  </div>
                </div>
                <div className={`space-y-3 transition-opacity ${skyColorEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Pekat Awan</span>
                    <input 
                      type="range" min="0" max="100" 
                      value={filterSkyIntensity} 
                      onChange={(e) => setFilterSkyIntensity(parseInt(e.target.value))} 
                      className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                    />
                    <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">{filterSkyIntensity}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Kecerahan Awan</span>
                    <input 
                      type="range" min="0" max="200" 
                      value={filterSkyBrightness} 
                      onChange={(e) => setFilterSkyBrightness(parseInt(e.target.value))} 
                      className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                    />
                    <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">{filterSkyBrightness}%</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={resetAI} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <RotateCcw size={12} />
                  Reset
                </button>
              </div>
            </div>
          </Panel>

          <Panel id="filter" title="Filter" icon={<Sun size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-4 gap-2">
                {(['warm', 'cool', 'vintage', 'vivid', 'bw', 'ocean', 'sunset', 'forest', 'art', 'sketch', 'oil_painting', 'pop_art'] as ColorizeStyle[]).map(style => (
                  <button 
                    key={style} 
                    onClick={() => setColorizeStyle(style)} 
                    className={`py-2 rounded-xl text-[8px] font-bold capitalize transition-all border ${
                      colorizeStyle === style ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 text-gray-500 border-gray-100'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Intensitas</span>
                <input 
                  type="range" min="0" max="100" 
                  value={colorizeIntensity} 
                  onChange={(e) => setColorizeIntensity(parseInt(e.target.value))} 
                  className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                />
                <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">{colorizeIntensity}%</span>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={resetFilter} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <RotateCcw size={12} />
                  Reset
                </button>
              </div>
            </div>
          </Panel>

          <Panel id="relight" title="Pencahayaan" icon={<Sun size={16} className="text-indigo-500" />} openPanel={openPanel} setOpenPanel={setOpenPanel}>
            <div className="space-y-5 pb-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Arah Cahaya</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {RELIGHTING_DIRECTIONS.map(dir => (
                    <button 
                      key={dir.id} 
                      onClick={() => toggleRelightDir(dir.id)} 
                      className={`py-1.5 rounded-lg text-[8px] font-bold border transition-all ${
                        relightDirs.includes(dir.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-100'
                      }`}
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Intensitas</span>
                  <input type="range" min="0" max="100" value={relightIntensity} onChange={(e) => setRelightIntensity(parseInt(e.target.value))} className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                  <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">{relightIntensity}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-600 w-24 shrink-0">Kehangatan</span>
                  <input type="range" min="0" max="100" value={relightWarmth} onChange={(e) => setRelightWarmth(parseInt(e.target.value))} className="w-40 accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                  <span className="text-[11px] font-black text-indigo-500 flex-1 text-right">+{relightWarmth}</span>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={resetRelight} disabled={!canResetSettings} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <RotateCcw size={12} />
                  Reset
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};