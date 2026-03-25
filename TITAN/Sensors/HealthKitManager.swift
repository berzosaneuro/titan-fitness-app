import Foundation
#if canImport(HealthKit)
import HealthKit
#endif

/// HRV, FC, SpO₂, temperatura cutánea (HealthKit + Watch vía HK).
public final class HealthKitManager: @unchecked Sendable {
    #if canImport(HealthKit)
    private let store = HKHealthStore()
    #endif

    public init() {}

    public func requestAuthorization() async throws {
        #if canImport(HealthKit)
        guard HKHealthStore.isHealthDataAvailable() else { return }
        var types = Set<HKObjectType>()
        if let t = HKObjectType.quantityType(forIdentifier: .heartRate) { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .oxygenSaturation) { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .bodyTemperature) { types.insert(t) }
        guard !types.isEmpty else { return }
        try await store.requestAuthorization(toShare: [], read: types)
        #endif
    }
}
