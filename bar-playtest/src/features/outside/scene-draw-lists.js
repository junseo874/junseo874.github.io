/* Static scenery changes rarely; live NPC draw callbacks belong only to this frame. */
(function(root) {
  'use strict';
  const baseOrder = (a, b) => a.layer - b.layer || a.order - b.order || b.z - a.z || 0;
  function merge(fixed, actors, compare) {
    if (!actors.length) return fixed;
    const moving = actors.slice().sort(compare), result = [];
    let i = 0, j = 0;
    while (i < fixed.length && j < moving.length)
      result.push(compare(fixed[i], moving[j]) <= 0 ? fixed[i++] : moving[j++]);
    while (i < fixed.length) result.push(fixed[i++]);
    while (j < moving.length) result.push(moving[j++]);
    return result;
  }
  function unchanged(keys, source) {
    if (!keys || keys.length !== source.length) return false;
    for (let i = 0; i < source.length; i++) {
      const n = source[i], k = keys[i];
      if (k.node !== n || k.layer !== n.layer || k.order !== n.order || k.z !== n.z ||
          k.id !== n.id || k.name !== n.name || k.parent !== n.ancestry?.[0]) return false;
    }
    return true;
  }
  function create(compareStreet) {
    const scenes = new WeakMap();
    // The original street pass sorted the base-ordered list. Preserve its
    // stable ties, including actors inserted after scenery with identical keys.
    const streetOrder = (a, b) => compareStreet(a, b) || baseOrder(a, b);
    return function lists(source, actors, street, engine) {
      let entry = scenes.get(source);
      if (!entry || entry.engine !== engine || !unchanged(entry.keys, source)) {
        entry = {engine, keys: source.map(n => ({node:n, layer:n.layer, order:n.order, z:n.z,
          id:n.id, name:n.name, parent:n.ancestry?.[0]})), base: source.slice().sort(baseOrder)};
        scenes.set(source, entry);
      }
      const base = merge(entry.base, actors, baseOrder);
      if (!street) return {base, paint:base};
      if (!entry.street) entry.street = entry.base.slice().sort(streetOrder);
      return {base, paint:merge(entry.street, actors, streetOrder)};
    };
  }
  const api = {create};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LunaSceneDrawLists = api;
})(typeof window === 'undefined' ? globalThis : window);
