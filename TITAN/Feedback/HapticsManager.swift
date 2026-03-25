import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Taptic Engine: alertas y estado crítico (Dead Man's Switch).
public enum HapticsManager {
    public static func criticalAlert() {
        #if canImport(UIKit)
        let g = UINotificationFeedbackGenerator()
        g.notificationOccurred(.error)
        let i = UIImpactFeedbackGenerator(style: .heavy)
        i.impactOccurred(intensity: 1)
        #endif
    }

    public static func lightPulse() {
        #if canImport(UIKit)
        let i = UIImpactFeedbackGenerator(style: .light)
        i.impactOccurred(intensity: 0.6)
        #endif
    }
}
