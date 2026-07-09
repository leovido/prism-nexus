import ExpoModulesCore
import Foundation

enum HydratorException {
  static func error(code: String, message: String) -> Exception {
    Exception(name: "HydrationError", description: message, code: code)
  }
}
