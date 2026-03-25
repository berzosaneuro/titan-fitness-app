import XCTest
import TITAN

final class DecisionEngineDegradationTests: XCTestCase {
    func testConservativeDegradationPrefixesSummaryAndScalesPlan() {
        let engine = DecisionEngine()
        let scores = InferenceScores(cnsr: 90, ico: 90, injuryRisk: 5)
        let fused = FusedFeatureVector()
        let deg = MissionDegradationContext(tier: .conservative, userFacingNotice: "Watch no disponible")
        let plan = engine.planMicroAdjustments(scores: scores, fused: fused, dmsTriggered: false, degradation: deg)
        XCTAssertTrue(plan.summary.hasPrefix("[DEG]"))
        XCTAssertLessThan(plan.loadScale, 1.0)
        XCTAssertGreaterThan(plan.restScale, 1.0)
    }

    func testDMSSkipsDegradationMerge() {
        let engine = DecisionEngine()
        let scores = InferenceScores(cnsr: 50, ico: 50, injuryRisk: 90)
        let fused = FusedFeatureVector()
        let deg = MissionDegradationContext(tier: .critical, userFacingNotice: "Cámara off")
        let plan = engine.planMicroAdjustments(scores: scores, fused: fused, dmsTriggered: true, degradation: deg)
        XCTAssertEqual(plan.repetitionState, .aborted)
        XCTAssertFalse(plan.summary.contains("[DEG]"))
    }
}
