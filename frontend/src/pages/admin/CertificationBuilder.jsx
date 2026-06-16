import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { adminApi, courseApi } from '../../services/api';
import { Award, Plus, Edit2, Trash2, X, CheckCircle, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS = {
  READY: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  NEARLY_READY: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  NOT_READY: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const EMPTY_FORM = {
  name: '',
  description: '',
  minQuizScore: 70,
  minCourseCompletion: 80,
  courseIds: [],
};

export default function CertificationBuilder() {
  const [certs, setCerts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // cert object or null
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    Promise.all([adminApi.certifications(), courseApi.list({ limit: 100 })])
      .then(([certsData, coursesData]) => {
        setCerts(Array.isArray(certsData) ? certsData : []);
        setCourses(coursesData.courses || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (cert) => {
    setEditing(cert);
    setForm({
      name: cert.name,
      description: cert.description || '',
      minQuizScore: cert.minQuizScore,
      minCourseCompletion: cert.minCourseCompletion,
      courseIds: cert.courses.map(cc => cc.course.id),
    });
    setShowModal(true);
  };

  const toggleCourse = (id) => {
    setForm(f => ({
      ...f,
      courseIds: f.courseIds.includes(id)
        ? f.courseIds.filter(cid => cid !== id)
        : [...f.courseIds, id],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await adminApi.updateCertification(editing.id, form);
        setCerts(prev => prev.map(c => c.id === editing.id ? updated : c));
      } else {
        const created = await adminApi.createCertification(form);
        setCerts(prev => [created, ...prev]);
      }
      setShowModal(false);
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteCert = async (id) => {
    if (!confirm('Delete this certification? This cannot be undone.')) return;
    await adminApi.deleteCertification(id);
    setCerts(prev => prev.filter(c => c.id !== id));
  };

  const toggleActive = async (cert) => {
    const updated = await adminApi.updateCertification(cert.id, { isActive: !cert.isActive });
    setCerts(prev => prev.map(c => c.id === cert.id ? { ...c, isActive: updated.isActive } : c));
  };

  return (
    <Layout title="Certification Builder">
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Certifications</h2>
            <p className="text-sm text-gray-400 mt-0.5">Build certification tracks with required courses and passing criteria</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Certification
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : certs.length === 0 ? (
          <div className="card text-center py-16">
            <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <div className="text-gray-400 font-medium">No certifications yet</div>
            <div className="text-sm text-gray-500 mt-1 mb-4">Create your first certification track</div>
            <button onClick={openCreate} className="btn-primary px-6">Create Certification</button>
          </div>
        ) : (
          <div className="space-y-3">
            {certs.map(cert => (
              <div key={cert.id} className={`card border ${cert.isActive ? 'border-gray-700' : 'border-gray-800 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cert.isActive ? 'bg-yellow-500/20' : 'bg-gray-700'}`}>
                      <Award className={`w-5 h-5 ${cert.isActive ? 'text-yellow-400' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{cert.name}</h3>
                        {!cert.isActive && <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Inactive</span>}
                      </div>
                      {cert.description && <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{cert.description}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>Min Quiz: <span className="text-white font-medium">{cert.minQuizScore}%</span></span>
                        <span>Min Completion: <span className="text-white font-medium">{cert.minCourseCompletion}%</span></span>
                        <span>{cert.courses.length} course{cert.courses.length !== 1 ? 's' : ''} required</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setExpanded(e => ({ ...e, [cert.id]: !e[cert.id] }))}
                      className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
                      {expanded[cert.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(cert)} className="text-gray-400 hover:text-brand-400 p-1.5 rounded-lg hover:bg-gray-800">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(cert)}
                      className={`text-xs px-2.5 py-1 rounded-lg border ${cert.isActive ? 'border-gray-700 text-gray-400 hover:border-red-500/50 hover:text-red-400' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}>
                      {cert.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => deleteCert(cert.id)} className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expanded[cert.id] && cert.courses.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="text-xs font-medium text-gray-400 mb-2">Required Courses</div>
                    <div className="grid grid-cols-2 gap-2">
                      {cert.courses.map(cc => (
                        <div key={cc.course.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                          <BookOpen className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                          <span className="text-sm text-gray-300 truncate">{cc.course.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Edit Certification' : 'Create Certification'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4 flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Certification Name *</label>
                <input className="input w-full" placeholder="e.g. Diamond Expert Level 1"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                <textarea className="input w-full h-20 resize-none" placeholder="What does this certification validate?"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Minimum Quiz Score (%)</label>
                  <input type="number" min="0" max="100" className="input w-full"
                    value={form.minQuizScore} onChange={e => setForm(f => ({ ...f, minQuizScore: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Minimum Course Completion (%)</label>
                  <input type="number" min="0" max="100" className="input w-full"
                    value={form.minCourseCompletion} onChange={e => setForm(f => ({ ...f, minCourseCompletion: Number(e.target.value) }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Required Courses <span className="text-gray-500">({form.courseIds.length} selected)</span>
                </label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {courses.map(c => {
                    const selected = form.courseIds.includes(c.id);
                    return (
                      <button key={c.id} onClick={() => toggleCourse(c.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${selected ? 'bg-brand-500/20 border-brand-500/40 text-white' : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600'}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${selected ? 'bg-brand-500' : 'bg-gray-700'}`}>
                          {selected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-sm truncate">{c.title}</span>
                        {c.department && <span className="text-xs text-gray-500 ml-auto shrink-0">{c.department}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Certification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
