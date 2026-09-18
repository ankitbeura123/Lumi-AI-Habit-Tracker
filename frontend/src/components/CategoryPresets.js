import { 
  Moon, 
  GraduationCap, 
  Briefcase, 
  Utensils, 
  BookOpen, 
  Dumbbell, 
  Gamepad2, 
  Bus 
} from 'lucide-react';

export const CATEGORY_PRESETS = [
  {
    id: 'sleep',
    name: 'Sleep & Rest',
    iconName: 'Moon',
    label: 'Sleep & Night Rest',
    defaultStart: '23:00',
    defaultEnd: '07:00',
    defaultDays: 'all',
    durationLabel: '8 hrs',
    theme: 'indigo',
    colorClasses: {
      bg: 'bg-indigo-50/80',
      border: 'border-indigo-200',
      hoverBorder: 'hover:border-indigo-400',
      text: 'text-indigo-700',
      badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      accent: '#6366f1'
    },
    description: 'Applied everyday across the full week'
  },
  {
    id: 'classes',
    name: 'Lectures & Labs',
    iconName: 'GraduationCap',
    label: 'College Lectures / Labs',
    defaultStart: '09:00',
    defaultEnd: '13:00',
    defaultDays: 'weekdays',
    durationLabel: '4 hrs',
    theme: 'sky',
    colorClasses: {
      bg: 'bg-sky-50/80',
      border: 'border-sky-200',
      hoverBorder: 'hover:border-sky-400',
      text: 'text-sky-700',
      badge: 'bg-sky-100 text-sky-700 border-sky-200',
      accent: '#0284c7'
    },
    description: 'Standard weekday lecture block'
  },
  {
    id: 'work',
    name: 'Work / Internship',
    iconName: 'Briefcase',
    label: 'Internship / Work Shift',
    defaultStart: '14:00',
    defaultEnd: '18:00',
    defaultDays: 'weekdays',
    durationLabel: '4 hrs',
    theme: 'amber',
    colorClasses: {
      bg: 'bg-amber-50/80',
      border: 'border-amber-200',
      hoverBorder: 'hover:border-amber-400',
      text: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
      accent: '#d97706'
    },
    description: 'Afternoon work / part-time shift'
  },
  {
    id: 'meals',
    name: 'Meals & Recharge',
    iconName: 'Utensils',
    label: 'Lunch & Recharge Break',
    defaultStart: '13:00',
    defaultEnd: '14:00',
    defaultDays: 'all',
    durationLabel: '1 hr',
    theme: 'emerald',
    colorClasses: {
      bg: 'bg-emerald-50/80',
      border: 'border-emerald-200',
      hoverBorder: 'hover:border-emerald-400',
      text: 'text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      accent: '#059669'
    },
    description: 'Daily lunchtime or dinner'
  },
  {
    id: 'study',
    name: 'Deep Study',
    iconName: 'BookOpen',
    label: 'Deep Study & Assignment',
    defaultStart: '15:00',
    defaultEnd: '17:00',
    defaultDays: 'weekdays',
    durationLabel: '2 hrs',
    theme: 'cyan',
    colorClasses: {
      bg: 'bg-cyan-50/80',
      border: 'border-cyan-200',
      hoverBorder: 'hover:border-cyan-400',
      text: 'text-cyan-700',
      badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      accent: '#0891b2'
    },
    description: 'Focused study session'
  },
  {
    id: 'workout',
    name: 'Fitness & Gym',
    iconName: 'Dumbbell',
    label: 'Gym & Physical Workout',
    defaultStart: '18:00',
    defaultEnd: '19:30',
    defaultDays: 'all',
    durationLabel: '1.5 hrs',
    theme: 'rose',
    colorClasses: {
      bg: 'bg-rose-50/80',
      border: 'border-rose-200',
      hoverBorder: 'hover:border-rose-400',
      text: 'text-rose-700',
      badge: 'bg-rose-100 text-rose-700 border-rose-200',
      accent: '#e11d48'
    },
    description: 'Evening workout or cardio'
  },
  {
    id: 'leisure',
    name: 'Leisure & Downtime',
    iconName: 'Gamepad2',
    label: 'Downtime & Social Rest',
    defaultStart: '20:00',
    defaultEnd: '22:00',
    defaultDays: 'all',
    durationLabel: '2 hrs',
    theme: 'purple',
    colorClasses: {
      bg: 'bg-purple-50/80',
      border: 'border-purple-200',
      hoverBorder: 'hover:border-purple-400',
      text: 'text-purple-700',
      badge: 'bg-purple-100 text-purple-700 border-purple-200',
      accent: '#9333ea'
    },
    description: 'Relaxation and hobbies'
  },
  {
    id: 'commute',
    name: 'Transit & Commute',
    iconName: 'Bus',
    label: 'Campus Commute / Transit',
    defaultStart: '08:15',
    defaultEnd: '09:00',
    defaultDays: 'weekdays',
    durationLabel: '45 mins',
    theme: 'slate',
    colorClasses: {
      bg: 'bg-slate-100',
      border: 'border-slate-200',
      hoverBorder: 'hover:border-slate-400',
      text: 'text-slate-700',
      badge: 'bg-slate-200 text-slate-700 border-slate-300',
      accent: '#64748b'
    },
    description: 'Travel to/from campus'
  }
];

export function getCategoryByLabel(label = '') {
  const l = label.toLowerCase();
  if (l.includes('sleep') || l.includes('rest') || l.includes('bed') || l.includes('nap')) return CATEGORY_PRESETS[0];
  if (l.includes('class') || l.includes('lecture') || l.includes('college') || l.includes('course') || l.includes('school')) return CATEGORY_PRESETS[1];
  if (l.includes('job') || l.includes('intern') || l.includes('work') || l.includes('shift')) return CATEGORY_PRESETS[2];
  if (l.includes('lunch') || l.includes('dinner') || l.includes('meal') || l.includes('break') || l.includes('eat') || l.includes('food')) return CATEGORY_PRESETS[3];
  if (l.includes('study') || l.includes('library') || l.includes('assignment') || l.includes('research') || l.includes('exam')) return CATEGORY_PRESETS[4];
  if (l.includes('gym') || l.includes('workout') || l.includes('run') || l.includes('exercise') || l.includes('fitness') || l.includes('sport')) return CATEGORY_PRESETS[5];
  if (l.includes('chill') || l.includes('game') || l.includes('leisure') || l.includes('movie') || l.includes('relax')) return CATEGORY_PRESETS[6];
  if (l.includes('commute') || l.includes('bus') || l.includes('travel') || l.includes('drive')) return CATEGORY_PRESETS[7];
  return CATEGORY_PRESETS[1];
}

export function getPresetIconComponent(iconName) {
  switch (iconName) {
    case 'Moon': return Moon;
    case 'GraduationCap': return GraduationCap;
    case 'Briefcase': return Briefcase;
    case 'Utensils': return Utensils;
    case 'BookOpen': return BookOpen;
    case 'Dumbbell': return Dumbbell;
    case 'Gamepad2': return Gamepad2;
    case 'Bus': return Bus;
    default: return BookOpen;
  }
}

