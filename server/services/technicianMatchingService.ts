import { db } from '../db';
import { TechnicianProfile, LocationCoordinates, MatchScoreResult } from '../../src/types/index';

/**
 * Calculates Haversine distance between two coordinates in Kilometers
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * FIX HUB MULTI-FACTOR TECHNICIAN MATCHING ALGORITHM
 * ----------------------------------------------------
 * MATCH SCORE (0 - 100 PTS) =
 *   + Distance Score (Max 25 pts)
 *   + Brand & Model Expertise Score (Max 20 pts)
 *   + Repair Issue Category Match (Max 15 pts)
 *   + Verified Rating Score (Max 15 pts)
 *   + Completed Jobs & Reliability Score (Max 10 pts)
 *   + Quote Accuracy & Anti-Exploitation Score (Max 10 pts)
 *   + Availability & Fast Response Score (Max 5 pts)
 */
export class TechnicianMatchingService {
  public static matchTechnicians(params: {
    customerLocation: LocationCoordinates;
    deviceBrand: string;
    deviceModel?: string;
    issues: string[];
    maxDistanceKm?: number;
  }): MatchScoreResult[] {
    const { customerLocation, deviceBrand, issues, maxDistanceKm = 30 } = params;
    const technicians = db.technicianProfiles;

    const results: MatchScoreResult[] = [];

    for (const tech of technicians) {
      // 1. Calculate Distance
      const distanceKm = calculateDistanceKm(
        customerLocation.lat,
        customerLocation.lng,
        tech.shopLocation.lat,
        tech.shopLocation.lng
      );

      // Filter out technicians outside their service radius or max search distance
      if (distanceKm > (tech.serviceRadiusKm || maxDistanceKm)) {
        continue;
      }

      // 1. Distance Score (Max 25 pts): 0 km = 25 pts, decaying linearly down to 0 at 25km
      const distanceScore = Math.max(0, Math.round((1 - Math.min(distanceKm, 25) / 25) * 25));

      // 2. Brand & Model Expertise (Max 20 pts)
      let expertiseScore = 5;
      const brandSupported = tech.supportedBrands.some(
        (b) => b.toLowerCase() === deviceBrand.toLowerCase()
      );
      if (brandSupported) {
        expertiseScore = 20;
      }

      // 3. Issue Category Expertise (Max 15 pts)
      let categoryMatchCount = 0;
      for (const issue of issues) {
        if (tech.supportedCategories.includes(issue)) {
          categoryMatchCount++;
        }
      }
      const categoryRatio = issues.length > 0 ? categoryMatchCount / issues.length : 1;
      const categoryScore = Math.round(categoryRatio * 15);

      // 4. Rating Score (Max 15 pts): 5.0 = 15 pts, 4.0 = 12 pts, 3.0 = 9 pts
      const ratingScore = Math.round((Math.min(5, Math.max(3, tech.rating)) / 5) * 15);

      // 5. Reliability & Completed Volume (Max 10 pts)
      const volumeBonus = Math.min(5, Math.floor(tech.completedJobs / 20)); // up to 5 pts
      const cancelPenalty = Math.min(5, Math.floor(tech.cancellationRate / 2)); // penalty for cancellation
      const reliabilityScore = Math.max(2, 5 + volumeBonus - cancelPenalty);

      // 6. Quote Accuracy Score (Max 10 pts)
      const quoteAccuracyScore = Math.round(((tech.quoteAccuracyScore || 95) / 100) * 10);

      // 7. Availability & Response (Max 5 pts)
      let availabilityScore = 0;
      if (tech.availability === 'AVAILABLE') availabilityScore += 3;
      else if (tech.availability === 'BUSY') availabilityScore += 1;
      if (tech.averageResponseMinutes <= 15) availabilityScore += 2;
      else if (tech.averageResponseMinutes <= 30) availabilityScore += 1;

      // Verification bonus (up to 5 pts boost)
      let verificationBoost = 0;
      if (tech.verificationStatus.identityVerified) verificationBoost += 2;
      if (tech.verificationStatus.businessVerified) verificationBoost += 2;
      if (tech.verificationStatus.payoutVerified) verificationBoost += 1;

      const totalRaw =
        distanceScore +
        expertiseScore +
        categoryScore +
        ratingScore +
        reliabilityScore +
        quoteAccuracyScore +
        availabilityScore +
        verificationBoost;

      const totalScore = Math.min(100, Math.max(10, totalRaw));

      results.push({
        technicianId: tech.userId,
        totalScore,
        distanceKm,
        breakdown: {
          distanceScore,
          expertiseScore,
          reliabilityScore,
          ratingScore,
          responseScore: availabilityScore,
          availabilityScore,
        },
        technician: tech,
      });
    }

    // Sort by Match Score descending, then distance ascending
    results.sort((a, b) => b.totalScore - a.totalScore || a.distanceKm - b.distanceKm);

    return results;
  }
}
