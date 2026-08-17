import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw, Plus, X, Save, Trash2, Mic, MicOff, Play, Pause,
  Image as ImageIcon, FileText, Volume2, Send, Eye, Clock,
  Bell, AlertCircle, CheckCircle, Church
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Church as ChurchType, Circular } from '../../types';

export default function CircularsPage() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  if (isSuperAdmin) return <SuperAdminView />;
  return <ChurchAdminView />;
}

/* ───────────────────── Super Admin View ───────────────────── */

function SuperAdminView() {
  const { profile } = useAuth();
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [churches, setChurches] = useState<ChurchType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [viewCircular, setViewCircular] = useState<Circular | null>(null);

  const fetchCirculars = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('circulars')
      .select('*, circular_churches(church_id, read_at, read_by)')
      .order('created_at', { ascending: false });
    setCirculars((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCirculars();
    supabase.from('churches').select('*').order('name').then(({ data }) => setChurches(data || []));
  }, [fetchCirculars]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this circular?')) return;
    await supabase.from('circulars').delete().eq('id', id);
    fetchCirculars();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Circulars</h1>
          <p className="text-slate-500 text-sm mt-0.5">Send announcements to all or specific churches</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCirculars} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowCompose(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Circular
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : circulars.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Bell className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-medium">No circulars yet</p>
          <p className="text-sm mt-1">Create your first circular to send to churches</p>
        </div>
      ) : (
        <div className="space-y-4">
          {circulars.map(c => {
            const readCount = c.circular_churches?.filter((cc: any) => cc.read_at).length || 0;
            const totalTargets = c.target_type === 'all' ? churches.length : (c.circular_churches?.length || 0);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 text-lg">{c.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {new Date(c.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${c.target_type === 'all' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                        {c.target_type === 'all' ? 'All Churches' : 'Specific'}
                      </span>
                      <button onClick={() => setViewCircular(c)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {c.content && (
                    <p className="text-sm text-slate-600 mt-3 line-clamp-2">{c.content}</p>
                  )}

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {c.voice_url && (
                      <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
                        <Mic className="w-3 h-3" /> Voice
                      </span>
                    )}
                    {c.image_url && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                        <ImageIcon className="w-3 h-3" /> Image
                      </span>
                    )}
                    {c.document_url && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                        <FileText className="w-3 h-3" /> Document
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{readCount}/{totalTargets} read</span>
                    </div>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: totalTargets > 0 ? `${(readCount / totalTargets) * 100}%` : '0%' }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCompose && (
        <ComposeCircular
          churches={churches}
          onClose={() => setShowCompose(false)}
          onSent={fetchCirculars}
          profile={profile}
        />
      )}

      {viewCircular && (
        <CircularDetail circular={viewCircular} churches={churches} onClose={() => setViewCircular(null)} />
      )}
    </div>
  );
}

/* ───────────────────── Compose Circular Modal ───────────────────── */

function ComposeCircular({ churches, onClose, onSent, profile }: {
  churches: ChurchType[];
  onClose: () => void;
  onSent: () => void;
  profile: any;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);

  // File uploads
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  function startRecording() {
    chunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        setVoicePreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    }).catch(() => setError('Microphone access denied'));
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  }

  function clearRecording() {
    setVoiceBlob(null);
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    setVoicePreviewUrl(null);
    setRecordingTime(0);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDocumentSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setDocumentFile(file);
  }

  async function uploadFile(file: File | Blob, path: string): Promise<string | null> {
    const { data, error: uploadError } = await supabase.storage.from('circulars').upload(path, file, { upsert: true });
    if (uploadError) { console.error('Upload error:', uploadError); return null; }
    const { data: urlData } = supabase.storage.from('circulars').getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (targetType === 'specific' && selectedChurchIds.length === 0) { setError('Select at least one church'); return; }
    if (!content.trim() && !voiceBlob && !imageFile && !documentFile) { setError('Add some content, voice, image, or document'); return; }

    setSaving(true);
    try {
      const circularId = crypto.randomUUID();

      let voiceUrl: string | null = null;
      let imageUrl: string | null = null;
      let documentUrl: string | null = null;

      if (voiceBlob) voiceUrl = await uploadFile(voiceBlob, `${circularId}/voice.webm`);
      if (imageFile) imageUrl = await uploadFile(imageFile, `${circularId}/${imageFile.name}`);
      if (documentFile) documentUrl = await uploadFile(documentFile, `${circularId}/${documentFile.name}`);

      const { data: circularData, error: insertError } = await supabase
        .from('circulars')
        .insert({
          id: circularId,
          title: title.trim(),
          content: content.trim() || null,
          voice_url: voiceUrl,
          image_url: imageUrl,
          document_url: documentUrl,
          target_type: targetType,
          created_by: profile.id,
        })
        .select('id')
        .maybeSingle();

      if (insertError) throw insertError;

      if (targetType === 'specific' && selectedChurchIds.length > 0) {
        const churchLinks = selectedChurchIds.map(cid => ({
          circular_id: circularData?.id || circularId,
          church_id: cid,
        }));
        const { error: linkError } = await supabase.from('circular_churches').insert(churchLinks);
        if (linkError) throw linkError;
      }

      onClose();
      onSent();
    } catch (err: any) {
      setError(err.message || 'Failed to send circular');
    }
    setSaving(false);
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-800">New Circular</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Circular subject" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" autoFocus />
          </div>

          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Send to *</label>
            <div className="flex gap-3 mb-3">
              <button type="button" onClick={() => setTargetType('all')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${targetType === 'all' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                All Churches
              </button>
              <button type="button" onClick={() => setTargetType('specific')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${targetType === 'specific' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                Specific Churches
              </button>
            </div>
            {targetType === 'specific' && (
              <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {churches.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selectedChurchIds.includes(c.id)} onChange={e => {
                      if (e.target.checked) setSelectedChurchIds([...selectedChurchIds, c.id]);
                      else setSelectedChurchIds(selectedChurchIds.filter(id => id !== c.id));
                    }} className="w-4 h-4 rounded accent-teal-600" />
                    <span className="text-sm text-slate-700">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Text Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Type your circular message..." className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-y" />
          </div>

          {/* Voice Recorder */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Voice Message</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              {!voicePreviewUrl ? (
                <div className="flex items-center gap-4">
                  <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-teal-600 hover:bg-teal-700'}`}>
                    {isRecording ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                  </button>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{isRecording ? 'Recording...' : 'Click to record'}</p>
                    {isRecording && <p className="text-xs text-red-500 font-mono mt-0.5">{fmt(recordingTime)}</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <AudioPlayer src={voicePreviewUrl} />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={startRecording} className="text-xs px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">Re-record</button>
                    <button type="button" onClick={clearRecording} className="text-xs px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors">Remove</button>
                    <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Voice attached</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Image Attachment</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              {imagePreview ? (
                <div className="space-y-3">
                  <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg object-contain mx-auto" />
                  <div className="flex items-center gap-2 justify-center">
                    <label className="text-xs px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors cursor-pointer">
                      Change
                      <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                    </label>
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="text-xs px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors">Remove</button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 cursor-pointer py-4 hover:bg-slate-100 rounded-lg transition-colors">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-500">Click to attach image</span>
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Document Attachment</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              {documentFile ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{documentFile.name}</p>
                    <p className="text-xs text-slate-500">{(documentFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <label className="text-xs px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors cursor-pointer">
                    Change
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleDocumentSelect} className="hidden" />
                  </label>
                  <button type="button" onClick={() => setDocumentFile(null)} className="text-xs px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors">Remove</button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 cursor-pointer py-4 hover:bg-slate-100 rounded-lg transition-colors">
                  <FileText className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-500">Click to attach document</span>
                  <span className="text-xs text-slate-400">PDF, DOC, XLS, TXT</span>
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleDocumentSelect} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors">
              <Send className="w-4 h-4" /> {saving ? 'Sending...' : 'Send Circular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ───────────────────── Circular Detail Modal ───────────────────── */

function CircularDetail({ circular, churches, onClose }: { circular: Circular; churches: ChurchType[]; onClose: () => void }) {
  const [readerNames, setReaderNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const readByIds = (circular.circular_churches || [])
      .map((cc: any) => cc.read_by)
      .filter(Boolean);
    if (readByIds.length === 0) return;
    const uniqueIds = [...new Set(readByIds as string[])];
    supabase.from('profiles').select('id, full_name').in('id', uniqueIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(p => { map[p.id] = p.full_name || 'Unknown'; });
        setReaderNames(map);
      }
    });
  }, [circular.circular_churches]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-800">Circular Details</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <h3 className="text-xl font-bold text-slate-800">{circular.title}</h3>
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {new Date(circular.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          {circular.content && <p className="text-sm text-slate-700 whitespace-pre-wrap">{circular.content}</p>}
          {circular.voice_url && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><Volume2 className="w-4 h-4" /> Voice Message</p>
              <AudioPlayer src={circular.voice_url} />
            </div>
          )}
          {circular.image_url && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Image</p>
              <img src={circular.image_url} alt="Circular" className="max-h-64 rounded-lg object-contain" />
            </div>
          )}
          {circular.document_url && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><FileText className="w-4 h-4" /> Document</p>
              <a href={circular.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium transition-colors border border-amber-200">
                <FileText className="w-4 h-4" /> Download Document
              </a>
            </div>
          )}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-2">Read Status</p>
            <div className="space-y-2">
              {(circular.circular_churches || []).map((cc: any) => {
                const church = churches.find(c => c.id === cc.church_id);
                const readerName = cc.read_by ? readerNames[cc.read_by] : null;
                return (
                  <div key={cc.church_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1.5"><Church className="w-3.5 h-3.5 text-slate-400" /> {church?.name || 'Unknown'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cc.read_at ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {cc.read_at
                        ? <>Read by {readerName || 'admin'} on {new Date(cc.read_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</>
                        : 'Unread'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Church Admin View ───────────────────── */

function ChurchAdminView() {
  const { profile } = useAuth();
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewCircular, setViewCircular] = useState<Circular | null>(null);

  const fetchCirculars = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('circulars')
      .select('*, circular_churches(church_id, read_at, read_by)')
      .order('created_at', { ascending: false });
    setCirculars((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCirculars(); }, [fetchCirculars]);

  async function markAsRead(circularId: string) {
    if (!profile?.church_id) return;
    await supabase
      .from('circular_churches')
      .update({ read_at: new Date().toISOString(), read_by: profile.id })
      .eq('circular_id', circularId)
      .eq('church_id', profile.church_id);
    fetchCirculars();
  }

  const unreadCount = circulars.filter(c => {
    const cc = c.circular_churches?.find((x: any) => x.church_id === profile?.church_id);
    return !cc?.read_at;
  }).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Circulars</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread circular(s)` : 'All circulars read'}
          </p>
        </div>
        <button onClick={fetchCirculars} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : circulars.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Bell className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-medium">No circulars yet</p>
          <p className="text-sm mt-1">Circulars from super admin will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {circulars.map(c => {
            const cc = c.circular_churches?.find((x: any) => x.church_id === profile?.church_id);
            const isUnread = !cc?.read_at;
            return (
              <div key={c.id} className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${isUnread ? 'border-teal-300 ring-1 ring-teal-100' : 'border-slate-200'}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isUnread && <div className="w-2.5 h-2.5 bg-teal-500 rounded-full flex-shrink-0" />}
                        <h3 className="font-bold text-slate-800">{c.title}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {new Date(c.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => { setViewCircular(c); if (isUnread) markAsRead(c.id); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {c.content && <p className="text-sm text-slate-600 mt-3 line-clamp-2">{c.content}</p>}

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {c.voice_url && (
                      <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full"><Mic className="w-3 h-3" /> Voice</span>
                    )}
                    {c.image_url && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full"><ImageIcon className="w-3 h-3" /> Image</span>
                    )}
                    {c.document_url && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full"><FileText className="w-3 h-3" /> Document</span>
                    )}
                    {cc?.read_at && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full ml-auto">
                        <CheckCircle className="w-3 h-3" /> Read
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewCircular && (
        <CircularDetailView circular={viewCircular} onClose={() => setViewCircular(null)} />
      )}
    </div>
  );
}

/* ───────────────────── Church Admin Circular Detail ───────────────────── */

function CircularDetailView({ circular, onClose }: { circular: Circular; onClose: () => void }) {
  const [creatorName, setCreatorName] = useState<string | null>(null);

  useEffect(() => {
    if (circular.created_by) {
      supabase.from('profiles').select('full_name').eq('id', circular.created_by).maybeSingle()
        .then(({ data }) => setCreatorName(data?.full_name || null));
    }
  }, [circular.created_by]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-800">Circular</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <h3 className="text-xl font-bold text-slate-800">{circular.title}</h3>
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {new Date(circular.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {creatorName && (
              <> — from {creatorName}</>
            )}
          </p>
          {circular.content && <p className="text-sm text-slate-700 whitespace-pre-wrap">{circular.content}</p>}
          {circular.voice_url && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><Volume2 className="w-4 h-4" /> Voice Message</p>
              <AudioPlayer src={circular.voice_url} />
            </div>
          )}
          {circular.image_url && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Image</p>
              <img src={circular.image_url} alt="Circular" className="max-h-64 rounded-lg object-contain" />
            </div>
          )}
          {circular.document_url && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><FileText className="w-4 h-4" /> Document</p>
              <a href={circular.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium transition-colors border border-amber-200">
                <FileText className="w-4 h-4" /> Download Document
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Shared Audio Player ───────────────────── */

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setPlaying(false));
    return () => { audio.pause(); audio.src = ''; };
  }, [src]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setPlaying(!playing);
  }

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={togglePlay} className="w-9 h-9 rounded-full bg-teal-600 hover:bg-teal-700 flex items-center justify-center flex-shrink-0 transition-colors">
          {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
