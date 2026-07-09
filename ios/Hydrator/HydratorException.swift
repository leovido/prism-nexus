import ExpoModulesCore
import Foundation

enum HydratorException {
  static func throwError(code: String, message: String) -> Never {
    throw Exception(name: "HydrationError", description: message, code: code)
  }
}
