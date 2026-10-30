// Small helpers the page files share.

/** The element with this id (the page's html always has it). */
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
