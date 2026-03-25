// swift-tools-version: 5.9
// Paquete iOS: módulos de misión TITAN (edge, pipeline, UI inmutable).
import PackageDescription

let package = Package(
    name: "TITAN",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "TITAN", targets: ["TITAN"]),
    ],
    targets: [
        .target(
            name: "TITAN",
            path: ".",
            resources: [
                .copy("Layer2/Persistence/TitanLayer2.sql"),
                .copy("Professional/Persistence/TitanProfessional.sql"),
                .copy("Kernel/TitanKernelSchema.sql"),
            ],
            linkerSettings: [
                .linkedFramework("Network"),
            ]
        ),
        .testTarget(
            name: "TITANTests",
            dependencies: ["TITAN"],
            path: "Tests/TITANTests"
        ),
    ]
)
