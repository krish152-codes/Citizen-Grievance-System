import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', otp: '' });
  const [otpSent, setOtpSent] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pwStrength, setPwStrength] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
    setSuccess('');
    if (name === 'password') {
      let s = 0;
      if (value.length >= 6) s++;
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
      navigate('/citizen-dashboard');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Please enter your email and password');
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login({ email: form.email, password: form.password });
      login(data.user, data.token);
      setSuccess('Login successful! Redirecting…');
      setTimeout(() => redirectAfterLogin(data.user), 400);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Full name is required');
    if (!form.email.trim()) return setError('Email address is required');
    if (!form.phone.trim()) return setError('Phone number is required');
    if (!form.password) return setError('Password is required');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');

    const cleanPhone = form.phone.trim().replace(/\s|-/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhone)) {
      return setError('Please enter a valid phone number (10 digits, e.g. 9876543210)');
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: cleanPhone,
        password: form.password,
      });
      login(data.user, data.token);
      setSuccess('Account created! Welcome to SheharSetu…');
      setTimeout(() => redirectAfterLogin(data.user), 400);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!form.email) return setError('Email is required');
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.sendOTP(form.email);
      setOtpSent(true);
      setSuccess('OTP sent to your email.');
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
    if (!form.otp) return setError('Please enter the OTP');
    setLoading(true);
    setError('');
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

  const pwColors = ['bg-slate-200', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];
  const pwLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  const EyeIcon = ({ open }) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {open
        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" strokeWidth="2" strokeLinecap="round"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" strokeLinecap="round"/></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2"/><circle cx="12" cy="12" r="3" strokeWidth="2"/></>
      }
    </svg>
  );

  return (
    <div className="min-h-screen flex">
      {/* ── Left hero panel ── */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-brand-900 to-slate-800 p-12 flex-col justify-between relative overflow-hidden">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="font-display font-bold text-white text-lg">SheharSetu</span>
        </div>

        {/* Headline */}
        <div>
          <h1 className="font-display text-5xl font-bold text-white leading-tight mb-5">
            Your City,<br />
            <span className="text-brand-400">Your Voice.</span>
          </h1>
          <p className="text-slate-300 text-base leading-relaxed max-w-sm">
            Report civic issues, track resolutions, and help build a better city. Join thousands of citizens making a difference.
          </p>

          {/* Features */}
          <div className="mt-10 space-y-3">
            {[
              { icon: '📸', text: 'Report issues with photos in seconds' },
              { icon: '🤖', text: 'AI instantly routes to the right department' },
              { icon: '📍', text: 'Track your complaint with a ticket ID' },
              { icon: '✅', text: 'Get notified when your issue is resolved' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-slate-300 text-sm">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Demo credentials */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 text-xs text-white">
          <p className="font-bold mb-2 text-brand-300">🔑 Demo Credentials</p>
          <div className="space-y-1 font-mono text-slate-300">
            <p><span className="text-brand-400 font-bold">Admin:</span> admin@citypulse.gov / admin123</p>
            <p><span className="text-purple-400 font-bold">Manager:</span> a.moore@infrastructure.gov / manager123</p>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-brand-700 rounded-full opacity-20" />
        <div className="absolute top-32 -right-10 w-40 h-40 bg-blue-700 rounded-full opacity-20" />
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-[500px] flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-display font-bold text-slate-900">SheharSetu</span>
          </div>

          <h2 className="font-display text-2xl font-bold text-slate-900 mb-1">
            {tab === 'register' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {tab === 'register'
              ? 'Join SheharSetu and start reporting civic issues.'
              : 'Sign in to track your complaints and city health.'}
          </p>

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            {[['login', 'Sign In'], ['register', 'Create Account'], ['otp', 'OTP Login']].map(([t, label]) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess(''); setOtpSent(false); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
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
                <label className="label">Email Address</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="input-field"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="input-field pr-10"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <EyeIcon open={showPw} />
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading
                  ? <span className="flex items-center gap-2 justify-center"><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />Signing in…</span>
                  : 'Sign In'}
              </button>
              <p className="text-center text-sm text-slate-500">
                No account?{' '}
                <button type="button" onClick={() => setTab('register')} className="text-brand-600 font-semibold hover:underline">
                  Create one free →
                </button>
              </p>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="label">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Email */}
              <div>
                <label className="label">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="input-field"
                  autoComplete="email"
                />
              </div>

              {/* Phone — mandatory */}
              <div>
                <label className="label">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">📱</span>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="9876543210"
                    className="input-field pl-9"
                    autoComplete="tel"
                    maxLength={15}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">10-digit Indian mobile number. Required for complaint updates.</p>
              </div>

              {/* Password */}
              <div>
                <label className="label">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min 6 characters"
                    className="input-field pr-10"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <EyeIcon open={showPw} />
                  </button>
                </div>
                {form.password && (
                  <div className="mt-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((s) => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= pwStrength ? pwColors[pwStrength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Strength: <span className="font-semibold text-slate-600">{pwLabels[pwStrength]}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Required note */}
              <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 leading-relaxed">
                <span className="text-red-500 font-bold">*</span> All fields are required. Your phone number will be used to notify you about your complaint status.
              </p>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading
                  ? <span className="flex items-center gap-2 justify-center"><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />Creating Account…</span>
                  : 'Create Free Account'}
              </button>
              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <button type="button" onClick={() => setTab('login')} className="text-brand-600 font-semibold hover:underline">
                  Sign in →
                </button>
              </p>
            </form>
          )}

          {/* ── OTP FORM ── */}
          {tab === 'otp' && (
            <form onSubmit={otpSent ? handleVerifyOTP : handleSendOTP} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className="input-field"
                  disabled={otpSent}
                />
              </div>
              {otpSent && (
                <div>
                  <label className="label">Enter OTP</label>
                  <input
                    name="otp"
                    type="text"
                    value={form.otp}
                    onChange={handleChange}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="input-field tracking-widest text-center text-xl font-mono"
                    autoFocus
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-400">Check your terminal in dev mode.</p>
                    <button type="button" onClick={handleSendOTP} className="text-xs text-brand-600 font-semibold">Resend OTP</button>
                  </div>
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Please wait…' : otpSent ? 'Verify OTP & Login' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* Report without login note */}
          <div className="mt-6 p-3 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-700 text-center">
            💡 You can also{' '}
            <button onClick={() => navigate('/report')} className="font-bold underline">report an issue without logging in</button>.
            {' '}Create an account to track your complaints.
          </div>
        </div>
      </div>
    </div>
  );
}
