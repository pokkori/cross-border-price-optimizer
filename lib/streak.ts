export interface StreakData { count: number; lastDate: string; shield: boolean; }
export function updateStreak(key: string): StreakData {
  const today = new Date().toISOString().split('T')[0];
  const raw = typeof window !== 'undefined' ? localStorage.getItem(`streak_${key}`) : null;
  const data: StreakData = raw ? JSON.parse(raw) : { count: 0, lastDate: '', shield: false };
  if (data.lastDate === today) return data;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (data.lastDate === yesterday) { data.count += 1; }
  else if (data.shield && data.lastDate) { data.count += 1; data.shield = false; }
  else { data.count = 1; }
  if (data.count % 7 === 0) data.shield = true;
  data.lastDate = today;
  localStorage.setItem(`streak_${key}`, JSON.stringify(data));
  return data;
}
export function loadStreak(key: string): StreakData {
  if (typeof window === 'undefined') return { count: 0, lastDate: '', shield: false };
  const raw = localStorage.getItem(`streak_${key}`);
  return raw ? JSON.parse(raw) : { count: 0, lastDate: '', shield: false };
}
export function getStreakMilestoneMessage(streak: number): string | null {
  if (streak === 3) return "3日連続！"; if (streak === 7) return "7日連続達成！";
  if (streak === 14) return "2週間連続！"; if (streak === 30) return "30日連続！"; return null;
}
