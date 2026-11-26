// Ім'я учня: спершу те, що він сам вписав в анкеті (ім'я та прізвище), потім ім'я з Google/LINE, потім пошта.
export const DETAILS = 'student_details(first_name, last_name)';

export function displayName(p) {
  if (!p) return '';
  const raw = p.student_details;
  const d = Array.isArray(raw) ? raw[0] : raw;
  const own = d ? [d.first_name, d.last_name].filter(Boolean).join(' ').trim() : '';
  return own || p.full_name || (p.email ? p.email.split('@')[0] : '') || '';
}
