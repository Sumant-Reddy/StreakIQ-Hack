import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { courseApi, aiApi } from '../../services/api';
import { BookOpen, FileText, Play, CheckCircle, Clock, ChevronRight, Brain, Layers, Star, Lock } from 'lucide-react';

const CONTENT_ICONS = { VIDEO: Play, PDF: FileText, PPT: Layers, SOP: FileText, ARTICLE: BookOpen };

export default function CoursePlayer() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    courseApi.get(id)
      .then(c => {
        setCourse(c);
        if (c.modules?.[0]) setActiveModule(c.modules[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleEnroll = () => courseApi.enroll(id).then(() => setCourse(c => ({ ...c, enrolled: true })));

  const loadFlashcards = async (moduleId) => {
    const data = await aiApi.flashcards(moduleId);
    setFlashcards(data);
    setShowFlashcards(true);
    setCardIndex(0);
    setCardFlipped(false);
  };

  const handleVideoEnd = () => {
    if (activeModule) {
      courseApi.recordWatch(course.id, activeModule.id, {
        watchedSecs: activeModule.duration,
        totalSecs: activeModule.duration,
        completed: true,
      });
    }
  };

  if (loading) return <Layout title="Course"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div></Layout>;
  if (!course) return <Layout title="Course"><div className="text-gray-400 text-center mt-20">Course not found</div></Layout>;

  return (
    <Layout title={course.title}>
      <div className="max-w-6xl">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Module list */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white">Course Content</h3>
              <span className="text-xs text-gray-400">{course.modules?.length} modules</span>
            </div>
            {course.modules?.map((m, i) => {
              const Icon = CONTENT_ICONS[m.contentType] || BookOpen;
              const active = activeModule?.id === m.id;
              return (
                <button key={m.id} onClick={() => { setActiveModule(m); setShowFlashcards(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${active ? 'bg-brand-500/20 border border-brand-500/40' : 'hover:bg-gray-800 border border-transparent'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-brand-500/30' : 'bg-gray-700'}`}>
                    <Icon className={`w-4 h-4 ${active ? 'text-brand-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{m.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {Math.round(m.duration / 60)} min · {m.contentType}
                    </div>
                  </div>
                </button>
              );
            })}

            {course.quizzes?.map(q => (
              <Link key={q.id} to={`/learn/quiz/${q.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 border border-gray-700 group">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Star className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{q.title}</div>
                  <div className="text-xs text-gray-500">{q.questions?.length} questions · {q.passingScore}% to pass</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
              </Link>
            ))}
          </div>

          {/* Content area */}
          <div className="lg:col-span-2 space-y-4">
            {!course.enrolled ? (
              <div className="card text-center py-12">
                <Lock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">Enroll to Start Learning</h3>
                <p className="text-gray-400 text-sm mb-5">Get access to all modules, AI companion, and assessments</p>
                <button onClick={handleEnroll} className="btn-primary px-8 py-2.5">Enroll Now</button>
              </div>
            ) : activeModule ? (
              <>
                {showFlashcards ? (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">AI Flashcards</h3>
                      <button onClick={() => setShowFlashcards(false)} className="text-xs text-gray-400 hover:text-white">Close</button>
                    </div>
                    {flashcards.length > 0 ? (
                      <div className="text-center">
                        <div className="text-xs text-gray-400 mb-4">{cardIndex + 1} / {flashcards.length}</div>
                        <div className="min-h-40 flex items-center justify-center bg-gray-800 rounded-xl p-6 cursor-pointer border-2 border-dashed border-gray-700 hover:border-brand-500/50 transition-colors"
                          onClick={() => setCardFlipped(!cardFlipped)}>
                          <div className="text-center">
                            <div className="text-xs text-brand-400 mb-2">{cardFlipped ? 'ANSWER' : 'QUESTION'}</div>
                            <div className="text-white font-medium">{cardFlipped ? flashcards[cardIndex]?.back : flashcards[cardIndex]?.front}</div>
                            {!cardFlipped && <div className="text-xs text-gray-500 mt-3">Tap to reveal answer</div>}
                          </div>
                        </div>
                        <div className="flex justify-center gap-3 mt-4">
                          <button onClick={() => { setCardIndex(Math.max(0, cardIndex - 1)); setCardFlipped(false); }} disabled={cardIndex === 0} className="btn-secondary text-sm px-4">Previous</button>
                          <button onClick={() => { setCardIndex(Math.min(flashcards.length - 1, cardIndex + 1)); setCardFlipped(false); }} disabled={cardIndex === flashcards.length - 1} className="btn-primary text-sm px-4">Next</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">No flashcards available. Generate them first.</div>
                    )}
                  </div>
                ) : (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-white">{activeModule.title}</h3>
                        <p className="text-xs text-gray-400">{activeModule.contentType} · {Math.round(activeModule.duration / 60)} min</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => loadFlashcards(activeModule.id)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" /> Flashcards
                        </button>
                        <Link to="/learn/ai-companion" className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" /> Ask AI
                        </Link>
                      </div>
                    </div>

                    {activeModule.contentType === 'VIDEO' ? (
                      <div className="aspect-video bg-gray-800 rounded-xl flex items-center justify-center border border-gray-700">
                        <div className="text-center">
                          <div className="w-16 h-16 rounded-full bg-brand-500/20 flex items-center justify-center mx-auto mb-3 cursor-pointer hover:bg-brand-500/30 transition-colors" onClick={handleVideoEnd}>
                            <Play className="w-8 h-8 text-brand-400" />
                          </div>
                          <div className="text-gray-400 text-sm">Video Player</div>
                          <div className="text-xs text-gray-600 mt-1">{activeModule.contentUrl}</div>
                          <button onClick={handleVideoEnd} className="btn-primary text-xs mt-3 px-4 py-1.5">Mark as Watched</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-800 rounded-xl p-6 min-h-48 flex items-center justify-center border border-gray-700">
                        <div className="text-center">
                          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <div className="text-gray-400 text-sm">{activeModule.contentType} Document</div>
                          <a href={activeModule.contentUrl} target="_blank" rel="noreferrer" className="btn-primary text-xs mt-3 px-4 py-1.5 inline-block">Open Document</a>
                        </div>
                      </div>
                    )}

                    {activeModule.aiSummary && (
                      <div className="mt-4 bg-brand-500/10 border border-brand-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-brand-400" />
                          <span className="text-xs font-semibold text-brand-400">AI Summary</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{activeModule.aiSummary}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="card text-center py-12 text-gray-400">Select a module to start</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
