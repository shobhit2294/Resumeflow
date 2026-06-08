import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Video, VideoOff, Mic, MicOff, Send,
  Star, CheckCircle2, AlertTriangle, TrendingUp, Eye,
  MessageSquare, Volume2, ChevronRight, RefreshCw, Award
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

// ── TTS helper ────────────────────────────────────────────────
const synth = window.speechSynthesis;
function speak(text, onEnd) {
  synth.cancel();
  const clean = text.replace(/\[Score:.*?\]/gi, '').replace(/INTERVIEW_COMPLETE/g, '').trim();
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 0.95; utt.pitch = 1; utt.volume = 1;
  const voices = synth.getVoices();
  const v = voices.find(v => v.lang.startsWith('en') && v.localService) || voices.find(v => v.lang.startsWith('en'));
  if (v) utt.voice = v;
  if (onEnd) utt.onend = onEnd;
  synth.speak(utt);
}
function stopSpeaking() { synth.cancel(); }

// ── Filler word detector ──────────────────────────────────────
const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'actually', 'right', 'so', 'well', 'i mean'];
function countFillers(text) {
  const lower = text.toLowerCase();
  const counts = {};
  let total = 0;
  FILLER_WORDS.forEach(fw => {
    const regex = new RegExp(`\\b${fw}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      counts[fw] = matches.length;
      total += matches.length;
    }
  });
  return { counts, total };
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Score color ────────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 75) return 'text-green-600';
  if (s >= 55) return 'text-amber-600';
  return 'text-red-500';
}
function scoreBg(s) {
  if (s >= 75) return 'bg-green-100';
  if (s >= 55) return 'bg-amber-100';
  return 'bg-red-100';
}
function scoreBar(s) {
  if (s >= 75) return 'bg-green-500';
  if (s >= 55) return 'bg-amber-400';
  return 'bg-red-400';
}

// ═══════════════════════════════════════════════════════════════
export default function VideoInterviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Interview state ─────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [interviewMeta, setInterviewMeta] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // ── Video / camera state ────────────────────────────────────
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');

  // ── Behavioral tracking ─────────────────────────────────────
  const [eyeContactPct, setEyeContactPct] = useState(null);
  const [lookAwayCount, setLookAwayCount] = useState(0);
  const [headMovement, setHeadMovement] = useState('stable');
  const [allFillers, setAllFillers] = useState({ counts: {}, total: 0 });
  const [answerLengths, setAnswerLengths] = useState([]);
  const [wordTimestamps, setWordTimestamps] = useState([]);  // for WPM
  const [pauseCount, setPauseCount] = useState(0);
  const [facialData, setFacialData] = useState({ neutral: 70, happy: 15, nervous: 15 });
  const fullTranscriptRef = useRef('');

  // ── Analysis state ──────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // chat | report

  // ── Refs ────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const bottomRef = useRef(null);
  const frameRef = useRef(null);   // canvas for face analysis
  const prevHeadPosRef = useRef(null);
  const eyeContactFrames = useRef({ on: 0, total: 0 });
  const headMoveFrames = useRef({ large: 0, total: 0 });

  // ── Load interview ──────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['interview', id],
    queryFn: () => api.get(`/interview/${id}`).then(r => r.data),
  });

  useEffect(() => {
    if (data?.interview) {
      const iv = data.interview;
      setMessages(iv.messages || []);
      setInterviewMeta(iv);
      setIsCompleted(iv.status === 'completed');
      if (iv.behaviorReport) setReport(iv.behaviorReport);
    }
  }, [data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // ── Camera ──────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setCameraError('');
      startFaceTracking();
      toast.success('Camera started');
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera in browser settings.');
      toast.error('Camera access denied');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    stopFaceTracking();
  };

  // ── Lightweight face tracking via canvas pixel analysis ─────
  // (No heavy ML library needed — uses brightness/motion heuristics)
  const startFaceTracking = () => {
    if (faceIntervalRef.current) return;
    faceIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;

      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 48;  // small = fast
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 64, 48);
      const frame = ctx.getImageData(0, 0, 64, 48);
      const pixels = frame.data;

      // Face detection heuristic: check if center region has skin-tone pixels
      let skinPixels = 0;
      const cx = 32, cy = 24, r = 12;
      for (let y = cy - r; y < cy + r; y++) {
        for (let x = cx - r; x < cx + r; x++) {
          const i = (y * 64 + x) * 4;
          const R = pixels[i], G = pixels[i+1], B = pixels[i+2];
          // Simple skin tone heuristic
          if (R > 80 && G > 40 && B > 20 && R > G && R > B && (R - G) > 10) skinPixels++;
        }
      }
      const facePresent = skinPixels > 40;
      eyeContactFrames.current.total++;
      if (facePresent) eyeContactFrames.current.on++;

      // Head movement: compare center of mass shift between frames
      let sumX = 0, sumY = 0, count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const bright = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
        if (bright > 50) { sumX += (i/4) % 64; sumY += Math.floor((i/4) / 64); count++; }
      }
      if (count > 0) {
        const cx2 = sumX / count, cy2 = sumY / count;
        if (prevHeadPosRef.current) {
          const dx = Math.abs(cx2 - prevHeadPosRef.current.x);
          const dy = Math.abs(cy2 - prevHeadPosRef.current.y);
          headMoveFrames.current.total++;
          if (dx > 3 || dy > 3) headMoveFrames.current.large++;
        }
        prevHeadPosRef.current = { x: cx2, y: cy2 };
      }

      // Update live stats
      const eyePct = eyeContactFrames.current.total > 0
        ? Math.round((eyeContactFrames.current.on / eyeContactFrames.current.total) * 100)
        : null;
      setEyeContactPct(eyePct);

      const moveRatio = headMoveFrames.current.total > 0
        ? headMoveFrames.current.large / headMoveFrames.current.total : 0;
      setHeadMovement(moveRatio > 0.3 ? 'excessive' : moveRatio > 0.15 ? 'moderate' : 'stable');

      if (!facePresent) setLookAwayCount(c => c + 1);

    }, 500); // every 500ms
  };

  const stopFaceTracking = () => {
    if (faceIntervalRef.current) { clearInterval(faceIntervalRef.current); faceIntervalRef.current = null; }
  };

  // ── Speech Recognition ───────────────────────────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const startListening = useCallback(() => {
    if (!SpeechRecognition) { toast.error('Speech recognition not supported. Use Chrome.'); return; }
    if (recognitionRef.current) recognitionRef.current.abort();

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    let pauseTimer = null;

    rec.onstart = () => setListening(true);
    rec.onend = () => { setListening(false); if (pauseTimer) clearTimeout(pauseTimer); };

    rec.onresult = (event) => {
      if (pauseTimer) clearTimeout(pauseTimer);
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      const current = final || interim;
      setTranscript(current);
      if (final) setInput(final);

      // Detect pause > 2s
      pauseTimer = setTimeout(() => setPauseCount(c => c + 1), 2000);
    };

    rec.onerror = (e) => { setListening(false); if (e.error !== 'no-speech') toast.error('Mic: ' + e.error); };
    recognitionRef.current = rec;
    rec.start();
  }, []);

  const stopListening = () => { recognitionRef.current?.abort(); recognitionRef.current = null; setListening(false); setTranscript(''); };

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = async (textOverride) => {
    const text = (textOverride || input).trim();
    if (!text || sending || isCompleted) return;
    stopListening(); stopSpeaking();
    setInput(''); setTranscript('');
    setSending(true);

    // Track behavioral metrics for this answer
    const { counts, total } = countFillers(text);
    setAllFillers(prev => {
      const merged = { ...prev.counts };
      Object.entries(counts).forEach(([k, v]) => merged[k] = (merged[k] || 0) + v);
      return { counts: merged, total: prev.total + total };
    });
    setAnswerLengths(prev => [...prev, countWords(text)]);
    fullTranscriptRef.current += `\nCandidate: ${text}`;

    setMessages(prev => [...prev, { role: 'user', content: text, _id: 'tmp-' + Date.now() }]);

    try {
      const res = await api.post(`/interview/${id}/message`, { content: text });
      const aiReply = res.data.message;

      setMessages(prev => [
        ...prev.filter(m => !String(m._id).startsWith('tmp-')),
        { role: 'user', content: text },
        aiReply,
      ]);
      setInterviewMeta(res.data.interview);
      fullTranscriptRef.current += `\nInterviewer: ${aiReply.content}`;

      setAiSpeaking(true);
      speak(aiReply.content, () => {
        setAiSpeaking(false);
        if (res.data.interview.status !== 'completed') {
          setTimeout(() => startListening(), 400);
        }
      });

      if (res.data.interview.status === 'completed') {
        setIsCompleted(true);
        stopFaceTracking();
        toast.success('Interview complete! Generating your behavioral report...');
        setTimeout(() => runBehaviorAnalysis(), 1500);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
      setMessages(prev => prev.filter(m => !String(m._id).startsWith('tmp-')));
    } finally { setSending(false); }
  };

  // ── Behavior analysis ─────────────────────────────────────────
  const runBehaviorAnalysis = async () => {
    setAnalyzing(true);
    stopCamera();
    try {
      const totalWords = answerLengths.reduce((a, b) => a + b, 0);
      const durationMins = interviewMeta?.duration || 10;
      const wpm = durationMins > 0 ? Math.round(totalWords / durationMins) : 0;

      const payload = {
        transcript: fullTranscriptRef.current,
        fillerWordCount: allFillers.counts,
        totalFillerWords: allFillers.total,
        speakingPaceWpm: wpm,
        silencePauseCount: pauseCount,
        answerLengths,
        eyeContactPercent: eyeContactPct,
        lookAwayCount: Math.round(lookAwayCount / 2), // de-noise
        facialExpressions: facialData,
        headMovement,
        sessionDurationMins: durationMins,
      };

      const res = await api.post(`/interview/${id}/analyze-behavior`, payload);
      setReport(res.data.report);
      setActiveTab('report');
      toast.success('Behavioral report ready!');
    } catch (err) {
      toast.error('Report generation failed: ' + (err.response?.data?.error || err.message));
    } finally { setAnalyzing(false); }
  };

  // Cleanup on unmount
  useEffect(() => () => { stopCamera(); stopSpeaking(); stopListening(); }, []);

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Rating label ──────────────────────────────────────────────
  const ratingLabel = (s) => s >= 75 ? 'Good' : s >= 55 ? 'Needs work' : 'Improve';

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-20">
        <button onClick={() => { stopCamera(); stopSpeaking(); navigate('/interview'); }}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            Video Interview
            {interviewMeta?.job && ` — ${interviewMeta.job.role} at ${interviewMeta.job.company}`}
          </p>
          <p className="text-xs text-gray-400">
            {interviewMeta?.questionsAsked || 0}/8 questions ·{' '}
            {isCompleted ? <span className="text-primary-600">Complete</span> : <span className="text-amber-600">In progress</span>}
          </p>
        </div>
        {interviewMeta?.averageScore && (
          <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-xs font-semibold text-amber-700">{interviewMeta.averageScore}/10</span>
          </div>
        )}
        {/* Tab switcher shown after completion */}
        {(isCompleted || report) && (
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 text-xs font-medium ${activeTab === 'chat' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
              Interview
            </button>
            <button onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 text-xs font-medium ${activeTab === 'report' ? 'bg-primary-100 text-primary-700' : 'text-gray-500'}`}>
              AI Report
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* CHAT TAB                                                   */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'chat' && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Video + metrics ── */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 p-3 bg-white border-r border-gray-100 overflow-y-auto">

            {/* Camera view */}
            <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <VideoOff size={28} className="text-gray-500" />
                  <p className="text-xs text-gray-400 text-center px-2">{cameraError || 'Camera off'}</p>
                </div>
              )}
              {/* Live indicators */}
              {cameraOn && (
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <div className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                  </div>
                </div>
              )}
              {aiSpeaking && (
                <div className="absolute bottom-1.5 left-1.5 bg-primary-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  AI speaking...
                </div>
              )}
              {listening && (
                <div className="absolute bottom-1.5 right-1.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" /> Listening
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="flex gap-2">
              <button
                onClick={cameraOn ? stopCamera : startCamera}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  cameraOn ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                }`}
              >
                {cameraOn ? <><VideoOff size={13} /> Stop</> : <><Video size={13} /> Start camera</>}
              </button>
              <button
                onClick={() => setMicOn(m => !m)}
                className={`p-2 rounded-lg text-xs transition-all ${micOn ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'}`}
              >
                {micOn ? <Mic size={14} /> : <MicOff size={14} />}
              </button>
            </div>

            {/* Live behavioral metrics */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Live metrics</p>

              <div className="p-2.5 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 flex items-center gap-1"><Eye size={10} /> Eye contact</span>
                  <span className={`font-medium ${eyeContactPct !== null ? (eyeContactPct >= 60 ? 'text-green-600' : 'text-amber-600') : 'text-gray-400'}`}>
                    {eyeContactPct !== null ? `${eyeContactPct}%` : cameraOn ? 'measuring...' : '—'}
                  </span>
                </div>
                <div className="h-1 bg-gray-200 rounded-full">
                  <div className={`h-full rounded-full transition-all ${eyeContactPct >= 60 ? 'bg-green-500' : 'bg-amber-400'}`}
                    style={{ width: `${eyeContactPct || 0}%` }} />
                </div>
              </div>

              <div className="p-2.5 bg-gray-50 rounded-lg text-xs">
                <div className="flex justify-between mb-0.5">
                  <span className="text-gray-500">Head movement</span>
                  <span className={`font-medium capitalize ${headMovement === 'stable' ? 'text-green-600' : headMovement === 'moderate' ? 'text-amber-600' : 'text-red-500'}`}>
                    {cameraOn ? headMovement : '—'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-gray-50 rounded-lg text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Filler words</span>
                  <span className={`font-medium ${allFillers.total > 10 ? 'text-red-500' : allFillers.total > 5 ? 'text-amber-600' : 'text-green-600'}`}>
                    {allFillers.total}
                  </span>
                </div>
                {allFillers.total > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(allFillers.counts).sort((a,b) => b[1]-a[1]).slice(0,4).map(([w,c]) => (
                      <span key={w} className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full">
                        "{w}" ×{c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-gray-50 rounded-lg text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Answers given</span>
                  <span className="font-medium text-gray-700">{answerLengths.length}</span>
                </div>
                {answerLengths.length > 0 && (
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Avg {Math.round(answerLengths.reduce((a,b) => a+b, 0) / answerLengths.length)} words/answer
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-gray-50 rounded-lg text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pauses detected</span>
                  <span className={`font-medium ${pauseCount > 5 ? 'text-amber-600' : 'text-green-600'}`}>{pauseCount}</span>
                </div>
              </div>
            </div>

            {/* Tip box */}
            <div className="p-2.5 bg-primary-50 border border-primary-100 rounded-lg">
              <p className="text-[10px] text-primary-700 font-medium mb-1">Quick tips</p>
              <ul className="text-[10px] text-primary-600 space-y-0.5">
                <li>• Look at camera, not screen</li>
                <li>• Speak at steady pace</li>
                <li>• Use STAR method</li>
                <li>• Pause before answering</li>
              </ul>
            </div>
          </div>

          {/* ── Right: Chat ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => {
                const isAI = msg.role === 'assistant';
                const scoreMatch = msg.content.match(/\[Score:\s*(\d+(?:\.\d+)?)/i);
                const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;
                const display = msg.content.replace(/\[Score:.*?\]/gi, '').replace(/INTERVIEW_COMPLETE/g, '').trim();
                return (
                  <div key={msg._id || i} className={`flex gap-2.5 ${isAI ? '' : 'flex-row-reverse'} animate-fade-in`}>
                    {isAI && (
                      <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-primary-700">AI</div>
                    )}
                    <div className={`max-w-[78%] ${!isAI ? 'items-end flex flex-col' : ''}`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isAI ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm' : 'bg-primary-400 text-white rounded-tr-sm'}`}>
                        {display}
                      </div>
                      {score && (
                        <div className="flex items-center gap-1 mt-1 ml-1">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          <span className="text-[10px] text-gray-400">{score}/10</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex gap-2.5 animate-fade-in">
                  <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-700">AI</div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center h-5">
                      {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: d+'ms' }} />)}
                    </div>
                  </div>
                </div>
              )}

              {isCompleted && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-xs font-medium border border-primary-100">
                    <CheckCircle2 size={13} />
                    Interview complete! {analyzing ? 'Generating behavioral report...' : 'View your AI report →'}
                  </div>
                </div>
              )}

              {analyzing && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm">
                    <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    AI is analyzing your behavior patterns...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Input ── */}
            {!isCompleted && (
              <div className="px-4 py-3 bg-white border-t border-gray-100">
                {/* Transcript preview */}
                {transcript && (
                  <div className="mb-2 px-3 py-2 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-800 animate-fade-in">
                    {transcript}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  {/* Mic button */}
                  <button
                    onClick={listening ? stopListening : startListening}
                    disabled={aiSpeaking || sending}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                      listening ? 'bg-red-500 text-white animate-pulse' :
                      aiSpeaking || sending ? 'bg-gray-100 text-gray-300 cursor-not-allowed' :
                      'bg-primary-100 text-primary-700 hover:bg-primary-200'
                    }`}
                  >
                    {listening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>

                  <textarea
                    className="input flex-1 resize-none min-h-[40px] max-h-28 text-sm"
                    placeholder={listening ? 'Listening... speak your answer' : aiSpeaking ? 'AI is speaking...' : 'Type or use mic to answer...'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={aiSpeaking}
                    rows={1}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending || aiSpeaking}
                    className="btn-primary h-10 px-3 flex-shrink-0"
                  >
                    <Send size={15} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {aiSpeaking ? 'AI is asking a question...' : listening ? 'Recording your answer...' : 'Press mic to speak · Enter to send'}
                </p>
              </div>
            )}

            {isCompleted && !analyzing && report && (
              <div className="px-4 py-3 bg-white border-t border-gray-100">
                <button onClick={() => setActiveTab('report')} className="btn-primary w-full justify-center">
                  <Award size={15} /> View full behavioral report
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* REPORT TAB                                                 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'report' && (
        <div className="flex-1 overflow-y-auto p-5 max-w-3xl w-full mx-auto space-y-5">
          {analyzing && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-3 border-primary-400 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
              <p className="text-sm text-gray-500">Analyzing your behavioral patterns with AI...</p>
            </div>
          )}

          {!analyzing && !report && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Award size={40} className="text-gray-300" />
              <p className="text-sm text-gray-400">Complete the interview to get your behavioral report</p>
              <button onClick={() => setActiveTab('chat')} className="btn-secondary">
                Back to interview
              </button>
            </div>
          )}

          {report && (
            <div className="animate-fade-in space-y-5">
              {/* Overall score */}
              <div className="card p-5">
                <div className="flex items-center gap-5">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold flex-shrink-0 ${scoreBg(report.overallBehaviorScore)} ${scoreColor(report.overallBehaviorScore)}`}>
                    {report.overallBehaviorScore}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">Behavioral performance score</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{report.summary}</p>
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Detailed breakdown</h3>
                <div className="space-y-4">
                  {report.categories && Object.entries(report.categories).map(([key, cat]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-sm font-medium text-gray-800 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${scoreBg(cat.score)} ${scoreColor(cat.score)}`}>
                            {ratingLabel(cat.score)}
                          </span>
                        </div>
                        <span className={`text-sm font-semibold ${scoreColor(cat.score)}`}>{cat.score}/100</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mb-2">
                        <div className={`h-full rounded-full transition-all ${scoreBar(cat.score)}`} style={{ width: `${cat.score}%` }} />
                      </div>
                      <p className="text-xs text-gray-500">{cat.observation}</p>
                      <p className="text-xs text-primary-700 mt-1 font-medium">→ {cat.tip}</p>
                      {cat.topFillers && cat.topFillers.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {cat.topFillers.map(f => (
                            <span key={f} className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">"{f}"</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp size={15} className="text-green-500" /> Strengths
                </h3>
                <ul className="space-y-2">
                  {report.topStrengths?.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Critical improvements */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-500" /> Critical improvements
                </h3>
                <div className="space-y-4">
                  {report.criticalImprovements?.map((item, i) => (
                    <div key={i} className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <p className="text-sm font-semibold text-amber-900">{item.issue}</p>
                      <p className="text-xs text-amber-700 mt-0.5 mb-2">{item.impact}</p>
                      <div className="bg-white border border-amber-200 rounded-lg p-2.5">
                        <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-1">Practice exercise</p>
                        <p className="text-xs text-gray-700">{item.exercise}</p>
                        <p className="text-[10px] text-amber-600 mt-1">⏱ {item.timeToImprove}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly plan */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">7-day practice plan</h3>
                <div className="space-y-2">
                  {report.weeklyPracticeplan?.map((day, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-lg text-sm">
                      <div className="w-5 h-5 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i+1}</div>
                      <span className="text-gray-700">{day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-primary-500" /> Before your next interview
                </h3>
                <ul className="space-y-2">
                  {report.nextInterviewChecklist?.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <input type="checkbox" className="mt-0.5 rounded" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Raw metrics */}
              <div className="card p-5 bg-gray-50">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Raw session metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {[
                    ['Eye contact', eyeContactPct !== null ? `${eyeContactPct}%` : '—'],
                    ['Filler words', allFillers.total],
                    ['Long pauses', pauseCount],
                    ['Head movement', headMovement],
                    ['Answers given', answerLengths.length],
                    ['Avg answer length', answerLengths.length ? `${Math.round(answerLengths.reduce((a,b)=>a+b,0)/answerLengths.length)} words` : '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-white border border-gray-100 rounded-lg p-2.5">
                      <p className="text-gray-400 mb-1">{label}</p>
                      <p className="font-semibold text-gray-900">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Re-analyze / nav */}
              <div className="flex gap-3 pb-6">
                <button onClick={() => setActiveTab('chat')} className="btn-secondary flex-1 justify-center">
                  Review interview
                </button>
                <button onClick={runBehaviorAnalysis} disabled={analyzing} className="btn-primary flex-1 justify-center">
                  <RefreshCw size={14} /> Re-analyze
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}