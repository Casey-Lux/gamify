import { w as writable } from "./index3.js";
import "./client.js";
import "idb";
const skills = writable([]);
const areas = writable([]);
const catalogFromCache = writable(false);
const catalogCachedAt = writable(null);
export {
  areas as a,
  catalogCachedAt as b,
  catalogFromCache as c,
  skills as s
};
