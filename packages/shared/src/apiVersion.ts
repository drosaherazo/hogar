/**
 * The version of the contract between the web and the API. Raise it by one, in the same PR that
 * changes both, only when the API stops working for webs built before the change; the API then
 * answers older webs with `426 client.outdated` and they show the required update screen.
 */
export const API_VERSION = 1;

/** The header the web's API client sends with `API_VERSION` on every request. */
export const API_VERSION_HEADER = "X-Hogar-Api-Version";
