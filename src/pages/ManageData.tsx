import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Trash2, 
  Upload, 
  Loader2, 
  Save,
  Search,
  Edit,
  Settings as SettingsIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { INITIAL_COLLEGES, INITIAL_EXAMINERS, INITIAL_SUBJECTS } from '@/data/defaults';
import { Label } from '@/components/ui/label';

const ManageData = () => {
  const [colleges, setColleges] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [examiners, setExaminers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState('colleges');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: colData } = await supabase.from('colleges').select('*').order('code');
      const { data: subData } = await supabase.from('subjects').select('*').order('code');
      const { data: exInData } = await supabase.from('examiners').select('*').order('name');
      
      setColleges(colData || []);
      setSubjects(subData || []);
      setExaminers(exInData || []);
    } catch (error) {
      toast.error('Failed to fetch data from Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  const seedData = async () => {
    setIsLoading(true);
    try {
      if (colleges.length === 0) {
        await supabase.from('colleges').insert(INITIAL_COLLEGES.map(c => ({ code: c.code, name: c.name, abbreviated: c.abbreviated })));
      }
      if (subjects.length === 0) {
        await supabase.from('subjects').insert(INITIAL_SUBJECTS.map(s => ({ code: s.code, name: s.name, department: s.department })));
      }
      if (examiners.length === 0) {
        await supabase.from('examiners').insert(INITIAL_EXAMINERS.map(e => ({ 
          name: e.name, designation: e.designation, role: e.role, college_code: e.collegeCode,
          contact_number: e.contactNumber || null, bank_details: e.bankDetails || null
        })));
      }
      toast.success('Successfully seeded initial data!');
      fetchData();
    } catch (error: any) {
      toast.error(`Seeding failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const table = editingItem ? currentTab : currentTab;
      let error;
      
      if (editingItem) {
        ({ error } = await supabase.from(currentTab).update(formData).eq('id', editingItem.id));
      } else {
        ({ error } = await supabase.from(currentTab).insert([formData]));
      }

      if (error) throw error;
      toast.success(`${currentTab.slice(0, -1)} saved successfully`);
      setIsDialogOpen(false);
      setEditingItem(null);
      setFormData({});
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormData({});
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: any) => {
    setEditingItem(item);
    const { id, created_at, ...rest } = item;
    setFormData(rest);
    setIsDialogOpen(true);
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Item deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
          <p className="text-muted-foreground">Dynamically manage your database records here.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={fetchData} variant="outline">Refresh</Button>
          {(colleges.length === 0 || subjects.length === 0 || examiners.length === 0) && (
            <Button onClick={seedData} variant="default" className="gap-2">
              <Upload className="h-4 w-4" /> Seed Data
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border/50 bg-background/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="colleges">Colleges ({colleges.length})</TabsTrigger>
              <TabsTrigger value="subjects">Subjects ({subjects.length})</TabsTrigger>
              <TabsTrigger value="examiners">Examiners ({examiners.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={currentTab}>
              <div className="flex justify-between items-center mb-6 gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder={`Search ${currentTab}...`} 
                    className="pl-10 h-10"
                    onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
                  />
                </div>
                <Button onClick={openAddDialog} className="gap-2 h-10 px-6">
                  <Plus className="h-4 w-4" /> Add New
                </Button>
              </div>

              <div className="border rounded-xl overflow-hidden bg-background">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      {currentTab === 'colleges' && (
                        <>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Abbreviation</TableHead>
                        </>
                      )}
                      {currentTab === 'subjects' && (
                        <>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                        </>
                      )}
                      {currentTab === 'examiners' && (
                        <>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>College Code</TableHead>
                        </>
                      )}
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(currentTab === 'colleges' ? colleges : currentTab === 'subjects' ? subjects : examiners)
                      .filter(i => (i.name || i.code || '').toLowerCase().includes(searchQuery))
                      .slice(0, 25)
                      .map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                        {currentTab === 'colleges' && (
                          <>
                            <TableCell className="font-mono text-sm">{item.code}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.abbreviated}</TableCell>
                          </>
                        )}
                        {currentTab === 'subjects' && (
                          <>
                            <TableCell className="font-mono text-sm">{item.code}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.department}</TableCell>
                          </>
                        )}
                        {currentTab === 'examiners' && (
                          <>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              <span className="capitalize px-2 py-0.5 rounded-full bg-secondary text-[10px] font-bold">
                                {item.role?.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{item.college_code}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteItem(currentTab, item.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add New'} {currentTab.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {currentTab === 'colleges' && (
              <>
                <div className="space-y-2">
                  <Label>College Code</Label>
                  <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>College Name</Label>
                  <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Abbreviated Name</Label>
                  <Input value={formData.abbreviated || ''} onChange={e => setFormData({...formData, abbreviated: e.target.value})} />
                </div>
              </>
            )}
            {currentTab === 'subjects' && (
              <>
                <div className="space-y-2">
                  <Label>Subject Code</Label>
                  <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Subject Name</Label>
                  <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={formData.department || ''} onChange={e => setFormData({...formData, department: e.target.value})} />
                </div>
              </>
            )}
            {currentTab === 'examiners' && (
              <>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input value={formData.designation || ''} onChange={e => setFormData({...formData, designation: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.role || ''} 
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="">Select Role</option>
                    <option value="external">External Examiner</option>
                    <option value="internal">Internal Examiner</option>
                    <option value="skilled_assistant">Skilled Assistant</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>College Code</Label>
                  <Input value={formData.college_code || ''} onChange={e => setFormData({...formData, college_code: e.target.value})} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageData;
