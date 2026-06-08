import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Send, Star, CheckCircle2, Mic, MicOff, Volume2, VolumeX, MessageSquare, Radio } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

// ── Speech helpers ──────────────────────────────────────────────
const synth = window.speechSynthesis;

function speak(text, onEnd) {
  synth.cancel();
  const clean = text.replace(/\[Score:.*?\]/gi, '').replace(/INTERVIEW_COMPLETE/g, '').trim();
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 0.95;
  utt.pitch = 1;
  utt.volume = 1;
  // Prefer a natural English voice if available
  const voices = synth.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('en') && v.localService) || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utt.voice = preferred;
  if (onEnd) utt.onend = onEnd;
  synth.speak(utt);
}

function stopSpeaking() { synth.cancel(); }

// ── Main component ───────────────────────────────────────────────
export default function InterviewSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Chat state
  const [localMessages, setLocalMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [interviewMeta, setInterviewMeta] = useState(null);

  // Voice state
  const [voiceMode, setVoiceMode] = useState(false);   // voice vs text mode
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['interview', id],
    queryFn: () => api.get(`/interview/${id}`).then(r => r.data),
  });

  const interview = data?.interview;

  useEffect(() => {
    if (interview?.messages) {
      setLocalMessages(interview.messages);
      setInterviewMeta({
        status: interview.status,
        questionsAsked: interview.questionsAsked,
        totalQuestions: interview.totalQuestions,
        averageScore: interview.averageScore,
        type: interview.type,
        job: interview.job,
      });
    }
  }, [interview]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages, sending, aiSpeaking]);

  // Auto-speak first AI message when entering voice mode
  useEffect(() => {
    if (voiceMode && ttsEnabled && localMessages.length > 0) {
      const last = localMessages[localMessages.length - 1];
      if (last.role === 'assistant') {
        setAiSpeaking(true);
        speak(last.content, () => setAiSpeaking(false));
      }
    }
    if (!voiceMode) {
      stopSpeaking();
      stopListening();
    }
  }, [voiceMode]);

  // ── Speech Recognition setup ────────────────────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeechRecognition = !!SpeechRecognition;

  function startListening() {
    if (!hasSpeechRecognition) {
      toast.error('Your browser does not support speech recognition. Try Chrome.');
      return;
    }
    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) setInput(final);
    };

    recognition.onerror = (e) => {
      setListening(false);
      if (e.error !== 'no-speech') toast.error('Mic error: ' + e.error);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
    setTranscript('');
  }

  function toggleListening() {
    if (listening) stopListening();
    else startListening();
  }

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = async (textOverride) => {
    const text = (textOverride || input).trim();
    if (!text || sending) return;

    stopListening();
    stopSpeaking();
    setInput('');
    setTranscript('');
    setSending(true);

    setLocalMessages(prev => [...prev, { role: 'user', content: text, _id: 'temp-' + Date.now() }]);

    try {
      const res = await api.post(`/interview/${id}/message`, { content: text });
      const aiReply = res.data.message;

      setLocalMessages(prev => [
        ...prev.filter(m => !String(m._id).startsWith('temp-')),
        { role: 'user', content: text },
        aiReply,
      ]);

      setInterviewMeta(res.data.interview);

      // Speak the AI reply if voice mode and TTS on
      if (voiceMode && ttsEnabled) {
        setAiSpeaking(true);
        speak(aiReply.content, () => {
          setAiSpeaking(false);
          // Auto-start listening after AI finishes speaking
          if (!res.data.interview.status === 'completed') {
            setTimeout(() => startListening(), 500);
          }
        });
      }

      if (res.data.interview.status === 'completed') {
        toast.success('Interview complete! Check your results below.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message');
      setLocalMessages(prev => prev.filter(m => !String(m._id).startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  // Voice mode: send when user stops speaking (auto-submit transcript)
  const handleVoiceSubmit = () => {
    if (input.trim()) sendMessage(input);
  };

  const isCompleted = interviewMeta?.status === 'completed';

  const scoreFromText = (text) => {
    const m = text?.match(/\[Score:\s*(\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => { stopSpeaking(); navigate('/interview'); }}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 capitalize">
            {interviewMeta?.type} interview
            {interviewMeta?.job && ` — ${interviewMeta.job.role} at ${interviewMeta.job.company}`}
          </p>
          <p className="text-xs text-gray-400">
            {interviewMeta?.questionsAsked || 0}/{interviewMeta?.totalQuestions || 8} questions ·{' '}
            {isCompleted
              ? <span className="text-primary-600">Completed</span>
              : <span className="text-amber-600">In progress</span>}
          </p>
        </div>

        {/* Score badge */}
        {interviewMeta?.averageScore && (
          <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-xs font-semibold text-amber-700">{interviewMeta.averageScore}/10</span>
          </div>
        )}

        {/* Mode toggle */}
        {!isCompleted && (
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setVoiceMode(false)}
              title="Text mode"
              className={`p-1.5 ${!voiceMode ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <MessageSquare size={15} />
            </button>
            <button
              onClick={() => setVoiceMode(true)}
              title="Voice mode"
              className={`p-1.5 ${voiceMode ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Radio size={15} />
            </button>
          </div>
        )}
      </div>

      {/* ── Voice mode banner ── */}
      {voiceMode && !isCompleted && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary-50 border-b border-primary-100">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${listening ? 'bg-red-500 animate-pulse' : aiSpeaking ? 'bg-primary-400 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-xs font-medium text-primary-800">
              {aiSpeaking ? 'AI is speaking...' : listening ? 'Listening to you...' : 'Voice mode active'}
            </span>
          </div>
          <button
            onClick={() => setTtsEnabled(e => !e)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all ${ttsEnabled ? 'bg-primary-200 text-primary-800' : 'bg-gray-100 text-gray-500'}`}
          >
            {ttsEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            {ttsEnabled ? 'Voice on' : 'Voice off'}
          </button>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {localMessages.map((msg, i) => {
          const isAI = msg.role === 'assistant';
          const score = isAI ? scoreFromText(msg.content) : null;
          const displayContent = msg.content
            .replace(/\[Score:\s*\d+(?:\.\d+)?\/10\]/gi, '')
            .replace(/INTERVIEW_COMPLETE/g, '')
            .trim();

          return (
            <div key={msg._id || i} className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'} animate-fade-in`}>
              {isAI && (
                <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary-700">AI</span>
                </div>
              )}
              <div className={`max-w-[80%] ${isAI ? '' : 'items-end flex flex-col'}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  isAI
                    ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                    : 'bg-primary-400 text-white rounded-tr-sm'
                }`}>
                  {displayContent}
                </div>
                {score && (
                  <div className="flex items-center gap-1 mt-1 ml-1">
                    <Star size={10} className="text-amber-400 fill-amber-400" />
                    <span className="text-[10px] text-gray-400">{score}/10</span>
                  </div>
                )}
                {/* Speak this message button */}
                {isAI && voiceMode && (
                  <button
                    onClick={() => { setAiSpeaking(true); speak(displayContent, () => setAiSpeaking(false)); }}
                    className="mt-1 ml-1 text-[10px] text-gray-400 hover:text-primary-600 flex items-center gap-0.5"
                  >
                    <Volume2 size={10} /> Replay
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* AI typing indicator */}
        {sending && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-primary-700">AI</span>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {isCompleted && !sending && (
          <div className="flex justify-center animate-fade-in">
            <div className="flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-xs font-medium border border-primary-100">
              <CheckCircle2 size={13} />
              Interview complete · Final score: {interviewMeta?.averageScore || '—'}/10
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      {!isCompleted && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          {voiceMode ? (
            /* ── VOICE mode input ── */
            <div className="flex flex-col items-center gap-3">
              {/* Transcript preview */}
              {(transcript || input) && (
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 min-h-[40px]">
                  {transcript || input}
                </div>
              )}
              <div className="flex items-center gap-3">
                {/* Big mic button */}
                <button
                  onClick={toggleListening}
                  disabled={aiSpeaking || sending}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    listening
                      ? 'bg-red-500 text-white scale-110 animate-pulse'
                      : aiSpeaking || sending
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-400 text-white hover:bg-primary-600 hover:scale-105'
                  }`}
                >
                  {listening ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                {/* Send voice answer */}
                {input && !listening && (
                  <button
                    onClick={handleVoiceSubmit}
                    disabled={sending}
                    className="btn-primary h-10 px-4"
                  >
                    <Send size={14} /> Send answer
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 text-center">
                {listening ? 'Listening... click mic to stop' : aiSpeaking ? 'Wait for AI to finish...' : 'Tap mic to speak your answer'}
              </p>
            </div>
          ) : (
            /* ── TEXT mode input ── */
            <div>
              <div className="flex gap-2 items-end">
                <textarea
                  className="input flex-1 resize-none min-h-[40px] max-h-32 text-sm"
                  placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  rows={1}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className="btn-primary h-10 px-3 flex-shrink-0"
                >
                  <Send size={15} />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                Tip: Use STAR format — Situation, Task, Action, Result · Switch to{' '}
                <button onClick={() => setVoiceMode(true)} className="text-primary-600 hover:underline">voice mode</button>
                {' '}to answer by speaking
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Completed footer ── */}
      {isCompleted && (
        <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-2">
          <button onClick={() => { stopSpeaking(); navigate('/interview'); }} className="btn-secondary flex-1 justify-center">
            Back to sessions
          </button>
          <button onClick={() => { stopSpeaking(); navigate('/interview'); }} className="btn-primary flex-1 justify-center">
            New session
          </button>
        </div>
      )}
    </div>
  );
}