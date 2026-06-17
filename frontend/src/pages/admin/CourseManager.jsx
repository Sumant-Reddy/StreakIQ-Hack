import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import { courseApi, aiApi, adminApi } from '../../services/api';
import {
  Plus, BookOpen, Edit, Eye, Brain, X, CheckCircle, Loader,
  RefreshCw, Upload, ImagePlus, Trash2, Save, ChevronDown, ChevronUp,
  FileText, Video, File, Globe, ArrowLeft,
} from 'lucide-react';

const DEPARTMENTS = ['Retail', 'Operations', 'Management', 'Training'];
const CONTENT_TYPES = ['VIDEO', 'PDF', 'SOP', 'PPT', 'ARTICLE'];

const MODULE_ICON = { VIDEO: Video, PDF: FileText, SOP: FileText, PPT: File, ARTICLE: Globe };

function emptyForm() {
  return {
    title: '', description: '', department: 'Retail', tags: '', estimatedHours: 2,
    isPublished: false, isMandatory: false, thumbnail: '', thumbnailS3Key: '',
    titleHi: '', titleTe: '', descriptionHi: '', descriptionTe: '',
  };
}

function emptyModuleForm() {
  return { title: '', contentType: 'VIDEO', contentUrl: '', s3Key: '', duration: 0, description: '' };
}

