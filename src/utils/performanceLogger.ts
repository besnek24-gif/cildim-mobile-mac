type AnyArgs = any[];

function noop(..._args: AnyArgs) {
  return undefined;
}

const perfFunction: any = (..._args: AnyArgs) => undefined;

const perf = new Proxy(perfFunction, {
  get(_target, prop) {
    if (prop === "default") return perf;
    if (prop === "__esModule") return true;

    if (prop === "time") return (_label?: string) => Date.now();
    if (prop === "now") return () => Date.now();

    return noop;
  },
  apply(_target, _thisArg, _args) {
    return undefined;
  },
});

export const mark = noop;
export const measure = noop;
export const start = noop;
export const end = noop;
export const log = noop;
export const warn = noop;
export const error = noop;
export const track = noop;
export const time = (_label?: string) => Date.now();
export const now = () => Date.now();

export default perf;
