import type { ComponentProps } from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { useKeyboardState } from "react-native-keyboard-controller"

import { ThemeProvider } from "@/theme/context"

import { SelectionSheet, type SelectionItem } from "./SelectionSheet"

const mockUseKeyboardState = jest.mocked(useKeyboardState)

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: object) => {
    const { View } = require("react-native")
    return <View {...props} />
  },
}))

const items: SelectionItem[] = [
  { id: "food", title: "Food", subtitle: "Groceries", icon: "food" },
  { id: "transport", title: "Transport", subtitle: "Bus fare", icon: "bus" },
  { id: "health", title: "Health", subtitle: "Medicine", icon: "medical-bag" },
]

function renderSheet(overrides: Partial<ComponentProps<typeof SelectionSheet>> = {}) {
  const onSelect = jest.fn()
  const onClose = jest.fn()

  return render(
    <ThemeProvider initialContext="dark">
      <SelectionSheet
        visible
        title="Categories"
        items={items}
        selectedIds={[]}
        onSelect={onSelect}
        onClose={onClose}
        {...overrides}
      />
    </ThemeProvider>,
  )
}

describe("SelectionSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseKeyboardState.mockImplementation((selector) =>
      selector!({
        appearance: "dark",
        duration: 0,
        height: 0,
        isVisible: false,
        target: 0,
        timestamp: 0,
        type: "default",
      }),
    )
  })

  it("reserves space for the active keyboard", () => {
    mockUseKeyboardState.mockImplementation((selector) =>
      selector!({
        appearance: "dark",
        duration: 250,
        height: 320,
        isVisible: true,
        target: 1,
        timestamp: 1,
        type: "default",
      }),
    )

    const { getByTestId, getByText } = renderSheet()

    expect(getByTestId("selection-sheet-keyboard-inset")).toHaveStyle({ paddingBottom: 320 })
    expect(getByText("Food")).toBeTruthy()
    expect(getByText("Transport")).toBeTruthy()
  })

  it("filters results as the search query changes", () => {
    const { getByPlaceholderText, getByText, queryByText } = renderSheet()

    fireEvent.changeText(getByPlaceholderText("Search categories..."), "bus")

    expect(getByText("Transport")).toBeTruthy()
    expect(queryByText("Food")).toBeNull()
    expect(queryByText("Health")).toBeNull()
  })

  it("shows the empty state when no items match", () => {
    const { getByPlaceholderText, getByText } = renderSheet()

    fireEvent.changeText(getByPlaceholderText("Search categories..."), "missing")

    expect(getByText("No matches found.")).toBeTruthy()
  })

  it("creates a tag when no exact case-insensitive match exists", () => {
    const onCreate = jest.fn()
    const { getByLabelText, getByPlaceholderText, queryByText } = renderSheet({
      title: "Tags",
      creatable: true,
      multiple: true,
      onCreate,
    })

    fireEvent.changeText(getByPlaceholderText("Search tags..."), "#Recurring")
    fireEvent.press(getByLabelText("Add tag Recurring"))

    expect(onCreate).toHaveBeenCalledWith("Recurring")
    expect(queryByText('Add "Recurring"')).toBeNull()
  })

  it("does not offer to create an existing tag with different casing", () => {
    const { getByPlaceholderText, queryByLabelText } = renderSheet({
      title: "Tags",
      creatable: true,
      multiple: true,
    })

    fireEvent.changeText(getByPlaceholderText("Search tags..."), "FOOD")

    expect(queryByLabelText("Add tag FOOD")).toBeNull()
  })

  it("toggles multiple selections and closes only when Done is pressed", () => {
    const onSelect = jest.fn()
    const onClose = jest.fn()
    const { getByText } = renderSheet({
      multiple: true,
      selectedIds: ["food"],
      onSelect,
      onClose,
    })

    fireEvent.press(getByText("Transport"))
    expect(onSelect).toHaveBeenCalledWith(["food", "transport"])
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.press(getByText("Done"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("pins selected items above unselected results in multi-select mode", () => {
    const { getAllByRole } = renderSheet({
      multiple: true,
      selectedIds: ["health"],
    })

    expect(getAllByRole("checkbox").map((item) => item.props.accessibilityLabel)).toEqual([
      "Health",
      "Food",
      "Transport",
    ])
  })
})
