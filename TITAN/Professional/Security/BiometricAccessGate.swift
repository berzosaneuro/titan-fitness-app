import Foundation

#if canImport(LocalAuthentication)
import LocalAuthentication
#endif

/// Puerta biométrica (Face ID / Touch ID) para datos críticos; invocar desde el hilo principal de la app.
@MainActor
public enum BiometricAccessGate {
    public static func unlockWithBiometry(localizedReason: String) async throws -> Bool {
        #if canImport(LocalAuthentication)
        let context = LAContext()
        context.localizedCancelTitle = "Cancelar"
        return try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: localizedReason)
        #else
        return true
        #endif
    }
}
