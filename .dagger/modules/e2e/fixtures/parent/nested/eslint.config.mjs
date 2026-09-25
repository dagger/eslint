// A project nested in parent, with its own config. It fails lint, so parent
// passes only when it leaves this project to be linted on its own.
export default [
  {
    rules: {
      "no-unused-vars": "error",
    },
  },
];
