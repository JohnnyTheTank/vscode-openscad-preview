//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'web', // webview runs in browser context
    mode: 'none',

    entry: './src/wasm/off-glb-converter.ts',
    output: {
        path: path.resolve(__dirname, 'dist/libs'),
        filename: 'off-glb-converter.js',
        library: {
            type: 'umd',
            name: 'OffGlbConverter'
        },
        globalObject: 'this'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            configFile: path.resolve(__dirname, 'src/wasm/tsconfig.json')
                        }
                    }
                ]
            }
        ]
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: "log",
    }
};
module.exports = config;
