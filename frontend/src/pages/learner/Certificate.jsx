import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { learnerApi, gamificationApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Award, Download, ArrowLeft, CheckCircle, Star, Medal } from 'lucide-react';

// YAMI Learn diamond SVG logo — inline so it works in print window too
const YAMI_LOGO_SVG = `
<svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c4b5fd"/>
      <stop offset="100%" stop-color="#f9a8d4"/>
    </linearGradient>
    <linearGradient id="g3" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ddd6fe"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <!-- Outer hexagon diamond -->
  <polygon points="28,4 52,16 52,40 28,52 4,40 4,16" fill="url(#g1)" opacity="0.15"/>
  <polygon points="28,4 52,16 52,40 28,52 4,40 4,16" fill="none" stroke="url(#g1)" stroke-width="1.5"/>
  <!-- Diamond gem shape -->
  <polygon points="28,10 44,24 28,48 12,24" fill="url(#g1)"/>
  <!-- Facets -->
  <polygon points="28,10 44,24 28,24" fill="url(#g2)" opacity="0.6"/>
  <polygon points="28,10 12,24 28,24" fill="url(#g3)" opacity="0.4"/>
  <line x1="28" y1="10" x2="28" y2="48" stroke="white" stroke-width="0.5" opacity="0.3"/>
  <line x1="12" y1="24" x2="44" y2="24" stroke="white" stroke-width="0.5" opacity="0.3"/>
  <!-- Sparkle top right -->
  <circle cx="46" cy="10" r="2" fill="#f9a8d4" opacity="0.8"/>
  <circle cx="44" cy="8" r="1" fill="#ddd6fe" opacity="0.6"/>
</svg>`;

// Inline logo as React component for screen
function YamiLogo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1s" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed"/>
          <stop offset="50%" stopColor="#a855f7"/>
          <stop offset="100%" stopColor="#ec4899"/>
        </linearGradient>
        <linearGradient id="g2s" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd"/>
          <stop offset="100%" stopColor="#f9a8d4"/>
        </linearGradient>
        <linearGradient id="g3s" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ddd6fe"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
      </defs>
      <polygon points="28,4 52,16 52,40 28,52 4,40 4,16" fill="url(#g1s)" opacity="0.15"/>
      <polygon points="28,4 52,16 52,40 28,52 4,40 4,16" fill="none" stroke="url(#g1s)" strokeWidth="1.5"/>
      <polygon points="28,10 44,24 28,48 12,24" fill="url(#g1s)"/>
      <polygon points="28,10 44,24 28,24" fill="url(#g2s)" opacity="0.6"/>
      <polygon points="28,10 12,24 28,24" fill="url(#g3s)" opacity="0.4"/>
      <line x1="28" y1="10" x2="28" y2="48" stroke="white" strokeWidth="0.5" opacity="0.3"/>
      <line x1="12" y1="24" x2="44" y2="24" stroke="white" strokeWidth="0.5" opacity="0.3"/>
      <circle cx="46" cy="10" r="2" fill="#f9a8d4" opacity="0.8"/>
      <circle cx="44" cy="8" r="1" fill="#ddd6fe" opacity="0.6"/>
    </svg>
  );
}

