import SwiftUI

/// Plan nutricional (integración opcional con ecosistema rendimiento / API coach).
public struct DietRootView: View {
    public init() {}

    public var body: some View {
        ZStack {
            DarkOpsTheme.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 12) {
                Text("DIETA")
                    .font(.system(size: 12, weight: .heavy, design: .monospaced))
                    .foregroundStyle(DarkOpsTheme.statusOK)
                Text("Sincronizar con planes Titan OS (backend)")
                    .font(.footnote)
                    .foregroundStyle(DarkOpsTheme.textPrimary.opacity(0.85))
                Spacer()
            }
            .padding(24)
        }
    }
}
