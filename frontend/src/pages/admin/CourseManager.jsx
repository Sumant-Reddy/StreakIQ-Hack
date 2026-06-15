import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { courseApi, aiApi } from '../../services/api';
import { Plus, BookOpen, Edit, Eye, Brain, FileText, X, CheckCircle, Loader } from 'lucide-react';

export default function CourseManager() {
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showQuizGen, setShowQuizGen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quizGenLoading, setQuizGenLoading] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);

  const [form, setForm] = useState({
    title: '', description: '', department: 'Retail', tags: '', estimatedHours: 2, isPublished: false
  });
  const [quizForm, setQuizForm] = useState({ content: '', contentType: 'PDF', difficulty: 'MEDIUM', count: 5 });

  useEffect(() => {
    courseApi.list({ limit: 50 }).then(d => setCourses(d.courses || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const course = await courseApi.create(form);
      setCourses(prev => [course, ...prev]);
      setShowForm(false);
      setForm({ title: '', description: '', department: 'Retail', tags: '', estimatedHours: 2, isPublished: false });
    } catch (err) {
      alert(err.error || 'Failed to create course');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (course) => {
    await courseApi.update(course.id, { ...course, isPublished: !course.isPublished });
    setCourses(prev => prev.map(c => c.id === course.id ? { ...c, isPublished: !c.isPublished } : c));
  };

  const generateQuiz = async () => {
    if (!quizForm.content.trim()) return;
    setQuizGenLoading(true);
    setGeneratedQuiz(null);
    try {
      const result = await aiApi.generateQuiz({ ...quizForm, courseId: showQuizGen?.id, courseTitle: showQuizGen?.title });
      setGeneratedQuiz(result);
    } catch (err) {
      alert(err.error || 'Failed to generate quiz');
    } finally {
      setQuizGenLoading(false);
    }
  };

  return (
    <Layout title="Course Manager">
      <div className="max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">{courses.length} courses</p>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Course
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="card border-brand-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Create New Course</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Title *</label>
                <input className="input w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Diamond Fundamentals" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Department</label>
                <select className="input w-full" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  <option value="Retail">Retail</option>
                  <option value="Operations">Operations</option>
                  <option value="Management">Management</option>
                  <option value="Training">Training</option>
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
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
                <span className="text-sm text-gray-300">Publish immediately</span>
              </label>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleCreate} disabled={saving || !form.title} className="btn-primary flex items-center gap-2">
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Course
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Quiz Generator modal */}
        {showQuizGen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5 text-brand-400" />
                  <h3 className="font-semibold text-white">AI Quiz Generator</h3>
                </div>
                <button onClick={() => { setShowQuizGen(null); setGeneratedQuiz(null); }} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-400">Generating quiz for: <span className="text-white font-medium">{showQuizGen.title}</span></p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Content Type</label>
                    <select className="input w-full text-sm" value={quizForm.contentType} onChange={e => setQuizForm(f => ({ ...f, contentType: e.target.value }))}>
                      {['VIDEO', 'PDF', 'PPT', 'SOP', 'ARTICLE'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Difficulty</label>
                    <select className="input w-full text-sm" value={quizForm.difficulty} onChange={e => setQuizForm(f => ({ ...f, difficulty: e.target.value }))}>
                      {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Questions</label>
                    <input className="input w-full text-sm" type="number" min="3" max="20" value={quizForm.count} onChange={e => setQuizForm(f => ({ ...f, count: parseInt(e.target.value) }))} />
                  </div>
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
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{generatedQuiz.questions?.length || 0} questions generated{generatedQuiz.quiz ? ' and saved!' : ''}</span>
                    </div>
                    {generatedQuiz.questions?.map((q, i) => (
                      <div key={i} className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-brand-400">{i + 1}. {q.type}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded text-xs ${q.difficulty === 'EASY' ? 'bg-emerald-500/20 text-emerald-400' : q.difficulty === 'HARD' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{q.difficulty}</span>
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

        {/* Course list */}
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {courses.map(c => (
              <div key={c.id} className="card space-y-3 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-white">{c.title}</h4>
                      {c.isPublished
                        ? <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">Published</span>
                        : <span className="text-xs bg-gray-700 text-gray-400 border border-gray-600 px-2 py-0.5 rounded-full">Draft</span>
                      }
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.description}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-2">
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {c.modules?.length || 0} modules</span>
                      <span>{c.department}</span>
                      <span>{c.estimatedHours}h</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1 border-t border-gray-800">
                  <button onClick={() => togglePublish(c)} className="btn-secondary text-xs py-1.5 flex-1">
                    {c.isPublished ? 'Unpublish' : 'Publish'}
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
    </Layout>
  );
}
