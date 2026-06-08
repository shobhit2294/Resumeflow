import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, MessageSquare, FileText,
  Bell, User, LogOut, Menu, X, ChevronRight, Zap, Globe, TrendingUp, Briefcase, Award,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { getCompanyColor } from '../../utils/constants';

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Pipeline',      end: true },
  { to: '/analytics',  icon: BarChart2,       label: 'Analytics' },
  { to: '/interview',  icon: MessageSquare,   label: 'AI Interview' },
  { to: '/resume',     icon: FileText,        label: 'Resume AI' },
  { to: '/reminders',  icon: Bell,            label: 'Reminders' },
  { to: '/jobs-search', icon: Globe,           label: 'Find Jobs' },
  { to: '/tracker',     icon: TrendingUp,     label: 'Tracker' },
  { to: '/portal',      icon: Briefcase,      label: 'Job Portal' },
  { to: '/certificates', icon: Award,           label: 'Certificates' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const avatarColor = getCompanyColor(user?.name || '');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-56 bg-white border-r border-gray-100
          flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-400 rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">ResumeFlow</span>
          </div>
          <p className="text-xs text-gray-400 mt-1 ml-9">AI Job Tracker</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pb-2">
            Workspace
          </p>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${
                  isActive
                    ? 'bg-primary-50 text-primary-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'} />
                  {label}
                  {isActive && <ChevronRight size={12} className="ml-auto text-primary-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-3 border-t border-gray-100 space-y-0.5">
          <NavLink
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                isActive ? 'bg-primary-50 text-primary-800' : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <User size={16} className="text-gray-400" />
            Profile
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={16} className="text-gray-400" />
            Log out
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2 mt-2 border-t border-gray-100 pt-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarColor}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.title || user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-gray-900">ResumeFlow</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}