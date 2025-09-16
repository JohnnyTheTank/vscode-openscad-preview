//@ts-check

'use strict';

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/concepts/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // modules added here also need to be added in the .vscodeignore file
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeScript-SourceMap/fork-ts-checker-webpack-plugin/blob/v6.4.0/README.md#typescript-options
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        // Copy the OpenSCAD WASM files
        {
          from: 'src/wasm',
          to: 'wasm'
        },
        // Copy model-viewer (UMD version for script tag loading)
        {
          from: 'node_modules/@google/model-viewer/dist/model-viewer-umd.min.js',
          to: 'libs/model-viewer.min.js'
        },
        // Copy Three.js r149 (supports global THREE object)
        {
          from: 'node_modules/three/build/three.min.js',
          to: 'libs/three.min.js'
        },
        // Copy our custom wrapper files that work with global THREE
        {
          from: 'src/wasm/STLLoaderWrapper.js',
          to: 'libs/STLLoader.js'
        },
        {
          from: 'src/wasm/GLTFExporterWrapper.js',
          to: 'libs/GLTFExporter.js'
        }
      ]
    })
  ],
};
module.exports = config;