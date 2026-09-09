import { db } from '../db';
import { AuditLog, UserRole } from '../../src/types/index';

export class AuditService {
  public static log(params: {
    actorId: string;
    actorRole: UserRole;
    action: string;
    resourceType: string;
    resourceId: string;
    details: Record<string, unknown>;
    ipAddress?: string;
  }): AuditLog {
    const entry: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: params.details,
      ipAddress: params.ipAddress || '127.0.0.1',
      timestamp: new Date().toISOString(),
    };

    db.auditLogs.push(entry);
    db.save();
    return entry;
  }

  public static getLogsForResource(resourceId: string): AuditLog[] {
    return db.auditLogs.filter((log) => log.resourceId === resourceId);
  }

  public static getLogs(): AuditLog[] {
    return db.auditLogs;
  }
}
