import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const TABS = ['login', 'register', 'otp'];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', otp: '' });
  const [otpSent, setOtpSent] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pwStrength, setPwStrength] = useState(0);
  const [backendOk, setBackendOk] = useState(null); // null=checking, true=ok, false=down

  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/health');
        const data = await res.json();
        setBackendOk(data.success === true);
      } catch {
        setBackendOk(false);
      }
    };
    checkBackend();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
    setSuccess('');
    if (name === 'password') {
      let s = 0;
      if (value.length > 5) s++;
      if (/[A-Z]/.test(value)) s++;
      if (/[0-9]/.test(value)) s++;
      if (/[^A-Za-z0-9]/.test(value)) s++;
      setPwStrength(s);
    }
  };

  const redirectAfterLogin = (user) => {
    if (user.role === 'admin' || user.role === 'manager') {
      navigate('/dashboard');
    } else {
      navigate('/report');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Please enter email and password');
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login({ email: form.email, password: form.password });
      login(data.user, data.token);
      setSuccess('Login successful! Redirecting…');
      setTimeout(() => redirectAfterLogin(data.user), 500);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.code === 'ERR_NETWORK' || msg?.includes('Network')) {
        setError('❌ Cannot connect to backend. Make sure: cd backend && npm run dev');
      } else {
        setError(msg || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return setError('All fields are required');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.register({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      login(data.user, data.token);
      setSuccess('Account created! Redirecting…');
      setTimeout(() => redirectAfterLogin(data.user), 500);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.code === 'ERR_NETWORK' || msg?.includes('Network')) {
        setError('❌ Cannot connect to backend. Make sure: cd backend && npm run dev');
      } else {
        setError(msg || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!form.email) return setError('Email is required');
    setLoading(true);
    try {
      const { data } = await authAPI.sendOTP(form.email);
      setOtpSent(true);
      setSuccess('OTP sent! Check console/terminal for the code (dev mode).');
      if (data.otp) {
        setForm((f) => ({ ...f, otp: data.otp }));
        setSuccess(`OTP auto-filled: ${data.otp} (dev mode)`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!form.otp) return setError('Enter OTP');
    setLoading(true);
    try {
      const { data } = await authAPI.verifyOTP(form.email, form.otp);
      login(data.user, data.token);
      redirectAfterLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      const { data } = await authAPI.guestLogin();
      login(data.user, data.token);
      navigate('/report');
    } catch {
      // Fallback: create a guest session locally
      const guestUser = { id: 'guest', name: 'Guest User', email: 'guest@demo.com', role: 'citizen', isGuest: true };
      login(guestUser, 'guest-token');
      navigate('/report');
    } finally {
      setLoading(false);
    }
  };

  const pwStrengthColors = ['bg-slate-200', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];
  const pwStrengthLabels = ['', 'WEAK', 'FAIR', 'MEDIUM', 'STRONG'];

  return (
    <div className="min-h-screen flex">
      {/* Left hero panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 p-12 flex-col justify-between relative overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="font-display font-bold text-slate-900">CityPulse AI</span>
        </div>

        <div>
          <h1 className="font-display text-5xl font-bold text-slate-900 leading-tight mb-6">
            Optimizing the<br />
            <span className="text-brand-600">Urban Pulse.</span>
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed max-w-sm">
            Access the neural network of city management. Real-time insights, civic health metrics, and automated issue resolution in one unified dashboard.
          </p>

          <div className="mt-10 bg-white rounded-2xl border border-slate-100 p-4 inline-flex items-center gap-3 shadow-sm">
            <div className="flex -space-x-2">
              {['#2563eb', '#7c3aed', '#dc2626'].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white" style={{ backgroundColor: c }} />
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Join 400+ City Managers</p>
              <p className="text-xs text-orange-500 font-bold">⭐ TOP RATED GOV-TECH</p>
            </div>
          </div>
        </div>

        {/* Demo credentials box */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 p-4 text-xs">
          <p className="font-bold text-slate-700 mb-2">🔑 Demo Credentials</p>
          <div className="space-y-1 font-mono text-slate-600">
            <p><span className="text-brand-600 font-bold">Admin:</span> admin@citypulse.gov / admin123</p>
            <p><span className="text-purple-600 font-bold">Manager:</span> a.moore@infrastructure.gov / manager123</p>
            <p><span className="text-green-600 font-bold">Citizen:</span> rahul@citizen.in / citizen123</p>
          </div>
          <p className="text-slate-400 mt-2">Run <code className="bg-slate-100 px-1 rounded">npm run seed</code> in backend first</p>
        </div>

        <div className="flex gap-8">
          {['INFRASTRUCTURE', 'MOBILITY', 'ENVIRONMENT'].map((tag) => (
            <span key={tag} className="text-xs font-bold text-slate-300 tracking-widest">{tag}</span>
          ))}
        </div>

        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-brand-100 rounded-full opacity-30" />
        <div className="absolute top-40 -right-10 w-40 h-40 bg-blue-100 rounded-full opacity-50" />
      </div>

      {/* Right login panel */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Backend status indicator */}
          {backendOk === false && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs">
              <p className="font-bold text-red-700 mb-1">⚠️ Backend Not Running</p>
              <p className="text-red-600">Open a terminal and run:</p>
              <code className="block bg-red-100 rounded p-1.5 mt-1 text-red-800 font-mono">
                cd sheharsetu/backend<br/>
                npm install<br/>
                npm run seed<br/>
                npm run dev
              </code>
            </div>
          )}
          {backendOk === true && (
            <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Backend connected ✓
            </div>
          )}

          <h2 className="font-display text-3xl font-bold text-slate-900 mb-1">Welcome back,</h2>
          <p className="text-slate-500 mb-6">let's make the city better today.</p>

          {/* Social login */}
          <div className="flex gap-3 mb-5">
            <button className="flex-1 btn-secondary gap-2 text-sm py-2.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button className="flex-1 btn-secondary gap-2 text-sm py-2.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-100"></div>
            <span className="text-xs text-slate-400 font-semibold tracking-wider">OR EMAIL</span>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
            {[['login','Login'], ['register','Register'], ['otp','Magic OTP']].map(([t, label]) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess(''); setOtpSent(false); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error / Success messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
              <span>✓</span> {success}
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Work Email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="admin@citypulse.gov"
                    className="input-field pl-8"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Secure Password</label>
                  <button type="button" className="text-xs text-brand-600 font-semibold">Forgot?</button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2"/>
                    </svg>
                  </span>
                  <input
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="input-field pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPw
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" strokeWidth="2" strokeLinecap="round"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" strokeLinecap="round"/></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2"/><circle cx="12" cy="12" r="3" strokeWidth="2"/></>
                      }
                    </svg>
                  </button>
                </div>
                {form.password && (
                  <div className="mt-1.5">
                    <div className="flex gap-1">
                      {[1,2,3,4].map((s) => (
                        <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= pwStrength ? pwStrengthColors[pwStrength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">STRENGTH: <span className="font-bold text-brand-600">{pwStrengthLabels[pwStrength]}</span></p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded accent-brand-600" defaultChecked />
                  Remember device
                </label>
                <button type="button" className="text-sm text-brand-600 font-semibold">✨ Magic Link</button>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Authenticating…
                  </span>
                ) : 'Access Dashboard'}
              </button>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="James Miller"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Work Email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@citypulse.gov"
                    className="input-field pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min 6 characters"
                    className="input-field pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                    </svg>
                  </button>
                </div>
                {form.password && (
                  <div className="mt-1.5">
                    <div className="flex gap-1">
                      {[1,2,3,4].map((s) => (
                        <div key={s} className={`h-1 flex-1 rounded-full ${s <= pwStrength ? pwStrengthColors[pwStrength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
                Creating a <span className="font-semibold text-slate-600">citizen</span> account. Admins are set up via the seed script.
              </p>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Creating Account…
                  </span>
                ) : 'Create Account'}
              </button>
            </form>
          )}

          {/* ── OTP FORM ── */}
          {tab === 'otp' && (
            <form onSubmit={otpSent ? handleVerifyOTP : handleSendOTP} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.gov"
                  className="input-field"
                  disabled={otpSent}
                />
              </div>
              {otpSent && (
                <div>
                  <label className="label">Enter OTP (check terminal)</label>
                  <input
                    name="otp"
                    type="text"
                    value={form.otp}
                    onChange={handleChange}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="input-field tracking-widest text-center text-lg font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-1 text-center">
                    OTP auto-filled in dev mode.{' '}
                    <button type="button" onClick={handleSendOTP} className="text-brand-600 font-semibold">Resend</button>
                  </p>
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Please wait…' : otpSent ? 'Verify OTP' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* Guest */}
          <button onClick={handleGuest} disabled={loading} className="btn-secondary w-full mt-3 py-2.5 text-sm">
            Continue as Guest
          </button>

          <p className="text-center text-sm text-slate-500 mt-4">
            {tab === 'login' ? (
              <>No account? <button onClick={() => setTab('register')} className="text-brand-600 font-semibold hover:underline">Create one →</button></>
            ) : (
              <>Have an account? <button onClick={() => setTab('login')} className="text-brand-600 font-semibold hover:underline">Sign in →</button></>
            )}
          </p>

          <div className="flex justify-center gap-6 mt-6">
            {['SECURITY AUDIT', 'COMPLIANCE', 'SYSTEM STATUS'].map((l) => (
              <button key={l} className="text-xs text-slate-400 font-semibold tracking-wide hover:text-slate-600">{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
