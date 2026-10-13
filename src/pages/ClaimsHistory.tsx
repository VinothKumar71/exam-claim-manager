import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Edit, 
  Trash2, 
  Download, 
  Search,
  Loader2,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { generateClaimPDF, generateProjectClaimPDF } from '@/utils/pdfGenerator';

const ClaimsHistory = () => {
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setClaims(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch claims: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteClaim = async (id: string) => {
    if (!confirm('Are you sure you want to delete this claim record?')) return;
    try {
      const { error } = await supabase.from('claims').delete().eq('id', id);
      if (error) throw error;
      toast.success('Claim deleted');
      setClaims(claims.filter(c => c.id !== id));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = (claim: any) => {
    const route = claim.type === 'practical' ? '/practical' : '/project-viva';
    navigate(`${route}?id=${claim.id}`);
  };

  const handleDownloadPDF = async (claim: any) => {
    try {
      // We need examiners for the PDF generator
      const { data: examiners } = await supabase.from('examiners').select('*');
      
      // Post-process dates from JSON
      const formData = JSON.parse(JSON.stringify(claim.form_data), (key, value) => {
        if (key === 'date' && value) return new Date(value);
        return value;
      });

      if (claim.type === 'practical') {
        generateClaimPDF(formData, examiners || []);
      } else {
        generateProjectClaimPDF(formData, examiners || []);
      }
      toast.success('PDF re-generated successfully');
    } catch (error) {
      toast.error('Error regenerating PDF');
    }
  };

  const filteredClaims = claims.filter(c => 
    c.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.centre_code?.includes(searchTerm) ||
    c.period?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Claims History</h1>
          <p className="text-muted-foreground mt-1 text-sm">View and manage all previously generated remuneration claims.</p>
        </div>
        <Button onClick={fetchClaims} variant="outline" size="sm" className="gap-2">
           <Filter className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="border-border/50 bg-background/50 backdrop-blur-sm overflow-hidden border-none shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by Dept, Code or Period..." 
                className="pl-10 bg-white dark:bg-slate-950 border-slate-200 focus:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900">
              <TableRow>
                <TableHead className="font-bold">Date Created</TableHead>
                <TableHead className="font-bold">Type</TableHead>
                <TableHead className="font-bold">Dept & Period</TableHead>
                <TableHead className="font-bold text-right">Grand Total</TableHead>
                <TableHead className="text-right font-bold w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-50" />
                    <p className="text-xs text-muted-foreground mt-2">Loading History...</p>
                  </TableCell>
                </TableRow>
              ) : filteredClaims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-50">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                      <p className="font-medium text-lg">No claims found</p>
                      <p className="text-sm">Try adjusting your search or generate a new claim.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredClaims.map((claim) => (
                  <TableRow key={claim.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/80 group">
                    <TableCell className="font-medium">
                      {format(new Date(claim.created_at), 'dd MMM yyyy, hh:mm a')}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        claim.type === 'practical' 
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {claim.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{claim.department || 'N/A'}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{claim.period}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">
                      ₹{claim.grand_total}/-
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleEdit(claim)}
                                className="hover:bg-primary/10 hover:text-primary"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Report</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDownloadPDF(claim)}
                                className="hover:bg-blue-500/10 hover:text-blue-500"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Re-generate PDF</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => deleteClaim(claim.id)}
                                className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Record</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="text-center text-[10px] text-muted-foreground italic">
        * Claims are automatically saved to Supabase every time you click "Generate PDF".
      </div>
    </div>
  );
};

export default ClaimsHistory;
