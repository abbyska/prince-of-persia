import { defineConfig } from 'vite'

// Relative asset paths work both at a GitHub Pages project URL
// (https://<user>.github.io/prince-of-persia/) and at a custom domain root.
export default defineConfig({
  base: './',
})