export default function Certificate() {
  const { certId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const certRef = useRef();

  useEffect(() => {
    Promise.all([
      learnerApi.getCertificate(certId),
      gamificationApi.badges(),
    ]).then(([certData, badgeData]) => {
      setData(certData);
      setEarnedBadges(badgeData.filter(b => b.earned).slice(0, 8)); // show up to 8 badges on cert
    }).catch(console.error).finally(() => setLoading(false));
  }, [certId]);

  const handlePrint = () => {
    const { certification, learner, isEligible, readinessScore, avgQuizScore, avgCompletion, completedCourses, totalCourses, earnedDate } = data;
    const dateStr = earnedDate ? new Date(earnedDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const badgesHtml = earnedBadges.map(b => `<span style="display:inline-flex;align-items:center;gap:4px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:20px;padding:3px 10px;font-size:10pt;color:#6d28d9;margin:3px">${b.iconUrl} ${b.name}</span>`).join('');

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Certificate — ${learner.name}</title>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f8f6ff; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    @page { size: A4 landscape; margin: 0; }
    @media print { body { background: white; min-height: unset; } .cert { box-shadow: none !important; } }

    .cert {
      width: 297mm; height: 210mm;
      background: white;
      position: relative;
      padding: 14mm 18mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(124,58,237,0.15);
    }

    /* Corner ornaments */
    .corner { position: absolute; width: 32mm; height: 32mm; }
    .corner-tl { top: 6mm; left: 6mm; border-top: 3px solid #7c3aed; border-left: 3px solid #7c3aed; border-radius: 4px 0 0 0; }
    .corner-tr { top: 6mm; right: 6mm; border-top: 3px solid #7c3aed; border-right: 3px solid #7c3aed; border-radius: 0 4px 0 0; }
    .corner-bl { bottom: 6mm; left: 6mm; border-bottom: 3px solid #7c3aed; border-left: 3px solid #7c3aed; border-radius: 0 0 0 4px; }
    .corner-br { bottom: 6mm; right: 6mm; border-bottom: 3px solid #7c3aed; border-right: 3px solid #7c3aed; border-radius: 0 0 4px 0; }

    /* Subtle bg pattern */
    .bg-pattern {
      position: absolute; inset: 0; pointer-events: none;
      background-image: radial-gradient(circle at 20% 80%, rgba(124,58,237,0.04) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(236,72,153,0.04) 0%, transparent 50%);
    }

    /* Gold top bar */
    .gold-bar { position: absolute; top: 0; left: 0; right: 0; height: 5mm; background: linear-gradient(90deg, #7c3aed, #a855f7, #ec4899, #a855f7, #7c3aed); }

    .content { position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%; }

    /* Header: logo + title side by side */
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6mm; }
    .logo-block { display: flex; align-items: center; gap: 10px; }
    .logo-text { }
    .logo-text .brand { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 16pt; color: #7c3aed; letter-spacing: -0.5px; }
    .logo-text .tagline { font-size: 7pt; color: #9ca3af; letter-spacing: 3px; text-transform: uppercase; margin-top: 1px; }
    .cert-type { text-align: right; }
    .cert-type .label { font-size: 8pt; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; }
    .cert-type .title { font-family: 'Playfair Display', serif; font-size: 18pt; color: #1f2937; font-weight: 700; margin-top: 2px; }

    /* Divider */
    .divider { height: 1px; background: linear-gradient(90deg, transparent, #7c3aed44, #ec4899, #7c3aed44, transparent); margin-bottom: 6mm; }

    /* Main body: left (name/text) + right (medal/metrics) */
    .body { display: flex; gap: 10mm; flex: 1; }
    .left { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .right { width: 72mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }

    /* Name section */
    .certify-text { font-size: 10pt; color: #6b7280; font-style: italic; margin-bottom: 4mm; }
    .name { font-family: 'Playfair Display', serif; font-size: 34pt; color: #1f2937; font-weight: 700; line-height: 1.1; margin-bottom: 3mm; }
    .cert-name { font-family: 'Playfair Display', serif; font-size: 14pt; color: #7c3aed; font-weight: 600; margin-bottom: 4mm; }
    .achieve-text { font-size: 9pt; color: #6b7280; line-height: 1.6; max-width: 130mm; margin-bottom: 5mm; }

    /* Badges row */
    .badges-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2mm; }

    /* Medal / metrics on right */
    .medal-icon { width: 24mm; height: 24mm; background: linear-gradient(135deg, #7c3aed, #ec4899); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 5mm; box-shadow: 0 4px 20px rgba(124,58,237,0.4); }
    .metrics { width: 100%; }
    .metric { text-align: center; padding: 3mm; background: #f9f7ff; border-radius: 6px; border: 1px solid #ede9fe; margin-bottom: 2mm; }
    .metric .val { font-size: 18pt; font-weight: 700; color: #7c3aed; font-family: 'Inter', sans-serif; }
    .metric .lbl { font-size: 7pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 1px; }
    .metrics-row { display: flex; gap: 2mm; }
    .metrics-row .metric { flex: 1; }

    /* Footer */
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 4mm; border-top: 1px solid #f3f4f6; }
    .sign-block { text-align: center; }
    .sign-name { font-family: 'Playfair Display', serif; font-size: 11pt; font-style: italic; color: #7c3aed; }
    .sign-line { width: 40mm; height: 1px; background: #e5e7eb; margin: 2mm auto; }
    .sign-title { font-size: 7pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px; }
    .date-block { text-align: right; }
    .date-val { font-size: 10pt; font-weight: 600; color: #374151; }
    .date-lbl { font-size: 7pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-top: 1px; }
    .cert-id { font-size: 7pt; color: #d1d5db; text-align: center; }
  </style>
</head>
<body>
  <div class="cert">
    <div class="gold-bar"></div>
    <div class="bg-pattern"></div>
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <div class="content">
      <!-- Header -->
      <div class="header">
        <div class="logo-block">
          ${YAMI_LOGO_SVG}
          <div class="logo-text">
            <div class="brand">YAMI Learn</div>
            <div class="tagline">AI Learning Platform · CaratLane</div>
          </div>
        </div>
        <div class="cert-type">
          <div class="label">Official Certification</div>
          <div class="title">Certificate of Achievement</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Body -->
      <div class="body">
        <!-- Left: name + achievement story -->
        <div class="left">
          <div class="certify-text">This is to proudly certify that</div>
          <div class="name">${learner.name}</div>
          <div class="achieve-text">
            has successfully demonstrated exceptional proficiency and completed all requirements to earn the certification in
          </div>
          <div class="cert-name">${certification.name}</div>
          <div class="achieve-text" style="margin-bottom:3mm;">
            ${learner.department ? `As a valued member of the <strong>${learner.department}</strong> team, this achievement reflects a commitment to continuous growth and excellence in learning.` : 'This achievement reflects a commitment to continuous growth and excellence in learning.'}
            With a quiz performance of <strong>${avgQuizScore}%</strong> and <strong>${completedCourses}/${totalCourses}</strong> courses completed, this individual has demonstrated mastery of the subject matter.
          </div>
          ${earnedBadges.length > 0 ? `
          <div style="margin-top:2mm;">
            <div style="font-size:7pt;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px;">Badges Earned</div>
            <div class="badges-row">${badgesHtml}</div>
          </div>` : ''}
        </div>

        <!-- Right: medal + metrics -->
        <div class="right">
          <div class="medal-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
              <circle cx="12" cy="8" r="6"/>
              <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
          </div>
          <div class="metrics">
            <div class="metric">
              <div class="val">${readinessScore}%</div>
              <div class="lbl">Overall Score</div>
            </div>
            <div class="metrics-row">
              <div class="metric">
                <div class="val" style="font-size:14pt">${avgQuizScore}%</div>
                <div class="lbl">Quiz Score</div>
              </div>
              <div class="metric">
                <div class="val" style="font-size:14pt">${completedCourses}/${totalCourses}</div>
                <div class="lbl">Courses</div>
              </div>
            </div>
            ${earnedBadges.length > 0 ? `
            <div class="metric">
              <div class="val" style="font-size:14pt">${earnedBadges.length}</div>
              <div class="lbl">Badges</div>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="sign-block">
          <div class="sign-name">YAMI Learning Team</div>
          <div class="sign-line"></div>
          <div class="sign-title">Authorized by CaratLane L&amp;D</div>
        </div>
        <div class="cert-id">
          CERT-${certId?.toUpperCase()?.slice(0, 8) || 'YAMI'}-${new Date().getFullYear()}
        </div>
        <div class="date-block">
          <div class="date-val">${dateStr}</div>
          <div class="date-lbl">Date Awarded</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 800);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
      Certificate not found
    </div>
  );

  const { certification, learner, isEligible, readinessScore, avgQuizScore, avgCompletion, completedCourses, totalCourses, earnedDate } = data;
  const dateStr = earnedDate
    ? new Date(earnedDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      {/* Nav bar */}
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between">
        <Link to="/learn/certifications" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Certifications
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/learn/badges" className="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm border border-purple-800 rounded-xl px-4 py-2 hover:bg-purple-900/20 transition-all">
            <Medal className="w-4 h-4" /> My Badges
          </Link>
          {isEligible && (
            <button onClick={handlePrint}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-xl transition-colors">
              <Download className="w-4 h-4" /> Download Certificate
            </button>
          )}
        </div>
      </div>

      {/* Not eligible warning */}
      {!isEligible && (
        <div className="max-w-5xl mx-auto mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <Award className="w-5 h-5 text-yellow-400 shrink-0" />
          <div>
            <div className="text-yellow-300 font-medium text-sm">Certificate preview — not yet earned</div>
            <div className="text-gray-400 text-xs mt-0.5">Current readiness: {readinessScore}%. Complete all required courses and achieve the minimum scores to unlock.</div>
          </div>
        </div>
      )}

      {/* Earned badges highlight strip */}
      {earnedBadges.length > 0 && isEligible && (
        <div className="max-w-5xl mx-auto mb-4 bg-purple-900/20 border border-purple-800/40 rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-purple-400 text-xs font-semibold uppercase tracking-wider shrink-0">Badges on this certificate:</span>
          {earnedBadges.map(b => (
            <span key={b.id} className="text-sm">{b.iconUrl} <span className="text-gray-300 text-xs">{b.name}</span></span>
          ))}
        </div>
      )}

      {/* Certificate card */}
      <div
        ref={certRef}
        className={`max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden transition-all ${!isEligible ? 'opacity-60 grayscale' : ''}`}
        style={{ minHeight: '560px', position: 'relative', fontFamily: 'Georgia, serif' }}
      >
        {/* Gold top bar */}
        <div style={{ height: '7px', background: 'linear-gradient(90deg, #7c3aed, #a855f7, #ec4899, #a855f7, #7c3aed)' }} />

        {/* Corner ornaments */}
        {[
          { top: '16px', left: '16px', borderTop: '3px solid #7c3aed', borderLeft: '3px solid #7c3aed', borderRadius: '4px 0 0 0' },
          { top: '16px', right: '16px', borderTop: '3px solid #7c3aed', borderRight: '3px solid #7c3aed', borderRadius: '0 4px 0 0' },
          { bottom: '16px', left: '16px', borderBottom: '3px solid #7c3aed', borderLeft: '3px solid #7c3aed', borderRadius: '0 0 0 4px' },
          { bottom: '16px', right: '16px', borderBottom: '3px solid #7c3aed', borderRight: '3px solid #7c3aed', borderRadius: '0 0 4px 0' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: '48px', height: '48px', pointerEvents: 'none', ...s }} />
        ))}

        {/* Subtle radial bg */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 15% 85%, rgba(124,58,237,0.04) 0%, transparent 50%), radial-gradient(ellipse at 85% 15%, rgba(236,72,153,0.04) 0%, transparent 50%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', padding: '40px 56px 36px', display: 'flex', flexDirection: 'column', minHeight: '553px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <YamiLogo size={52} />
              <div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#7c3aed', letterSpacing: '-0.5px', fontFamily: 'Arial, sans-serif' }}>YAMI Learn</div>
                <div style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '2px', fontFamily: 'Arial, sans-serif' }}>AI Learning Platform · CaratLane</div>
              </div>
            </div>
            {/* Cert type */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>Official Certification</div>
              <div style={{ fontSize: '22px', fontFamily: '"Palatino Linotype", Palatino, Georgia, serif', fontWeight: '700', color: '#1f2937', marginTop: '4px' }}>Certificate of Achievement</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), #ec4899, rgba(124,58,237,0.4), transparent)', marginBottom: '24px' }} />

          {/* Body: left + right */}
          <div style={{ display: 'flex', gap: '40px', flex: 1 }}>
            {/* Left */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic', marginBottom: '8px', fontFamily: 'Arial, sans-serif' }}>
                This is to proudly certify that
              </p>
              <h2 style={{ fontFamily: '"Palatino Linotype", Palatino, Georgia, serif', fontSize: '36px', color: '#1f2937', fontWeight: '700', lineHeight: '1.1', marginBottom: '10px' }}>
                {learner.name}
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.7', fontFamily: 'Arial, sans-serif', marginBottom: '6px' }}>
                has successfully demonstrated exceptional proficiency and completed all requirements to earn the certification in
              </p>
              <div style={{ fontSize: '18px', color: '#7c3aed', fontFamily: '"Palatino Linotype", Palatino, Georgia, serif', fontWeight: '700', marginBottom: '10px' }}>
                {certification.name}
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.7', fontFamily: 'Arial, sans-serif', marginBottom: '12px' }}>
                {learner.department
                  ? `As a valued member of the ${learner.department} team, this achievement reflects a commitment to continuous growth. `
                  : ''}
                With a quiz performance of <strong style={{ color: '#7c3aed' }}>{avgQuizScore}%</strong> and{' '}
                <strong style={{ color: '#7c3aed' }}>{completedCourses}/{totalCourses}</strong> courses completed.
              </p>

              {/* Badges */}
              {earnedBadges.length > 0 && (
                <div>
                  <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', fontFamily: 'Arial, sans-serif' }}>Badges Earned</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {earnedBadges.map(b => (
                      <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', color: '#6d28d9', fontFamily: 'Arial, sans-serif' }}>
                        {b.iconUrl} {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right */}
            <div style={{ width: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              {/* Medal */}
              <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #7c3aed, #ec4899)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="6"/>
                  <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                </svg>
              </div>
              {/* Metrics */}
              {[
                { val: `${readinessScore}%`, lbl: 'Overall Score', big: true },
                { val: `${avgQuizScore}%`, lbl: 'Quiz Score' },
                { val: `${completedCourses}/${totalCourses}`, lbl: 'Courses Done' },
                ...(earnedBadges.length > 0 ? [{ val: earnedBadges.length, lbl: 'Badges' }] : []),
              ].map(m => (
                <div key={m.lbl} style={{ width: '100%', textAlign: 'center', background: '#f9f7ff', border: '1px solid #ede9fe', borderRadius: '10px', padding: m.big ? '12px 8px' : '8px' }}>
                  <div style={{ fontSize: m.big ? '28px' : '20px', fontWeight: '700', color: '#7c3aed', fontFamily: 'Arial, sans-serif' }}>{m.val}</div>
                  <div style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '2px', fontFamily: 'Arial, sans-serif' }}>{m.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#7c3aed', fontFamily: 'Georgia, serif' }}>YAMI Learning Team</div>
              <div style={{ width: '120px', height: '1px', background: '#e5e7eb', margin: '6px auto' }} />
              <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: 'Arial, sans-serif' }}>Authorized by CaratLane L&D</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#d1d5db', fontFamily: 'Arial, sans-serif' }}>CERT-{certId?.toUpperCase()?.slice(0, 8) || 'YAMI'}-{new Date().getFullYear()}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', fontFamily: 'Arial, sans-serif' }}>{dateStr}</div>
              <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', fontFamily: 'Arial, sans-serif' }}>Date Awarded</div>
            </div>
          </div>

        </div>
      </div>

      {/* Achievement stats below the cert */}
      {isEligible && (
        <div className="max-w-5xl mx-auto mt-8 grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
            <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{completedCourses}/{totalCourses}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Courses Completed</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
            <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{avgQuizScore}%</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Avg Quiz Score</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
            <Medal className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{earnedBadges.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Badges Earned</div>
          </div>
        </div>
      )}
    </div>
  );
}
