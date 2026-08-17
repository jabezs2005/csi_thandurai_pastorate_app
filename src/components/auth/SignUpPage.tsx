import { useState, useEffect } from 'react';
import { Eye, EyeOff, Church, User, AlertCircle, CheckCircle, ArrowLeft, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Church as ChurchType } from '../../types';

interface SignUpPageProps {
  onBack: () => void;
}

export default function SignUpPage({ onBack }: SignUpPageProps) {
  const { signUp } = useAuth();
  const [selectedChurchId, setSelectedChurchId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [churches, setChurches] = useState<ChurchType[]>([]);
  const [churchesLoading, setChurchesLoading] = useState(true);

  useEffect(() => {
    const loadChurches = async () => {
      try {
        const { data, error: err } = await supabase
          .from('churches')
          .select('*')
          .order('name');
        if (err) throw err;
        if (data) setChurches(data);
      } catch (err) {
        console.error('Failed to load churches:', err);
      } finally {
        setChurchesLoading(false);
      }
    };
    loadChurches();
  }, []);

  const validateForm = (): string | null => {
    if (!fullName.trim()) return 'Full name is required';
    if (!email.trim()) return 'Email is required';
    if (!password.trim()) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    if (!selectedChurchId) return 'Please select a church';
    return null;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUp(email, password, 'church_admin', selectedChurchId, fullName, mobile);
    if (signUpError) {
      setError(signUpError);
    } else {
      setSuccess(true);
      setFullName('');
      setEmail('');
      setMobile('');
      setPassword('');
      setConfirmPassword('');
      setSelectedChurchId('');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500 rounded-2xl mb-4 shadow-lg">
            <Church className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ChurchConnect</h1>
          <p className="text-teal-300 mt-1">Create New Account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-teal-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-lg font-bold text-white">Create Church Admin Account</h2>
                <p className="text-teal-100 text-xs">Requires super admin approval</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {success ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Account Created!</h3>
                  <p className="text-green-700 text-sm mb-4">
                    Your account has been created! Please wait for super admin approval before you can log in.
                  </p>
                </div>
                <button
                  onClick={onBack}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    placeholder="Enter your mobile number"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Church *</label>
                  <select
                    value={selectedChurchId}
                    onChange={e => setSelectedChurchId(e.target.value)}
                    disabled={churchesLoading}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white disabled:opacity-60"
                    required
                  >
                    <option value="">{churchesLoading ? 'Loading churches...' : '-- Select your church --'}</option>
                    {churches.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none disabled:opacity-60"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none disabled:opacity-60"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>{error}</div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || churchesLoading}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}

            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={onBack}
                className="w-full text-teal-600 hover:text-teal-700 font-medium py-2 flex items-center justify-center gap-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
