'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { MoodSlider } from '@/components/MoodSlider';
import { FloatingHearts } from '@/components/FloatingHearts';
import { Heart, Trash2, Search, Pencil, X, ChevronDown, Image as ImageIcon, Mic, Loader2, Plus, Play, Pause, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const VAPID_PUBLIC_KEY = 'BDUq_avuUv7N_Wo1fRo_zYtqQnfjTak61W14G1Zgp-y1LreXJuOWRfPkQTDXoigf3zL5QZ8YQwHG4Uo1dPSpPY8';

// Helper to determine mood card background color
const getMoodCardColor = (level: number) => {
  if (level <= 40) return 'bg-blue-600/80'; // Buồn & Hơi buồn
  if (level <= 60) return 'bg-emerald-500/80'; // Bình thường
  return 'bg-rose-500/80'; // Vui & Hạnh phúc
};

const getTextColor = (level: number) => {
  // Với các màu nền đậm trên, chữ trắng là tốt nhất
  return 'text-white';
};

const getMoodInfo = (level: number) => {
  if (level <= 20) return { emoji: '☹️', text: 'Cần một cái ôm quá...' };
  if (level <= 40) return { emoji: '😕', text: 'Hơi buồn một chút.' };
  if (level <= 60) return { emoji: '🙂', text: 'Bình thường nè.' };
  if (level <= 80) return { emoji: '😊', text: 'Đang thấy vui vui!' };
  return { emoji: '🌟', text: 'Cực kỳ hạnh phúc luôn!' };
};

// Custom Audio Player Component
const CustomAudioPlayer = ({ src }: { src: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p);
    }
  };

  return (
    <div className="bg-rose-50/50 backdrop-blur-sm rounded-2xl p-3 border border-rose-100 flex items-center gap-3 shadow-inner">
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={onTimeUpdate} 
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />
      <motion.button 
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md transition-transform"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
      </motion.button>
      <div className="flex-1 h-1.5 bg-rose-200 rounded-full overflow-hidden relative">
        <motion.div 
          initial={false}
          animate={{ width: `${progress}%` }}
          className="absolute inset-0 bg-rose-500"
        />
      </div>
      <Volume2 size={16} className="text-rose-400" />
    </div>
  );
};

