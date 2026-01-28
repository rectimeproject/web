/**
 * Polyfill for Explicit Resource Management (Symbol.asyncDispose / Symbol.dispose)
 * Required for iOS Safari and older browsers that don't support 'await using' syntax
 */

// Polyfill Symbol.dispose if not available
if (typeof Symbol.dispose === "undefined") {
  Object.defineProperty(Symbol, "dispose", {
    value: Symbol("Symbol.dispose"),
    writable: false,
    enumerable: false,
    configurable: false
  });
}

// Polyfill Symbol.asyncDispose if not available
if (typeof Symbol.asyncDispose === "undefined") {
  Object.defineProperty(Symbol, "asyncDispose", {
    value: Symbol("Symbol.asyncDispose"),
    writable: false,
    enumerable: false,
    configurable: false
  });
}

export {};
