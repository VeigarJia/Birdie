"use client";

import { useState } from "react";

/** One-time inline prompt for Birdie's own access key (not a UniMelb login). */
export function AccessKeyPrompt({ invalid, onSubmit }: { invalid: boolean; onSubmit: (key: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mt-8 rounded-xl border border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const key = value.trim();
        if (key) onSubmit(key);
      }}
    >
      <label htmlFor="access-key" className="block font-medium">
        Access key
      </label>
      <p className="mt-1 text-sm text-muted">Enter your Birdie access key once on this device. This is not your UniMelb password.</p>
      <input
        id="access-key"
        type="password"
        autoComplete="current-password"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-3 h-11 w-full rounded-[10px] border border-line bg-bg px-3 text-base"
      />
      {invalid && <p className="mt-2 text-sm text-danger">That key didn&apos;t work. Check it and try again.</p>}
      <button type="submit" className="mt-4 h-11 w-full rounded-[10px] bg-accent text-sm font-semibold text-bg active:opacity-80">
        Continue
      </button>
    </form>
  );
}
