const DEFAULT_BUSINESS_TIMEZONE = "Asia/Shanghai";

function createDateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function createDatePartsFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function getBusinessTimeZone(): string {
  return process.env.BUSINESS_TIMEZONE?.trim() || DEFAULT_BUSINESS_TIMEZONE;
}

export function getBusinessDate(input: Date | string | number = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  return createDateFormatter(getBusinessTimeZone()).format(date);
}

export function getCurrentBusinessDate(): string {
  return getBusinessDate(new Date());
}

export function parseStoredTimestamp(value: string): Date {
  if (/[zZ]$|[+\-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }

  if (value.includes("T")) {
    return new Date(`${value}Z`);
  }

  return new Date(value.replace(" ", "T") + "Z");
}

export function toSqlTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function getBusinessDateForStoredTimestamp(value: string): string {
  return getBusinessDate(parseStoredTimestamp(value));
}

export function getBusinessHourLabel(input: Date | string | number): string {
  const parts = createDatePartsFormatter(getBusinessTimeZone())
    .formatToParts(input instanceof Date ? input : new Date(input))
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }
      return result;
    }, {});

  return parts.hour ?? "00";
}
