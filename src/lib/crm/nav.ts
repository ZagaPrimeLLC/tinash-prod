import {
  LayoutDashboard, KanbanSquare, UserCheck, Inbox, Users,
  GraduationCap, Route, History, CircleUser, Settings, Contact2, Briefcase, FileUp, UserCog, HeartHandshake,
} from 'lucide-react';

/**
 * Roles come from proj_tinash.team_roles (membership itself is hub.memberships). Everything here is deliberately blunt:
 * ops and admin run the business, leadership watches it.
 */
export type Role = 'admin' | 'ops' | 'leadership' | 'viewer';

export const WRITERS: Role[] = ['admin', 'ops'];
export function canWrite(role: Role | null): boolean {
  return role !== null && WRITERS.includes(role);
}

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  hint?: string;
};

export type NavSection = { title: string; items: NavItem[] };

const ALL: Role[] = ['admin', 'ops', 'leadership', 'viewer'];
const OPS: Role[] = ['admin', 'ops'];

export const NAV: NavSection[] = [
  {
    title: 'Work',
    items: [
      { href: '/dashboard',          label: 'Overview',   icon: LayoutDashboard, roles: ALL },
      { href: '/dashboard/board',    label: 'Work board', icon: KanbanSquare,    roles: ALL },
      { href: '/dashboard/my-work',  label: 'My work',    icon: CircleUser,      roles: OPS },
    ],
  },
  {
    title: 'Families',
    items: [
      { href: '/dashboard/inquiries',   label: 'Care inquiries', icon: HeartHandshake, roles: ALL,
        hint: 'family pipeline' },
      { href: '/dashboard/inbox',       label: 'Inbox',      icon: Inbox,     roles: ALL,
        hint: 'from the website' },
      { href: '/dashboard/contacts',    label: 'Contacts',   icon: Contact2,  roles: ALL },
    ],
  },
  {
    title: 'Recruitment',
    items: [
      { href: '/dashboard/jobs',        label: 'Jobs',       icon: Briefcase, roles: ALL },
      { href: '/dashboard/recruitment', label: 'Applicants', icon: UserCheck, roles: ALL },
      { href: '/dashboard/recruitment/import', label: 'Import applicants', icon: FileUp, roles: OPS,
        hint: 'Indeed, CareerPlug, CSV' },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/dashboard/people',     label: 'Employees',  icon: Users,          roles: ALL },
      { href: '/dashboard/onboarding', label: 'Onboarding', icon: Route,          roles: OPS },
      { href: '/dashboard/training',   label: 'Training',   icon: GraduationCap,  roles: ALL },
    ],
  },
  {
    title: 'Record',
    items: [
      { href: '/dashboard/profile',  label: 'My profile', icon: UserCog,  roles: ALL },
      { href: '/dashboard/activity', label: 'Activity', icon: History,  roles: ALL },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: OPS },
    ],
  },
];

export function navFor(role: Role | null): NavSection[] {
  const r = role ?? 'viewer';
  return NAV
    .map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(r)) }))
    .filter((s) => s.items.length > 0);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  ops: 'Operations',
  leadership: 'Leadership',
  viewer: 'Viewer',
};
