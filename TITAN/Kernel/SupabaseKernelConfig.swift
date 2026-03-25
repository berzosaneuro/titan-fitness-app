import Foundation

public enum SupabaseKernelConfig: Sendable {
    public static func baseURL() -> URL? {
        if let s = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_BASE_URL") as? String,
           let u = URL(string: s.trimmingCharacters(in: .whitespacesAndNewlines)), !s.isEmpty
        {
            return u
        }
        if let s = ProcessInfo.processInfo.environment["SUPABASE_BASE_URL"],
           let u = URL(string: s.trimmingCharacters(in: .whitespacesAndNewlines)), !s.isEmpty
        {
            return u
        }
        return nil
    }

    public static func anonKey() -> String {
        if let s = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String, !s.isEmpty {
            return s
        }
        if let s = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"], !s.isEmpty {
            return s
        }
        return ""
    }

    public static func bearerToken() -> String {
        if let s = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_BEARER_TOKEN") as? String, !s.isEmpty {
            return s
        }
        if let s = ProcessInfo.processInfo.environment["SUPABASE_BEARER_TOKEN"], !s.isEmpty {
            return s
        }
        return anonKey()
    }

    public static func jwtSubjectUUID() -> UUID? {
        let t = bearerToken()
        let parts = t.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var b64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64.append("=") }
        guard let data = Data(base64Encoded: b64),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sub = obj["sub"] as? String,
              let u = UUID(uuidString: sub)
        else { return nil }
        return u
    }
}
