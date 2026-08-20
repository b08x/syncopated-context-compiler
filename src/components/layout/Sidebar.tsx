import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Upload, 
  MessageSquare, 
  Network, 
  Zap, 
  Download, 
  Settings,
  Menu,
  ChevronLeft,
  Moon,
  Sun
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { useTheme } from '@/src/lib/useTheme';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/review', icon: MessageSquare, label: 'Review' },
  { to: '/graph', icon: Network, label: 'Graph' },
  { to: '/distill', icon: Zap, label: 'Distill' },
  { to: '/export', icon: Download, label: 'Export' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(true);
  const { theme, toggleTheme } = useTheme();

  return (
    <div 
      className={cn(
        "border-r border-border bg-card flex flex-col h-full transition-all duration-300 relative group",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-4 top-6 h-8 w-8 rounded-full border border-border bg-card shadow-md z-50 opacity-0 group-hover:opacity-100 transition-opacity",
          collapsed && "opacity-100"
        )}
      >
        {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </Button>

      <div className={cn("p-6 overflow-hidden whitespace-nowrap", collapsed && "p-4")}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-brand-orange flex items-center justify-center text-white text-xs font-bold shrink-0">SCC</div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-foreground leading-none">SYNCOPATED <span className="text-brand-orange">COMPILER</span></h1>
              <p className="text-[9px] text-muted-foreground mt-1 font-mono uppercase tracking-widest leading-none">Context & Skill Engine</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-none bg-brand-orange flex items-center justify-center text-white text-xs font-bold mx-auto">SCC</div>
        )}
      </div>

      <nav className="flex-1 px-2 space-y-1 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all duration-200 border-l-2",
              collapsed ? "justify-center px-0 border-l-0" : "",
              isActive 
                ? "bg-brand-orange/10 text-brand-orange border-brand-orange" 
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent"
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-xs uppercase tracking-widest font-bold">{item.label}</span>}
          </NavLink>
        ))}
        
        <button
          onClick={toggleTheme}
          title={collapsed ? "Toggle Theme" : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all duration-200 border-l-2 cursor-pointer",
            collapsed ? "justify-center px-0 border-l-0" : "",
            "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent"
          )}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          {!collapsed && <span className="text-xs uppercase tracking-widest font-bold">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
      </nav>

      <div className={cn("p-4 border-t border-border", collapsed && "p-2")}>
        {!collapsed ? (
          <div className="p-3">
            <p className="text-[10px] text-muted-foreground font-mono uppercase font-bold tracking-wider">Session Stats</p>
            <div className="mt-4 space-y-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
                  <span className="text-muted-foreground">Rated</span>
                  <span className="text-brand-orange">0/0</span>
                </div>
                <div className="w-full bg-muted rounded-none h-1 overflow-hidden">
                  <div className="w-0 h-full bg-brand-orange transition-all" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-1 bg-muted rounded-none overflow-hidden">
            <div className="w-0 h-full bg-brand-orange" />
          </div>
        )}
      </div>
    </div>
  );
}
