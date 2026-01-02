'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { MoodSlider } from '@/components/MoodSlider';
import { FloatingHearts } from '@/components/FloatingHearts';
import { Heart, Trash2, Search, Pencil, X, ChevronDown, Image as ImageIcon, Mic, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// Helper to determine background color
const getBackgroundColor = (level: number) => {
  if (level <= 30) return 'bg-blue-900'; // Buồn
  if (level <= 70) return 'bg-emerald-600'; // Bình thường
  return 'bg-rose-500'; // Hạnh phúc
};

const getMoodText = (level: number) => {
  if (level <= 30) return 'Đang cảm thấy buồn...';
  if (level <= 70) return 'Cảm thấy bình thường';
  return 'Đang rất hạnh phúc!';
};

export default function Home() {
  const [mood, setMood] = useState<number>(50);
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const hugChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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
      .upload(filePath, file);

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
      
      setNewMemTitle('');
      setNewMemContent('');
      setSelectedFile(null);
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
    window.scrollTo({ top: document.getElementById('memory-form')?.offsetTop ? document.getElementById('memory-form')!.offsetTop - 100 : 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingMemory(null);
    setNewMemTitle('');
    setNewMemContent('');
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
    const hugChannel = supabase.channel('room_1', {
      config: { broadcast: { self: true } },
    });
    hugChannelRef.current = hugChannel;

    hugChannel
      .on('broadcast', { event: 'hug-event' }, () => {
        // Show hearts + confetti on any hug-event
        triggerHearts();
        fireHeartConfetti();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(moodSubscription);
      if (hugChannelRef.current) supabase.removeChannel(hugChannelRef.current);
    };
  }, [triggerHearts, fireHeartConfetti]);

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
    // Trigger local animation immediately
    triggerHearts();
    fireHeartConfetti();
    
    // Send to other user
    if (!hugChannelRef.current) {
      hugChannelRef.current = supabase.channel('room_1', {
        config: { broadcast: { self: true } },
      }).subscribe();
    }
    await hugChannelRef.current.send({
      type: 'broadcast',
      event: 'hug-event',
      payload: { message: 'HUG' },
    });
    await insertLog('vừa gửi một cái ôm');
  };

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

      <main
        className={`flex min-h-screen flex-col items-center justify-center p-8 transition-colors duration-700 ease-in-out ${getBackgroundColor(
          mood
        )}`}
      >
      <FloatingHearts hearts={hearts} />

      <div className="z-10 w-full max-w-md space-y-12 rounded-3xl bg-white/10 p-8 backdrop-blur-md shadow-2xl border border-white/20">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white drop-shadow-md">
            Our Universe
          </h1>
          <motion.div
            animate={{
              color: ['#ffffff', '#fecaca', '#ffffff'],
              textShadow: [
                '0 0 0px rgba(255,255,255,0)',
                '0 0 10px rgba(255,255,255,0.5)',
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
          <p className="text-white/80 text-lg animate-pulse">
            {loading ? 'Đang kết nối...' : getMoodText(mood)}
          </p>
          <p className="text-white/90 text-sm sm:text-base">
            Chúng mình đã bên nhau: {elapsed.days} ngày, {elapsed.hours} giờ, {elapsed.minutes} phút, {elapsed.seconds} giây
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between text-white/60 text-sm font-medium px-1">
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
          
          <div className="text-center text-6xl font-bold text-white tracking-tighter">
            {mood}
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendHug}
            className="group relative inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-rose-500 font-bold shadow-lg hover:bg-rose-50 transition-all"
          >
            <Heart className="h-6 w-6 fill-current group-hover:animate-bounce" />
            <span>Gửi một cái ôm</span>
          </motion.button>
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
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4">
          <div className="text-white font-bold flex justify-between items-center">
            <span>Nhật ký</span>
            {userName && <span className="text-xs text-white/60">Bạn đang là: {userName}</span>}
          </div>
          <div className="mt-2 max-h-[150px] overflow-y-auto">
            <ul className="space-y-1 text-white/90 text-xs sm:text-sm">
              {logs.map((l, idx) => (
                <li key={`${l.created_at}-${idx}`} className="flex gap-2 leading-snug">
                  <span className="font-semibold">{l.user_name}:</span>
                  <span>{l.content}</span>
                </li>
              ))}
              {logs.length === 0 && (
                <li className="text-white/50 text-xs">
                  Chưa có dòng nhật ký nào. Hãy bắt đầu bằng cách kéo thanh trượt hoặc gửi một cái ôm.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mt-6">
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 space-y-3">
          <div className="text-white font-bold">Danh sách việc muốn làm cùng nhau</div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="Nhập kế hoạch..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button
              className="rounded-xl bg-rose-500 text-white px-4 py-2 text-sm font-semibold hover:bg-rose-600 transition"
              onClick={addBucketItem}
            >
              Thêm kế hoạch
            </button>
          </div>
          <div className="max-h-[150px] overflow-y-auto">
            <ul className="space-y-2">
              {bucketItems.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-white/90"
                >
                  <div className={`text-sm ${it.is_completed ? 'line-through text-white/50' : ''}`}>
                    <span className="font-semibold">{it.title}</span>
                    <span className="ml-2 text-xs text-white/60">• thêm bởi {it.created_by}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={it.is_completed}
                        onChange={() => toggleBucketItem(it)}
                        className="h-4 w-4 accent-rose-500"
                      />
                      Hoàn thành
                    </label>
                    <button
                      onClick={() => deleteBucketItem(it.id)}
                      className="text-white/40 hover:text-rose-400 transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
              {bucketItems.length === 0 && (
                <li className="text-white/50 text-xs">Chưa có kế hoạch nào. Hãy thêm một điều đầu tiên.</li>
              )}
            </ul>
          </div>
          {bucketItems.some((it) => it.is_completed) && (
            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={deleteCompletedItems}
                className="text-xs text-rose-300 hover:text-rose-400 transition-colors font-medium"
              >
                Xóa tất cả việc đã hoàn thành
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl mt-12 space-y-8 pb-12">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white drop-shadow-md">Bảo tàng kỷ niệm</h2>
          <p className="text-white/70 text-sm mt-2">Nơi lưu giữ những khoảnh khắc ngọt ngào của chúng mình</p>
        </div>

        <div id="memory-form" className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 space-y-4 max-w-md mx-auto relative overflow-hidden">
          <AnimatePresence mode="wait">
            {editingMemory && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-0 left-0 right-0 bg-rose-500 text-white text-[10px] font-bold py-1 text-center uppercase tracking-wider"
              >
                Đang chỉnh sửa kỷ niệm
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-3 pt-2">
            <input
              className="w-full rounded-xl bg-white/80 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="Tiêu đề kỷ niệm..."
              value={newMemTitle}
              onChange={(e) => setNewMemTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl bg-white/80 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-300 min-h-[100px] resize-none"
              placeholder="Nội dung kỷ niệm..."
              value={newMemContent}
              onChange={(e) => setNewMemContent(e.target.value)}
            />
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="p-2 rounded-full bg-white/20 group-hover:bg-rose-500/20 text-white transition-all">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <span className="text-xs text-white/60 group-hover:text-white transition-colors">Ảnh</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="p-2 rounded-full bg-white/20 group-hover:bg-emerald-500/20 text-white transition-all">
                  <Mic className="h-5 w-5" />
                </div>
                <span className="text-xs text-white/60 group-hover:text-white transition-colors">Ghi âm</span>
                <input 
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </label>

              {selectedFile && (
                <div className="flex-1 flex items-center justify-between bg-white/10 rounded-lg px-3 py-1">
                  <span className="text-[10px] text-white/80 truncate max-w-[100px]">{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} className="text-white/40 hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                disabled={uploading}
                className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                  editingMemory ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
                } text-white disabled:opacity-50`}
                onClick={editingMemory ? updateMemory : addMemory}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải lên...
                  </>
                ) : (
                  editingMemory ? 'Cập nhật ký ức' : 'Lưu giữ ký ức'
                )}
              </button>
              {editingMemory && (
                <button
                  className="px-4 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all"
                  onClick={cancelEditing}
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            className="w-full rounded-full bg-white/10 backdrop-blur-md border border-white/20 pl-10 pr-4 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-rose-300 transition-all"
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
                className="group rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 space-y-3 hover:bg-white/15 transition-all relative overflow-hidden"
              >
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-white font-bold text-lg leading-tight pr-8">{mem.title}</h3>
                  <div className="flex gap-1 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEditing(mem)}
                      className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-emerald-400 hover:bg-white/20 transition-all"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMemory(mem.id)}
                      className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-rose-400 hover:bg-white/20 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {mem.media_url && mem.media_type === 'image' && (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10">
                    <img 
                      src={mem.media_url} 
                      alt={mem.title} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}

                {mem.media_url && mem.media_type === 'audio' && (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <audio 
                      controls 
                      src={mem.media_url} 
                      className="w-full h-8 opacity-70 hover:opacity-100 transition-opacity"
                    />
                  </div>
                )}

                <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">
                  {mem.content}
                </p>
                <div className="flex justify-between items-center pt-2">
                  <div className="text-[10px] text-white/40 italic">
                    {new Date(mem.created_at).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <span className="text-[10px] bg-rose-500/30 text-rose-100 px-2 py-1 rounded-full">
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
              <Heart className="h-12 w-12 text-rose-300/40 mx-auto animate-pulse" />
              <p className="text-white/40 italic text-sm">
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
              className="group flex items-center gap-2 px-6 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all"
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
