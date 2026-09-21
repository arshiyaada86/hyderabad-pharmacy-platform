module.exports = {
  preset: "jest-expo",
  testTimeout: 60000,
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?/.*|expo.*|@expo/.*|@react-navigation/.*|react-native-.*)/)",
  ],
  collectCoverageFrom: [
    "src/services/{mock,rules}.ts",
    "src/components/{PhotoPicker,ProfileForm,ui}.tsx",
  ],
};
