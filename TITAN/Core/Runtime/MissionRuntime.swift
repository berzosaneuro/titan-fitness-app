import Combine
import Foundation
import os.log
import SwiftUI

private func diagnosticJSON(_ pairs: (String, String)...) -> String {
    let inner = pairs.map { "\"\($0.0)\":\"\($0.1)\"" }.joined(separator: ",")
    return "{\(inner)}"
}

public struct SessionMissionState: Sendable {
    public var ico: UInt8
    public var cnsr: UInt8
    public var injuryRisk: UInt8
    public var repetitionState: RepetitionSafetyState
    public var microAdjustmentSummary: String

    public init(
        ico: UInt8 = 100,
        cnsr: UInt8 = 100,
        injuryRisk: UInt8 = 0,
        repetitionState: RepetitionSafetyState = .idle,
        microAdjustmentSummary: String = ""
    ) {
        self.ico = ico
        self.cnsr = cnsr
        self.injuryRisk = injuryRisk
        self.repetitionState = repetitionState
        self.microAdjustmentSummary = microAdjustmentSummary
    }
}

public enum RepetitionSafetyState: Sendable {
    case idle
    case inProgress
    case aborted
}

public enum MissionPanicReason: Sendable {
    case diskFailure
    case syncMismatch
}

public enum KernelSyncState: Sendable {
    case idle
    case syncing
    case stable
}

@MainActor
public final class MissionRuntime: ObservableObject {
    @Published public private(set) var sessionMissionState = SessionMissionState()
    @Published public private(set) var lastPanic: (abort: Bool, reason: MissionPanicReason)?
    @Published public private(set) var syncMismatchSessionIds: Set<UUID> = []
    @Published public private(set) var kernelSyncState: KernelSyncState = .idle

    private let log = Logger(subsystem: "titan.kernel", category: "runtime")

    private let sensorCapture: SensorCapturing
    private let preprocessing: Preprocessing
    private let fusion: FusionEngine
    private let inference: InferenceEngine
    private let decision: DecisionEngine
    private let healthProvider: any SubsystemHealthProviding
    private let diagnostics: MissionDiagnosticsRecording
    private let dmsAccumulator = DeadMansSwitchAccumulator()
    private var lastRepetitionState: RepetitionSafetyState = .idle
    private var lastDegradationLogSignature: String = ""
    private var lastIncoherenceLogAt: CFAbsoluteTime = 0
    private var lastMicroAdjustSignature: String = ""
    private var lastLatencyWarningAt: CFAbsoluteTime = 0

    private let wal: TelemetryWALStore
    private var missionSessionUUID: UUID?
    private var tickEnabled = true
    private var tickTask: Task<Void, Never>?
    private var flushCoalesceTask: Task<Void, Never>?
    private let reachabilityListenerId: UUID

    public init(
        wal: TelemetryWALStore,
        sensorCapture: SensorCapturing,
        preprocessing: Preprocessing,
        fusion: FusionEngine,
        inference: InferenceEngine,
        decision: DecisionEngine,
        healthProvider: any SubsystemHealthProviding = DefaultSubsystemHealthProvider(),
        diagnostics: MissionDiagnosticsRecording = MissionDiagnosticsCenter()
    ) {
        self.wal = wal
        self.sensorCapture = sensorCapture
        self.preprocessing = preprocessing
        self.fusion = fusion
        self.inference = inference
        self.decision = decision
        self.healthProvider = healthProvider
        self.diagnostics = diagnostics
        _ = SessionMetricsSyncEngine.shared
        DMSPreWarmedAudioKernel.shared.prewarm()
        reachabilityListenerId = MissionReachabilityKernel.shared.addOnlineListener { [weak self] in
            Task { @MainActor in
                self?.scheduleFlush()
            }
        }
    }

    deinit {
        MissionReachabilityKernel.shared.removeOnlineListener(reachabilityListenerId)
    }

    public static func kernelBootstrap() throws -> MissionRuntime {
        let wal = try TelemetryWALStore.open()
        return MissionRuntime(
            wal: wal,
            sensorCapture: SensorCapture(),
            preprocessing: Preprocessing(),
            fusion: FusionEngine(),
            inference: InferenceEngine(),
            decision: DecisionEngine()
        )
    }

    public func beginMissionSessionIfNeeded() {
        if missionSessionUUID != nil { return }
        let id = UUID()
        missionSessionUUID = id
        do {
            try wal.insertSession(id: id, status: "active", metadataJSON: "{}")
        } catch {
            panic(abort: true, reason: .diskFailure)
            return
        }
        scheduleFlush()
    }

