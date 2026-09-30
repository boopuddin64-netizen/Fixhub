import { db } from '../db';

/** Recomputes a technician's rating / review count from the reviews that are visible (not hidden by moderation). */
export function recomputeTechnicianRating(technicianId: string): void {
  const tech = db.technicianProfiles.find((t) => t.userId === technicianId);
  if (!tech) return;
  const visible = db.reviews.filter((r) => r.technicianId === technicianId && !r.hidden);
  if (visible.length === 0) {
    tech.rating = 5.0; // same starting rating a brand-new technician gets at registration
    tech.reviewCount = 0;
    return;
  }
  const avg = visible.reduce((sum, r) => sum + r.rating, 0) / visible.length;
  tech.rating = Math.round(avg * 10) / 10;
  tech.reviewCount = visible.length;
}
