
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { Binary, Mail, Lock, User as UserIcon, Loader2, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const { loginEmail, initiateSignup, verifyOtpAndRegister, loginGoogle } = useAuth();
  
  // UI State
  const [view, setView] = useState<'LOGIN' | 'SIGNUP' | 'OTP'>('LOGIN');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  
  // Verification State
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
        // 1. Check uniqueness / Send data to server
        await initiateSignup(email, password, name);
        
        // 2. Generate OTP (Simulated or Trigger Server Email)
        const code = await authService.generateOTP(email);
        setGeneratedOtp(code);
        
        // 3. Move to OTP View
        setView('OTP');
    } catch (err: any) {
        setError(err.message || 'Signup failed.');
    } finally {
        setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
          await verifyOtpAndRegister(email, password, name, otp, generatedOtp);
      } catch (err: any) {
          setError(err.message || 'Verification failed.');
      } finally {
          setLoading(false);
      }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      // Simulate selecting a google account
      await loginGoogle(email || undefined); 
    } catch (err) {
      setError('Google sign-in failed.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
      const code = await authService.generateOTP(email);
      setGeneratedOtp(code);
      setOtp(''); // Clear input
      alert('New code sent!');
  };

  return (
    <div className="min-h-screen w-full bg-trade-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-trade-panel border border-trade-border p-8 rounded-2xl w-full max-w-md shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/20">
                <Binary className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
                {view === 'LOGIN' ? 'Welcome Back' : view === 'SIGNUP' ? 'Create Account' : 'Verify Email'}
            </h1>
            <p className="text-trade-text-muted text-sm mt-1 text-center">
                {view === 'LOGIN' ? 'Enter your credentials to access your workspace' : 
                 view === 'SIGNUP' ? 'Start your AI trading journey today' : 
                 `We sent a code to ${email}`}
            </p>
        </div>

        {/* LOGIN FORM */}
        {view === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input 
                        type="email" 
                        placeholder="Email Address"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-trade-bg border border-trade-border rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-trade-accent transition-colors"
                        required
                    />
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input 
                        type="password" 
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-trade-bg border border-trade-border rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-trade-accent transition-colors"
                        required
                    />
                </div>
                {error && <div className="text-red-500 text-xs text-center bg-red-500/10 p-2 rounded">{error}</div>}
                <button 
                    type="submit" disabled={loading}
                    className="w-full bg-trade-accent hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                </button>
            </form>
        )}

        {/* SIGNUP FORM */}
        {view === 'SIGNUP' && (
            <form onSubmit={handleSignupStart} className="space-y-4">
                <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input 
                        type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)}
                        className="w-full bg-trade-bg border border-trade-border rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-trade-accent transition-colors" required
                    />
                </div>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input 
                        type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full bg-trade-bg border border-trade-border rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-trade-accent transition-colors" required
                    />
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input 
                        type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full bg-trade-bg border border-trade-border rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-trade-accent transition-colors" required
                    />
                </div>
                {error && <div className="text-red-500 text-xs text-center bg-red-500/10 p-2 rounded">{error}</div>}
                <button 
                    type="submit" disabled={loading}
                    className="w-full bg-trade-accent hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Send Verification Code <ArrowRight className="w-4 h-4" /></>}
                </button>
            </form>
        )}

        {/* OTP FORM */}
        {view === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="text-center">
                    <div className="relative mx-auto w-48">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-trade-accent w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Enter 6-digit Code" 
                            value={otp} 
                            onChange={e => setOtp(e.target.value.slice(0, 6))}
                            className="w-full bg-trade-bg border border-trade-border rounded-lg py-3 pl-10 pr-4 text-white text-center tracking-[0.5em] font-mono text-xl focus:outline-none focus:border-trade-accent transition-colors" 
                            required
                            maxLength={6}
                        />
                    </div>
                    <button type="button" onClick={handleResendOtp} className="text-xs text-trade-text-muted mt-2 hover:text-trade-accent flex items-center justify-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Resend Code
                    </button>
                </div>

                {error && <div className="text-red-500 text-xs text-center bg-red-500/10 p-2 rounded">{error}</div>}
                
                <div className="flex gap-2">
                    <button 
                        type="button" onClick={() => setView('SIGNUP')}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all"
                    >
                        Back
                    </button>
                    <button 
                        type="submit" disabled={loading}
                        className="flex-1 bg-trade-accent hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Verify & Create'}
                    </button>
                </div>
            </form>
        )}

        <div className="my-6 flex items-center gap-4">
            <div className="h-px bg-gray-800 flex-1"></div>
            <span className="text-xs text-gray-500 uppercase">Or continue with</span>
            <div className="h-px bg-gray-800 flex-1"></div>
        </div>

        <button 
            onClick={handleGoogle}
            disabled={loading}
            className="w-full bg-white text-gray-900 font-bold py-3 rounded-lg transition-transform hover:bg-gray-100 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
        >
             <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
             </svg>
            Sign in with Google
        </button>

        <div className="mt-6 text-center">
            {view === 'LOGIN' ? (
                <p className="text-sm text-gray-400">
                    Don't have an account?
                    <button onClick={() => setView('SIGNUP')} className="ml-1 text-trade-accent hover:underline font-semibold">Sign Up</button>
                </p>
            ) : (
                <p className="text-sm text-gray-400">
                    Already have an account?
                    <button onClick={() => setView('LOGIN')} className="ml-1 text-trade-accent hover:underline font-semibold">Log In</button>
                </p>
            )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
