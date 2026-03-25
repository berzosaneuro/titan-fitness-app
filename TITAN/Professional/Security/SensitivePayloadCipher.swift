import CryptoKit
import Foundation

public enum SensitivePayloadCipherError: Error, Sendable {
    case missingCombinedCiphertext
}

/// Cifrado en reposo AES‑256 GCM (CryptoKit). Claves vía `SecureEnclave` / Keychain en la app host.
public enum SensitivePayloadCipher: Sendable {
    public struct SealedBlob: Sendable, Codable {
        public var combined: Data
        public init(combined: Data) {
            self.combined = combined
        }
    }

    public static func seal(_ plaintext: Data, using key: SymmetricKey) throws -> SealedBlob {
        let box = try AES.GCM.seal(plaintext, using: key)
        guard let combined = box.combined else {
            throw SensitivePayloadCipherError.missingCombinedCiphertext
        }
        return SealedBlob(combined: combined)
    }

    public static func open(_ blob: SealedBlob, using key: SymmetricKey) throws -> Data {
        let box = try AES.GCM.SealedBox(combined: blob.combined)
        return try AES.GCM.open(box, using: key)
    }
}
