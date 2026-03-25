import SwiftUI

public enum PreflightLight: String, Sendable {
    case green = "Luz verde"
    case amber = "Luz ámbar"
    case red = "Luz roja"
}

/// HRV + tap test + cuestionario → ICO pre‑vuelo (stub).
public struct PreflightRootView: View {
    @State private var light: PreflightLight = .green

    public init() {}

    public var body: some View {
        ZStack {
            DarkOpsTheme.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 20) {
                Text("PRE‑FLIGHT")
                    .font(.system(size: 12, weight: .heavy, design: .monospaced))
                    .foregroundStyle(DarkOpsTheme.statusOK)
                StatusIndicator(level: level(for: light), label: light.rawValue)
                TapTestPanel()
                Text("HRV matutina · cuestionario → enlazar HealthKit + ICO pre‑vuelo")
                    .font(.footnote)
                    .foregroundStyle(DarkOpsTheme.textPrimary.opacity(0.85))
                Spacer()
            }
            .padding(24)
        }
    }

    private func level(for light: PreflightLight) -> StatusIndicator.Level {
        switch light {
        case .green: .ok
        case .amber: .warn
        case .red: .danger
        }
    }
}
