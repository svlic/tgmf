export type CaptionSelectableMessage = {
  readonly id?: number;
  readonly message?: string;
};

export function partitionCaptionedAlbumMessages<T extends CaptionSelectableMessage>(messages: readonly T[]) {
  const selected = messages.find((message) => typeof message.message === "string" && message.message.trim().length > 0) ?? null;
  return {
    selected,
    skipped: selected ? messages.filter((message) => message.id !== selected.id) : messages,
  };
}