export default function Home() {
  const [mood, setMood] = useState<number>(50);
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [presenceState, setPresenceState] = useState<Record<string, { isHugging: boolean }>>({});
  const [specialConnection, setSpecialConnection] = useState(false);
  const hugChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stopHuggingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartShapeRef = useRef<ReturnType<typeof confetti.shapeFromPath> | null>(null);
  const [userName, setUserName] = useState<string | null>(() => {
    try {
      return localStorage.getItem('user_name');
    } catch {
      return null;
    }
  });
  const [logs, setLogs] = useState<
    { content: string; user_name: string; created_at: string }[]
  >([]);
  type BucketItem = {
    id: number;
    title: string;
    created_by: string;
    is_completed: boolean;
    created_at: string;
  };
  type Memory = {
    id: number;
    title: string;
    content: string;
    media_url?: string;
    media_type?: 'image' | 'audio';
    created_by: string;
    created_at: string;
  };
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemContent, setNewMemContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [displayCount, setDisplayCount] = useState(6);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Tính năng này yêu cầu trình duyệt hỗ trợ Push API. Nếu bạn dùng iPhone, hãy chọn 'Thêm vào màn hình chính' (Add to Home Screen) để sử dụng nhé!");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return;
      }

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Save subscription to Supabase
      const user = userName ?? 'Ẩn danh';
      await supabase.from('push_subscriptions').upsert({
        user_name: user,
        subscription: subscription.toJSON(),
      }, { onConflict: 'user_name' });

      setIsSubscribed(true);
      console.log('Push notification subscribed!');
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      });
    }
  }, []);

  const computeElapsed = () => {
    const start = new Date(2025, 8, 15).getTime();
    const diff = Math.max(0, Date.now() - start);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { days, hours, minutes, seconds };
  };
  const [elapsed, setElapsed] = useState(computeElapsed);

  const triggerHearts = useCallback(() => {
    const id = Date.now();
    const newHearts = Array.from({ length: 5 }).map((_, i) => ({
      id: id + i,
      x: Math.random() * 80 + 10,
    }));
    setHearts((prev) => [...prev, ...newHearts]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id < id));
    }, 4500);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    const splashId = setTimeout(() => setShowSplash(false), 3500);
    return () => {
      clearTimeout(id);
      clearTimeout(splashId);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      setElapsed(computeElapsed());
    }, 1000);
    return () => clearInterval(id);
  }, [mounted]);

  useEffect(() => {
    const fetchBucket = async () => {
      const { data } = await supabase
        .from('bucket_list')
        .select('id,title,created_by,is_completed,created_at')
        .order('created_at', { ascending: false });
      if (data) setBucketItems(data as BucketItem[]);
    };
    fetchBucket();
    const bucketChannel = supabase
      .channel('bucket-list')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'bucket_list' },
        (payload: { new: BucketItem }) => {
          setBucketItems((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'bucket_list' },
        (payload: { new: BucketItem }) => {
          setBucketItems((prev) =>
            prev.map((it) => (it.id === payload.new.id ? payload.new : it))
          );
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'DELETE', schema: 'public', table: 'bucket_list' },
        (payload: { old: { id: number } }) => {
          setBucketItems((prev) => prev.filter((it) => it.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(bucketChannel);
    };
  }, []);

  useEffect(() => {
    const fetchMemories = async () => {
      const { data } = await supabase
        .from('memories')
        .select('id,title,content,media_url,media_type,created_by,created_at')
        .order('created_at', { ascending: false });
      if (data) setMemories(data as Memory[]);
    };
    fetchMemories();

    const memoriesChannel = supabase
      .channel('memories-updates')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'memories' },
        (payload: { new: Memory }) => {
          setMemories((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'memories' },
        (payload: { new: Memory }) => {
          setMemories((prev) => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'DELETE', schema: 'public', table: 'memories' },
        (payload: { old: { id: number } }) => {
          setMemories((prev) => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(memoriesChannel);
    };
  }, []);

  const addBucketItem = async () => {
    const t = newTitle.trim();
    if (!t) return;
    const creator = userName ?? 'Ẩn danh';
    await supabase.from('bucket_list').insert({ title: t, created_by: creator, is_completed: false });
    setNewTitle('');
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('memories_assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('memories_assets')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const addMemory = async () => {
    const t = newMemTitle.trim();
    const c = newMemContent.trim();
    if (!t || !c) return;
    
    setUploading(true);
    try {
      let media_url = undefined;
      let media_type: 'image' | 'audio' | undefined = undefined;

      if (selectedFile) {
        media_url = await uploadFile(selectedFile);
        media_type = selectedFile.type.startsWith('image/') ? 'image' : 'audio';
      }

      const creator = userName ?? 'Ẩn danh';
      await supabase.from('memories').insert({
        title: t,
        content: c,
        created_by: creator,
        media_url,
        media_type
      });
      
      // Success effect
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fb7185', '#fda4af', '#fff']
      });

      setNewMemTitle('');
      setNewMemContent('');
      setSelectedFile(null);
      setIsFormOpen(false);
    } catch (error) {
      console.error('Error adding memory:', error);
      alert('Có lỗi xảy ra khi tải lên tệp tin.');
    } finally {
      setUploading(false);
    }
  };

  const updateMemory = async () => {
    if (!editingMemory) return;
    const t = newMemTitle.trim();
    const c = newMemContent.trim();
    if (!t || !c) return;
    
    setUploading(true);
    try {
      let media_url = editingMemory.media_url;
      let media_type = editingMemory.media_type;

      if (selectedFile) {
        media_url = await uploadFile(selectedFile);
        media_type = selectedFile.type.startsWith('image/') ? 'image' : 'audio';
      }

      await supabase.from('memories').update({
        title: t,
        content: c,
        media_url,
        media_type
      }).eq('id', editingMemory.id);
      
      setEditingMemory(null);
      setNewMemTitle('');
      setNewMemContent('');
      setSelectedFile(null);
    } catch (error) {
      console.error('Error updating memory:', error);
      alert('Có lỗi xảy ra khi cập nhật kỷ niệm.');
    } finally {
      setUploading(false);
    }
  };

  const deleteMemory = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa kỷ niệm này không?')) {
      await supabase.from('memories').delete().eq('id', id);
    }
  };

  const startEditing = (mem: Memory) => {
    setEditingMemory(mem);
    setNewMemTitle(mem.title);
    setNewMemContent(mem.content);
    setIsFormOpen(true);
  };

  const cancelEditing = () => {
    setEditingMemory(null);
    setNewMemTitle('');
    setNewMemContent('');
    setIsFormOpen(false);
  };

  const filteredMemories = memories.filter(mem => 
    mem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mem.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleBucketItem = async (item: BucketItem) => {
    await supabase.from('bucket_list').update({ is_completed: !item.is_completed }).eq('id', item.id);
  };

  const deleteBucketItem = async (id: number) => {
    await supabase.from('bucket_list').delete().eq('id', id);
  };

  const deleteCompletedItems = async () => {
    await supabase.from('bucket_list').delete().eq('is_completed', true);
  };
  const fireHeartConfetti = useCallback(() => {
    try {
      if (!heartShapeRef.current) {
        const heartPath = 'M24 42C24 42 6 32 6 18C6 12.477 10.477 8 16 8C19.534 8 22.706 9.797 24 12.5C25.294 9.797 28.466 8 32 8C37.523 8 42 12.477 42 18C42 32 24 42 24 42Z';
        heartShapeRef.current = confetti.shapeFromPath({ path: heartPath });
      }
      if (!heartShapeRef.current) return;
      const heartShape = heartShapeRef.current;
      let i = 0;
      const timer = setInterval(() => {
        const drift = (Math.random() - 0.5) * 0.6;
        const gravity = 0.4 + Math.random() * 0.5;
        confetti({
          shapes: [heartShape],
          particleCount: 1,
          colors: ['#FF0000'],
          scalar: 3.5,
          origin: { x: 0.5, y: 0.7 },
          drift,
          gravity,
          ticks: 250,
        });
        i += 1;
        if (i >= 10) clearInterval(timer);
      }, 100);
    } catch {}
  }, []);

  const insertLog = useCallback(
    async (content: string) => {
      const name = userName ?? 'Ẩn danh';
      await supabase.from('mood_logs').insert({ content, user_name: name });
    },
    [userName]
  );

  // Fetch initial mood
  useEffect(() => {
    const fetchMood = async () => {
      const { data, error } = await supabase
        .from('moods')
        .select('mood_level')
        .eq('id', 1)
        .single();

      if (data) {
        setMood(data.mood_level);
      } else if (error) {
        console.error('Error fetching mood:', JSON.stringify(error, null, 2));
        // Optional: Create row if not exists (usually better to do in SQL setup)
      }
      setLoading(false);
    };

    fetchMood();
  }, []);

  // Realtime subscription
  useEffect(() => {
    // 1. Listen to DB changes for Mood
    const moodSubscription = supabase
      .channel('mood-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'moods',
          filter: 'id=eq.1',
        },
        (payload) => {
          if (payload.new && typeof payload.new.mood_level === 'number') {
            setMood(payload.new.mood_level);
          }
        }
      )
      .subscribe();

    // 2. Listen to Broadcast for Hugs (self + others)
    const hugChannel = supabase.channel('global_hug_channel', {
      config: { 
        broadcast: { self: true },
        presence: { key: userName ?? 'Ẩn danh' }
      },
    });
    hugChannelRef.current = hugChannel;

    hugChannel
      .on('broadcast', { event: 'hug_sync_event' }, () => {
        // Show hearts + confetti
        triggerHearts();
        fireHeartConfetti();
        
        // Visual feedback (Pulse Effect)
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 1000);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = hugChannel.presenceState<{ isHugging: boolean }>();
        console.log('Presence synced:', state); // Debug log
        const newState: Record<string, { isHugging: boolean }> = {};
        
        Object.keys(state).forEach(key => {
          // Dùng some() để kiểm tra nếu ít nhất một phiên kết nối đang hugging
          newState[key] = { isHugging: state[key].some(p => p.isHugging) };
        });
        
        setPresenceState(newState);
        
        // Logic Kết nối: Check if both Quang and Linh are hugging
        const isQuangHugging = newState['Quang']?.isHugging || false;
        const isLinhHugging = newState['Linh']?.isHugging || false;
        
        if (isQuangHugging && isLinhHugging) {
          setSpecialConnection(true);
        } else {
          setSpecialConnection(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await hugChannel.track({ isHugging: false });
        }
      });

    return () => {
      supabase.removeChannel(moodSubscription);
      if (hugChannelRef.current) supabase.removeChannel(hugChannelRef.current);
      if (stopHuggingTimerRef.current) clearTimeout(stopHuggingTimerRef.current);
    };
  }, [triggerHearts, fireHeartConfetti, userName]);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('mood_logs')
        .select('content,user_name,created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setLogs(data);
    };
    fetchLogs();

    const logsChannel = supabase
      .channel('mood-logs')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'mood_logs' },
        (payload: { new: { content: string; user_name: string; created_at: string } }) => {
          setLogs((prev) => [payload.new, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
    };
  }, []);


  const handleMoodChange = (value: number[]) => {
    setMood(value[0]);
  };

  const handleMoodCommit = async (value: number[]) => {
    const newMood = value[0];
    // Update DB
    const { error } = await supabase
      .from('moods')
      .update({ mood_level: newMood, last_updated: new Date().toISOString() })
      .eq('id', 1);

    if (error) {
      console.error('Error updating mood:', error);
    }
    await insertLog(`đã cập nhật tâm trạng thành ${newMood}`);
  };

  const sendHug = async () => {
    // Local feedback is handled via broadcast (self: true)
    
    // Send to other user
    if (!hugChannelRef.current) {
      hugChannelRef.current = supabase.channel('global_hug_channel', {
        config: { 
          broadcast: { self: true },
          presence: { key: userName ?? 'Ẩn danh' }
        },
      }).subscribe();
    }
    
    const sender = userName ?? 'Quang';
    await hugChannelRef.current.send({
      type: 'broadcast',
      event: 'hug_sync_event',
      payload: { from: sender },
    });
    
    await insertLog('vừa gửi một cái ôm');
  };

  const startHugging = async () => {
    console.log('Start hugging...');
    // Clear stop timer if it exists
    if (stopHuggingTimerRef.current) {
      clearTimeout(stopHuggingTimerRef.current);
      stopHuggingTimerRef.current = null;
    }

    if (hugChannelRef.current) {
      const status = await hugChannelRef.current.track({ isHugging: true });
      console.log('Track status (start):', status);
    }
  };

  const stopHugging = async () => {
    console.log('Stop hugging (waiting 1.5s buffer)...');
    
    // Clear existing timer if any
    if (stopHuggingTimerRef.current) clearTimeout(stopHuggingTimerRef.current);

    // Buffer 1.5s before actually setting isHugging to false
    stopHuggingTimerRef.current = setTimeout(async () => {
      if (hugChannelRef.current) {
        const status = await hugChannelRef.current.track({ isHugging: false });
        console.log('Track status (stop):', status);
      }
      stopHuggingTimerRef.current = null;
    }, 1500);
  };

  // Tự động tắt SpecialConnection sau 30 giây và kích hoạt rung nhịp tim khi kết nối
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (specialConnection) {
      // Haptic Feedback: Nhịp tim khi kết nối thành công
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      timer = setTimeout(() => {
        setSpecialConnection(false);
      }, 30000);
    }
    return () => clearTimeout(timer);
  }, [specialConnection]);

  if (!mounted) {
    return <div className="min-h-screen bg-rose-500" />;
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-blue-950 overflow-hidden"
          >
            {/* Heart Rain Background for Splash */}
            <div className="absolute inset-0 pointer-events-none">
              <FloatingHearts hearts={Array.from({ length: 20 }).map((_, i) => ({ id: i, x: Math.random() * 100 }))} />
            </div>
            
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="z-10 text-center"
            >
              <h1 className="text-6xl md:text-8xl font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                Quang <span className="text-rose-500">❤️</span> Linh
              </h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-white/60 text-xl tracking-widest uppercase"
              >
                Our Own Universe
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-h-screen bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))] from-rose-100 via-purple-100 to-sky-100 transition-colors duration-700 ease-in-out flex flex-col items-center justify-center p-4 sm:p-8">
      <FloatingHearts hearts={hearts} />
      
      {/* Synchronized Pulse Effect */}
      <AnimatePresence>
        {showPulse && (
          <motion.div
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
          >
            <div className="w-64 h-64 rounded-full bg-rose-400/30 blur-3xl border-8 border-rose-300/20" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Special Connection Glowing Border */}
      <AnimatePresence>
        {specialConnection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.4, 0.8, 0.4],
              boxShadow: [
                "inset 0 0 40px rgba(251, 113, 133, 0.4), inset 0 0 80px rgba(251, 113, 133, 0.2)",
                "inset 0 0 60px rgba(251, 113, 133, 0.8), inset 0 0 120px rgba(251, 113, 133, 0.4)",
                "inset 0 0 40px rgba(251, 113, 133, 0.4), inset 0 0 80px rgba(251, 113, 133, 0.2)"
              ]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] pointer-events-none border-[12px] border-rose-400/20"
            style={{
              background: "linear-gradient(to right, rgba(251, 113, 133, 0.1), transparent, rgba(251, 113, 133, 0.1))",
              WebkitBackdropFilter: "blur(4px)",
              backdropFilter: "blur(4px)"
            }}
          />
        )}
      </AnimatePresence>

      <div className={`z-10 w-full max-w-md space-y-12 p-6 sm:p-8 bg-white/40 backdrop-blur-xl border border-white/50 shadow-2xl shadow-rose-100/50 rounded-[2rem] transition-all duration-500`}>
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold drop-shadow-sm text-slate-800">
            Our Universe
          </h1>
          <div className="flex justify-center mt-2">
            {!isSubscribed && (
              <button
                onClick={subscribeToPush}
                className="text-[10px] bg-white/20 hover:bg-white/40 text-white px-3 py-1 rounded-full border border-white/20 transition-all flex items-center gap-1"
              >
                🔔 Nhận thông báo từ người ấy
              </button>
            )}
          </div>
          <motion.div
            animate={{
              color: ['#1e293b', '#64748b', '#1e293b'],
              textShadow: [
                '0 0 0px rgba(255,255,255,0)',
                '0 0 10px rgba(255,255,255,0.2)',
                '0 0 0px rgba(255,255,255,0)',
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
            className="text-2xl font-bold tracking-wide"
          >
            Quang <span className="text-rose-400">❤️</span> Linh
          </motion.div>
          <p className="text-slate-600 font-medium text-sm sm:text-base">
            Chúng mình đã bên nhau: {elapsed.days} ngày, {elapsed.hours} giờ, {elapsed.minutes} phút, {elapsed.seconds} giây
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between text-slate-400 text-sm font-medium px-1">
            <span>Buồn</span>
            <span>Bình thường</span>
            <span>Vui vẻ</span>
          </div>
          
          <MoodSlider
            defaultValue={[50]}
            value={[mood]}
            max={100}
            step={1}
            onValueChange={handleMoodChange}
            onValueCommit={handleMoodCommit}
          />
          
          <div className="h-32 flex items-center justify-center">
            {loading ? (
              <p className="text-slate-400 text-lg animate-pulse">Đang kết nối...</p>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={getMoodInfo(mood).text}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.8 }}
                  transition={{ duration: 0.4, type: "spring", bounce: 0.5 }}
                  className="flex flex-col items-center gap-2"
                >
                  <span className="text-6xl drop-shadow-xl filter">{getMoodInfo(mood).emoji}</span>
                  <span className="text-xl font-bold text-slate-800 text-center px-4">
                    {getMoodInfo(mood).text}
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    (Mức độ: {mood}%)
                  </span>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 pt-4 select-none" style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className={`relative w-14 h-14 rounded-full border-2 transition-all duration-300 ${presenceState['Quang']?.isHugging ? 'border-emerald-400 scale-110' : 'border-slate-200'}`}>
                <div className="absolute inset-0 rounded-full overflow-hidden bg-rose-100 flex items-center justify-center text-rose-500 font-bold">Q</div>
                {presenceState['Quang']?.isHugging && (
                  <motion.div 
                    layoutId="glow-q"
                    className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-ping opacity-50" 
                  />
                )}
                {/* Online/Offline Status Dot */}
                <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white z-50 transition-colors duration-300 ${
                  presenceState['Quang'] ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'
                }`} />
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quang</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onMouseDown={startHugging}
              onMouseUp={stopHugging}
              onMouseLeave={stopHugging}
              onTouchStart={startHugging}
              onTouchEnd={stopHugging}
              onClick={sendHug}
              className="group relative flex items-center justify-center w-20 h-20 bg-gradient-to-r from-rose-400 to-purple-500 hover:from-rose-500 hover:to-purple-600 rounded-full shadow-lg shadow-rose-200/50 transition-all border border-white/40 backdrop-blur-sm"
            >
              <Heart className={`w-10 h-10 transition-all duration-300 ${specialConnection ? 'text-white fill-white animate-pulse' : 'text-white/90'}`} />
            </motion.button>

            <div className="flex flex-col items-center gap-2">
              <div className={`relative w-14 h-14 rounded-full border-2 transition-all duration-300 ${presenceState['Linh']?.isHugging ? 'border-emerald-400 scale-110' : 'border-slate-200'}`}>
                <div className="absolute inset-0 rounded-full overflow-hidden bg-rose-100 flex items-center justify-center text-rose-500 font-bold">L</div>
                {presenceState['Linh']?.isHugging && (
                  <motion.div 
                    layoutId="glow-l"
                    className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-ping opacity-50" 
                  />
                )}
                {/* Online/Offline Status Dot */}
                <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white z-50 transition-colors duration-300 ${
                  presenceState['Linh'] ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'
                }`} />
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Linh</span>
            </div>
          </div>
          
          <p className="text-[11px] text-slate-400 font-medium italic">Nhấn để gửi, nhấn giữ cùng nhau để kết nối</p>
        </div>
      </div>
      
      {!userName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="text-center font-bold text-lg">Bạn là ai?</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="rounded-xl bg-rose-500 text-white py-3 font-semibold hover:bg-rose-600 transition"
                onClick={() => {
                  localStorage.setItem('user_name', 'Quang');
                  setUserName('Quang');
                }}
              >
                Quang
              </button>
              <button
                className="rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 transition"
                onClick={() => {
                  localStorage.setItem('user_name', 'Linh');
                  setUserName('Linh');
                }}
              >
                Linh
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mt-8">
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-2xl shadow-rose-100/50 rounded-[2rem] p-6">
          <div className="text-slate-800 font-bold flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-lg">📔 Nhật ký</span>
              {userName && <span className="text-[10px] bg-rose-100 text-rose-500 px-2 py-0.5 rounded-full font-bold border border-rose-200">Bạn là {userName}</span>}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
          <div className="mt-4 space-y-3 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-rose-200">
            {logs.map((log, i) => (
              <div key={i} className="text-sm text-slate-600 border-l-2 border-rose-200 pl-3 py-1">
                <span className="font-bold text-slate-800">{log.user_name}</span> {log.content}
                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                  {new Date(log.created_at).toLocaleTimeString('vi-VN')}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-slate-400 text-xs italic text-center py-4">
                Chưa có dòng nhật ký nào. Hãy bắt đầu bằng cách kéo thanh trượt hoặc gửi một cái ôm.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mt-6">
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-2xl shadow-rose-100/50 rounded-[2rem] p-6 space-y-4">
          <div className="text-slate-800 font-bold text-lg">📌 Việc muốn làm cùng nhau</div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-2xl bg-white/60 px-4 py-2 text-sm text-slate-800 placeholder-slate-300 outline-none focus:ring-2 focus:ring-rose-200 border border-white/40 shadow-inner"
              placeholder="Nhập kế hoạch..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button
              className="rounded-2xl bg-gradient-to-r from-rose-400 to-purple-500 text-white px-4 py-2 text-sm font-bold hover:from-rose-500 hover:to-purple-600 transition shadow-md shadow-rose-200/50"
              onClick={addBucketItem}
            >
              Thêm
            </button>
          </div>
          <div className="max-h-[150px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-rose-200">
            <ul className="space-y-2">
              {bucketItems.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between rounded-2xl bg-white/40 px-4 py-3 text-slate-700 shadow-sm border border-white/40 transition-all hover:bg-white/60"
                >
                  <div className={`text-sm ${it.is_completed ? 'line-through text-slate-400' : 'font-medium'}`}>
                    <span>{it.title}</span>
                    <span className="ml-2 text-[10px] text-slate-400 font-bold">• {it.created_by}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={it.is_completed}
                        onChange={() => toggleBucketItem(it)}
                        className="h-4 w-4 accent-rose-400 rounded-lg border-rose-200"
                      />
                    </label>
                    <button
                      onClick={() => deleteBucketItem(it.id)}
                      className="text-slate-300 hover:text-rose-400 transition-colors p-1"
                      title="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
              {bucketItems.length === 0 && (
                <li className="text-slate-400 text-xs italic text-center py-4">Chưa có kế hoạch nào.</li>
              )}
            </ul>
          </div>
          {bucketItems.some((it) => it.is_completed) && (
            <div className="flex justify-end pt-2 border-t border-rose-100">
              <button
                onClick={deleteCompletedItems}
                className="text-[10px] text-rose-400 hover:text-rose-600 transition-colors font-bold uppercase tracking-wider"
              >
                Xóa việc đã hoàn thành
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl mt-12 space-y-8 pb-12">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-800 drop-shadow-sm">🏛️ Bảo tàng kỷ niệm</h2>
          <p className="text-slate-600 text-sm mt-2 font-medium">Nơi lưu giữ những khoảnh khắc ngọt ngào của chúng mình</p>
        </div>

        {/* Floating Action Button */}
        <div className="fixed bottom-6 left-6 z-40 select-none" style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            onClick={() => setIsFormOpen(true)}
            className="w-14 h-14 bg-rose-500 text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white/50 backdrop-blur-sm"
          >
            <Plus size={28} />
          </motion.button>
        </div>

        {/* Bottom Sheet Form */}
        <AnimatePresence>
          {isFormOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={cancelEditing}
                className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60]"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl rounded-t-[32px] p-6 pb-10 z-[70] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] border-t border-white/50"
              >
                <div className="w-12 h-1.5 bg-rose-100 rounded-full mx-auto mb-6" />
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-rose-900">
                    {editingMemory ? 'Chỉnh sửa kỷ niệm' : 'Thêm kỷ niệm mới'}
                  </h3>
                  <button onClick={cancelEditing} className="p-2 rounded-full bg-rose-50 text-rose-400">
                    <X size="20" />
                  </button>
                </div>

                <div className="space-y-4">
                  <input
                    className="w-full rounded-2xl bg-white/50 border border-rose-100 px-4 py-3 text-base text-slate-800 placeholder-slate-300 outline-none focus:ring-2 focus:ring-rose-200 transition-all shadow-inner"
                    placeholder="Tiêu đề kỷ niệm..."
                    value={newMemTitle}
                    onChange={(e) => setNewMemTitle(e.target.value)}
                  />
                  <textarea
                    className="w-full rounded-2xl bg-white/50 border border-rose-100 px-4 py-3 text-base text-slate-800 placeholder-slate-300 outline-none focus:ring-2 focus:ring-rose-200 min-h-[120px] resize-none shadow-inner"
                    placeholder="Nội dung kỷ niệm..."
                    value={newMemContent}
                    onChange={(e) => setNewMemContent(e.target.value)}
                  />
                  
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group flex-1">
                      <div className="p-3 rounded-2xl bg-white/60 text-slate-600 group-active:scale-95 transition-all shadow-sm border border-white/50 flex items-center justify-center gap-2 w-full font-bold">
                        <ImageIcon size="20" className="text-rose-400" />
                        <span className="text-sm">Thêm ảnh/nhạc</span>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,audio/*"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {selectedFile && (
                      <div className="flex-1 flex items-center gap-2 bg-rose-50/50 p-2 rounded-xl border border-rose-100">
                        <span className="text-xs font-bold text-rose-400 truncate flex-1">{selectedFile.name}</span>
                        <button onClick={() => setSelectedFile(null)} className="text-rose-300"><X size="14" /></button>
                      </div>
                    )}
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    disabled={uploading}
                    className={`w-full rounded-2xl py-4 text-base font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                      editingMemory ? 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-emerald-100' : 'bg-gradient-to-r from-rose-400 to-purple-500 shadow-rose-100'
                    } text-white disabled:opacity-50`}
                    onClick={editingMemory ? updateMemory : addMemory}
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : (editingMemory ? 'Cập nhật' : 'Lưu giữ ngay ✨')}
                  </motion.button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="max-w-md mx-auto relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            className="w-full rounded-full bg-white/60 backdrop-blur-md border border-white/60 pl-12 pr-4 py-3 text-base text-rose-900 placeholder-rose-300 outline-none focus:ring-2 focus:ring-rose-300 transition-all shadow-sm"
            placeholder="Tìm kiếm ký ức..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredMemories.slice(0, displayCount).map((mem) => (
              <motion.div
                key={mem.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -5 }}
                className="group rounded-[32px] bg-white/50 backdrop-blur-xl border border-white/60 p-6 space-y-4 hover:bg-white/70 transition-all relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <div className="flex justify-between items-center gap-2">
                  <h3 className="text-rose-900 font-bold text-xl leading-tight truncate min-w-0">{mem.title}</h3>
                  <div className="flex gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      onClick={() => startEditing(mem)}
                      className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/60 text-rose-900/40 hover:text-emerald-500 hover:bg-white/80 transition-all border border-white/40 shadow-sm"
                    >
                      <Pencil size="20" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      onClick={() => deleteMemory(mem.id)}
                      className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/60 text-rose-900/40 hover:text-rose-500 hover:bg-white/80 transition-all border border-white/40 shadow-sm"
                    >
                      <Trash2 size="20" />
                    </motion.button>
                  </div>
                </div>

                {mem.media_url && mem.media_type === 'image' && (
                  <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-white/40 shadow-md">
                    <img 
                      src={mem.media_url} 
                      alt={mem.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {mem.media_url && mem.media_type === 'audio' && (
                  <CustomAudioPlayer src={mem.media_url} />
                )}

                <p className="text-rose-900/80 text-base whitespace-pre-wrap leading-relaxed font-medium tracking-wide">
                  {mem.content}
                </p>
                <div className="flex justify-between items-center pt-3 border-t border-rose-100/50">
                  <div className="text-[11px] text-rose-900/40 italic font-bold">
                    {new Date(mem.created_at).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </div>
                  <span className="text-[11px] bg-rose-500 text-white px-3 py-1 rounded-full font-bold shadow-sm shadow-rose-200">
                    {mem.created_by}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {filteredMemories.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full text-center py-12 space-y-3"
            >
              <Heart className="h-12 w-12 text-rose-300 mx-auto animate-pulse opacity-40" />
              <p className="text-rose-900/40 italic text-sm font-medium">
                {searchQuery 
                  ? 'Không tìm thấy kỷ niệm nào khớp với từ khóa của bạn...' 
                  : 'Chưa có kỷ niệm nào ở đây, hãy là người đầu tiên viết nên câu chuyện của chúng mình nhé!'}
              </p>
            </motion.div>
          )}
        </div>

        {filteredMemories.length > displayCount && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => setDisplayCount(prev => prev + 6)}
              className="group flex items-center gap-2 px-6 py-2 rounded-full bg-white/40 border border-white/40 text-rose-900 text-sm font-bold hover:bg-white/60 transition-all shadow-sm"
            >
              <span>Xem thêm ký ức</span>
              <ChevronDown className="h-4 w-4 group-hover:translate-y-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
