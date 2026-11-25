/** Strip query and fragment so OAuth codes, tokens and user input never enter logs. */
export function requestPathWithoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0] || '/';
}
