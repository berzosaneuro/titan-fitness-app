import Foundation

public enum MissionFactory {
    public static func makeRuntime(
        sensorCapture: SensorCapturing = SensorCapture(),
        preprocessing: Preprocessing = Preprocessing(),
        fusion: FusionEngine = FusionEngine(),
        inference: InferenceEngine = InferenceEngine(),
        decision: DecisionEngine = DecisionEngine(),
        healthProvider: any SubsystemHealthProviding = DefaultSubsystemHealthProvider(),
        diagnostics: MissionDiagnosticsCenter = MissionDiagnosticsCenter()
    ) throws -> MissionRuntime {
        let wal = try TelemetryWALStore.open()
        return MissionRuntime(
            wal: wal,
            sensorCapture: sensorCapture,
            preprocessing: preprocessing,
            fusion: fusion,
            inference: inference,
            decision: decision,
            healthProvider: healthProvider,
            diagnostics: diagnostics
        )
    }
}
