import React from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  if (isHomePage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background dark:bg-slate-950">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <div className="flex h-14 items-center gap-4">
              <span className="text-sm font-semibold tracking-tight text-muted-foreground uppercase">
                {location.pathname.replace('/', '').replace('-', ' ')}
              </span>
            </div>
          </header>
          <main className="flex flex-1 flex-col overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
