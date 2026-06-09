import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * CurrencyInput — formats number with thousand-separator dots as the user types.
 *
 * Props mirror a standard <input> for easy drop-in replacement:
 *   value        {string|number}  — raw numeric value (no formatting)
 *   onChange     {function}       — called with a synthetic-like event: { target: { value: rawString } }
 *   className    {string}
 *   placeholder  {string}
 *   disabled     {bool}
 *   required     {bool}
 *   autoFocus    {bool}
 *   min          {number}         — used only for validation hint (not enforced by browser)
 *   max          {number}
 */
export function CurrencyInput({
  value = "",
  onChange,
  className,
  placeholder = "0",
  disabled = false,
  required = false,
  autoFocus = false,
  id,
  min,
  max,
  ...rest
}) {
  // Format a raw numeric string with thousand-separator dots (vi-VN style)
  const format = (raw) => {
    if (raw === "" || raw === null || raw === undefined) return "";
    let valStr = String(raw);
    
    // If it's a standard JS numeric representation (e.g. "1000.00" or 1000)
    // convert it to round integer first to ignore any trailing decimal zeros.
    if (!isNaN(Number(valStr))) {
      valStr = Math.round(Number(valStr)).toString();
    }
    
    const digits = valStr.replace(/\D/g, "");
    if (digits === "") return "";
    return Number(digits).toLocaleString("vi-VN");
  };

  const [display, setDisplay] = useState(() => format(value));
  const skipNextEffect = useRef(false);

  // Sync display when value changes from outside (e.g. pre-fill on edit)
  useEffect(() => {
    if (skipNextEffect.current) {
      skipNextEffect.current = false;
      return;
    }
    setDisplay(format(value));
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, ""); // strip everything non-digit
    const formatted = raw === "" ? "" : Number(raw).toLocaleString("vi-VN");

    skipNextEffect.current = true;
    setDisplay(formatted);

    // Bubble up the raw numeric string (same shape as a regular input event)
    onChange?.({ target: { value: raw } });
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        className={cn(
          // Same base styles as the shadcn Input component
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
          "md:text-sm",
          className
        )}
        {...rest}
      />
      {/* Currency badge */}
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground select-none">
        ₫
      </span>
    </div>
  );
}
