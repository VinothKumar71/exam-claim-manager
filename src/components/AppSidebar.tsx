import React from "react";
import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  Settings, 
  Home as HomeIcon,
  ChevronLeft,
  GraduationCap,
  Users,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

const items = [
  {
    title: "Home",
    url: "/",
    icon: HomeIcon,
    module: "general",
  },
  {
    title: "Practical Exams",
    url: "/practical",
    icon: ClipboardList,
    module: "practical",
  },
  {
    title: "Project Viva-Voce",
    url: "/project-viva",
    icon: GraduationCap,
    module: "project",
  },
  {
    title: "Manage Data",
    url: "/manage-data",
    icon: Settings,
    module: "admin",
  },
  {
    title: "Claims History",
    url: "/history",
    icon: ClipboardList,
    module: "general",
  },
  {
    title: "Reports & Accounts",
    url: "/staff-summary",
    icon: Users,
    module: "general",
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const [networkUrl, setNetworkUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('http://localhost:3000/api/network-info')
      .then(res => res.json())
      .then(data => {
        if (data.ip !== 'localhost') {
          setNetworkUrl(`http://${data.ip}:${data.port}`);
        }
      })
      .catch(err => console.error("Could not fetch network info", err));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Signed out', description: 'You have been signed out.' });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-border">
        <div className={cn(
          "flex items-center gap-2 transition-all duration-300",
          state === "collapsed" ? "justify-center" : "px-4 w-full"
        )}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          {state === "expanded" && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-sm leading-tight truncate">Exam Claim</span>
              <span className="text-[10px] text-muted-foreground truncate">Manager v1.0</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <button onClick={() => navigate(item.url)}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sign Out" onClick={handleSignOut} className="text-destructive hover:text-destructive">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {networkUrl && state === "expanded" && (
          <div className="px-4 py-3 mt-2 bg-primary/10 mx-2 rounded-lg border border-primary/20">
            <p className="text-[10px] font-bold text-primary uppercase mb-1">Network Access URL</p>
            <p className="text-xs text-slate-700 font-mono break-all">{networkUrl}</p>
          </div>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
