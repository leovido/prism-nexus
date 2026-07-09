import ExpoModulesCore

private let hydratePath = "://hydrate/"

private func extractReqId(from url: String) -> String? {
  guard let range = url.range(of: hydratePath) else {
    return nil
  }
  let reqId = String(url[range.upperBound...])
  return reqId.isEmpty ? nil : reqId
}

public class PrismNexusHydratorModule: Module {
  private var service: HydratorService?

  private func getService() throws -> HydratorService {
    if let service {
      return service
    }
    let created = try HydratorService()
    service = created
    return created
  }

  public func definition() -> ModuleDefinition {
    Name("PrismNexusHydrator")

    Function("isAvailable") {
      return true
    }

    Function("extractReqId") { (url: String) -> String? in
      return extractReqId(from: url)
    }

    AsyncFunction("configure") { (options: [String: Any]) in
      let testMode = options["testMode"] as? Bool ?? false
      let chunkThreshold = options["chunkThreshold"] as? Int
      let reassemblyTimeoutMs: UInt64?
      if let ms = options["reassemblyTimeoutMs"] as? Int {
        reassemblyTimeoutMs = UInt64(ms)
      } else if let ms = options["reassemblyTimeoutMs"] as? Double {
        reassemblyTimeoutMs = UInt64(ms)
      } else {
        reassemblyTimeoutMs = nil
      }
      try self.getService().configure(
        testMode: testMode,
        chunkThreshold: chunkThreshold,
        reassemblyTimeoutMs: reassemblyTimeoutMs
      )
    }

    AsyncFunction("storePayload") { (payload: [String: Any]) in
      try self.getService().storePayloadDictionary(payload)
    }

    AsyncFunction("sealAndStorePayload") { (input: [String: Any]) -> [String: Any] in
      guard let reqId = input["reqId"] as? String,
            let ctx = input["ctx"] as? String,
            let state = input["state"] else {
        throw HydratorException.error(code: "MALFORMED_PAYLOAD", message: "Invalid seal input")
      }
      let version = input["version"] as? Int ?? 1
      let ts = input["ts"] as? Int ?? Int(Date().timeIntervalSince1970)
      return try self.getService().sealAndStore(
        state: state,
        reqId: reqId,
        ctx: ctx,
        version: version,
        ts: ts
      )
    }

    AsyncFunction("resolveEnvelope") { (_ trigger: String) -> [String: Any]? in
      return try self.getService().resolveEnvelope()
    }

    AsyncFunction("purgeExpired") {
      return try self.getService().purgeExpired()
    }

    AsyncFunction("inspectStorage") {
      return try self.getService().inspectStorage()
    }
  }
}
