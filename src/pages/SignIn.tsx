import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Loader2, LogIn, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SignInProps {
  onSignIn: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Error', description: 'Please enter email and password', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: 'Welcome!', description: 'Sign in successful.' });
      onSignIn();
    } catch (error: any) {
      toast({ title: 'Sign In Failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />

      <div className="relative w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl mb-4 backdrop-blur-sm">
            <GraduationCap className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Exam Claim Manager</h1>
          <p className="text-sm text-blue-200/70 mt-1">Anna University Regional Campus Coimbatore</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Sign In</h2>
            <p className="text-sm text-slate-400 mt-0.5">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@university.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-400/20"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-400/20"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 mt-2 transition-all duration-200 shadow-lg shadow-blue-900/40"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In</>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-slate-500">
              Office of the Controller of Examinations
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Authorized access only. Contact admin for account issues.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
