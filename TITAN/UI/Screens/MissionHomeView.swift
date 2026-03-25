import SwiftUI

private final class TitanMissionRoot: ObservableObject {
    @Published var missionRuntime: MissionRuntime?

    init() {
        do {
            missionRuntime = try MissionRuntime.kernelBootstrap()
        } catch {
            missionRuntime = nil
        }
    }
}

public struct MissionHomeView: View {
    @StateObject private var root = TitanMissionRoot()

    public init() {}

    public var body: some View {
        Group {
            if let rt = root.missionRuntime {
                TabView {
                    PreflightRootView()
                        .tabItem { Label("Pre‑flight", systemImage: "checkmark.shield") }
                    TrainingRootView(runtime: rt)
                        .tabItem { Label("Sesión", systemImage: "figure.strengthtraining.traditional") }
                    DietRootView()
                        .tabItem { Label("Dieta", systemImage: "leaf") }
                }
                .tint(DarkOpsTheme.statusOK)
                .preferredColorScheme(.dark)
            } else {
                ZStack {
                    DarkOpsTheme.background.ignoresSafeArea()
                    Text("Almacenamiento TITAN no disponible")
                        .foregroundStyle(DarkOpsTheme.statusWarn)
                        .padding()
                }
                .preferredColorScheme(.dark)
            }
        }
    }
}
