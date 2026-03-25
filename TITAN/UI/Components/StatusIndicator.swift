import SwiftUI

/// R1.3 — Codificación redundante: color + forma geométrica + glifo SF Symbol (acceso atención dividida).
public struct StatusIndicator: View {
    public enum Level {
        case ok, warn, danger
    }

    let level: Level
    let label: String

    public init(level: Level, label: String) {
        self.level = level
        self.label = label
    }

    private var color: Color {
        switch level {
        case .ok: DarkOpsTheme.statusOK
        case .warn: DarkOpsTheme.statusWarn
        case .danger: DarkOpsTheme.statusDanger
        }
    }

    private var symbolName: String {
        switch level {
        case .ok: "checkmark.circle.fill"
        case .warn: "exclamationmark.triangle.fill"
        case .danger: "xmark.octagon.fill"
        }
    }

    public var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 12, height: 12)
                .overlay(Circle().stroke(DarkOpsTheme.textPrimary.opacity(0.3), lineWidth: 1))
            Image(systemName: symbolName)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(color)
                .accessibilityHidden(true)
            Text(label)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(DarkOpsTheme.textPrimary)
        }
    }
}
