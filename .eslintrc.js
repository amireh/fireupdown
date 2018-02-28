module.exports = {
  "parserOptions": {
    "sourceType": "script",
    "ecmaVersion": 6
  },

  "rules": {
    "no-undef": 2,
    "no-unused-vars": 2,
    "no-shadow": 2,
    "no-duplicate-imports": 2,
    "no-redeclare": 2,
  },

  "globals": {
    "Promise": false,
    "exports": true
  },
  overrides: [
    {
      files: [ 'lib/__tests__/**' ],
      env: {
        mocha: true,
        node: true,
      }
    }
  ]
}