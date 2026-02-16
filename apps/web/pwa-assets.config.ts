import {
  defineConfig,
  minimal2023Preset as preset,
} from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  images: ["public/logo.jpg"],
  preset: {
    ...preset,
    transparent: {
      ...preset.transparent,
      favicons: undefined,
    },
  },
});
