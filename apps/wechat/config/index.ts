import { defineConfig } from "@tarojs/cli";

export default defineConfig({
  projectName: "coffee-shop-wechat",
  date: "2026-04-24",
  designWidth: 375,
  deviceRatio: {
    375: 2,
    750: 1,
  },
  sourceRoot: "src",
  outputRoot: "dist",
  framework: "react",
  compiler: "vite",
  plugins: [],
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
      },
    },
  },
  h5: {
    publicPath: "/",
    staticDirectory: "static",
  },
});
