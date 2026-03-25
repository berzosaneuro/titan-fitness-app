import Foundation
#if canImport(CoreMotion)
import CoreMotion
#endif

/// Acelerometría y giroscopio con muestreo de alta frecuencia (timestamps alineados al reloj maestro en capa superior).
public final class MotionManager: @unchecked Sendable {
    #if canImport(CoreMotion)
    private let motion = CMMotionManager()
    #endif

    public init() {}

    public func startUpdates(queue: OperationQueue) {
        #if canImport(CoreMotion)
        guard motion.isDeviceMotionAvailable else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 100.0
        motion.startDeviceMotionUpdates(to: queue) { _, _ in }
        #endif
    }

    public func stopUpdates() {
        #if canImport(CoreMotion)
        motion.stopDeviceMotionUpdates()
        #endif
    }
}
