const typescript = require('rollup-plugin-typescript2');
const { nodeResolve } = require('@rollup/plugin-node-resolve');

module.exports = {
  input: 'main.ts',
  output: {
    dir: '.',
    format: 'cjs',
  },
  plugins: [
    nodeResolve({ browser: true }),
    typescript(),
  ],
  external: ['obsidian'],
};
