import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './ui/Menu';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';
import { Button } from './Button';
import { useTheme } from '../theme';
import type { Role } from '../types';
import {
  ChevronDown,
  Hospital,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react';
import { Tooltip } from './ui/Tooltip';

type NavItem = {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
};

export function AppShell({
  title,
  role,
  userName,
  hospitalName,
  actions,
  children,
  onSignOut,
  onOpenAccount,
  onOpenHospital,
  onToggleTheme,
  onRequestPlatform,
  onRequestAuthority,
  maxWidth = 'default',
}: {
  title: ReactNode;
  role: Role;
  userName?: string;
  hospitalName?: string;
  actions?: ReactNode;
  children: ReactNode;
  onSignOut: () => void;
  onOpenAccount: () => void;
  onOpenHospital?: () => void;
  onToggleTheme?: () => void;
  onRequestPlatform?: () => void;
  onRequestAuthority?: () => void;
  maxWidth?: 'default' | 'wide';
}) {
  const name = userName || 'You';
  const theme = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const themeLabel = theme.mode === 'dark' ? 'Switch to light' : 'Switch to dark';
  const themeIcon = theme.mode === 'dark' ? Sun : Moon;
  const measure = maxWidth === 'wide' ? 'max-w-[100rem]' : 'max-w-7xl';

  const nav = useMemo(() => {
    const items: NavItem[] = [];
    if (role === 'authority') {
      items.push({ key: 'authority', label: 'Authority dashboard', icon: <Icon icon={ShieldCheck} size={16} /> });
    } else if ((role as any) === 'platform') {
      items.push({ key: 'platform', label: 'Platform registry', icon: <Icon icon={LifeBuoy} size={16} /> });
    } else {
      items.push({ key: 'console', label: 'Hospital console', icon: <Icon icon={Hospital} size={16} /> });
    }
    return items;
  }, [role]);

  const isHospitalRole = role !== 'authority' && (role as any) !== 'platform';

  return (
    <div className="min-h-dvh text-ink">
      <header
        className={`sticky top-0 z-40 transition-shadow ${
          scrolled ? 'shadow-[var(--shadow-soft)]' : 'shadow-none'
        }`}
      >
        <div className="bg-surface/88 backdrop-blur-md">
          <div className={`mx-auto flex ${measure} items-center gap-4 px-4 py-2.5 sm:px-6`}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <a href="/" className="flex items-center gap-2 font-semibold">
                <span className="grid size-9 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
                  <Icon icon={LifeBuoy} size={18} />
                </span>
                <div className="hidden flex-col leading-tight sm:flex">
                  <span className="text-sm font-semibold font-display">Rescue+</span>
                  <span className="text-2xs text-muted">National emergency response</span>
                </div>
                <span className="text-base font-semibold font-display sm:hidden">Rescue+</span>
              </a>
              {nav.length > 0 && (
                <nav aria-label={typeof title === 'string' ? title : 'Main'} className="ml-2 hidden items-center gap-1 md:flex">
                  {nav.map((item) => (
                    <a
                      key={item.key}
                      href={item.href || '#'}
                      onClick={item.onClick}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </a>
                  ))}
                </nav>
              )}
              {hospitalName && isHospitalRole && (
                <div className="ml-2 hidden items-center gap-1.5 rounded-full border border-line surface-2 px-2.5 py-1 text-2xs font-semibold text-muted md:flex">
                  <Icon icon={Hospital} size={14} />
                  <span className="truncate max-w-[280px]">{hospitalName}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {onToggleTheme && (
                <Tooltip label={themeLabel}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleTheme()}
                    aria-label={themeLabel}
                    icon={<Icon icon={themeIcon} size={16} />}
                  />
                </Tooltip>
              )}
              {actions}
              <Menu
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex items-center gap-2 rounded-xl border border-line surface-2 px-2 py-1.5 text-left transition-colors hover:border-line-strong"
                  >
                    <Avatar name={name} size={32} />
                    <div className="hidden flex-col leading-tight sm:flex">
                      <span className="text-sm font-semibold">{name}</span>
                      <span className="text-2xs capitalize text-muted">{role}</span>
                    </div>
                    <ChevronDown size={15} className="text-muted" aria-hidden />
                  </button>
                )}
              >
                {({ close }) => (
                  <>
                    <MenuLabel>Account</MenuLabel>
                    <MenuItem icon={<Icon icon={User} size={16} />} onClick={() => { onOpenAccount(); close(); }}>
                      Account settings
                    </MenuItem>
                    {onOpenHospital && isHospitalRole && (
                      <MenuItem icon={<Icon icon={Hospital} size={16} />} onClick={() => { onOpenHospital(); close(); }}>
                        Hospital profile
                      </MenuItem>
                    )}
                    <MenuSeparator />
                    <MenuLabel>Switch role</MenuLabel>
                    {onRequestAuthority && role !== 'authority' && (
                      <MenuItem icon={<Icon icon={ShieldCheck} size={16} />} onClick={() => { onRequestAuthority(); close(); }}>
                        Open Authority dashboard
                      </MenuItem>
                    )}
                    {onRequestPlatform && (role as any) !== 'platform' && (
                      <MenuItem icon={<Icon icon={LayoutDashboard} size={16} />} onClick={() => { onRequestPlatform(); close(); }}>
                        Open Platform registry
                      </MenuItem>
                    )}
                    <MenuSeparator />
                    <MenuItem icon={<Icon icon={LogOut} size={16} />} danger onClick={() => { onSignOut(); close(); }}>
                      Sign out
                    </MenuItem>
                  </>
                )}
              </Menu>
            </div>
          </div>
        </div>
      </header>
      <main className={`mx-auto ${measure} px-4 py-6 sm:px-6 lg:px-8`}>{children}</main>
    </div>
  );
}
