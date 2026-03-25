# Trazabilidad mandato → módulo (TITAN iOS)

| Requisito | Módulo / archivo | Notas |
|-----------|------------------|--------|
| R1.1 UI inmutable | `UI/Screens/MissionHomeView.swift`, `Features/*` | Jerarquía TabView fija; cambios solo con nueva certificación. |
| R1.3 Dark Ops | `UI/Components/DarkOpsTheme.swift`, `StatusIndicator.swift` | #000, semántica estado, sin adorno. |
| R1.3 háptico + audio crítico | `Feedback/HapticsManager.swift`, `AudioManager.swift`, `MissionRuntime.swift` | 800 Hz vía `AudioManager` (sustituir tono certificado). |
| R2.2 reloj 10 ms | `Core/Pipeline/MasterClock.swift`, `SensorSample.masterTimestamp` | Cuantificación de timestamps al ingestar. |
| R2.3 outliers / sospechoso | `Preprocessing.swift`, `AnomalyModels.swift` | Correlato multimodal + contrato anomalías por sensor / fusionado. |
| R2.3 fusión | `FusionEngine.swift` | Vector hacia inferencia; bandera `biomechanicalCritical`. |
| R3.1 tap test | `TapTestModel.swift`, `Features/Preflight/TapTestPanel.swift` | 10 s; variabilidad inter‑tap pendiente. |
| R3.1 CNS‑R | `CNSModel.swift` | Integrar tap + HRV HealthKit. |
| R3.2 lesión CNN+LSTM | `InjuryRiskModel.swift` | Stub hasta Core ML + vídeo. |
| R3.3 ICO + micro‑ajuste | `ICOModel.swift`, `DecisionEngine.swift` | `safetyFloorICO` + caída ≥15 vs baseline; sin mutar layout. |
| R4.1 edge / latencia | Pipeline en `MissionRuntime.tick()` | Medir en dispositivo (&lt;100 ms / &lt;300 ms) en certificación. |
| R4.2 DMS consecutivo | `DeadMansSwitchAccumulator.swift`, `MissionRuntime.swift` | No abort en un solo tick; `acknowledgeDeadMansSwitch()`. |
| R5 panel web | `contracts/titan-mission-contract.json`, repo web raíz | Solo agregados; sin DMS ni SLA de latencia del binario. |

El mensaje de especificación del usuario se cortó en **R5.1 (gateway edge)**; completar en siguiente revisión de mandato.