export default function CourseManager() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingCourse, setEditingCourse] = useState(null);
  const [showQuizGen, setShowQuizGen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState(emptyForm());
  const [moduleForm, setModuleForm] = useState(emptyModuleForm());
  const [showAddModule, setShowAddModule] = useState(false);
  const [addingModule, setAddingModule] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const [quizForm, setQuizForm] = useState({ content: '', contentType: 'PDF', difficulty: 'MEDIUM', count: 5 });
  const [quizGenLoading, setQuizGenLoading] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);

  const uploadFile = async (file, type = 'file', courseId = null) => {
    const formData = new FormData();
    formData.append(type === 'thumbnail' ? 'thumbnail' : 'file', file);
    if (courseId) formData.append('courseId', courseId);
    const endpoint = type === 'thumbnail' ? '/api/upload/thumbnail' : '/api/upload';
    const token = localStorage.getItem('yami_token');
    const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return { url: data.url, s3Key: data.s3Key || null };
  };

  const loadCourses = () => {
    setLoading(true);
    courseApi.list({ limit: 100 })
      .then(d => setCourses(d.courses || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCourses(); }, []);

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const course = await courseApi.create(form);
      setCourses(prev => [course, ...prev]);
      setView('list');
      setForm(emptyForm());
    } catch (err) {
      alert(err.error || 'Failed to create course');
    } finally { setSaving(false); }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEdit = async (course) => {
    // Fetch full course with modules
    try {
      const full = await courseApi.get(course.id);
      setEditingCourse(full);
      setForm({
        title: full.title || '',
        description: full.description || '',
        department: full.department || 'Retail',
        tags: full.tags || '',
        estimatedHours: full.estimatedHours || 2,
        isPublished: full.isPublished || false,
        isMandatory: full.isMandatory || false,
        thumbnail: full.thumbnail || '',
        thumbnailS3Key: full.thumbnailS3Key || '',
        titleHi: full.titleHi || '',
        titleTe: full.titleTe || '',
        descriptionHi: full.descriptionHi || '',
        descriptionTe: full.descriptionTe || '',
      });
      setShowAddModule(false);
      setModuleForm(emptyModuleForm());
      setView('edit');
    } catch (err) {
      alert('Failed to load course details');
    }
  };

  const handleSaveEdit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const updated = await courseApi.update(editingCourse.id, form);
      setCourses(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      setEditingCourse(prev => ({ ...prev, ...updated }));
      alert('Course updated!');
    } catch (err) {
      alert(err.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  // ── Module management ───────────────────────────────────────────────────────
  const handleAddModule = async () => {
    if (!moduleForm.title.trim() || !editingCourse) return;
    setAddingModule(true);
    try {
      const mod = await courseApi.addModule(editingCourse.id, moduleForm);
      setEditingCourse(prev => ({ ...prev, modules: [...(prev.modules || []), mod] }));
      setModuleForm(emptyModuleForm());
      setShowAddModule(false);
    } catch (err) {
      alert(err.error || 'Failed to add module');
    } finally { setAddingModule(false); }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!confirm('Delete this module?')) return;
    try {
      await courseApi.deleteModule(editingCourse.id, moduleId);
      setEditingCourse(prev => ({ ...prev, modules: prev.modules.filter(m => m.id !== moduleId) }));
    } catch (err) {
      alert('Failed to delete module');
    }
  };

  // ── Publish toggle ──────────────────────────────────────────────────────────
  const togglePublish = async (course) => {
    await courseApi.update(course.id, { ...course, isPublished: !course.isPublished });
    const updated = { ...course, isPublished: !course.isPublished };
    setCourses(prev => prev.map(c => c.id === course.id ? updated : c));
    if (editingCourse?.id === course.id) {
      setEditingCourse(prev => ({ ...prev, isPublished: !prev.isPublished }));
      setForm(f => ({ ...f, isPublished: !f.isPublished }));
    }
  };

  const syncDocmost = async () => {
    setSyncing(true);
    try {
      await adminApi.syncDocmost();
      alert('Docmost sync started in background');
    } catch (err) {
      alert('Sync failed: ' + (err.error || err.message));
    } finally { setSyncing(false); }
  };

  // ── Generate quiz ───────────────────────────────────────────────────────────
  const generateQuiz = async () => {
    if (!quizForm.content.trim()) return;
    setQuizGenLoading(true);
    setGeneratedQuiz(null);
    try {
      const result = await aiApi.generateQuiz({ ...quizForm, courseId: showQuizGen?.id, courseTitle: showQuizGen?.title });
      setGeneratedQuiz(result);
    } catch (err) {
      alert(err.error || 'Failed to generate quiz');
    } finally { setQuizGenLoading(false); }
  };

  // ── Shared file upload widget ───────────────────────────────────────────────
  const FileUploadField = ({ label, value, onChange, accept, type = 'file', courseId = null }) => (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <div className="flex gap-2">
        <input className="input flex-1 text-sm" value={value || ''} onChange={e => onChange(e.target.value, null)}
          placeholder="Paste URL or upload →" />
        <label className={`btn-secondary text-xs flex items-center gap-1.5 cursor-pointer ${uploadingFile || uploadingThumb ? 'opacity-50' : ''}`}>
          <Upload className="w-3.5 h-3.5" />
          Upload
          <input type="file" accept={accept} className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              type === 'thumbnail' ? setUploadingThumb(true) : setUploadingFile(true);
              try {
                const { url, s3Key } = await uploadFile(file, type, courseId);
                onChange(url, s3Key);
              } catch { alert('Upload failed'); }
              finally { type === 'thumbnail' ? setUploadingThumb(false) : setUploadingFile(false); }
            }} />
        </label>
      </div>
    </div>
  );

  // ── Course info form (shared between create & edit) ─────────────────────────
  const CourseForm = ({ isEdit }) => (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Title *</label>
          <input className="input w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Diamond Fundamentals" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Department</label>
          <select className="input w-full" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="text-xs text-gray-400 block mb-1">Description</label>
          <textarea className="input w-full h-20 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Course description..." />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Tags (comma-separated)</label>
          <input className="input w-full" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="diamond,4c,fundamentals" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Estimated Hours</label>
          <input className="input w-full" type="number" min="0.5" step="0.5" value={form.estimatedHours} onChange={e => setForm(f => ({ ...f, estimatedHours: parseFloat(e.target.value) }))} />
        </div>
        <div className="lg:col-span-2">
          <FileUploadField label="Thumbnail"
            value={form.thumbnail} accept="image/*" type="thumbnail"
            courseId={isEdit ? editingCourse?.id : null}
            onChange={(url, s3Key) => setForm(f => ({ ...f, thumbnail: url, ...(s3Key && { thumbnailS3Key: s3Key }) }))} />
          {form.thumbnail && <img src={form.thumbnail} alt="" className="mt-2 h-16 rounded-lg object-cover border border-gray-700" />}
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Title (Hindi)</label>
          <input className="input w-full" value={form.titleHi || ''} onChange={e => setForm(f => ({ ...f, titleHi: e.target.value }))} placeholder="हिंदी में शीर्षक" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Title (Telugu)</label>
          <input className="input w-full" value={form.titleTe || ''} onChange={e => setForm(f => ({ ...f, titleTe: e.target.value }))} placeholder="తెలుగులో శీర్షిక" />
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
          <span className="text-sm text-gray-300">{form.isPublished ? 'Published' : 'Draft — not visible to learners'}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" checked={form.isMandatory || false} onChange={e => setForm(f => ({ ...f, isMandatory: e.target.checked }))} />
          <span className="text-sm text-gray-300">Mandatory — auto-enroll new JCs</span>
        </label>
      </div>
    </div>
  );

  // ── Module add form ─────────────────────────────────────────────────────────
  const AddModulePanel = () => (
    <div className="mt-4 p-4 bg-gray-800/60 border border-gray-700 rounded-xl space-y-3">
      <h4 className="text-sm font-semibold text-white">Add Module</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Title *</label>
          <input className="input w-full text-sm" value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} placeholder="Module title" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Content Type</label>
          <select className="input w-full text-sm" value={moduleForm.contentType} onChange={e => setModuleForm(f => ({ ...f, contentType: e.target.value, contentUrl: '', s3Key: '' }))}>
            {CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Duration (seconds)</label>
          <input className="input w-full text-sm" type="number" min="0" value={moduleForm.duration} onChange={e => setModuleForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} placeholder="600" />
        </div>
        <div className="col-span-2">
          {moduleForm.contentType === 'ARTICLE' ? (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Article Content</label>
              <textarea className="input w-full h-24 resize-none text-sm" value={moduleForm.contentUrl} onChange={e => setModuleForm(f => ({ ...f, contentUrl: e.target.value }))} placeholder="Write article or paste URL..." />
            </div>
          ) : (
            <FileUploadField label={moduleForm.contentType === 'VIDEO' ? 'Video / Audio' : 'Document / File'}
              value={moduleForm.contentUrl}
              accept={moduleForm.contentType === 'VIDEO' ? 'video/*,audio/*' : moduleForm.contentType === 'PPT' ? '.ppt,.pptx' : '.pdf,.doc,.docx,.jpg,.png'}
              type="file"
              courseId={editingCourse?.id}
              onChange={(url, s3Key) => setModuleForm(f => ({ ...f, contentUrl: url, ...(s3Key && { s3Key }) }))} />
          )}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => { setShowAddModule(false); setModuleForm(emptyModuleForm()); }} className="btn-secondary text-xs py-1.5">Cancel</button>
        <button onClick={handleAddModule} disabled={addingModule || !moduleForm.title.trim()} className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
          {addingModule ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add Module
        </button>
      </div>
    </div>
  );

  // ── VIEWS ───────────────────────────────────────────────────────────────────

  if (view === 'create') return (
    <Layout title="Course Manager">
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setForm(emptyForm()); }} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="font-semibold text-white">Create New Course</h2>
        </div>
        <div className="card space-y-4">
          <CourseForm isEdit={false} />
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-800">
            <button onClick={() => { setView('list'); setForm(emptyForm()); }} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.title} className="btn-primary flex items-center gap-2">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Course
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );

  if (view === 'edit' && editingCourse) return (
    <Layout title="Course Manager">
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setEditingCourse(null); }} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="font-semibold text-white">Edit: {editingCourse.title}</h2>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${form.isPublished ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-700 text-gray-400 border-gray-600'}`}>
            {form.isPublished ? 'Published' : 'Draft'}
          </span>
        </div>

        {/* Course details form */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-white text-sm">Course Details</h3>
          <CourseForm isEdit={true} />
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-800">
            <button onClick={() => togglePublish(editingCourse)} className="btn-secondary text-sm">
              {form.isPublished ? 'Unpublish' : 'Publish'}
            </button>
            <button onClick={() => setShowQuizGen(editingCourse)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> AI Quiz
            </button>
            <button onClick={handleSaveEdit} disabled={saving || !form.title} className="btn-primary flex items-center gap-2">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Modules section */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">Modules ({editingCourse.modules?.length || 0})</h3>
            <button onClick={() => setShowAddModule(v => !v)} className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Module
            </button>
          </div>

          {/* Existing modules */}
          <div className="space-y-2">
            {(editingCourse.modules || []).length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No modules yet. Add one above.</p>
            )}
            {(editingCourse.modules || []).map((mod, idx) => {
              const Icon = MODULE_ICON[mod.contentType] || File;
              return (
                <div key={mod.id} className="flex items-center gap-3 p-3 bg-gray-800/60 border border-gray-700 rounded-xl group">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{mod.title}</div>
                    <div className="text-xs text-gray-500 flex gap-2">
                      <span>{mod.contentType}</span>
                      {mod.duration > 0 && <span>{Math.round(mod.duration / 60)}m</span>}
                      {mod.contentUrl && (
                        <a href={mod.contentUrl} target="_blank" rel="noopener noreferrer"
                          className="text-brand-400 hover:text-brand-300 truncate max-w-[200px]">
                          {mod.contentUrl.startsWith('http') ? 'View file' : mod.contentUrl.substring(0, 40)}
                        </a>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteModule(mod.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {showAddModule && <AddModulePanel />}
        </div>
      </div>

      {/* AI Quiz Generator modal */}
      {showQuizGen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div className="flex items-center gap-3"><Brain className="w-5 h-5 text-brand-400" /><h3 className="font-semibold text-white">AI Quiz Generator</h3></div>
              <button onClick={() => { setShowQuizGen(null); setGeneratedQuiz(null); }} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-400">Generating quiz for: <span className="text-white font-medium">{showQuizGen.title}</span></p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-gray-400 block mb-1">Content Type</label>
                  <select className="input w-full text-sm" value={quizForm.contentType} onChange={e => setQuizForm(f => ({ ...f, contentType: e.target.value }))}>
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-400 block mb-1">Difficulty</label>
                  <select className="input w-full text-sm" value={quizForm.difficulty} onChange={e => setQuizForm(f => ({ ...f, difficulty: e.target.value }))}>
                    {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-400 block mb-1">Questions</label>
                  <input className="input w-full text-sm" type="number" min="3" max="20" value={quizForm.count} onChange={e => setQuizForm(f => ({ ...f, count: parseInt(e.target.value) }))} /></div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Paste course content / transcript</label>
                <textarea className="input w-full h-32 resize-none text-sm" value={quizForm.content} onChange={e => setQuizForm(f => ({ ...f, content: e.target.value }))} placeholder="Paste video transcript, PDF text, or SOP content here..." />
              </div>
              <button onClick={generateQuiz} disabled={quizGenLoading || !quizForm.content} className="btn-primary w-full flex items-center justify-center gap-2">
                {quizGenLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {quizGenLoading ? 'Generating...' : 'Generate Quiz with AI'}
              </button>
              {generatedQuiz && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400"><CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">{generatedQuiz.questions?.length || 0} questions generated{generatedQuiz.quiz ? ' and saved!' : ''}</span></div>
                  {generatedQuiz.questions?.map((q, i) => (
                    <div key={i} className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-brand-400">{i + 1}. {q.type}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${q.difficulty === 'EASY' ? 'bg-emerald-500/20 text-emerald-400' : q.difficulty === 'HARD' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{q.difficulty}</span>
                      </div>
                      <p className="text-sm text-white">{q.text}</p>
                      <p className="text-xs text-emerald-400">✓ {q.correctAnswer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  return (
    <Layout title="Course Manager">
      <div className="max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">{courses.length} courses ({courses.filter(c => c.isPublished).length} published, {courses.filter(c => !c.isPublished).length} drafts)</p>
          <div className="flex items-center gap-2">
            <button onClick={syncDocmost} disabled={syncing}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : t('admin.syncDocmost')}
            </button>
            <button onClick={() => { setForm(emptyForm()); setView('create'); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Course
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
        ) : courses.length === 0 ? (
          <div className="card text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No courses yet.</p>
            <button onClick={() => setView('create')} className="btn-primary mt-4">Create First Course</button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {courses.map(c => (
              <div key={c.id} className="card space-y-3 hover:border-gray-600 transition-colors">
                <div className="flex items-start gap-3">
                  {c.thumbnail
                    ? <img src={c.thumbnail} alt={c.title} className="w-12 h-12 rounded-lg object-cover border border-gray-700 shrink-0" />
                    : <div className="w-12 h-12 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5 text-brand-400" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-white text-sm">{c.title}</h4>
                      {c.isPublished
                        ? <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">Published</span>
                        : <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">Draft</span>
                      }
                      {c.isMandatory && <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">Mandatory</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.description}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-1.5">
                      <span>{c.modules?.length || 0} modules</span>
                      <span>{c.department}</span>
                      <span>{c.estimatedHours}h</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1 border-t border-gray-800">
                  <button onClick={() => togglePublish(c)} className="btn-secondary text-xs py-1.5 flex-1">
                    {c.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => openEdit(c)} className="btn-secondary text-xs py-1.5 flex items-center gap-1 flex-1 justify-center">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => setShowQuizGen(c)} className="btn-primary text-xs py-1.5 flex items-center gap-1.5 flex-1 justify-center">
                    <Brain className="w-3.5 h-3.5" /> AI Quiz
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Quiz Generator modal (list view) */}
      {showQuizGen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div className="flex items-center gap-3"><Brain className="w-5 h-5 text-brand-400" /><h3 className="font-semibold text-white">AI Quiz Generator</h3></div>
              <button onClick={() => { setShowQuizGen(null); setGeneratedQuiz(null); }} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-400">Generating quiz for: <span className="text-white font-medium">{showQuizGen.title}</span></p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-gray-400 block mb-1">Content Type</label>
                  <select className="input w-full text-sm" value={quizForm.contentType} onChange={e => setQuizForm(f => ({ ...f, contentType: e.target.value }))}>
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-400 block mb-1">Difficulty</label>
                  <select className="input w-full text-sm" value={quizForm.difficulty} onChange={e => setQuizForm(f => ({ ...f, difficulty: e.target.value }))}>
                    {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-400 block mb-1">Questions</label>
                  <input className="input w-full text-sm" type="number" min="3" max="20" value={quizForm.count} onChange={e => setQuizForm(f => ({ ...f, count: parseInt(e.target.value) }))} /></div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Paste course content / transcript</label>
                <textarea className="input w-full h-32 resize-none text-sm" value={quizForm.content} onChange={e => setQuizForm(f => ({ ...f, content: e.target.value }))} placeholder="Paste video transcript, PDF text, or SOP content here..." />
              </div>
              <button onClick={generateQuiz} disabled={quizGenLoading || !quizForm.content} className="btn-primary w-full flex items-center justify-center gap-2">
                {quizGenLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {quizGenLoading ? 'Generating...' : 'Generate Quiz with AI'}
              </button>
              {generatedQuiz && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400"><CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">{generatedQuiz.questions?.length || 0} questions generated{generatedQuiz.quiz ? ' and saved!' : ''}</span></div>
                  {generatedQuiz.questions?.map((q, i) => (
                    <div key={i} className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center gap-2"><span className="text-xs font-medium text-brand-400">{i + 1}. {q.type}</span><span className={`text-xs px-1.5 py-0.5 rounded ${q.difficulty === 'EASY' ? 'bg-emerald-500/20 text-emerald-400' : q.difficulty === 'HARD' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{q.difficulty}</span></div>
                      <p className="text-sm text-white">{q.text}</p>
                      <p className="text-xs text-emerald-400">✓ {q.correctAnswer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
