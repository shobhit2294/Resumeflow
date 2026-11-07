import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Mail, Phone, ShieldCheck, ArrowLeft, User, Briefcase } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../context/authStore';

// ─── 6-box OTP input (same as LoginPage) ─────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const inputs = useRef([]);
  const digits = (value || '').padEnd(6, '').split('').slice(0, 6);

  const handleChange = (idx, e) => {
    const ch = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = ch;
    onChange(next.join('').trimEnd());
    if (ch && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => (inputs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          className="w-10 h-12 text-center text-xl font-bold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent disabled:opacity-50 transition-all"
          autoFocus={idx === 0}
        />
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [step, setStep] = useState('info'); // 'info' | 'otp'
  const [form, setForm] = useState({ name: '', contact: '', title: '' });
  const [contactType, setContactType] = useState('email');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const { requestOtp, registerWithOtp } = useAuthStore();
  const navigate = useNavigate();

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Step 1: Send OTP
  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim()) return;
    setLoading(true);
    try {
      const result = await requestOtp(form.contact.trim());
      setContactType(result.type || (form.contact.includes('@') ? 'email' : 'phone'));
      if (result.devOtp) {
        setDevOtp(result.devOtp);
      }
      if (result.exists) {
        toast(`An account with this contact already exists. Entering sign-in mode.`, { icon: 'ℹ️' });
      } else {
        toast.success(result.message || 'OTP sent!');
      }
      setStep('otp');
      setResendTimer(60);

      // Start resend countdown
      const interval = setInterval(() => {
        setResendTimer((s) => {
          if (s <= 1) { clearInterval(interval); return 0; }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Resend
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const res = await requestOtp(form.contact.trim());
      if (res.devOtp) setDevOtp(res.devOtp);
      setOtp('');
      setResendTimer(60);
      const interval = setInterval(() => {
        setResendTimer((s) => {
          if (s <= 1) { clearInterval(interval); return 0; }
          return s - 1;
        });
      }, 1000);
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP + create account
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      await registerWithOtp(
        form.name.trim(),
        form.contact.trim(),
        otp,
        form.title.trim()
      );
      toast.success('Account created! Welcome to ResumeFlow 🎉');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary-400 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-primary-200">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">Start tracking your job search</p>
        </div>

        <div className="card p-6">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-6">
            {['info', 'otp'].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === s
                      ? 'bg-primary-400 text-white'
                      : i < ['info', 'otp'].indexOf(step)
                      ? 'bg-green-400 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {i + 1}
                </div>
                {i < 1 && <div className={`flex-1 h-0.5 ${step === 'otp' ? 'bg-primary-200' : 'bg-gray-100'}`} />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Info ──────────────────────────────────────────── */}
          {step === 'info' && (
            <form onSubmit={handleInfoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Full name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="input pl-9"
                    placeholder="Arjun Kumar"
                    value={form.name}
                    onChange={setField('name')}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Email or Mobile Number</label>
                <div className="relative">
                  {form.contact.includes('@') || !form.contact ? (
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  ) : (
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <input
                    type="text"
                    className="input pl-9"
                    placeholder="you@example.com or +919876543210"
                    value={form.contact}
                    onChange={setField('contact')}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Job title <span className="text-gray-400">(optional)</span>
                </label>
                <div className="relative">
                  <Briefcase size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="input pl-9"
                    placeholder="Software Engineer"
                    value={form.title}
                    onChange={setField('title')}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !form.name || !form.contact}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Send OTP →'
                )}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP ───────────────────────────────────────────── */}
          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <button
                type="button"
                onClick={() => { setStep('info'); setOtp(''); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 -mb-1"
              >
                <ArrowLeft size={13} /> {form.contact}
              </button>

              <div className="flex flex-col items-center gap-3 py-2">
                <ShieldCheck size={32} className="text-primary-400" />
                <p className="text-sm text-gray-600 text-center">
                  Enter the 6-digit code sent to your {contactType === 'phone' ? 'phone' : 'email'}:<br />
                  <strong>{form.contact}</strong>
                </p>
              </div>

              {devOtp && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1">
                  <p className="text-xs text-amber-900 font-semibold">
                    ⚡ Verification Code: <span className="font-mono text-base font-bold text-amber-950">{devOtp}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtp)}
                    className="text-xs text-primary-700 hover:underline font-bold"
                  >
                    👉 Click to Auto-Fill
                  </button>
                </div>
              )}

              <OtpInput value={otp} onChange={setOtp} disabled={loading} />

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Verify & Create Account'
                )}
              </button>

              <p className="text-center text-xs text-gray-400">
                {resendTimer > 0 ? (
                  `Resend in ${resendTimer}s`
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-primary-600 font-medium hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </p>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          No password needed — single-step verification via Email or Phone.
        </p>
      </div>
    </div>
  );
}
