import SwiftUI

/// R3.1 — Captura de taps 10 s (velocidad; variabilidad de intervalos en fase 2).
public struct TapTestPanel: View {
    @State private var isRunning = false
    @State private var taps = 0
    @State private var secondsLeft = 10
    @State private var lastResult: TapTestFingerResult?
    @State private var tapUptimes: [TimeInterval] = []

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("TAP TEST · 10 s")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(DarkOpsTheme.statusWarn)
            if isRunning {
                Text("Restante \(secondsLeft) s · Taps \(taps)")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(DarkOpsTheme.textPrimary)
                Button(action: {
                    taps += 1
                    tapUptimes.append(ProcessInfo.processInfo.systemUptime)
                }) {
                    Text("TAP")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .tint(DarkOpsTheme.statusOK)
            } else {
                Button(action: { Task { await runWindow() } }) {
                    Text("Iniciar ventana 10 s (dedo índice)")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(DarkOpsTheme.statusOK)
            }
            if let r = lastResult {
                Text("Último: \(r.tapCount) taps · aporte CNS stub \(TapTestSession(results: [r]).provisionalCNSRContribution())")
                    .font(.caption2)
                    .foregroundStyle(DarkOpsTheme.textPrimary.opacity(0.7))
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func runWindow() async {
        taps = 0
        tapUptimes = []
        isRunning = true
        for i in 0..<10 {
            secondsLeft = 10 - i
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
        secondsLeft = 0
        isRunning = false
        let variance = TapTestStatistics.intervalVarianceMsSquared(fromMonotonicUptimeSeconds: tapUptimes)
        lastResult = TapTestFingerResult(
            fingerIndex: 1,
            durationSeconds: 10,
            tapCount: taps,
            intervalVarianceMsSquared: variance
        )
    }
}
