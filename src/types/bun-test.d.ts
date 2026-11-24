declare module 'bun:test' {
  interface ExpectMatchers<T> {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toThrow(expected?: string | RegExp): void;
    not: ExpectMatchers<T>;
  }

  export function describe(label: string, fn: () => void): void;
  export function test(label: string, fn: () => void | Promise<void>): void;
  export function it(label: string, fn: () => void | Promise<void>): void;
  export function expect<T>(actual: T): ExpectMatchers<T>;
}