    public func startTickLoop() {
        tickTask?.cancel()
        tickTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                let enabled = await MainActor.run { self.tickEnabled }
                if !enabled {
                    try? await Task.sleep(nanoseconds: 100_000_000)
                    continue
                }
                await self.tick()
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
        }
    }

    public func stopTickLoop() {
        tickTask?.cancel()
        tickTask = nil
    }

    public func acknowledgeDeadMansSwitch() {
        dmsAccumulator.acknowledgeReset()
        tickEnabled = true
        lastPanic = nil
        syncMismatchSessionIds = []
        lastRepetitionState = .idle
        sessionMissionState.repetitionState = .idle
    }

    public func panic(abort: Bool, reason: MissionPanicReason) {
        tickEnabled = false
        sessionMissionState.repetitionState = .aborted
        lastPanic = (abort, reason)
    }

    private func scheduleFlush() {
        flushCoalesceTask?.cancel()
        flushCoalesceTask = Task { @MainActor [weak self] in
            guard let self else { return }
            await self.performFlushCore(verificationFocus: nil)
        }
    }

    private func performFlushCore(verificationFocus: UUID?) async {
        guard MissionReachabilityKernel.shared.isOnline() else {
            kernelSyncState = .idle
            return
        }
        kernelSyncState = .syncing
        defer {
            if kernelSyncState == .syncing {
                kernelSyncState = .idle
            }
        }
        do {
            try await SessionMetricsSyncEngine.shared.flushPending(
                wal: wal,
                verificationFocus: verificationFocus,
                onSyncMismatch: { [weak self] u in
                    Task { @MainActor in
                        self?.syncMismatchSessionIds.insert(u)
                        self?.panic(abort: true, reason: .syncMismatch)
                    }
                },
                onStable: { [weak self] in
                    Task { @MainActor in
                        self?.kernelSyncState = .stable
                    }
                }
            )
            let pending = try wal.countPendingTotal()
            if pending > 0 {
                kernelSyncState = .idle
                log.error("flush ended with pending=\(pending)")
                if let sid = missionSessionUUID {
                    try? wal.setSessionLastSyncError(sessionId: sid, message: "pending_queue_\(pending)")
                }
                Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    await self?.performFlushCore(verificationFocus: nil)
                }
            }
        } catch {
            log.error("performFlushCore \(String(describing: error))")
            if let sid = missionSessionUUID {
                try? wal.setSessionLastSyncError(sessionId: sid, message: String(describing: error))
            }
            kernelSyncState = .idle
            Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await self?.performFlushCore(verificationFocus: nil)
            }
        }
    }

    public func endMissionSessionVerified() async {
        guard let sid = missionSessionUUID else { return }
        do {
            try wal.updateLocalSessionStatus(sessionId: sid, status: "completed")
        } catch {
            panic(abort: true, reason: .diskFailure)
            return
        }
        stopTickLoop()
        tickEnabled = false
        if MissionReachabilityKernel.shared.isOnline() {
            do {
                try await SessionMetricsSyncEngine.shared.ensureRemoteSession(
                    sessionId: sid,
                    status: "completed",
                    metadataJSON: "{}"
                )
            } catch {
                log.error("remote session complete \(String(describing: error))")
                try? wal.setSessionLastSyncError(sessionId: sid, message: String(describing: error))
            }
        }
        kernelSyncState = .syncing
        do {
            try await SessionMetricsSyncEngine.shared.flushPending(
                wal: wal,
                verificationFocus: sid,
                onSyncMismatch: { [weak self] u in
                    Task { @MainActor in
                        self?.syncMismatchSessionIds.insert(u)
                        self?.panic(abort: true, reason: .syncMismatch)
                    }
                },
                onStable: { [weak self] in
                    Task { @MainActor in
                        self?.kernelSyncState = .stable
                    }
                }
            )
            let pending = try wal.countPendingTotal()
            if pending > 0 {
                try? wal.setSessionLastSyncError(sessionId: sid, message: "pending_after_session_end_\(pending)")
                panic(abort: true, reason: .syncMismatch)
            }
        } catch {
            log.error("endMissionSessionVerified \(String(describing: error))")
            try? wal.setSessionLastSyncError(sessionId: sid, message: String(describing: error))
            panic(abort: true, reason: .syncMismatch)
        }
        missionSessionUUID = nil
    }

    public func tick() async {
        guard tickEnabled else { return }
        guard let sessionUUID = missionSessionUUID else { return }
        let tickStarted = CFAbsoluteTimeGetCurrent()
        let health = await healthProvider.snapshot()
        let degradation = health.degradationContext
        let degSig = "\(degradation.tier.rawValue)|\(degradation.userFacingNotice)"
        if degradation.tier != .nominal, degSig != lastDegradationLogSignature {
            lastDegradationLogSignature = degSig
            diagnostics.record(
                MissionDiagnosticRecord(
                    category: "subsystem",
                    code: MissionDiagnosticCodes.subsystemDegraded,
                    severity: degradation.tier >= .critical ? .error : .warning,
                    payloadJSON: diagnosticJSON(("notice", degradation.userFacingNotice.replacingOccurrences(of: "\"", with: "'")))
                )
            )
        }
        if degradation.tier == .nominal {
            lastDegradationLogSignature = ""
        }
        let raw = await sensorCapture.pullSamples(maxCount: 256)
        let cleaned = preprocessing.filterMultimodal(raw)
        let fused = fusion.fuse(cleaned)
        if fused.suspectRatio > 0.35, cleaned.count >= 4 {
            let now = CFAbsoluteTimeGetCurrent()
            if now - lastIncoherenceLogAt >= 5 {
                lastIncoherenceLogAt = now
                diagnostics.record(
                    MissionDiagnosticRecord(
                        category: "fusion",
                        code: MissionDiagnosticCodes.sensorIncoherence,
                        severity: .warning,
                        payloadJSON: diagnosticJSON(("suspectRatio", String(format: "%.3f", fused.suspectRatio)))
                    )
                )
            }
        }
        let scores = inference.infer(from: fused)
        let dmsTriggered = dmsAccumulator.recordTick(
            injuryRisk: scores.injuryRisk,
            biomechanicalCritical: fused.biomechanicalCritical
        )
        let plan = decision.planMicroAdjustments(
            scores: scores,
            fused: fused,
            dmsTriggered: dmsTriggered,
            degradation: degradation
        )
        let elapsedMs = Int((CFAbsoluteTimeGetCurrent() - tickStarted) * 1_000)
        let nowWall = CFAbsoluteTimeGetCurrent()
        if elapsedMs > 100, nowWall - lastLatencyWarningAt >= 2 {
            lastLatencyWarningAt = nowWall
            diagnostics.record(
                MissionDiagnosticRecord(
                    category: "latency",
                    code: MissionDiagnosticCodes.latencyBudgetVisual,
                    severity: .warning,
                    payloadJSON: diagnosticJSON(("tickMs", String(elapsedMs)))
                )
            )
        }
        if elapsedMs > 300 {
            diagnostics.record(
                MissionDiagnosticRecord(
                    category: "latency",
                    code: MissionDiagnosticCodes.latencyBudgetCritical,
                    severity: .error,
                    payloadJSON: diagnosticJSON(("tickMs", String(elapsedMs)))
                )
            )
        }
        if plan.repetitionState != .aborted, plan.summary.contains("Micro-ajuste"), plan.summary != lastMicroAdjustSignature {
            lastMicroAdjustSignature = plan.summary
            let clipped = String(plan.summary.prefix(200)).replacingOccurrences(of: "\"", with: "'")
            diagnostics.record(
                MissionDiagnosticRecord(
                    category: "safety",
                    code: MissionDiagnosticCodes.microAdjustment,
                    severity: .info,
                    payloadJSON: diagnosticJSON(("summary", clipped))
                )
            )
        }
        if !plan.summary.contains("Micro-ajuste") {
            lastMicroAdjustSignature = ""
        }
        let clientFrameId = UUID()
        let tjson = diagnosticJSON(
            ("suspectRatio", String(format: "%.4f", fused.suspectRatio)),
            ("biomechanicalCritical", fused.biomechanicalCritical ? "1" : "0")
        )
        do {
            try wal.appendTelemetryFrame(
                sessionId: sessionUUID,
                clientSideId: clientFrameId,
                timestamp: Date().timeIntervalSince1970,
                cnsr: Double(scores.cnsr),
                ico: Double(scores.ico),
                injuryRisk: Double(scores.injuryRisk),
                telemetryJSON: tjson
            )
        } catch {
            panic(abort: true, reason: .diskFailure)
            return
        }
        let state = SessionMissionState(
            ico: scores.ico,
            cnsr: scores.cnsr,
            injuryRisk: scores.injuryRisk,
            repetitionState: plan.repetitionState,
            microAdjustmentSummary: plan.summary
        )
        let becameAborted = state.repetitionState == .aborted && lastRepetitionState != .aborted
        lastRepetitionState = state.repetitionState
        sessionMissionState = state
        if becameAborted {
            tickEnabled = false
            diagnostics.record(
                MissionDiagnosticRecord(category: "safety", code: MissionDiagnosticCodes.dmsTriggered, severity: .security)
            )
            DMSPreWarmedAudioKernel.shared.playDMSBurst(duration: 0.4)
        }
        if MissionReachabilityKernel.shared.isOnline() {
            scheduleFlush()
        }
    }
}

