
const basePackages = [
  "react", "react-dom", "vue", "svelte", "preact", "jquery",
  "lodash", "underscore", "ramda", "clsx", "classnames",
  "moment", "date-fns", "dayjs", "luxon",
  "axios", "node-fetch", "swr",
  "redux", "mobx", "zustand", "jotai", "recoil", "xstate",
  "zod", "yup", "joi", "superstruct", "formik", "react-hook-form",
  "styled-components", "tailwindcss", "framer-motion",
  "express", "fastify", "koa", 
  "mongoose", "prisma", "knex",
  "webpack", "vite", "typescript", "eslint",
  "uuid", "nanoid", "chalk", "debug", "dotenv", "cors", "helmet"
];

const packages = [...basePackages, ...basePackages]; 
const batchInput = packages.map(p => ({ packageName: p, packageVersion: "latest" }));

console.log(`🚀 Starting stress test with ${packages.length} packages...`);
const startTime = Date.now();

try {
  await fetch("http://localhost:4000/trpc/bundle.analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packages: batchInput }),
  });
  console.log(`Done in ${(Date.now() - startTime) / 1000}s`);
} catch (error) {
  console.error(error);
}
