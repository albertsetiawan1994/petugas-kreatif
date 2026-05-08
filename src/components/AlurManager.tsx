import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layers, Plus, Check, X, Edit2, Trash2, Settings2, Download, Loader2 } from 'lucide-react';
import { dbService } from '../services/db';
import { showAlert } from '../services/alertService';
import { ConfirmModal } from './ConfirmModal';
import { toPng } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import JSZip from 'jszip';

const MASA_LIST = [
  'Adven',
  'Arwah',
  'Biasa',
  'Hari Raya',
  'Natal',
  'Para Kudus',
  'Paskah',
  'Pekan Suci',
  'Prapaskah',
];

const MISA_MAPPING: Record<string, string[]> = {
  'Adven': [
    'Misa Minggu Adven',
    'Misa Minggu Adven II',
    'Minggu Adven III (Gaudette)',
    'Misa Minggu Adven IV',
    'Hari Biasa Adven I',
    'Hari Biasa Adven II',
    'Hari Biasa Adven III',
  ],
  'Natal': [
    'Misa Vigili Natal',
    'Misa Fajar Natal',
    'Misa Siang Natal',
    'Hari Raya Natal (Oktaf)',
    'St.Stefanus (Martir)',
    'St.Yohanes Rasul',
    'Kanak-Kanak Suci',
    'Hari Biasa Masa Natal',
    'Keluarga Kudus',
    'Maria Bunda Allah',
    'Epifani',
    'Pembaptisan Tuhan',
  ],
  'Biasa': [
    'Misa Minggu Biasa',
    'Misa Minggu Biasa II',
    'Misa Minggu Biasa III',
    'Misa Minggu Biasa IV',
    'Misa Minggu Biasa V',
    'Misa Minggu Biasa VI',
    'Misa Minggu Biasa VII',
    'Misa Minggu Biasa VIII',
    'Misa Minggu Biasa IX',
    'Misa Minggu Biasa X',
    'Misa Minggu Biasa XI',
    'Misa Minggu Biasa XII',
    'Misa Minggu Biasa XIII',
    'Misa Minggu Biasa XIV',
    'Misa Minggu Biasa XV',
    'Misa Minggu Biasa XVI',
    'Misa Minggu Biasa XVII',
    'Misa Minggu Biasa XVIII',
    'Misa Minggu Biasa XIX',
    'Misa Minggu Biasa XX',
    'Misa Minggu Biasa XXI',
    'Misa Minggu Biasa XXII',
    'Misa Minggu Biasa XXIII',
    'Misa Minggu Biasa XXIV',
    'Misa Minggu Biasa XXV',
    'Misa Minggu Biasa XXVI',
    'Misa Minggu Biasa XXVII',
    'Misa Minggu Biasa XXVIII',
    'Misa Minggu Biasa XXIX',
    'Misa Minggu Biasa XXX',
    'Misa Minggu Biasa XXXI',
    'Misa Minggu Biasa XXXII',
    'Misa Minggu Biasa XXXIII',
    'Misa Minggu Biasa XXXIV',
    'Hari Biasa',
    'Hari Biasa II',
    'Hari Biasa III',
    'Hari Biasa IV',
    'Hari Biasa V',
    'Hari Biasa VI',
    'Hari Biasa VII',
    'Hari Biasa VIII',
    'Hari Biasa IX',
    'Hari Biasa X',
    'Hari Biasa XI',
    'Hari Biasa XII',
    'Hari Biasa XIII',
    'Hari Biasa XIV',
    'Hari Biasa XV',
    'Hari Biasa XVI',
    'Hari Biasa XVII',
    'Hari Biasa XVIII',
    'Hari Biasa XIX',
    'Hari Biasa XX',
    'Hari Biasa XXI',
    'Hari Biasa XXII',
    'Hari Biasa XXIII',
    'Hari Biasa XXIV',
    'Hari Biasa XXV',
    'Hari Biasa XXVI',
    'Hari Biasa XXVII',
    'Hari Biasa XXVIII',
    'Hari Biasa XXIX',
    'Hari Biasa XXX',
    'Hari Biasa XXXI',
    'Hari Biasa XXXII',
    'Hari Biasa XXXIII',
    'Hari Biasa XXXIV',
  ],
  'Prapaskah': [
    'Misa Rabu Abu',
    'Misa Minggu Prapaskah',
    'Misa Minggu Prapaskah II',
    'Misa Minggu Prapaskah III',
    'Minggu Prapaskah IV (Laetare)',
    'Misa Minggu Prapaskah V',
    'Hari Biasa Prapaskah I',
    'Hari Biasa Prapaskah II',
    'Hari Biasa Prapaskah III',
    'Hari Biasa Prapaskah IV',
    'Hari Biasa Prapaskah V',
  ],
  'Pekan Suci': [
    'Misa Minggu Palma',
    'Hari Biasa Pekan Suci',
    'Misa Kamis Putih',
    'Misa Jumat Agung',
    'Misa Sabtu Suci',
  ],
  'Paskah': [
    'Misa Vigili Paskah',
    'Misa Minggu Paskah',
    'Misa Minggu Paskah II',
    'Misa Minggu Paskah III',
    'Misa Minggu Paskah IV',
    'Misa Minggu Paskah V',
    'Misa Minggu Paskah VI',
    'Misa Minggu Paskah VII',
    'Hari Biasa Pekan Paskah',
    'Hari Biasa Pekan Paskah II',
    'Hari Biasa Pekan Paskah III',
    'Hari Biasa Pekan Paskah IV',
    'Hari Biasa Pekan Paskah V',
    'Hari Biasa Pekan Paskah VI',
    'Hari Biasa Pekan Paskah VII',
    'Misa Oktaf Paskah',
    'Misa Kenaikan Tuhan',
    'Misa Vigili Pentakosta',
    'Hari Raya Pentakosta',
  ],
  'Hari Raya': [
    'Misa Tritunggal Mahakudus',
    'Misa Tubuh & Darah Kristus',
    'Misa Hati Yesus Mahakudus',
    'Misa Kristus Raja',
  ],
  'Para Kudus': [
    'Misa Rasul/Martir',
    'Misa Kudus non martir',
    'Misa Santa Perawan',
  ],
  'Arwah': [
    'Hari Arwah',
    'Misa Arwah',
  ],
};

