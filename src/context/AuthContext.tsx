import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, Church } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  church: Church | null;
  loading: boolean;
  signIn: (identifier: string, password: string, expectedRole?: 'super_admin' | 'church_admin') => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, role: 'super_admin' | 'church_admin', churchId?: string, fullName?: string, mobile?: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, church:churches(*)')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
      if (data.church) setChurch(data.church as Church);
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await fetchProfile(session.user.id);
        })();
      } else {
        setProfile(null);
        setChurch(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(identifier: string, password: string, expectedRole?: 'super_admin' | 'church_admin'): Promise<{ error: string | null }> {
    let email = identifier;

    const isMobile = /^[0-9+\-\s()]{7,15}$/.test(identifier.trim());

    // Use edge function for pre-auth lookup (user not authenticated yet)
    try {
      const lookupPayload = isMobile ? { mobile: identifier.trim() } : { email: identifier.trim() };
      const lookupResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check_approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(lookupPayload),
      });

      const lookupData = await lookupResponse.json();

      if (!lookupData.found) {
        return { error: isMobile ? 'No account found with this mobile number.' : 'No account found with this email.' };
      }

      if (isMobile) {
        email = lookupData.email;
      }

      // Enforce role match: super admin credentials cannot be used on church admin login and vice versa
      if (expectedRole && lookupData.role && lookupData.role !== expectedRole) {
        return {
          error: expectedRole === 'super_admin'
            ? 'These credentials belong to a church admin account. Please use the Church Admin Login page.'
            : 'These credentials belong to a super admin account. Please use the Super Admin Login page.'
        };
      }

      // Check approval before attempting login
      if (lookupData.needs_approval && !lookupData.is_approved) {
        return { error: 'Your account is pending super admin approval. Please wait for approval before logging in.' };
      }
    } catch {
      // If edge function fails, continue with direct login attempt
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Post-auth role verification as a safety net (in case pre-auth lookup was skipped)
    if (expectedRole) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', email)
        .maybeSingle();

      if (profileData && profileData.role !== expectedRole) {
        await supabase.auth.signOut();
        return {
          error: expectedRole === 'super_admin'
            ? 'These credentials belong to a church admin account. Please use the Church Admin Login page.'
            : 'These credentials belong to a super admin account. Please use the Super Admin Login page.'
        };
      }
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setChurch(null);
  }

  async function signUp(
    email: string,
    password: string,
    role: 'super_admin' | 'church_admin',
    churchId?: string,
    fullName?: string,
    mobile?: string
  ): Promise<{ error: string | null }> {
    try {
      const isApproved = role === 'super_admin';
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role, is_approved: isApproved } },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          return { error: 'Email already registered' };
        }
        return { error: signUpError.message };
      }
      if (!authData.user) return { error: 'Failed to create account' };

      // Use edge function to create profile and set app_metadata
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create_account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: authData.user.id,
          email,
          role,
          church_id: churchId || null,
          full_name: fullName || '',
          mobile: mobile || '',
          is_approved: isApproved,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Failed to create profile' };
      }

      // Sign out after signup so user must log in properly
      await supabase.auth.signOut();

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Signup failed' };
    }
  }

  async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send_password_reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to send reset email' };
      }

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to send reset email' };
    }
  }

  async function resetPassword(token: string, newPassword: string): Promise<{ error: string | null }> {
    try {
      const { data: tokenData, error: tokenError } = await supabase
        .from('password_reset_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (tokenError || !tokenData) {
        return { error: 'Invalid or expired reset token' };
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return { error: 'Reset token has expired' };
      }

      if (tokenData.used_at) {
        return { error: 'Reset token has already been used' };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) return { error: updateError.message };

      await supabase
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to reset password' };
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, church, loading, signIn, signOut, refreshProfile, signUp, requestPasswordReset, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
