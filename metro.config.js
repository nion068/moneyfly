/* eslint-env node */
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

config.transformer.getTransformOptions = async () => ({
  transform: {
    // Inline requires are very useful for deferring loading of large dependencies/components.
    // For example, we use it in app.tsx to conditionally load Reactotron.
    // However, this comes with some gotchas.
    // Read more here: https://reactnative.dev/docs/optimizing-javascript-loading
    // And here: https://github.com/expo/expo/issues/27279#issuecomment-1971610698
    inlineRequires: true,
  },
})

// This works around package export resolution issues in axios/apisauce.
// See:
// https://github.com/axios/axios/issues/6899
// https://github.com/facebook/metro/issues/1272
config.resolver.unstable_conditionNames = ["require", "default", "browser"]

// This helps support certain popular third-party libraries
// such as Firebase that use the extension cjs.
config.resolver.sourceExts.push("cjs")

// Keep the Kotlin prototype and generated native build trees out of Metro's file graph.
config.resolver.blockList = [
  /prototype-firefly\/\.gradle\/.*/,
  /prototype-firefly\/app\/build\/.*/,
  /android\/\.gradle\/.*/,
  /android\/app\/build\/.*/,
  /android\/build\/.*/,
]

module.exports = config
