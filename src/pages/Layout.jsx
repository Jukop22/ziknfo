

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Music, FolderOpen, FileText, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Scanner",
    url: createPageUrl("Scanner"),
    icon: FolderOpen,
  },
  {
    title: "NFO Generateur",
    url: createPageUrl("NFOGenerator"),
    icon: FileText,
  },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <style>
          {`
            :root {
              --primary: #3b82f6;
              --primary-foreground: #ffffff;
              --secondary: #1e293b;
              --secondary-foreground: #e2e8f0;
              --background: #0f172a;
              --foreground: #f8fafc;
              --card: #1e293b;
              --card-foreground: #f8fafc;
              --border: #334155;
              --input: #334155;
              --ring: #3b82f6;
            }
            
            * {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            
            .glass-effect {
              backdrop-filter: blur(10px);
              background: rgba(30, 41, 59, 0.8);
              border: 1px solid rgba(51, 65, 85, 0.3);
            }
          `}
        </style>
        
        <Sidebar className="border-r border-slate-700 bg-slate-900/90 backdrop-blur-lg flex flex-col">
          <SidebarHeader className="border-b border-slate-700 p-6 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-white">Zik NFO</h2>
                <p className="text-xs text-slate-300">Music File Analyzer</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4 bg-slate-900/50 flex-grow">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-300 uppercase tracking-wider px-2 py-3">
                Outils
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-600/30 hover:text-blue-200 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-blue-600/40 text-blue-100 font-semibold' 
                            : 'text-slate-100 hover:text-white'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-300 uppercase tracking-wider px-2 py-3">
                Formats testés
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-3 py-2 space-y-2">
                  {["MP3", "FLAC", "WAV", "M4A", "DFF"].map((format) => (
                    <div key={format} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span className="text-slate-100">{format}</span>
                    </div>
                  ))}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <div className="p-4">
            <div className="text-xs text-slate-500 text-center">
              Version V1.31
            </div>
          </div>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-slate-800/30 backdrop-blur-lg border-b border-slate-700 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-700/50 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-white">NFO Builder</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

