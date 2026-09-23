import { Result } from "effect";
import { IssueFile } from "./Linear.js";

// Markdown links and images whose target is a Linear upload: `[name](url)` or `![name](url)`.
const uploadLinkPattern = /!?\[([^\]]*)\]\(<?(https:\/\/uploads\.linear\.app\/[^)\s>]+)>?\)/g;

export const extractUploadLinks = (
  markdown: string | undefined,
  source: string,
): ReadonlyArray<IssueFile> => {
  if (markdown === undefined) {
    return [];
  }
  return Array.from(markdown.matchAll(uploadLinkPattern), (match) =>
    IssueFile.make({ name: match[1] ?? "", url: match[2] ?? "", source }),
  );
};

/** Keeps the first link to each URL. */
export const uniqueByUrl = (files: ReadonlyArray<IssueFile>): ReadonlyArray<IssueFile> => {
  const seenUrls = new Set<string>();
  return files.filter((file) => {
    if (seenUrls.has(file.url)) {
      return false;
    }
    seenUrls.add(file.url);
    return true;
  });
};

const unsafeFileNameCharacters = /[^A-Za-z0-9._ ()-]/g;

/** A plain file name that cannot leave the output directory. */
export const toSafeFileName = (candidate: string): string => {
  const baseName = candidate.split(/[/\\]/).pop() ?? "";
  const cleaned = baseName
    .replace(unsafeFileNameCharacters, "_")
    .replace(/^[.\s]+/, "")
    .trim();
  if (cleaned.length === 0) {
    return "download";
  }
  return cleaned;
};

const splitExtension = (
  fileName: string,
): { readonly stem: string; readonly extension: string } => {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return { stem: fileName, extension: "" };
  }
  return { stem: fileName.slice(0, dotIndex), extension: fileName.slice(dotIndex) };
};

/** `report.pdf`, then `report-2.pdf`, `report-3.pdf`, ... for names already taken in this run. */
export const withUniqueSuffix = (fileName: string, takenNames: ReadonlySet<string>): string => {
  if (!takenNames.has(fileName)) {
    return fileName;
  }
  const { stem, extension } = splitExtension(fileName);
  let counter = 2;
  while (takenNames.has(`${stem}-${counter}${extension}`)) {
    counter += 1;
  }
  return `${stem}-${counter}${extension}`;
};

const contentDispositionFileName = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i;

export const fileNameFromContentDisposition = (header: string | null): string | undefined => {
  const match = header?.match(contentDispositionFileName);
  if (match?.[1] === undefined) {
    return undefined;
  }
  const rawName = match[1];
  return Result.getOrElse(
    Result.try(() => decodeURIComponent(rawName)),
    () => rawName,
  );
};
