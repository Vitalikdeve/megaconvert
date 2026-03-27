export type Brand<TValue, TTag extends string> = TValue & {
  readonly __brand: TTag;
};

export function brand<TValue, TTag extends string>(value: TValue): Brand<TValue, TTag> {
  return value as Brand<TValue, TTag>;
}
