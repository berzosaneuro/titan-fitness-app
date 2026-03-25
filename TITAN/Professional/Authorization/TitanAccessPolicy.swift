import Foundation

/// Roles operativos: **master** (Eljefazo) controla umbrales y módulos críticos; coach y médico con permisos acotados.
public enum TitanOperatorRole: String, Sendable, Codable {
    case master
    case coach
    case athlete
    case medical
}

public enum TitanAccessPolicy: Sendable {
    public static func canModifySecurityThresholds(role: TitanOperatorRole) -> Bool {
        role == .master
    }

    public static func canToggleCriticalModules(role: TitanOperatorRole) -> Bool {
        role == .master
    }

    public static func canViewFullTelemetry(role: TitanOperatorRole) -> Bool {
        switch role {
        case .master, .coach, .medical: true
        case .athlete: false
        }
    }

    public static func canExportAthleteHistory(role: TitanOperatorRole) -> Bool {
        switch role {
        case .master, .medical: true
        case .coach, .athlete: false
        }
    }
}
