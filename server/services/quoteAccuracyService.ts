import { db } from '../db';
import { AuditService } from './auditService';

export class QuoteAccuracyService {
  /**
   * Minor variation threshold: 5% or ₦3,000 (whichever is smaller)
   * Any additional diagnosis cost exceeding this requires explicit customer confirmation.
   */
  public static isMinorVariation(originalAmount: number, additionalCost: number): boolean {
    const thresholdPercentage = 0.05; // 5%
    const thresholdFixed = 3000; // ₦3,000
    const allowableIncrease = Math.min(originalAmount * thresholdPercentage, thresholdFixed);
    return additionalCost <= allowableIncrease;
  }

  /**
   * Updates technician's quote accuracy metric upon job completion
   */
  public static evaluateJobCompletion(params: {
    technicianId: string;
    originalQuoteAmount: number;
    finalAmount: number;
    repairJobId: string;
  }) {
    const { technicianId, originalQuoteAmount, finalAmount, repairJobId } = params;
    const tech = db.technicianProfiles.find((t) => t.userId === technicianId);
    if (!tech) return;

    const diff = finalAmount - originalQuoteAmount;
    const inflationRatio = diff > 0 ? diff / originalQuoteAmount : 0;

    // If final amount is significantly higher without customer dispute
    if (inflationRatio > 0.2) {
      // Flag potential quote inflation anomaly
      db.riskEvents.push({
        id: `risk_inf_${Date.now()}`,
        actorId: technicianId,
        eventType: 'HIGH_QUOTE_INFLATION',
        severity: 'MEDIUM',
        metadata: {
          repairJobId,
          originalQuoteAmount,
          finalAmount,
          inflationPercent: Math.round(inflationRatio * 100),
        },
        reviewed: false,
        timestamp: new Date().toISOString(),
      });

      // Decay quote accuracy score
      tech.quoteAccuracyScore = Math.max(70, Math.round((tech.quoteAccuracyScore || 95) - 2.5));
    } else if (diff === 0) {
      // Perfect quote adherence boost
      tech.quoteAccuracyScore = Math.min(100, Math.round((tech.quoteAccuracyScore || 95) + 0.2));
    }

    // Recalculate trust level
    if (tech.quoteAccuracyScore < 85 || tech.cancellationRate > 5) {
      tech.trustLevel = 'UNDER_REVIEW';
    } else if (tech.completedJobs >= 100 && tech.rating >= 4.8 && tech.quoteAccuracyScore >= 95) {
      tech.trustLevel = 'HIGHLY_TRUSTED';
    } else if (tech.completedJobs >= 30 && tech.rating >= 4.5) {
      tech.trustLevel = 'TRUSTED';
    } else if (tech.completedJobs >= 5) {
      tech.trustLevel = 'ESTABLISHED';
    }

    AuditService.log({
      actorId: 'system',
      actorRole: 'admin',
      action: 'QUOTE_ACCURACY_RECALCULATED',
      resourceType: 'TECHNICIAN_PROFILE',
      resourceId: technicianId,
      details: {
        originalQuoteAmount,
        finalAmount,
        newAccuracyScore: tech.quoteAccuracyScore,
        trustLevel: tech.trustLevel,
      },
    });

    db.save();
  }
}
