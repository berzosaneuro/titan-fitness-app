import Foundation

/// Estadística de intervalos entre taps (ms) a partir de marcas monótonas (`ProcessInfo.processInfo.systemUptime`).
public enum TapTestStatistics: Sendable {
    public static func intervalVarianceMsSquared(fromMonotonicUptimeSeconds times: [TimeInterval]) -> Double {
        let sorted = times.sorted()
        guard sorted.count >= 3 else { return 0 }
        let intervalsMs = zip(sorted.dropFirst(), sorted).map { later, earlier in (later - earlier) * 1000 }
        return populationVariance(intervalsMs)
    }

    private static func populationVariance(_ values: [Double]) -> Double {
        guard values.count >= 2 else { return 0 }
        let mean = values.reduce(0, +) / Double(values.count)
        return values.map { let d = $0 - mean; return d * d }.reduce(0, +) / Double(values.count)
    }
}

/// R3.1 — Tap test 10 s por dedo: velocidad y variabilidad inter‑tap (entradas a CNS‑R).
public struct TapTestFingerResult: Sendable {
    public var fingerIndex: Int
    public var durationSeconds: Double
    public var tapCount: Int
    /// Varianza de intervalos entre taps (ms²); baja variabilidad + caída de frecuencia → fatiga SNC (heurística).
    public var intervalVarianceMsSquared: Double

    public init(
        fingerIndex: Int,
        durationSeconds: Double = 10,
        tapCount: Int = 0,
        intervalVarianceMsSquared: Double = 0
    ) {
        self.fingerIndex = fingerIndex
        self.durationSeconds = durationSeconds
        self.tapCount = tapCount
        self.intervalVarianceMsSquared = intervalVarianceMsSquared
    }
}

public struct TapTestSession: Sendable {
    public var results: [TapTestFingerResult]

    public init(results: [TapTestFingerResult] = []) {
        self.results = results
    }

    /// Heurística local hasta Core ML: frecuencia de taps penalizada por varianza inter‑tap elevada (SNC).
    public func provisionalCNSRContribution() -> UInt8 {
        guard let r = results.first else { return 75 }
        let rate = Double(r.tapCount) / max(r.durationSeconds, 0.1)
        let rateScore = min(100, max(40, rate * 12))
        let varPenalty = min(35, sqrt(Swift.max(0, r.intervalVarianceMsSquared)) / 8)
        let combined = max(40, min(100, rateScore - varPenalty))
        return UInt8(combined.rounded(.towardZero))
    }
}
