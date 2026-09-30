export default [
  // Global ignores: the directories below hold ESLint configs of their own,
  // but parent ignores them, so they are not projects.
  {
    ignores: ["ignored-*", "**/vendor/**"],
  },
  {
    rules: {
      "no-unused-vars": "error",
      "prefer-const": "error",
    },
  },
];
