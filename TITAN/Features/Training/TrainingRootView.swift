import SwiftUI

public struct TrainingRootView: View {
    @ObservedObject private var runtime: MissionRuntime

    public init(runtime: MissionRuntime) {
        self.runtime = runtime
    }

    public var body: some View {
        let state = runtime.sessionMissionState
        ZStack {
            DarkOpsTheme.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                Text("SESION")
                    .font(.system(size: 12, weight: .heavy, design: .monospaced))
                    .foregroundStyle(DarkOpsTheme.statusOK)
                HStack {
                    metric("ICO", value: state.ico)
                    metric("CNS‑R", value: state.cnsr)
                    metric("RIESGO", value: state.injuryRisk)
                }
                StatusIndicator(level: repLevel(state.repetitionState), label: repLabel(state.repetitionState))
                if !state.microAdjustmentSummary.isEmpty {
                    Text(state.microAdjustmentSummary)
                        .font(.caption)
                        .foregroundStyle(DarkOpsTheme.statusWarn)
                }
                Spacer()
            }
            .padding(24)
        }
        .onAppear {
            runtime.beginMissionSessionIfNeeded()
            runtime.startTickLoop()
        }
        .onDisappear {
            runtime.stopTickLoop()
            Task { @MainActor in
                await runtime.endMissionSessionVerified()
            }
        }
    }

    private func metric(_ title: String, value: UInt8) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(DarkOpsTheme.textPrimary.opacity(0.5))
            Text("\(value)")
                .font(.system(size: 22, weight: .heavy, design: .monospaced))
                .foregroundStyle(DarkOpsTheme.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func repLevel(_ s: RepetitionSafetyState) -> StatusIndicator.Level {
        switch s {
        case .idle: .warn
        case .inProgress: .ok
        case .aborted: .danger
        }
    }

    private func repLabel(_ s: RepetitionSafetyState) -> String {
        switch s {
        case .idle: return "Listo"
        case .inProgress: return "En curso"
        case .aborted: return "ABORTADA · confirmar"
        }
    }
}