interface AlurManagerProps {
  canAddHomili?: boolean;
  canEditHomili?: boolean;
  canDeleteHomili?: boolean;
}

const AlurManager: React.FC<AlurManagerProps> = ({ canAddHomili, canEditHomili, canDeleteHomili }) => {
  const [selectedMasa, setSelectedMasa] = useState<string>('');
  const [selectedMisa, setSelectedMisa] = useState<string>('');
  const [misaMapping, setMisaMapping] = useState<Record<string, string[]>>({});
  const [bacaan1, setBacaan1] = useState<string>('');
  const [mazmur, setMazmur] = useState<string>('');
  const [bacaan2, setBacaan2] = useState<string>('');
  const [bacaanInjil, setBacaanInjil] = useState<string>('');
  const [selectedHomili, setSelectedHomili] = useState<string>('');
  const [newHomili, setNewHomili] = useState<string>('');
  const [isAddingHomili, setIsAddingHomili] = useState<boolean>(false);
  const [isManagingHomili, setIsManagingHomili] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadStep, setDownloadStep] = useState<{current: number, total: number, name: string} | null>(null);
  const [downloadPreview, setDownloadPreview] = useState<{title: string, subtitle: string} | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [editingHomili, setEditingHomili] = useState<{ oldName: string, newName: string } | null>(null);
  const [deleteTargetHomili, setDeleteTargetHomili] = useState<string | null>(null);
  const [homiliOptions, setHomiliOptions] = useState<string[]>([]);
  const editInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingHomili && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingHomili]);

  useEffect(() => {
    const fetchMassNames = async () => {
      // Initialize if empty
      await dbService.initializeMassNames(MISA_MAPPING);
      
      const names = await dbService.getAllMassNames();
      const mapping: Record<string, string[]> = {};
      names.forEach(m => {
        if (!mapping[m.masa]) mapping[m.masa] = [];
        mapping[m.masa].push(m.name);
      });
      
      // Sort names within each masa
      Object.keys(mapping).forEach(masa => {
        mapping[masa].sort((a, b) => a.localeCompare(b));
      });
      
      setMisaMapping(mapping);

      const dbHomilies = await dbService.getHomilies();
      setHomiliOptions(dbHomilies);
    };
    fetchMassNames();
  }, []);

  const availableMisa = useMemo(() => {
    return selectedMasa ? misaMapping[selectedMasa] || [] : [];
  }, [selectedMasa, misaMapping]);

  const slides = useMemo(() => [
    { title: selectedMisa, subtitle: 'Ritus Pembukaan', fileName: '01-Ritus_Pembukaan', loadingName: 'Ritus Pembukaan' },
    { title: selectedMisa, subtitle: 'Tuhan Kasihanilah Kami', fileName: '02-Tuhan_Kasihanilah_Kami', loadingName: 'Tuhan Kasihanilah Kami' },
    { title: selectedMisa, subtitle: 'Kemuliaan', fileName: '03-Kemuliaan', loadingName: 'Kemuliaan' },
    { title: selectedMisa, subtitle: 'Doa Kolekta', fileName: '04-Doa_Kolekta', loadingName: 'Doa Kolekta' },
    { title: 'Bacaan I', subtitle: bacaan1, fileName: '5-Bacaan_I', loadingName: 'Bacaan I' },
    { title: 'Mazmur Tanggapan', subtitle: mazmur, fileName: '6-Mazmur_Tanggapan', loadingName: 'Mazmur Tanggapan' },
    { title: 'Bacaan II', subtitle: bacaan2, fileName: '7-Bacaan_II', loadingName: 'Bacaan II' },
    { title: selectedMisa, subtitle: 'Bait Pengantar Injil', fileName: '08-Bait_Pengantar_Injil', loadingName: 'Bait Pengantar Injil' },
    { title: 'Bacaan Injil', subtitle: bacaanInjil, fileName: '9-Bacaan_Injil', loadingName: 'Bacaan Injil' },
    { title: 'Homili', subtitle: selectedHomili ? selectedHomili.toUpperCase() : 'HOMILI', fileName: '10-Homili', loadingName: 'Homili' },
    { title: selectedMisa, subtitle: 'Aku Percaya', fileName: '11-Aku_Percaya', loadingName: 'Aku Percaya' },
    { title: selectedMisa, subtitle: 'Doa Umat', fileName: '12-Doa_Umat', loadingName: 'Doa Umat' },
    { title: selectedMisa, subtitle: 'Persembahan', fileName: '13-Persembahan', loadingName: 'Persembahan' },
    { title: selectedMisa, subtitle: 'Doa Syukur Agung', fileName: '14-Doa_Syukur_Agung', loadingName: 'Doa Syukur Agung' },
    { title: selectedMisa, subtitle: 'Bapa Kami', fileName: '15-Bapa_Kami', loadingName: 'Bapa Kami' },
    { title: selectedMisa, subtitle: 'Doa Damai', fileName: '16-Doa_Damai', loadingName: 'Doa Damai' },
    { title: selectedMisa, subtitle: 'Anak Domba Allah', fileName: '17-Anak_Domba_Allah', loadingName: 'Anak Domba Allah' },
    { title: selectedMisa, subtitle: 'Komuni', fileName: '18-Komuni', loadingName: 'Komuni' },
    { title: selectedMisa, subtitle: 'Doa Penutup', fileName: '19-Doa_Penutup', loadingName: 'Doa Penutup' },
    { title: selectedMisa, subtitle: 'Pengumuman', fileName: '20-Pengumuman', loadingName: 'Pengumuman' },
    { title: selectedMisa, subtitle: 'Berkat Penutup', fileName: '21-Berkat_Penutup', loadingName: 'Berkat Penutup' },
  ], [selectedMisa, bacaan1, mazmur, bacaan2, bacaanInjil, selectedHomili]);

  const bannerImage = useMemo(() => {
    if (!selectedMisa) return '';
    
    const misa = selectedMisa.trim();
    
    // abu.png
    const abuList = [
      'Misa Minggu Paskah', 'Misa Minggu Paskah II', 'Misa Minggu Paskah III', 
      'Misa Minggu Paskah IV', 'Misa Minggu Paskah V', 'Misa Minggu Paskah VI', 
      'Misa Minggu Paskah VII', 'Hari Biasa Pekan Paskah', 'Hari Biasa Pekan Paskah II', 
      'Hari Biasa Pekan Paskah III', 'Hari Biasa Pekan Paskah IV', 'Hari Biasa Pekan Paskah V', 
      'Hari Biasa Pekan Paskah VI', 'Hari Biasa Pekan Paskah VII'
    ];
    if (abuList.includes(misa)) return '/abu.png';
    
    // pink.png
    if (misa === 'Minggu Adven III (Gaudette)' || misa === 'Minggu Prapaskah IV (Laetare)') return '/pink.png';
    
    // merah.png
    const merahList = [
      'St. Stefanus (Martir)', 'Kanak-Kanak Suci', 'Misa Minggu Palma', 
      'Misa Jumat Agung', 'Misa Vigili Pentakosta', 'Hari Raya Pentakosta', 
      'Misa Rasul/Martir'
    ];
    if (merahList.includes(misa)) return '/merah.png';

    // putih.png
    const putihList = [
      'Misa Vigili Natal', 'Misa Fajar Natal', 'Misa Siang Natal', 'Hari Raya Natal (Oktaf)',
      'St. Yohanes Rasul', 'Hari Biasa Masa Natal', 'Keluarga Kudus', 'Maria Bunda Allah',
      'Epifani', 'Pembaptisan Tuhan', 'Misa Minggu Biasa XXXIV', 'Misa Kamis Putih',
      'Misa Sabtu Suci', 'Misa Vigili Paskah', 'Misa Oktaf Paskah', 'Misa Kenaikan Tuhan',
      'Misa Tritunggal Mahakudus', 'Misa Tubuh & Darah Kristus', 'Misa Hati Yesus Mahakudus',
      'Misa Kristus Raja', 'Misa Kudus non martir', 'Misa Santa Perawan'
    ];
    if (putihList.includes(misa)) return '/putih.png';
    
    // ungu.png
    const unguList = [
      'Misa Minggu Adven', 'Misa Minggu Adven II', 'Misa Minggu Adven IV',
      'Hari Biasa Adven I', 'Hari Biasa Adven II', 'Hari Biasa Adven III',
      'Misa Rabu Abu', 'Misa Minggu Prapaskah', 'Misa Minggu Prapaskah II',
      'Misa Minggu Prapaskah III', 'Misa Minggu Prapaskah V',
      'Hari Biasa Prapaskah I', 'Hari Biasa Prapaskah II', 'Hari Biasa Prapaskah III',
      'Hari Biasa Prapaskah IV', 'Hari Biasa Prapaskah V',
      'Hari Biasa Pekan Suci', 'Hari Arwah', 'Misa Arwah'
    ];
    if (unguList.includes(misa)) return '/ungu.png';
    
    // hijau.png (Default for Minggu Biasa / Hari Biasa)
    if (misa.includes('Biasa')) return '/hijau.png';
    
    return '/hijau.png'; // Default fallback
  }, [selectedMisa]);

  const isWhiteBanner = bannerImage === '/putih.png';
  const isPinkBanner = bannerImage === '/pink.png';
  const isRedBanner = bannerImage === '/merah.png';
  const isGreenBanner = bannerImage === '/hijau.png';
  const isPurpleBanner = bannerImage === '/ungu.png';
  const isGrayBanner = bannerImage === '/abu.png';

  // Bar colors with Gradients based on banner type
  const titleBarBg = useMemo(() => {
    if (isWhiteBanner) return 'linear-gradient(to right, #bdbdbd, #e0e0e0)'; // Silver/Gray from user image
    if (isPinkBanner) return 'linear-gradient(to right, #db2777, #f472b6)';
    if (isRedBanner) return 'linear-gradient(to right, #b91c1c, #ef4444)';
    if (isGreenBanner) return 'linear-gradient(to right, #15803d, #22c55e)';
    if (isPurpleBanner) return 'linear-gradient(to right, #581c87, #a855f7)';
    if (isGrayBanner) return 'linear-gradient(to right, #3f3f46, #a1a1aa)';
    return 'linear-gradient(to right, #1e3a8a, #3b82f6)';
  }, [isWhiteBanner, isPinkBanner, isRedBanner, isGreenBanner, isPurpleBanner, isGrayBanner]);

  const subBarBg = useMemo(() => {
    if (isWhiteBanner) return '#f8f8f8'; // Very light gray from user image
    if (isPinkBanner) return 'rgba(255, 241, 242, 0.95)';
    if (isRedBanner) return 'rgba(254, 242, 242, 0.95)';
    if (isGreenBanner) return '#dcf0d1'; // Light green from user image
    if (isPurpleBanner) return 'rgba(250, 245, 255, 0.95)';
    if (isGrayBanner) return 'rgba(244, 244, 245, 0.95)';
    return 'rgba(248, 250, 252, 0.95)';
  }, [isWhiteBanner, isPinkBanner, isRedBanner, isGreenBanner, isPurpleBanner, isGrayBanner]);

  const titleTextColor = useMemo(() => {
    if (isWhiteBanner) return '#1a1a1a'; // Darker text for silver title
    return '#ffffff';
  }, [isWhiteBanner]);

  const subBarTextColor = useMemo(() => {
    if (isWhiteBanner) return '#262626'; // Dark text for light bar
    if (isPinkBanner) return '#db2777'; // Pink 600
    if (isRedBanner) return '#b91c1c';
    if (isGreenBanner) return '#166534'; // Dark green text for light Green Bar
    if (isPurpleBanner) return '#7e22ce';
    if (isGrayBanner) return '#3f3f46';
    return '#334155';
  }, [isWhiteBanner, isPinkBanner, isRedBanner, isGreenBanner, isPurpleBanner, isGrayBanner]);

  const verticalBarBg = useMemo(() => {
    if (isWhiteBanner) return '#b0b0b0'; // Medium gray (Far left 1) from user image
    if (isPinkBanner) return '#881337';
    if (isRedBanner) return '#450a0a';
    if (isGreenBanner) return '#022c22'; // Darkest green for Far Left Bar
    if (isPurpleBanner) return '#3b0764';
    if (isGrayBanner) return '#27272a';
    return '#171717';
  }, [isWhiteBanner, isPinkBanner, isRedBanner, isGreenBanner, isPurpleBanner, isGrayBanner]);

  const secondaryVerticalBarBg = useMemo(() => {
    if (isWhiteBanner) return '#e5e5e5'; // Lighter gray (Far left 2) from user image
    if (isPinkBanner) return '#9f1239';
    if (isRedBanner) return '#7f1d1d';
    if (isGreenBanner) return '#166534'; // Medium green for Second Vertical Bar
    if (isPurpleBanner) return '#4c1d95';
    if (isGrayBanner) return '#52525b';
    return '#2e3a59';
  }, [isWhiteBanner, isPinkBanner, isRedBanner, isGreenBanner, isPurpleBanner, isGrayBanner]);

  const textColorClass = bannerImage 
    ? (isWhiteBanner ? 'text-indigo-950' : 'text-white drop-shadow-md') 
    : 'text-indigo-600';
  const titleColorClass = bannerImage 
    ? (isWhiteBanner ? 'text-indigo-900' : 'text-white drop-shadow-lg') 
    : 'text-indigo-900';
  const subColorClass = bannerImage 
    ? (isWhiteBanner ? 'text-indigo-700' : 'text-white/90 drop-shadow-md') 
    : 'text-indigo-500';
  const borderColorClass = bannerImage 
    ? (isWhiteBanner ? 'border-indigo-100' : 'border-white/30') 
    : 'border-indigo-100';
  const boxBgClass = bannerImage 
    ? (isWhiteBanner ? 'bg-white/60' : 'bg-white/20') 
    : 'bg-white';
  const labelColorClass = bannerImage 
    ? (isWhiteBanner ? 'text-indigo-400' : 'text-white') 
    : 'text-indigo-400';
  const valueColorClass = bannerImage 
    ? (isWhiteBanner ? 'text-indigo-900' : 'text-white') 
    : 'text-indigo-900';

  const handleMasaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMasa(e.target.value);
    setSelectedMisa(''); // Reset Misa when Masa changes
  };

  const handleAddHomili = async () => {
    if (!newHomili.trim()) return;
    try {
      await dbService.addHomily(newHomili.trim());
      setHomiliOptions(prev => [...prev, newHomili.trim()].sort((a, b) => a.localeCompare(b)));
      setSelectedHomili(newHomili.trim());
      setNewHomili('');
      setIsAddingHomili(false);
    } catch (error) {
      console.error('Failed to add homily:', error);
    }
  };

  const handleUpdateHomili = async () => {
    if (!editingHomili || !editingHomili.newName.trim()) return;
    try {
      await dbService.updateHomily(editingHomili.oldName, editingHomili.newName.trim());
      setHomiliOptions(prev => prev.map(h => h === editingHomili.oldName ? editingHomili.newName.trim() : h).sort((a, b) => a.localeCompare(b)));
      if (selectedHomili === editingHomili.oldName) {
        setSelectedHomili(editingHomili.newName.trim());
      }
      setEditingHomili(null);
    } catch (error) {
      console.error('Failed to update homily:', error);
    }
  };

  const handleDeleteHomili = (name: string) => {
    setDeleteTargetHomili(name);
  };

  const confirmDeleteHomili = async () => {
    if (!deleteTargetHomili) return;
    try {
      await dbService.deleteHomily(deleteTargetHomili);
      setHomiliOptions(prev => prev.filter(h => h !== deleteTargetHomili));
      if (selectedHomili === deleteTargetHomili) {
        setSelectedHomili('');
      }
      setDeleteTargetHomili(null);
    } catch (error) {
      console.error('Failed to delete homily:', error);
      showAlert('Gagal menghapus homili.');
    }
  };

  const handleDownload = async () => {
    if (!previewRef.current || !selectedMisa) return;
    setIsDownloading(true);
    
    const zip = new JSZip();

    setDownloadStep({ current: 0, total: slides.length, name: '' });

    try {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        // Casing logic: Mazmur is Title Case, others are UPPERCASE
        const isMazmur = slide.title.toUpperCase().includes('MAZMUR');
        const formattedTitle = slide.title.toUpperCase();
        const formattedSubtitle = isMazmur 
          ? slide.subtitle.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
          : slide.subtitle.toUpperCase();

        setDownloadStep({ current: i + 1, total: slides.length, name: formattedSubtitle });
        
        setDownloadPreview({ 
          title: formattedTitle, 
          subtitle: formattedSubtitle 
        });
        
        // Wait for React to render the new preview state - optimized for extreme speed
        await new Promise(resolve => setTimeout(resolve, 30));

        const dataUrl = await toPng(previewRef.current, {
          cacheBust: false, // Set to false for speed as content is controlled
          pixelRatio: 2,
          backgroundColor: 'transparent',
          skipAutoScale: true, // Optimasi kecepatan
          style: {
            background: 'transparent',
          }
        });

        setGeneratedImage(dataUrl);
        const base64Data = dataUrl.split(',')[1];
        zip.file(`${slide.fileName}.png`, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const zipFileName = `AlurMisa-${selectedMisa.replace(/\s+/g, '_')}.zip`;

      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(content);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          const savedFile = await Filesystem.writeFile({
            path: zipFileName,
            data: base64Data,
            directory: Directory.Documents,
          });

          await Share.share({
            title: 'Alur Misa',
            url: savedFile.uri,
            dialogTitle: 'Simpan Alur Misa'
          });
          
          // Clear data after sharing
          clearForm();
        };
      } else {
        const link = document.createElement('a');
        link.download = zipFileName;
        link.href = URL.createObjectURL(content);
        link.click();
        
        // Clear data after download
        clearForm();
        // Refresh page after download
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      console.error('Download error:', err);
      showAlert('Gagal mengunduh alur misa.');
    } finally {
      setIsDownloading(false);
      setDownloadStep(null);
      setDownloadPreview(null);
    }
  };

  const clearForm = () => {
    setSelectedMasa('');
    setSelectedMisa('');
    setBacaan1('');
    setMazmur('');
    setBacaan2('');
    setBacaanInjil('');
    setSelectedHomili('');
  };

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      {/* Homili Management Modal */}
      {isManagingHomili && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                  <Settings2 size={20} />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight">Kelola Daftar Homili</h3>
              </div>
              <button 
                onClick={() => {
                  setIsManagingHomili(false);
                  setEditingHomili(null);
                }}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
              {homiliOptions.map((homili) => (
                <div 
                  key={homili} 
                  className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    editingHomili?.oldName === homili 
                      ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/10' 
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  {editingHomili?.oldName === homili ? (
                    <div className="flex-1 flex gap-2 items-center">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingHomili.newName}
                        onChange={(e) => setEditingHomili({ ...editingHomili, newName: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateHomili()}
                        className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <button 
                        onClick={handleUpdateHomili}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => setEditingHomili(null)}
                        className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-gray-700">{homili}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEditHomili && (
                          <button 
                            onClick={() => setEditingHomili({ oldName: homili, newName: homili })}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDeleteHomili && (
                          <button 
                            onClick={() => handleDeleteHomili(homili)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={() => setIsManagingHomili(false)}
                className="w-full bg-slate-900 text-white py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Homili Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTargetHomili}
        title="Hapus Homili"
        message={`Apakah Anda yakin ingin menghapus "${deleteTargetHomili}" dari daftar homili? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={confirmDeleteHomili}
        onCancel={() => setDeleteTargetHomili(null)}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Masa Selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                Pilih Masa
              </label>
              <select
                value={selectedMasa}
                onChange={handleMasaChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
              >
                <option value="">-- Pilih Masa --</option>
                {MASA_LIST.map((masa) => (
                  <option key={masa} value={masa}>
                    {masa}
                  </option>
                ))}
              </select>
            </div>

            {/* Misa Selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                Pilih Misa
              </label>
              <select
                value={selectedMisa}
                onChange={(e) => setSelectedMisa(e.target.value)}
                disabled={!selectedMasa}
                className={`w-full border rounded-xl px-4 py-3 text-gray-700 focus:outline-none transition-all font-medium ${
                  !selectedMasa 
                    ? 'bg-gray-100 border-gray-100 cursor-not-allowed text-gray-400' 
                    : 'bg-gray-50 border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer'
                }`}
              >
                <option value="">-- Pilih Misa --</option>
                {availableMisa.map((misa) => (
                  <option key={misa} value={misa}>
                    {misa}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bacaan I */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Bacaan I</label>
                <input
                  type="text"
                  placeholder="Bacaan I"
                  value={bacaan1}
                  onChange={(e) => setBacaan1(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              {/* Mazmur Tanggapan */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Mazmur Tanggapan</label>
                <textarea
                  placeholder="Mazmur Tanggapan"
                  rows={3}
                  value={mazmur}
                  onChange={(e) => setMazmur(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
                />
              </div>

              {/* Bacaan II */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Bacaan II</label>
                <input
                  type="text"
                  placeholder="Bacaan II"
                  value={bacaan2}
                  onChange={(e) => setBacaan2(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              {/* Bacaan Injil */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Bacaan Injil</label>
                <input
                  type="text"
                  placeholder="Bacaan Injil"
                  value={bacaanInjil}
                  onChange={(e) => setBacaanInjil(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              {/* Homili Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-700">Pilih Homili</label>
                  <div className="flex gap-3">
                    {!isAddingHomili && (
                      <>
                        {canEditHomili && (
                          <button
                            onClick={() => setIsManagingHomili(true)}
                            className="text-xs flex items-center gap-1 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                          >
                            <Settings2 size={14} />
                            Kelola
                          </button>
                        )}
                        {canAddHomili && (
                          <button
                            onClick={() => setIsAddingHomili(true)}
                            className="text-xs flex items-center gap-1 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
                          >
                            <Plus size={14} />
                            Tambah Baru
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {isAddingHomili ? (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                    <input
                      type="text"
                      placeholder="Nama Romo"
                      autoFocus
                      value={newHomili}
                      onChange={(e) => setNewHomili(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                    <button
                      onClick={handleAddHomili}
                      disabled={!newHomili.trim()}
                      className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      title="Simpan"
                    >
                      <Check size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingHomili(false);
                        setNewHomili('');
                      }}
                      className="bg-gray-100 text-gray-600 p-3 rounded-xl hover:bg-gray-200 transition-colors"
                      title="Batal"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedHomili}
                    onChange={(e) => setSelectedHomili(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
                  >
                    <option value="">-- Pilih Homili --</option>
                    {homiliOptions.map((homili) => (
                      <option key={homili} value={homili}>
                        {homili}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Preview Container for Download Generation - FIXED SIZES for Desktop/Mobile Consistency */}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <div 
          ref={previewRef}
          className="relative inline-block bg-transparent"
          style={{ width: 'fit-content' }} // Change to fit-content to remove extra space on the right
        >
          <div className="flex flex-col justify-end items-start pb-0 pl-0">
            {downloadPreview && (
              <div className="relative z-10 flex items-stretch animate-in slide-in-from-left duration-700">
                {/* Far Left Vertical Bar (Fixed width) */}
                <div 
                  className="w-12 z-50 relative"
                  style={{ backgroundColor: verticalBarBg }}
                ></div>

                {/* Second Vertical Bar with Shadow (Fixed width) */}
                <div 
                  className="w-18 shadow-[10px_0_20px_rgba(0,0,0,0.5)] z-40 relative"
                  style={{ backgroundColor: secondaryVerticalBarBg }}
                ></div>
                
                <div className="flex flex-col items-start relative -ml-8 mt-4">
                  {/* Title Bar (Top) - HIGHER Z-INDEX, COVERING LEFT */}
                  <div 
                    className="px-16 py-5 mb-0 shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-center relative z-[60]"
                    style={{ 
                      background: titleBarBg,
                      width: 'fit-content',
                      minWidth: '550px', // Standardized min-width for all
                      height: '80px' // Standardized height for all
                    }}
                  >
                    <h2 
                      className="text-4xl font-black leading-none tracking-tight whitespace-nowrap uppercase"
                      style={{ color: titleTextColor }}
                    >
                      {downloadPreview.title}
                    </h2>
                  </div>
                  
                  {/* Subtitle Bar (Bottom) - LOWER Z-INDEX, LONGER WIDTH */}
                  <div 
                    className="px-16 py-6 shadow-[0_15px_25px_rgba(0,0,0,0.2)] flex items-center relative z-20 -mt-0.5"
                    style={{ 
                      background: subBarBg,
                      minWidth: '650px', // Standardized min-width for all, always longer than title
                      width: 'fit-content',
                      paddingRight: downloadPreview.title.includes('MAZMUR') ? '64px' : '150px', // Standard padding for Mazmur, extra long for others
                      height: downloadPreview.title.includes('MAZMUR') && downloadPreview.subtitle.includes('\n') ? 'auto' : '100px',
                      minHeight: '100px'
                    }}
                  >
                    <p 
                      className={`font-black tracking-tight leading-[1.1] ${
                        downloadPreview.title.includes('MAZMUR') 
                          ? 'whitespace-pre-wrap max-w-[1000px]' 
                          : 'whitespace-nowrap'
                      }`}
                      style={{ 
                        color: subBarTextColor,
                        fontSize: downloadPreview.title.includes('MAZMUR') 
                          ? (downloadPreview.subtitle.length > 50 || downloadPreview.subtitle.includes('\n') ? '32px' : '48px') 
                          : '48px'
                      }}
                    >
                      {downloadPreview.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedMasa && selectedMisa && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
          >
            <Download size={24} />
            Download Alur Misa (ZIP)
          </button>

          {/* Real-time Preview during Download - Show below button when downloading */}
          {isDownloading && generatedImage && (
            <div className="w-full max-w-lg animate-in fade-in zoom-in duration-300">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Generating Preview...</p>
              <div className="rounded-xl overflow-hidden shadow-2xl border-4 border-white">
                <img src={generatedImage} alt="Generated Preview" className="w-full h-auto" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlurManager;
