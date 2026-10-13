import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ClipboardList, ArrowRight, ShieldCheck, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="max-w-5xl w-full space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 animate-fade-in">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure Admin Portal</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">
            Exam Claim <span className="text-primary italic">Manager</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A comprehensive system for managing remuneration claims and certificates for 
            Practical and Project Examinations at Anna University.
          </p>
        </div>

        {/* Module Selection */}
        <div className="grid md:grid-cols-2 gap-8 mt-12">
          {/* Practical Exam Module */}
          <Card 
            className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-primary/50 cursor-pointer overflow-hidden relative"
            onClick={() => navigate('/practical')}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ClipboardList className="w-24 h-24" />
            </div>
            <CardHeader className="space-y-1 pt-8">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl font-bold">Practical Examinations</CardTitle>
              <CardDescription className="text-slate-500">
                Manage claims for Internal/External examiners, Skilled Assistants, and Arrears.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              <ul className="space-y-2 mb-6">
                {['UG/PG Practical Exams', 'Arrear Sessions', 'Skilled Assistant Claims', 'Other College Expenses'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <BadgeCheck className="w-4 h-4 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="w-full group-hover:translate-x-1 transition-transform bg-primary text-white">
                Enter Module <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Project Viva Module */}
          <Card 
            className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-secondary/50 cursor-pointer overflow-hidden relative"
            onClick={() => navigate('/project-viva')}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <FileText className="w-24 h-24" />
            </div>
            <CardHeader className="space-y-1 pt-8">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl font-bold">Project Viva-Voce</CardTitle>
              <CardDescription className="text-slate-500">
                Handle claims for UG Project groups and PG Thesis evaluations.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              <ul className="space-y-2 mb-6">
                {['UG Regular (Group based)', 'B.Arch (Candidate based)', 'PG Thesis Evaluation', 'Supervisor Remuneration'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <BadgeCheck className="w-4 h-4 text-amber-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="w-full group-hover:translate-x-1 transition-transform bg-secondary text-secondary-foreground hover:bg-secondary/80">
                Enter Module <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer Info */}
        <div className="text-center pt-12 border-t border-slate-200 opacity-60 text-xs">
          <p>© 2026 Anna University Regional Campus Coimbatore</p>
          <p className="mt-1">Office of the Controller of Examinations</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
