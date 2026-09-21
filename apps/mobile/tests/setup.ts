jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon", MaterialCommunityIcons: "Icon" }));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("react-native-screens", () => {
  const actual = jest.requireActual("react-native-screens");
  const View = require("react-native").View;
  const React = require("react");
  const StackItem = ({ children, headerConfig, ...props }: any) =>
    React.createElement(View, props, headerConfig?.children, children);
  return {
    ...actual,
    Screen: View,
    ScreenContainer: View,
    ScreenStack: View,
    ScreenStackItem: StackItem,
    ScreenStackHeaderConfig: View,
    ScreenStackHeaderSubview: View,
  };
});
import { configure } from "@testing-library/react-native";
configure({ asyncUtilTimeout: 15000 });
