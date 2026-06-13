import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { FireflyCategory, FireflyTag } from "@/models/firefly"
import { ThemeProvider } from "@/theme/context"

import { SettingsClassificationScreen } from "./SettingsClassificationScreen"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockSaveCategory = jest.fn()
const mockSaveTag = jest.fn()
const mockDeleteCategory = jest.fn()
const mockDeleteTag = jest.fn()

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: object) => {
    const { View } = require("react-native")
    return <View {...props} />
  },
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useScrollToTop: jest.fn(),
}))

jest.mock("@/context/FireflyContext", () => ({
  useFirefly: () => ({
    isConfigured: true,
    categories: {
      data: [
        {
          id: "cat-1",
          attributes: { name: "Utilities" },
        },
      ] as FireflyCategory[],
      status: "ready",
    },
    tags: {
      data: [
        {
          id: "tag-1",
          attributes: { tag: "groceries" },
        },
      ] as FireflyTag[],
      status: "ready",
    },
    settingsMutation: { data: null, status: "idle" },
    saveCategory: mockSaveCategory,
    deleteCategory: mockDeleteCategory,
    saveTag: mockSaveTag,
    deleteTag: mockDeleteTag,
  }),
}))

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider initialContext="dark">
        <SettingsClassificationScreen
          navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never}
          route={{} as never}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe("SettingsClassificationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveCategory.mockResolvedValue(true)
    mockSaveTag.mockResolvedValue(true)
  })

  it("shows Save and Add Another for new categories and keeps the editor open after saving", async () => {
    const { getByLabelText, getByText, queryByText } = renderScreen()

    fireEvent.press(getByLabelText("Add category"))

    expect(getByText("New Category")).toBeTruthy()
    expect(getByText("Save and Add Another")).toBeTruthy()

    fireEvent.changeText(getByLabelText("Category name"), "Bills")
    fireEvent.press(getByText("Save and Add Another"))

    await waitFor(() => expect(mockSaveCategory).toHaveBeenCalledWith({ name: "Bills" }, undefined))
    expect(getByText("New Category")).toBeTruthy()
    expect(getByLabelText("Category name").props.value).toBe("")
    expect(queryByText("Save and Add Another")).toBeTruthy()
  })

  it("shows Save and Add Another for new tags and keeps the editor open after saving", async () => {
    const { getByLabelText, getByText } = renderScreen()

    fireEvent.press(getByLabelText("Add tag"))

    expect(getByText("New Tag")).toBeTruthy()
    expect(getByText("Save and Add Another")).toBeTruthy()

    fireEvent.changeText(getByLabelText("Tag"), "travel")
    fireEvent.press(getByText("Save and Add Another"))

    await waitFor(() => expect(mockSaveTag).toHaveBeenCalledWith({ tag: "travel" }, undefined))
    expect(getByText("New Tag")).toBeTruthy()
    expect(getByLabelText("Tag").props.value).toBe("")
  })

  it("keeps edit mode unchanged and closes after a successful save", async () => {
    const { getByLabelText, getByText, queryByText } = renderScreen()

    fireEvent.press(getByText("Utilities"))

    expect(getByText("Edit Category")).toBeTruthy()
    expect(queryByText("Save and Add Another")).toBeNull()

    fireEvent.changeText(getByLabelText("Category name"), "Utilities")
    fireEvent.press(getByText("Save"))

    await waitFor(() =>
      expect(mockSaveCategory).toHaveBeenCalledWith({ name: "Utilities" }, "cat-1"),
    )
    await waitFor(() => expect(queryByText("Edit Category")).toBeNull())
  })
})
