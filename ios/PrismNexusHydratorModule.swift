import ExpoModulesCore

private let hydratePath = "://hydrate/"

/// Extracts the request id from a deep-link locator. Routing context is never
/// encoded in the URL — only the opaque `reqId` segment is returned.
private func extractReqId(from url: String) -> String? {
  guard let range = url.range(of: hydratePath) else {
    return nil
  }
  let reqId = String(url[range.upperBound...])
  return reqId.isEmpty ? nil : reqId
}

public class PrismNexusHydratorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PrismNexusHydrator")

    Function("isAvailable") {
      return true
    }

    Function("extractReqId") { (url: String) -> String? in
      return extractReqId(from: url)
    }

    // Scaffold: native secure store + crypto pipeline lands in Phase 2.
    AsyncFunction("resolveEnvelope") { (_ trigger: String) -> [String: Any]? in
      return nil
    }

    AsyncFunction("purgeExpired") {
      return 0
    }

    AsyncFunction("inspectStorage") {
      return [
        "stored": [] as [String],
        "cached": 0,
      ]
    }
  }
}
