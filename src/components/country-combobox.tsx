"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { COUNTRIES, findCountryByName, searchCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";

function FlagIcon({ code, className }: { code: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("fi rounded-sm", `fi-${code.toLowerCase()}`, className)}
    />
  );
}

type Props = {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
};

export function CountryCombobox({ id, name, defaultValue = "", placeholder }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const results = useMemo(() => {
    if (!open) return [];
    return value ? searchCountries(value, 8) : COUNTRIES.slice(0, 8);
  }, [open, value]);

  const selected = findCountryByName(value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [value, open]);

  function commit(countryName: string) {
    setValue(countryName);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (open && results[active]) {
        event.preventDefault();
        commit(results[active].name);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        {selected ? (
          <FlagIcon
            code={selected.code}
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-6 -translate-y-1/2"
          />
        ) : null}
        <input
          id={id}
          name={name}
          className={cn("field", selected && "pl-11")}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && results.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-[1.2rem] border border-line bg-white shadow-[0_20px_40px_rgba(22,61,83,0.12)]"
        >
          {results.map((country, index) => (
            <li
              key={country.code}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                commit(country.name);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-base text-navy",
                index === active ? "bg-navy/5" : "bg-white",
              )}
            >
              <FlagIcon code={country.code} className="h-4 w-6 shrink-0" />
              <span>{country.name}</span>
              <span className="ml-auto text-xs tracking-[0.08em] text-muted">{country.code}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
