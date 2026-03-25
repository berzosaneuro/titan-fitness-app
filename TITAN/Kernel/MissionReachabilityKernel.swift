import Foundation
import Network

public final class MissionReachabilityKernel: @unchecked Sendable {
    public static let shared = MissionReachabilityKernel()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "titan.kernel.path")
    private var handlers: [UUID: @Sendable () -> Void] = [:]
    private let handlerLock = NSLock()

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            self?.notifyOnlineSubscribers()
        }
        monitor.start(queue: queue)
    }

    private func notifyOnlineSubscribers() {
        handlerLock.lock()
        let copy = Array(handlers.values)
        handlerLock.unlock()
        for h in copy {
            h()
        }
    }

    public func isOnline() -> Bool {
        monitor.currentPath.status == .satisfied
    }

    @discardableResult
    public func addOnlineListener(_ block: @escaping @Sendable () -> Void) -> UUID {
        let id = UUID()
        queue.async { [weak self] in
            self?.handlerLock.lock()
            self?.handlers[id] = block
            self?.handlerLock.unlock()
            if self?.monitor.currentPath.status == .satisfied {
                block()
            }
        }
        return id
    }

    public func removeOnlineListener(_ id: UUID) {
        queue.async { [weak self] in
            self?.handlerLock.lock()
            self?.handlers.removeValue(forKey: id)
            self?.handlerLock.unlock()
        }
    }
}
