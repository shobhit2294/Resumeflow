import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, Eye, EyeOff, Mail, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../context/authStore';

// ─── 6-box OTP input component ────────────────────────────────────────────────
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
    const focusIdx = Math.min(pasted.length, 5);
    inputs.current[focusIdx]?.focus();
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
export default function LoginPage() {
  const [step, setStep] = useState('contact'); // 'contact' | 'otp' | 'password'
  const [contact, setContact] = useState('');
  const [contactType, setContactType] = useState('email');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const { requestOtp, verifyOtpLogin, login } = useAuthStore();
  const navigate = useNavigate();

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Step 1: Send OTP
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const val = contact.trim();
    if (!val) return;
    setLoading(true);
    try {
      const result = await requestOtp(val);
      if (!result.exists) {
        toast.error('No account found for this contact. Please sign up free.');
        return;
      }
      setContactType(result.type || (val.includes('@') ? 'email' : 'phone'));
      if (result.devOtp) {
        setDevOtp(result.devOtp);
      }
      setStep('otp');
      setResendTimer(60);
      toast.success(result.message || 'OTP sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const res = await requestOtp(contact.trim());
      if (res.devOtp) setDevOtp(res.devOtp);
      setOtp('');
      setResendTimer(60);
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otp.length < 6) {
      toast.error('Enter all 6 digits');
      return;
    }
    setLoading(true);
    try {
      await verifyOtpLogin(contact.trim(), otp);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid OTP';
      toast.error(msg);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // Password fallback login
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(contact.trim(), password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
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
          <h1 className="text-2xl font-bold text-gray-900">ResumeFlow</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in with Email or Mobile</p>
        </div>

        <div className="card p-6">
          {/* ── Step: Contact (Email or Mobile) ────────────────────────── */}
          {step === 'contact' && (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Email or Mobile Number
                </label>
                <div className="relative">
                  {contact.includes('@') || !contact ? (
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  ) : (
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <input
                    type="text"
                    className="input pl-9"
                    placeholder="you@example.com or +919876543210"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !contact.trim()}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Continue with OTP'
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('password')}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
              >
                Sign in with password instead
              </button>
            </form>
          )}

          {/* ── Step: OTP ────────────────────────────────────────────── */}
          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <button
                type="button"
                onClick={() => { setStep('contact'); setOtp(''); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 -mb-1"
              >
                <ArrowLeft size={13} /> {contact}
              </button>

              <div className="flex flex-col items-center gap-3 py-2">
                <ShieldCheck size={32} className="text-primary-400" />
                <p className="text-sm text-gray-600 text-center">
                  Enter the 6-digit code sent to your {contactType === 'phone' ? 'phone' : 'email'}:<br />
                  <strong>{contact}</strong>
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
                  'Verify & Sign In'
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

              <button
                type="button"
                onClick={() => setStep('password')}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Use password instead
              </button>
            </form>
          )}

          {/* ── Step: Password (fallback) ─────────────────────────────── */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('contact')}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 -mb-1"
              >
                <ArrowLeft size={13} /> Back
              </button>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="input pl-9"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-4">
            No account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Works with any email or mobile number. No password required.
        </p>
      </div>
    </div>
  );
}
