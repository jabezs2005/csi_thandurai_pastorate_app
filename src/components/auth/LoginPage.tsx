import { useState, useEffect } from 'react';
import { Eye, EyeOff, Church, User, AlertCircle, CheckCircle, Mail, ArrowLeft, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Church as ChurchType } from '../../types';

interface LoginPageProps {
  onShowSignUp?: () => void;
}

export default function LoginPage({ onShowSignUp }: LoginPageProps) {
  const { signIn, requestPasswordReset } = useAuth();
  const [selectedChurchId, setSelectedChurchId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [churches, setChurches] = useState<ChurchType[]>([]);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const [churchesLoading, setChurchesLoading] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter email or mobile number');
      return;
    }
    if (!password.trim()) {
      setError('Please enter password');
      return;
    }
    if (!selectedChurchId) {
      setError('Please select a church');
      return;
    }

    setLoading(true);
    const { error: signInError } = await signIn(identifier, password, 'church_admin');
    if (signInError) {
      setError(signInError);
    }
    setLoading(false);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotMessage('');
    setError('');

    if (!forgotEmail.trim()) {
      setError('Please enter your email');
      return;
    }

    setForgotLoading(true);
    const { error: resetError } = await requestPasswordReset(forgotEmail);
    if (resetError) {
      setError(resetError);
    } else {
      setForgotSuccess(true);
      setForgotMessage('If an account exists with this email, you will receive password reset instructions.');
      setForgotEmail('');
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotSuccess(false);
      }, 3000);
    }
    setForgotLoading(false);
  }

  async function handleDemoSetup() {
    setSetupLoading(true);
    setSetupMessage('Initializing demo setup...');
    setError('');

    try {
      if (!churches || churches.length < 2) {
        throw new Error('Churches not loaded. Please refresh the page.');
      }

      const firstChurchId = churches[0]?.id;
      const secondChurchId = churches[1]?.id;

      if (!firstChurchId || !secondChurchId) {
        throw new Error('Church configuration is missing');
      }

      setSetupMessage('Creating admin accounts...');

      const accounts = [
        { email: 'superadmin@church.com', password: 'Admin@1234', role: 'super_admin', church_id: null, full_name: 'Super Administrator', mobile: '9000000001' },
        { email: 'admin1@stmarys.com', password: 'Admin@1234', role: 'church_admin', church_id: firstChurchId, full_name: 'St. Mary Admin 1', mobile: '9000000002' },
        { email: 'admin2@stmarys.com', password: 'Admin@1234', role: 'church_admin', church_id: firstChurchId, full_name: 'St. Mary Admin 2', mobile: '9000000003' },
        { email: 'admin1@stjohns.com', password: 'Admin@1234', role: 'church_admin', church_id: secondChurchId, full_name: 'St. John Admin 1', mobile: '9000000004' },
      ];

      for (const acct of accounts) {
        try {
          const checkResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check_approval`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ email: acct.email }),
          });

          const checkData = await checkResponse.json();

          if (checkData.found) {
            console.log(`${acct.email} already exists`);
            continue;
          }

          const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: acct.email,
            password: acct.password,
            options: { data: { role: acct.role } },
          });

          if (signUpError) {
            if (signUpError.message.includes('already registered')) {
              console.log(`${acct.email} already exists`);
              continue;
            }
            throw signUpError;
          }

          if (authData.user) {
            const isApproved = acct.role === 'super_admin';
            const createResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create_account`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                user_id: authData.user.id,
                email: acct.email,
                role: acct.role,
                church_id: acct.church_id,
                full_name: acct.full_name,
                mobile: acct.mobile,
                is_approved: isApproved,
              }),
            });

            if (!createResponse.ok) {
              const createData = await createResponse.json();
              throw new Error(createData.error || 'Failed to create profile');
            }

            await supabase.auth.signOut();
          }
        } catch (err) {
          console.error(`Error creating account ${acct.email}:`, err);
        }
      }

      setSetupMessage('Creating demo members...');

      const { data: existingMembers } = await supabase
        .from('members')
        .select('id')
        .eq('church_id', firstChurchId)
        .limit(1);

      if (!existingMembers || existingMembers.length === 0) {
        const demoMembers = [
          { church_id: firstChurchId, family_number: 'FAM001', member_name: 'Arumugam Selvaraj', address: '12, Rose Street, Chennai', email: 'arumugam@email.com', mobile: '9876543210' },
          { church_id: firstChurchId, family_number: 'FAM001', member_name: 'Geetha Arumugam', address: '12, Rose Street, Chennai', email: 'geetha@email.com', mobile: '9876543211' },
          { church_id: firstChurchId, family_number: 'FAM001', member_name: 'Praveen Arumugam', address: '12, Rose Street, Chennai', email: 'praveen@email.com', mobile: '9876543212' },
          { church_id: firstChurchId, family_number: 'FAM002', member_name: 'Daniel Raj', address: '45, Church Road, Chennai', email: 'daniel@email.com', mobile: '9876543220' },
          { church_id: firstChurchId, family_number: 'FAM002', member_name: 'Anitha Daniel', address: '45, Church Road, Chennai', email: 'anitha@email.com', mobile: '9876543221' },
          { church_id: firstChurchId, family_number: 'FAM003', member_name: 'Samuel Christraj', address: '7, Cross Lane, Chennai', email: 'samuel@email.com', mobile: '9876543230' },
          { church_id: firstChurchId, family_number: 'FAM003', member_name: 'Mercy Samuel', address: '7, Cross Lane, Chennai', email: 'mercy@email.com', mobile: '9876543231' },
          { church_id: firstChurchId, family_number: 'FAM004', member_name: 'Joseph Immanuel', address: '3, Palm Avenue, Chennai', email: 'joseph@email.com', mobile: '9876543240' },
        ];

        const { data: insertedMembers, error: memberErr } = await supabase.from('members').insert(demoMembers).select();

        if (memberErr) throw memberErr;

        if (insertedMembers && insertedMembers.length > 0) {
          setSetupMessage('Creating subscription records...');
          const year = new Date().getFullYear();
          const subData = [];

          for (const member of insertedMembers) {
            for (let month = 1; month <= 6; month++) {
              subData.push({
                member_id: member.id,
                church_id: firstChurchId,
                year,
                month,
                sandha: Math.floor(Math.random() * 500) + 100,
                kattida_nidhi: Math.floor(Math.random() * 1000) + 200,
                aalaya_paraamarippu: Math.floor(Math.random() * 300) + 50,
                narseidhi_thiruppani: Math.floor(Math.random() * 200) + 50,
                yezhaiyar_nidhi: Math.floor(Math.random() * 150) + 50,
                pengal_thiruppani: Math.floor(Math.random() * 100) + 25,
                aangal_thiruppani: Math.floor(Math.random() * 100) + 25,
                ilainyar_thiruppani: Math.floor(Math.random() * 100) + 25,
                siruvar_thiruppani: Math.floor(Math.random() * 100) + 25,
                girama_nidhi: Math.floor(Math.random() * 200) + 50,
                kalvi_nidhi: Math.floor(Math.random() * 300) + 100,
              });
            }
          }

          if (subData.length > 0) {
            const { error: subErr } = await supabase.from('subscriptions').insert(subData);
            if (subErr) throw subErr;
          }
        }
      }

      setSetupDone(true);
      setSetupMessage('Demo setup completed successfully!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Demo setup failed. Please try again.';
      setError(errorMsg);
      console.error('Demo setup error:', err);
    } finally {
      setSetupLoading(false);
    }
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500 rounded-2xl mb-4 shadow-lg">
              <Church className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">ChurchConnect</h1>
            <p className="text-teal-300 mt-1">Reset Your Password</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden p-8">
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  disabled={forgotLoading}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {forgotSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>{forgotMessage}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <button
              onClick={() => {
                setShowForgotPassword(false);
                setError('');
                setForgotMessage('');
              }}
              className="w-full mt-4 text-teal-600 hover:text-teal-700 font-medium py-2 flex items-center justify-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500 rounded-2xl mb-4 shadow-lg">
            <Church className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ChurchConnect</h1>
          <p className="text-teal-300 mt-1">Membership Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-teal-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-lg font-bold text-white">Church Admin Login</h2>
                <p className="text-teal-100 text-xs">Branch-level management access</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                {churches.length === 0 && !churchesLoading && (
                  <p className="text-xs text-red-600 mt-1">No churches found in database</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email or Mobile Number</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="admin@church.com or 9000000001"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
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
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                Forgot Password?
              </button>
            </div>


            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center mb-3">First time? Set up demo accounts and data</p>

              {setupLoading && (
                <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse flex-shrink-0 mt-1" />
                  <div>{setupMessage}</div>
                </div>
              )}

              <button
                onClick={handleDemoSetup}
                disabled={setupLoading || churches.length === 0 || churchesLoading}
                className={`w-full font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${
                  setupDone
                    ? 'bg-green-100 hover:bg-green-200 text-green-700'
                    : 'bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700'
                }`}
              >
                {setupDone && <CheckCircle className="w-4 h-4" />}
                {setupLoading ? 'Setting up...' : setupDone ? 'Demo Setup Complete!' : 'Setup Demo Data'}
              </button>

              {setupDone && (
                <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg p-4 text-xs text-teal-800 space-y-2">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    Demo Setup Successful!
                  </p>
                  <div className="bg-white rounded p-2.5 space-y-1.5">
                    <div>
                      <p className="font-medium text-slate-700">Super Admin:</p>
                      <p className="text-slate-600">Email: superadmin@church.com</p>
                      <p className="text-slate-600">Password: Admin@1234</p>
                      <p className="text-slate-500 text-[11px]">Login at: /super-admin</p>
                    </div>
                    <hr className="my-2 border-slate-200" />
                    <div>
                      <p className="font-medium text-slate-700">Church Admin (St. Mary's):</p>
                      <p className="text-slate-600">Email: admin1@stmarys.com</p>
                      <p className="text-slate-600">Password: Admin@1234</p>
                    </div>
                  </div>
                </div>
              )}

              {error && setupLoading && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
