// we always make sure 'react-native' gets included first
// eslint-disable-next-line no-restricted-imports
import * as ReactNative from "react-native"

import mockFile from "./mockFile"

// libraries to mock
jest.doMock("react-native", () => {
  // Extend ReactNative
  return Object.setPrototypeOf(
    {
      Image: {
        ...ReactNative.Image,
        resolveAssetSource: jest.fn((_source) => mockFile), // eslint-disable-line @typescript-eslint/no-unused-vars
        getSize: jest.fn(
          (
            uri: string, // eslint-disable-line @typescript-eslint/no-unused-vars
            success: (width: number, height: number) => void,
            failure?: (_error: any) => void, // eslint-disable-line @typescript-eslint/no-unused-vars
          ) => success(100, 100),
        ),
      },
    },
    ReactNative,
  )
})

jest.mock("i18next", () => ({
  currentLocale: "en",
  t: (key: string, params: Record<string, string>) => {
    return `${key} ${JSON.stringify(params)}`
  },
  translate: (key: string, params: Record<string, string>) => {
    return `${key} ${JSON.stringify(params)}`
  },
}))

jest.mock("expo-localization", () => ({
  ...jest.requireActual("expo-localization"),
  getLocales: () => [{ languageTag: "en-US", textDirection: "ltr" }],
}))

jest.mock("../app/i18n/index.ts", () => ({
  i18n: {
    isInitialized: true,
    language: "en",
    t: (key: string, params: Record<string, string>) => {
      return `${key} ${JSON.stringify(params)}`
    },
    numberToCurrency: jest.fn(),
  },
}))

jest.mock("react-native-keyboard-controller", () => {
  return require("react-native-keyboard-controller/jest")
})

jest.mock("react-native-svg", () => {
  const React = require("react")
  const mockComponent = (name: string) => {
    const Component = (props: any) => React.createElement(name, props, props.children)
    Component.displayName = name
    return Component
  }
  return {
    __esModule: true,
    default: mockComponent("Svg"),
    Svg: mockComponent("Svg"),
    Circle: mockComponent("Circle"),
    G: mockComponent("G"),
    Line: mockComponent("Line"),
    Path: mockComponent("Path"),
    Text: mockComponent("Text"),
  }
})

declare const tron // eslint-disable-line @typescript-eslint/no-unused-vars

declare global {
  let __TEST__: boolean
}
