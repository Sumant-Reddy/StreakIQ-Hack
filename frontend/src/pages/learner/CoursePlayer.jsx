import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import { courseApi, aiApi } from '../../services/api';
import {
  BookOpen, FileText, Play, CheckCircle, Clock, ChevronRight,
  Brain, Layers, Star, Lock, AlertCircle, Trophy, X, ExternalLink,
} from 'lucide-react';

const CONTENT_ICONS = { VIDEO: Play, PDF: FileText, PPT: Layers, SOP: FileText, ARTICLE: BookOpen };
const CONTENT_COLORS = { VIDEO: 'text-blue-400', PDF: 'text-red-400', PPT: 'text-orange-400', SOP: 'text-purple-400', ARTICLE: 'text-green-400' };

export default function CoursePlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [course, setCourse] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [watchedModules, setWatchedModules] = useState(new Set());
  const [quizPrompt, setQuizPrompt] = useState(null); // { quizId, title, questionCount }
  const [watchProgress, setWatchProgress] = useState(0); // 0-100
  const videoRef = useRef();
  const watchTimerRef = useRef();

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

  const markModuleComplete = async (module) => {
    if (!module || !course?.enrolled) return;
    try {
      await courseApi.recordWatch(course.id, module.id, {
        watchedSecs: module.duration || 300,
        totalSecs: module.duration || 300,
        completed: true,
      });
      setWatchedModules(prev => new Set([...prev, module.id]));
      setWatchProgress(100);

      // Check for quiz after completion
      const courseData = await courseApi.getNextQuiz(course.id);
      if (courseData) {
        setQuizPrompt(courseData);
      }
    } catch (err) {
      console.error('Watch record failed:', err);
    }
  };

  const handleVideoProgress = (e) => {
    const v = e.target;
    if (v.duration > 0) {
      const pct = Math.round((v.currentTime / v.duration) * 100);
      setWatchProgress(pct);
      if (pct >= 90 && activeModule) {
        markModuleComplete(activeModule);
      }
    }
  };

  if (loading) return (
    <Layout title={t('nav.myCourses')}>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    </Layout>
  );

  if (!course) return (
    <Layout title={t('nav.myCourses')}>
      <div className="text-gray-400 text-center mt-20">{t('course.courseNotFound', 'Course not found')}</div>
    </Layout>
  );

  // Detect file type from URL extension, regardless of contentType
  const getFileKind = (url = '') => {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) return 'AUDIO';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'IMAGE';
    if (['doc', 'docx'].includes(ext)) return 'WORD';
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'VIDEO_FILE';
    return null;
  };

  const renderContent = (module) => {
    if (!module) return null;

    // Use presigned S3 URL when available (generated fresh by the backend on every GET /courses/:id)
    const contentUrl = module.presignedUrl || module.contentUrl;

    // Extension-based rendering overrides contentType for uploaded local files
    const fileKind = getFileKind(contentUrl);

    if (fileKind === 'AUDIO') {
      return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-8 flex flex-col items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500/30 to-pink-500/30 flex items-center justify-center">
            <svg className="w-12 h-12 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-white font-medium mb-1">{module.title}</div>
            <div className="text-xs text-gray-500 mb-4">Audio lesson</div>
          </div>
          <audio
            src={contentUrl}
            controls
            className="w-full max-w-md"
            onEnded={() => markModuleComplete(module)}
            style={{ colorScheme: 'dark' }}
          >
            Your browser does not support the audio element.
          </audio>
          <button onClick={() => markModuleComplete(module)} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Mark as Listened
          </button>
        </div>
      );
    }

    if (fileKind === 'IMAGE') {
      return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          <img
            src={contentUrl}
            alt={module.title}
            className="w-full object-contain max-h-[560px] rounded-xl"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm text-gray-400">{module.title}</div>
            <div className="flex gap-2">
              <a href={contentUrl} target="_blank" rel="noreferrer"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Open full size
              </a>
              <button onClick={() => markModuleComplete(module)} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1.5 ml-3">
                <CheckCircle className="w-3.5 h-3.5" /> Mark as Viewed
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (fileKind === 'WORD') {
      return (
        <div className="bg-gray-800 rounded-xl p-8 flex flex-col items-center justify-center gap-4 border border-gray-700 min-h-48">
          <div className="w-16 h-16 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <FileText className="w-8 h-8 text-blue-400" />
          </div>
          <div className="text-center">
            <div className="text-white font-medium">{module.title}</div>
            <div className="text-sm text-gray-400 mt-1">Word Document (.docx)</div>
            <div className="text-xs text-gray-500 mt-0.5">Download to view in Microsoft Word or Google Docs</div>
          </div>
          <div className="flex gap-3">
            <a href={contentUrl} download className="btn-primary text-sm px-5 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" /> Download Document
            </a>
            <a href={`https://docs.google.com/viewer?url=${encodeURIComponent(contentUrl)}`} target="_blank" rel="noreferrer"
              className="btn-secondary text-sm px-4 flex items-center gap-1.5">
              View Online
            </a>
          </div>
          <button onClick={() => markModuleComplete(module)} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Mark as Read
          </button>
        </div>
      );
    }

    if (module.contentType === 'VIDEO') {
      const isYouTube = contentUrl?.includes('youtube') || contentUrl?.includes('youtu.be');
      const isYouTubeEmbed = contentUrl?.includes('embed');

      if (isYouTube && !isYouTubeEmbed) {
        const videoId = contentUrl?.match(/(?:v=|youtu.be\/)([^&\s]+)/)?.[1];
        const ytEmbed = videoId ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1` : null;
        if (ytEmbed) {
          return (
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-700">
              <iframe src={ytEmbed} title={module.title} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
            </div>
          );
        }
      }

      if (isYouTubeEmbed || contentUrl?.includes('vimeo') || contentUrl?.includes('embed')) {
        return (
          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-700">
            <iframe src={contentUrl} title={module.title} className="w-full h-full" allowFullScreen />
          </div>
        );
      }

      // Direct video file (including S3 presigned URL)
      return (
        <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
          {contentUrl ? (
            <video ref={videoRef} src={contentUrl} controls className="w-full h-full" onTimeUpdate={handleVideoProgress} onEnded={() => markModuleComplete(module)}>
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Play className="w-8 h-8 text-blue-400" />
              </div>
              <div className="text-gray-400 text-sm">{t('player.noContent', 'No video URL configured')}</div>
              <button onClick={() => markModuleComplete(module)} className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {t('course.markAsWatched', 'Mark as Watched')}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (module.contentType === 'PPT') {
      const embedUrl = contentUrl?.includes('docs.google.com')
        ? contentUrl.replace('/pub?', '/embed?').replace('/edit', '/embed')
        : contentUrl;
      return (
        <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
          {embedUrl ? (
            <iframe src={embedUrl} title={module.title} className="w-full h-full" allowFullScreen />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Layers className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                <div className="text-gray-400 text-sm">{t('course.noContentUrl', 'No PPT URL configured')}</div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (module.contentType === 'ARTICLE') {
      return (
        <div className="bg-gray-800 rounded-xl p-6 min-h-48 border border-gray-700">
          <div className="prose prose-invert max-w-none text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
            {contentUrl || t('player.noContent', 'No content available')}
          </div>
        </div>
      );
    }

    // PDF / SOP
    return (
      <div className="bg-gray-800 rounded-xl p-6 min-h-48 flex flex-col items-center justify-center gap-4 border border-gray-700">
        <FileText className="w-16 h-16 text-red-400" />
        <div className="text-center">
          <div className="text-white font-medium">{module.title}</div>
          <div className="text-sm text-gray-400 mt-1">{module.contentType} Document</div>
        </div>
        {contentUrl && (
          <a href={contentUrl} target="_blank" rel="noreferrer"
            className="btn-primary text-sm px-6 flex items-center gap-2">
            <ExternalLink className="w-4 h-4" /> {t('course.openDocument', 'Open Document')}
          </a>
        )}
        <button onClick={() => markModuleComplete(module)} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" /> {t('course.markAsRead', 'Mark as Read')}
        </button>
      </div>
    );
  };

  return (
    <Layout title={course.title}>
      <div className="max-w-6xl">
        {/* Quiz Available Prompt */}
        {quizPrompt && (
          <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-yellow-400 shrink-0" />
              <div>
                <div className="font-medium text-yellow-300 text-sm">Module Complete — Quiz Unlocked!</div>
                <div className="text-xs text-gray-400">{quizPrompt.title} · {quizPrompt._count?.questions || 10} questions</div>
                {quizPrompt.myBestScore !== null && (
                  <div className="text-xs text-brand-400">Your best: {quizPrompt.myBestScore}% · Attempt #{(quizPrompt.attemptCount || 0) + 1}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setQuizPrompt(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
              <Link to={`/learn/quiz/${quizPrompt.id}`} className="btn-primary text-sm px-4 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> Take Quiz
              </Link>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Module list */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white">{t('player.modules', 'Modules')}</h3>
              <span className="text-xs text-gray-400">{course.modules?.length} {t('course.modules', 'modules')}</span>
            </div>
            {course.modules?.map((m) => {
              const Icon = CONTENT_ICONS[m.contentType] || BookOpen;
              const active = activeModule?.id === m.id;
              const done = watchedModules.has(m.id);
              return (
                <button key={m.id} onClick={() => { setActiveModule(m); setShowFlashcards(false); setWatchProgress(0); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${active ? 'bg-brand-500/20 border border-brand-500/40' : 'hover:bg-gray-800 border border-transparent'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-brand-500/30' : done ? 'bg-emerald-500/20' : 'bg-gray-700'}`}>
                    {done ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Icon className={`w-4 h-4 ${active ? 'text-brand-400' : CONTENT_COLORS[m.contentType] || 'text-gray-400'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{m.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {Math.round((m.duration || 0) / 60)}m · {m.contentType}
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
                  <div className="text-xs text-gray-500">{q.questions?.length} {t('quiz.question', 'questions')} · {q.passingScore}% to pass</div>
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
                <h3 className="font-semibold text-white mb-2">{t('course.enrollToStart', 'Enroll to Start')}</h3>
                <p className="text-gray-400 text-sm mb-5">{t('course.getAccessToModules', 'Get access to all modules')}</p>
                <button onClick={handleEnroll} className="btn-primary px-8 py-2.5">{t('course.enrollNow', 'Enroll Now')}</button>
              </div>
            ) : activeModule ? (
              <>
                {showFlashcards ? (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">{t('player.flashcards', 'Flashcards')}</h3>
                      <button onClick={() => setShowFlashcards(false)} className="text-xs text-gray-400 hover:text-white">{t('common.close', 'Close')}</button>
                    </div>
                    {flashcards.length > 0 ? (
                      <div className="text-center">
                        <div className="text-xs text-gray-400 mb-4">{cardIndex + 1} / {flashcards.length}</div>
                        <div className="min-h-40 flex items-center justify-center bg-gray-800 rounded-xl p-6 cursor-pointer border-2 border-dashed border-gray-700 hover:border-brand-500/50"
                          onClick={() => setCardFlipped(!cardFlipped)}>
                          <div className="text-center">
                            <div className="text-xs text-brand-400 mb-2">{cardFlipped ? t('course.answer', 'Answer') : t('course.question', 'Question')}</div>
                            <div className="text-white font-medium">{cardFlipped ? flashcards[cardIndex]?.back : flashcards[cardIndex]?.front}</div>
                            {!cardFlipped && <div className="text-xs text-gray-500 mt-3">{t('course.tapToReveal', 'Tap to reveal')}</div>}
                          </div>
                        </div>
                        <div className="flex justify-center gap-3 mt-4">
                          <button onClick={() => { setCardIndex(Math.max(0, cardIndex - 1)); setCardFlipped(false); }} disabled={cardIndex === 0} className="btn-secondary text-sm px-4">{t('course.previous', 'Previous')}</button>
                          <button onClick={() => { setCardIndex(Math.min(flashcards.length - 1, cardIndex + 1)); setCardFlipped(false); }} disabled={cardIndex === flashcards.length - 1} className="btn-primary text-sm px-4">{t('course.next', 'Next')}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">{t('player.noContent', 'No flashcards available')}</div>
                    )}
                  </div>
                ) : (
                  <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{activeModule.title}</h3>
                        <p className="text-xs text-gray-400">{activeModule.contentType} · {Math.round((activeModule.duration || 0) / 60)}m</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => loadFlashcards(activeModule.id)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" /> {t('player.flashcards', 'Flashcards')}
                        </button>
                        {activeModule.contentType !== 'VIDEO' && (
                          <button onClick={() => markModuleComplete(activeModule)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> {t('player.markComplete', 'Mark Complete')}
                          </button>
                        )}
                        <Link to="/learn/ai-companion" className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" /> Ask AI
                        </Link>
                      </div>
                    </div>

                    {renderContent(activeModule)}

                    {/* Video progress bar */}
                    {activeModule.contentType === 'VIDEO' && watchProgress > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{t('player.watchProgress', 'Watch Progress')}</span>
                          <span>{watchProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-brand-500 to-pink-500 rounded-full transition-all" style={{ width: `${watchProgress}%` }} />
                        </div>
                      </div>
                    )}

                    {/* AI Summary */}
                    {activeModule.aiSummary && (
                      <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-brand-400" />
                          <span className="text-xs font-semibold text-brand-400">{t('player.aiSummary', 'AI Summary')}</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{activeModule.aiSummary}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="card text-center py-12 text-gray-400">{t('course.selectModule', 'Select a module to start learning')}</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
