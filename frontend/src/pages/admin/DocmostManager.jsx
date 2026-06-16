import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import { adminApi } from '../../services/api';
import {
  FileText, Plus, Edit2, Trash2, RefreshCw, Search, X,
  ChevronDown, ChevronUp, Clock, Database, ExternalLink, BookOpen
} from 'lucide-react';

const EMPTY_FORM = { title: '', content: '', spaceId: '' };

export default function DocmostManager() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null); // null = create mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listDocuments();
      setDocs(data.docs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditDoc(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = async (doc) => {
    setEditDoc(doc);
    setError('');
    // Fetch full content
    try {
      const full = await adminApi.getDocument(doc.docmostId);
      const parts = (full.content || '').split('\n\n');
      const title = parts[0] || doc.title;
      const content = parts.slice(1).join('\n\n');
      setForm({ title, content, spaceId: doc.spaceId || '' });
    } catch {
      setForm({ title: doc.title, content: '', spaceId: doc.spaceId || '' });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editDoc) {
        await adminApi.updateDocument(editDoc.docmostId, form);
      } else {
        await adminApi.createDocument(form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.error || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docmostId) => {
    try {
      await adminApi.deleteDocument(docmostId);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError('Delete failed: ' + (err.error || err.message));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await adminApi.syncDocmost();
      setTimeout(() => { setSyncing(false); load(); }, 3000);
    } catch {
      setSyncing(false);
    }
  };

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Knowledge Base">
      <div className="max-w-5xl space-y-5">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-semibold text-lg">Knowledge Base Documents</h2>
            <p className="text-gray-400 text-sm mt-0.5">{total} documents · embedded in RAG</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="bg-gray-800 border border-gray-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500 w-48" />
            </div>
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-all disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-brand-400' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Docmost'}
            </button>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-all">
              <Plus className="w-4 h-4" /> New Document
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Info banner */}
        <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl p-4 flex items-start gap-3">
          <Database className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <span className="font-medium text-white">RAG Knowledge Base</span> — Documents created here are automatically chunked, embedded with Gemini <code className="text-brand-400 text-xs">text-embedding-004</code>, and stored in Qdrant. JC learners get answers grounded in this content via the AI Companion.
          </div>
        </div>

        {/* Doc list */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">{search ? 'No documents match your search' : 'No documents yet. Create your first knowledge base document.'}</p>
            {!search && <button onClick={openCreate} className="btn-primary mt-4 text-sm">Create Document</button>}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(doc => (
              <div key={doc.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl transition-all">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{doc.title}</span>
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">embedded</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(doc.lastSyncedAt).toLocaleDateString()}</span>
                      {doc.spaceId && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{doc.spaceId.slice(0, 8)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}
                      className="p-2 text-gray-500 hover:text-gray-300 transition-colors">
                      {expanded === doc.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(doc)}
                      className="p-2 text-gray-500 hover:text-brand-400 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(doc)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {expanded === doc.id && (
                  <div className="border-t border-gray-800 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">ID: <code className="text-brand-400">{doc.docmostId}</code></span>
                      {doc.embeddingId && (
                        <span className="text-xs text-gray-500">Vector ID: <code className="text-gray-400">{doc.embeddingId}</code></span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
              <h3 className="text-white font-semibold text-lg">
                {editDoc ? 'Edit Document' : 'New Knowledge Base Document'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Document Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Diamond Grading Guide — 4Cs"
                  className="input w-full" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Content * <span className="text-gray-500 font-normal">(will be chunked and embedded for RAG)</span>
                </label>
                <textarea value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Paste training content, SOPs, product knowledge, or any reference material..."
                  rows={14}
                  className="input w-full font-mono text-sm resize-none" />
                <p className="text-xs text-gray-500 mt-1">
                  ~{Math.ceil((form.content.split(/s+/).length) / 500)} chunks · {form.content.length} chars
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Space ID <span className="text-gray-500 font-normal">(optional — leave blank for default)</span></label>
                <input value={form.spaceId} onChange={e => setForm(f => ({ ...f, spaceId: e.target.value }))}
                  placeholder="Docmost space UUID"
                  className="input w-full" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-800 shrink-0">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="btn-primary text-sm px-6 disabled:opacity-50">
                {saving ? (editDoc ? 'Saving...' : 'Creating & Embedding...') : (editDoc ? 'Save Changes' : 'Create & Embed')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-white font-semibold mb-2">Delete Document?</h3>
            <p className="text-gray-400 text-sm mb-1">
              <span className="text-white font-medium">"{deleteTarget.title}"</span> will be removed from:
            </p>
            <ul className="text-sm text-gray-500 list-disc list-inside mb-5 space-y-1">
              <li>Docmost wiki</li>
              <li>Qdrant vector database</li>
              <li>YAMI knowledge base</li>
            </ul>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget.docmostId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-all">
                Delete & Remove Embeddings
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
