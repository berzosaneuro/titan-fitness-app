import SwiftUI

/// R1.3 Dark Ops: #000000, estado alta luminancia, texto blanco.
public enum DarkOpsTheme {
    public static let background = Color(red: 0, green: 0, blue: 0)
    public static let textPrimary = Color.white
    public static let statusOK = Color(red: 0.2, green: 1, blue: 0.45)
    public static let statusWarn = Color(red: 1, green: 0.75, blue: 0)
    public static let statusDanger = Color(red: 1, green: 0.15, blue: 0.2)
}
