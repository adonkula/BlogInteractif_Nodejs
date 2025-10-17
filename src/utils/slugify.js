// src/utils/slugify.js
export function slugify(input = '') {
  return String(input)
    .normalize('NFD')                 // décompose les accents
    .replace(/[\u0300-\u036f]/g, '')  // supprime les diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')      // remplace tout sauf alphanum par '-'
    .replace(/^-+|-+$/g, '')          // trim les '-'
    .replace(/-{2,}/g, '-');          // collapse multiples '-'
}

export default slugify;